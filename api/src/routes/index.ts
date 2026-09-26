import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/asyncHandler";
import type { AuthenticatedRequest } from "../types/auth";
import { adminRoutes } from "./adminRoutes";
import { authRoutes } from "./authRoutes";
import { courseRoutes } from "./courseRoutes";
import { messageRoutes } from "./messageRoutes";
import { notificationRoutes } from "./notificationRoutes";
import { studentRoutes } from "./studentRoutes";
import { teacherRoutes } from "./teacherRoutes";

export const lmsRoutes = Router();

lmsRoutes.get(
  "/health",
  asyncHandler(async (_req: AuthenticatedRequest, res) => {
    res.json({ status: "ok", service: "bilimmentor-api" });
  }),
);

lmsRoutes.get("/ready", asyncHandler(async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("Database check timed out")), 5000);
      }),
    ]);
    res.json({ status: "ready", database: "available" });
  } catch {
    res.status(503).json({ status: "not_ready", database: "unavailable" });
  } finally {
    clearTimeout(timer);
  }
}));

lmsRoutes.use(authRoutes);
lmsRoutes.use(courseRoutes);
lmsRoutes.use(studentRoutes);
lmsRoutes.use(teacherRoutes);
lmsRoutes.use(notificationRoutes);
lmsRoutes.use(messageRoutes);
lmsRoutes.use(adminRoutes);
