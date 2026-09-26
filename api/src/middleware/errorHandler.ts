import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/httpError";

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (error && typeof error === "object" && "type" in error && "status" in error) {
    if (error.type === "entity.too.large" && error.status === 413) {
      return res.status(413).json({ message: "Запрос слишком большой. Уменьшите размер вложений или текста ответа." });
    }
    if (error.type === "entity.parse.failed" && error.status === 400) {
      return res.status(400).json({ message: "Некорректный формат JSON в запросе." });
    }
  }
  if (error instanceof HttpError) {
    return res.status(error.status).json({ message: error.message });
  }

  console.error(error);
  return res.status(500).json({ message: "Внутренняя ошибка сервера" });
}
