import type { Request } from "express";
import rateLimit from "express-rate-limit";

const oneMinuteMs = 60_000;
const tenMinutesMs = 10 * oneMinuteMs;

function resolveClientIp(request: Request) {
  const xForwardedFor = request.headers["x-forwarded-for"];

  if (typeof xForwardedFor === "string") {
    const firstIp = xForwardedFor.split(",")[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }

  if (Array.isArray(xForwardedFor) && xForwardedFor.length > 0) {
    const firstIp = xForwardedFor[0]?.split(",")[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }

  return request.ip ?? request.socket.remoteAddress ?? "unknown";
}

export const authRateLimit = rateLimit({
  windowMs: tenMinutesMs,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: resolveClientIp,
  validate: { xForwardedForHeader: false },
  message: { message: "Слишком много попыток. Попробуйте позже." },
});

export const passwordResetRateLimit = rateLimit({
  windowMs: tenMinutesMs,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: resolveClientIp,
  validate: { xForwardedForHeader: false },
  message: {
    message: "Слишком много запросов на сброс пароля. Попробуйте позже.",
  },
});
