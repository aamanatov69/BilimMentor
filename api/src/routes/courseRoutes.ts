import { UserRole } from "@prisma/client";
import { Router } from "express";
import { courseController } from "../controllers/courseController";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth, requireRole } from "../middleware/auth";

export const courseRoutes = Router();

courseRoutes.get("/api/public/courses", asyncHandler(courseController.publicCourses));
courseRoutes.get("/api/public/stats", asyncHandler(courseController.publicStats));

courseRoutes.get(
  "/api/courses",
  requireAuth(),
  requireRole([UserRole.student, UserRole.teacher, UserRole.admin]),
  asyncHandler(courseController.listCourses),
);
courseRoutes.get(
  "/api/courses/:id",
  requireAuth(),
  requireRole([UserRole.student, UserRole.teacher, UserRole.admin]),
  asyncHandler(courseController.getCourseById),
);
courseRoutes.post(
  "/api/courses",
  requireAuth(),
  requireRole([UserRole.admin]),
  asyncHandler(courseController.createCourseLegacy),
);

courseRoutes.get(
  "/api/student/courses/discover",
  requireAuth(),
  requireRole([UserRole.student]),
  asyncHandler(courseController.discoverCourses),
);

