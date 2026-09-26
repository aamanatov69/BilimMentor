import { UserRole } from "@prisma/client";
import { Router } from "express";
import { messageController } from "../controllers/messageController";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireRole, verifyToken } from "../middleware/auth";

export const messageRoutes = Router();

messageRoutes.get(
  "/api/users",
  verifyToken,
  requireRole([UserRole.student, UserRole.teacher, UserRole.admin]),
  asyncHandler(messageController.listUsers),
);
messageRoutes.get(
  "/api/messages",
  verifyToken,
  requireRole([UserRole.student, UserRole.teacher, UserRole.admin]),
  asyncHandler(messageController.listMessages),
);
messageRoutes.post(
  "/api/messages",
  verifyToken,
  requireRole([UserRole.student, UserRole.teacher, UserRole.admin]),
  asyncHandler(messageController.sendMessage),
);
