import type { UserRole } from "@prisma/client";
import jwt from "jsonwebtoken";
import type { JwtPayload } from "../types/auth";

const JWT_EXPIRES_IN = "1d";
const COURSE_INVITE_EXPIRES_IN = "30d";
const COURSE_INVITE_TYPE = "course_invite";

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

type CourseInviteTokenPayload = {
  typ: string;
  courseId?: string;
  teacherId?: string;
  exp?: number;
};

export type VerifiedCourseInvite = {
  courseId: string;
  teacherId: string;
  expiresAt: string | null;
};

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

export function createCourseInviteToken(input: {
  courseId: string;
  teacherId: string;
}) {
  return jwt.sign(
    {
      typ: COURSE_INVITE_TYPE,
      courseId: input.courseId,
      teacherId: input.teacherId,
    },
    JWT_SECRET,
    {
      expiresIn: COURSE_INVITE_EXPIRES_IN,
    },
  );
}

export function verifyCourseInviteToken(
  token: string,
): VerifiedCourseInvite | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as CourseInviteTokenPayload;
    if (typeof decoded === "string") {
      return null;
    }

    if (
      decoded.typ !== COURSE_INVITE_TYPE ||
      typeof decoded.courseId !== "string" ||
      !decoded.courseId.trim() ||
      typeof decoded.teacherId !== "string" ||
      !decoded.teacherId.trim()
    ) {
      return null;
    }

    return {
      courseId: decoded.courseId,
      teacherId: decoded.teacherId,
      expiresAt:
        typeof decoded.exp === "number"
          ? new Date(decoded.exp * 1000).toISOString()
          : null,
    };
  } catch {
    return null;
  }
}
