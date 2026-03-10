import rateLimit from "express-rate-limit";

const oneMinuteMs = 60_000;
const tenMinutesMs = 10 * oneMinuteMs;

export const authRateLimit = rateLimit({
  windowMs: tenMinutesMs,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Слишком много попыток. Попробуйте позже." },
});

export const passwordResetRateLimit = rateLimit({
  windowMs: tenMinutesMs,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Слишком много запросов на сброс пароля. Попробуйте позже.",
  },
});
