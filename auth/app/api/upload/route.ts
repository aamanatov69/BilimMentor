import { jwtVerify } from "jose";
import { MAX_UPLOAD_SIZE_BYTES, sanitizeUploadImage } from "@/lib/upload-image";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";

const JWT_SECRET = process.env.JWT_SECRET?.trim();
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is required for upload route");
}
const secret = new TextEncoder().encode(JWT_SECRET);

async function isAuthenticated() {
  const token = (await cookies()).get("bilimMentorToken")?.value;
  if (!token) {
    return false;
  }

  try {
    const { payload } = await jwtVerify(token, secret);
    if (!payload.sub || !["admin", "teacher", "student"].includes(String(payload.role))) return false;
    const apiUrl = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) throw new Error("API URL is required for upload authentication");
    const response = await fetch(`${apiUrl.replace(/\/$/, "")}/api/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json(
        { message: "Требуется авторизация" },
        { status: 401 },
      );
    }

    const formData = await request.formData();
    const fileValue = formData.get("file");

    if (!(fileValue instanceof File)) {
      return NextResponse.json({ message: "Файл не найден" }, { status: 400 });
    }

    if (
      !fileValue.type.startsWith("image/") ||
      fileValue.type.toLowerCase() === "image/svg+xml"
    ) {
      return NextResponse.json(
        { message: "Можно загружать только изображения" },
        { status: 400 },
      );
    }

    if (fileValue.size <= 0 || fileValue.size > MAX_UPLOAD_SIZE_BYTES) {
      return NextResponse.json(
        { message: "Размер изображения должен быть до 10 МБ" },
        { status: 400 },
      );
    }

    let bytes: Buffer;
    try {
      bytes = await sanitizeUploadImage(Buffer.from(await fileValue.arrayBuffer()), fileValue.type);
    } catch {
      return NextResponse.json(
        { message: "Не удалось обработать изображение. Используйте исправный PNG, JPEG, WebP или GIF до 10 МБ и 24 млн пикселей суммарно по кадрам." },
        { status: 400 },
      );
    }
    const fileName = `${randomUUID()}.webp`;

    const uploadDir = join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });

    await writeFile(join(uploadDir, fileName), bytes);

    return NextResponse.json({ url: `/uploads/${fileName}` });
  } catch {
    return NextResponse.json(
      { message: "Ошибка загрузки файла" },
      { status: 500 },
    );
  }
}
