import { UserRole } from "@prisma/client";
import { Router } from "express";
import { studentController } from "../controllers/studentController";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireRole, verifyToken } from "../middleware/auth";

export const studentRoutes = Router();
studentRoutes.post(
  "/api/student/courses/:id/lessons/:lessonId/view",
  verifyToken,
  requireRole([UserRole.student]),
  asyncHandler(studentController.studentViewLesson),
);

studentRoutes.get(
  "/api/student/courses",
  verifyToken,
  requireRole([UserRole.student]),
  asyncHandler(studentController.studentCourses),
);
studentRoutes.post(
  "/api/student/courses/:id/lessons/:lessonId/completion",
  verifyToken,
  requireRole([UserRole.student]),
  asyncHandler(studentController.studentSetLessonCompletion),
);
studentRoutes.get(
  "/api/student/overview",
  verifyToken,
  requireRole([UserRole.student]),
  asyncHandler(studentController.studentDashboardOverview),
);
studentRoutes.get(
  "/api/student/assignments",
  verifyToken,
  requireRole([UserRole.student]),
  asyncHandler(studentController.studentAssignments),
);
studentRoutes.get(
  "/api/student/grades",
  verifyToken,
  requireRole([UserRole.student]),
  asyncHandler(studentController.studentGradesOverview),
);
studentRoutes.post(
  "/api/student/assignments/:id/submit",
  verifyToken,
  requireRole([UserRole.student]),
  asyncHandler(studentController.studentSubmitAssignment),
);
studentRoutes.post(
  "/api/student/course-access-requests",
  verifyToken,
  requireRole([UserRole.student]),
  asyncHandler(studentController.studentRequestCourseAccess),
);
studentRoutes.get(
  "/api/student/course-access-requests",
  verifyToken,
  requireRole([UserRole.student]),
  asyncHandler(studentController.studentListCourseAccessRequests),
);

