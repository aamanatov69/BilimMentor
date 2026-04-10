import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

export const runtime = "nodejs";

const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;

function extensionFromFile(file: File) {
  const fromName = extname(file.name || "").toLowerCase();
  if (fromName) {
    return fromName;
  }

  const mime = (file.type || "").toLowerCase();
  if (mime === "image/png") return ".png";
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/webp") return ".webp";
  if (mime === "image/gif") return ".gif";
  if (mime === "image/svg+xml") return ".svg";

  return ".png";
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const fileValue = formData.get("file");

    if (!(fileValue instanceof File)) {
      return NextResponse.json({ message: "Файл не найден" }, { status: 400 });
    }

    if (!fileValue.type.startsWith("image/")) {
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

    const extension = extensionFromFile(fileValue);
    const fileName = `${Date.now()}-${randomUUID()}${extension}`;

    const uploadDir = join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });

    const bytes = Buffer.from(await fileValue.arrayBuffer());
    await writeFile(join(uploadDir, fileName), bytes);

    return NextResponse.json({ url: `/uploads/${fileName}` });
  } catch {
    return NextResponse.json(
      { message: "Ошибка загрузки файла" },
      { status: 500 },
    );
  }
}
