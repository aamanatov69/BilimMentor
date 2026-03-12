import { jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";

type UserRole = "student" | "teacher" | "admin";

type TokenPayload = {
  role: UserRole;
};

const disallowedProductionSecrets = new Set([
  "change-me-in-production",
  "changeme",
  "secret",
  "default",
]);

function isWeakJwtSecret(secret: string) {
  if (secret.length < 32) {
    return true;
  }

  return disallowedProductionSecrets.has(secret.trim().toLowerCase());
}

const roleToPath: Record<UserRole, string> = {
  admin: "/dashboard/admin",
  teacher: "/dashboard/teacher",
  student: "/dashboard/student",
};

const JWT_SECRET = process.env.JWT_SECRET?.trim();
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is required for dashboard middleware");
}

if (process.env.NODE_ENV === "production" && isWeakJwtSecret(JWT_SECRET)) {
  throw new Error("JWT_SECRET is too weak for production");
}

const secret = new TextEncoder().encode(JWT_SECRET);

async function getTokenPayload(
  request: NextRequest,
): Promise<TokenPayload | null> {
  const token = request.cookies.get("bilimMentorToken")?.value;
  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, secret);
    if (!payload.role || typeof payload.role !== "string") {
      return null;
    }

    if (
      payload.role !== "admin" &&
      payload.role !== "teacher" &&
      payload.role !== "student"
    ) {
      return null;
    }

    return { role: payload.role as UserRole };
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const payload = await getTokenPayload(request);

  if ((pathname === "/login" || pathname === "/register") && payload) {
    return NextResponse.redirect(
      new URL(roleToPath[payload.role], request.url),
    );
  }

  if (pathname.startsWith("/dashboard")) {
    if (!payload) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    if (pathname.startsWith("/dashboard/admin") && payload.role !== "admin") {
      return NextResponse.redirect(
        new URL(roleToPath[payload.role], request.url),
      );
    }

    if (
      pathname.startsWith("/dashboard/teacher") &&
      payload.role !== "teacher" &&
      payload.role !== "admin"
    ) {
      return NextResponse.redirect(
        new URL(roleToPath[payload.role], request.url),
      );
    }

    if (
      pathname.startsWith("/dashboard/student") &&
      payload.role !== "student" &&
      payload.role !== "admin"
    ) {
      return NextResponse.redirect(
        new URL(roleToPath[payload.role], request.url),
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/register"],
};
