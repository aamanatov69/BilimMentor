import { Router } from "express";
import { authController } from "../controllers/authController";
import { asyncHandler } from "../middleware/asyncHandler";
import { verifyToken } from "../middleware/auth";
import { authRateLimit, passwordResetRateLimit } from "../middleware/rateLimit";

export const authRoutes = Router();

authRoutes.post(
  "/api/auth/register",
  authRateLimit,
  asyncHandler(authController.register),
);
authRoutes.post(
  "/api/auth/login",
  authRateLimit,
  asyncHandler(authController.login),
);
authRoutes.post("/api/auth/logout", asyncHandler(authController.logout));
authRoutes.post(
  "/api/auth/forgot-password",
  passwordResetRateLimit,
  asyncHandler(authController.forgotPassword),
);
authRoutes.post(
  "/api/auth/reset-password",
  passwordResetRateLimit,
  asyncHandler(authController.resetPassword),
);
authRoutes.get(
  "/api/auth/reset-password/validate",
  passwordResetRateLimit,
  asyncHandler(authController.validateResetPasswordToken),
);
authRoutes.get("/api/me", verifyToken, asyncHandler(authController.me));
