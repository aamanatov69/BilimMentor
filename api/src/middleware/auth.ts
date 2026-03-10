import type { UserRole } from "@prisma/client";
import type { NextFunction, Response } from "express";
import { lmsRepository } from "../repositories/lmsRepository";
import type { AuthenticatedRequest } from "../types/auth";
import { decodeToken } from "../utils/jwt";

const LAST_SEEN_UPDATE_INTERVAL_MS = 60 * 1000;

function getTokenFromCookieHeader(cookieHeader?: string) {
  if (!cookieHeader) {
    return undefined;
  }

  const cookies = cookieHeader.split(";");
  for (const cookie of cookies) {
    const trimmedCookie = cookie.trim();
    if (trimmedCookie.startsWith("bilimMentorToken=")) {
      return decodeURIComponent(
        trimmedCookie.slice("bilimMentorToken=".length),
      );
    }

    // Backward compatibility for old cookie name during transition.
    if (trimmedCookie.startsWith("nexoraToken=")) {
      return decodeURIComponent(trimmedCookie.slice("nexoraToken=".length));
    }
  }

  return undefined;
}

function getRequestToken(req: AuthenticatedRequest) {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : undefined;

  if (bearerToken) {
    return bearerToken;
  }

  const cookieHeader =
    typeof req.headers.cookie === "string" ? req.headers.cookie : undefined;
  return getTokenFromCookieHeader(cookieHeader);
}

export async function verifyToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  const token = getRequestToken(req);

  if (!token) {
    return res.status(401).json({ message: "Требуется токен авторизации" });
  }

  const payload = decodeToken(token);
  if (!payload) {
    return res.status(401).json({ message: "Недействительный токен" });
  }

  const currentUser = await lmsRepository.prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, isBlocked: true, lastSeenAt: true },
  });

  if (!currentUser) {
    return res.status(401).json({ message: "Пользователь не найден" });
  }

  if (currentUser.isBlocked) {
    return res
      .status(403)
      .json({ message: "Пользователь заблокирован администратором" });
  }

  const now = Date.now();
  const lastSeenAtValue = (currentUser as { lastSeenAt?: Date | null })
    .lastSeenAt;
  const lastSeenAtMs = lastSeenAtValue?.getTime() ?? 0;
  if (now - lastSeenAtMs >= LAST_SEEN_UPDATE_INTERVAL_MS) {
    void lmsRepository.prisma.user
      .update({
        where: { id: currentUser.id },
        data: { lastSeenAt: new Date(now) },
      })
      .catch(() => {
        // Ignore activity tracking errors so auth flow remains unaffected.
      });
  }

  req.user = payload;
  return next();
}

export function requireAuth() {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) =>
    verifyToken(req, res, next);
}

export function requireRole(roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const role = req.user?.role;
    if (!role || !roles.includes(role)) {
      return res.status(403).json({ message: "Недостаточно прав" });
    }
    return next();
  };
}
