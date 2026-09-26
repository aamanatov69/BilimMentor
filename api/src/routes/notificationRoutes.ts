import { UserRole } from "@prisma/client";
import { Router } from "express";
import { notificationController } from "../controllers/notificationController";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireRole, verifyToken } from "../middleware/auth";

export const notificationRoutes = Router();

notificationRoutes.get(
  "/api/notifications",
  verifyToken,
  requireRole([UserRole.student, UserRole.teacher, UserRole.admin]),
  asyncHandler(notificationController.notifications),
);

notificationRoutes.get(
  "/api/notifications/unread-count",
  verifyToken,
  requireRole([UserRole.student, UserRole.teacher, UserRole.admin]),
  asyncHandler(notificationController.unreadNotificationCount),
);

notificationRoutes.patch(
  "/api/notifications/:id/read",
  verifyToken,
  requireRole([UserRole.student, UserRole.teacher, UserRole.admin]),
  asyncHandler(notificationController.markNotificationAsRead),
);

notificationRoutes.patch(
  "/api/notifications/read/all",
  verifyToken,
  requireRole([UserRole.student, UserRole.teacher, UserRole.admin]),
  asyncHandler(notificationController.markAllNotificationsAsRead),
);

