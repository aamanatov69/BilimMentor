import type { UserRole } from "@prisma/client";
import jwt from "jsonwebtoken";
import type { JwtPayload } from "../types/auth";

const JWT_EXPIRES_IN = "1d";

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

function getRequiredJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    throw new Error("JWT_SECRET is not defined");
  }

  if (process.env.NODE_ENV === "production" && isWeakJwtSecret(secret)) {
    throw new Error("JWT_SECRET is too weak for production");
  }

  return secret;
}

const JWT_SECRET = getRequiredJwtSecret();

export function createToken(user: { id: string; role: UserRole }) {
  return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

export function decodeToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (typeof decoded === "string" || !decoded.sub || !decoded.role) {
      return null;
    }

    if (
      decoded.role !== "student" &&
      decoded.role !== "teacher" &&
      decoded.role !== "admin"
    ) {
      return null;
    }

    return {
      sub: String(decoded.sub),
      role: decoded.role,
    };
  } catch {
    return null;
  }
}
