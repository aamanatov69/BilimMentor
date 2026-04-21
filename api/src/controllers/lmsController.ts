import type { Response } from "express";
import * as lmsService from "../services/lmsService";
import type { AuthenticatedRequest } from "../types/auth";

const authCookieMaxAgeMs = 24 * 60 * 60 * 1000;

function isSecureCookie() {
  return process.env.NODE_ENV === "production";
}

function setAuthCookie(res: Response, token: string) {
  res.cookie("bilimMentorToken", token, {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: "lax",
    path: "/",
    maxAge: authCookieMaxAgeMs,
  });
}

function clearAuthCookie(res: Response) {
  res.clearCookie("bilimMentorToken", {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: "lax",
    path: "/",
  });
}

export const lmsController = {
  health: async (_req: AuthenticatedRequest, res: Response) => {
    res.json({ status: "ok", service: "bilimmentor-api" });
  },

  register: async (req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.register(req.body);
    setAuthCookie(res, result.token);
    const { token: _token, ...payload } = result;
    res.status(201).json(payload);
  },

  login: async (req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.login(req.body);
    setAuthCookie(res, result.token);
    const { token: _token, ...payload } = result;
    res.json(payload);
  },

  logout: async (_req: AuthenticatedRequest, res: Response) => {
    clearAuthCookie(res);
    res.json({ message: "Выход выполнен" });
  },

  forgotPassword: async (req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.requestPasswordReset(req.body);
    res.json(result);
  },

  resetPassword: async (req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.resetPasswordByToken(req.body);
    res.json(result);
  },

  validateResetPasswordToken: async (
    req: AuthenticatedRequest,
    res: Response,
  ) => {
    const token =
      typeof req.query.token === "string" ? req.query.token : undefined;
    const result = await lmsService.validateResetPasswordToken({ token });
    res.json(result);
  },

  me: async (req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.me(req.user?.sub);
    res.json(result);
  },

  listCourses: async (req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.listCourses(req.user?.sub);
    res.json(result);
  },

  getCourseById: async (req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.getCourseById(
      String(req.params.id),
      req.user?.sub,
    );
    res.json(result);
  },

  createCourseLegacy: async (req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.createCourseLegacy(req.body);
    res.status(201).json(result);
  },

  discoverCourses: async (req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.discoverStudentCourses(req.user?.sub);
    res.json(result);
  },

  publicCourses: async (_req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.listPublicCourses();
    res.json(result);
  },

  publicStats: async (_req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.getPublicStats();
    res.json(result);
  },

  notifications: async (req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.listNotifications(req.user?.sub);
    res.json(result);
  },

  unreadNotificationCount: async (req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.getUnreadNotificationCount(req.user?.sub);
    res.json(result);
  },

  markNotificationAsRead: async (req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.markNotificationAsRead(
      req.user?.sub,
      String(req.params.id),
    );
    res.json(result);
  },

  markAllNotificationsAsRead: async (
    req: AuthenticatedRequest,
    res: Response,
  ) => {
    const result = await lmsService.markAllNotificationsAsRead(req.user?.sub);
    res.json(result);
  },

  listUsers: async (req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.listUsersForMessaging(
      req.user?.sub,
      req.query.role,
    );
    res.json(result);
  },

  listMessages: async (req: AuthenticatedRequest, res: Response) => {
    const withUserId =
      typeof req.query.withUserId === "string"
        ? req.query.withUserId
        : undefined;
    const result = await lmsService.listMessages(
      req.user?.sub,
      withUserId,
      req.query.withRole,
    );
    res.json(result);
  },

  sendMessage: async (req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.sendMessage(req.user?.sub, req.body);
    res.status(201).json(result);
  },

  adminOverview: async (_req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.adminOverview();
    res.json(result);
  },

  adminListUsers: async (_req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.adminListUsers();
    res.json(result);
  },

  adminCreateUser: async (req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.adminCreateUser(req.body);
    res.status(201).json(result);
  },

  adminUpdateUser: async (req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.adminUpdateUser(
      req.user?.sub,
      String(req.params.id),
      req.body,
    );
    res.json(result);
  },

  adminDeleteUser: async (req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.adminDeleteUser(
      req.user?.sub,
      String(req.params.id),
    );
    res.json(result);
  },

  adminBlockUser: async (req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.adminBlockUser(
      req.user?.sub,
      String(req.params.id),
    );
    res.json(result);
  },

  adminUnblockUser: async (req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.adminUnblockUser(
      req.user?.sub,
      String(req.params.id),
    );
    res.json(result);
  },

  adminResetUserPassword: async (req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.adminResetUserPassword(
      req.user?.sub,
      String(req.params.id),
      req.body?.password,
    );
    res.json(result);
  },

  adminCreateCourse: async (req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.adminCreateCourse(req.body);
    res.status(201).json(result);
  },

  adminUpdateCourse: async (req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.adminUpdateCourse(
      String(req.params.id),
      req.body,
    );
    res.json(result);
  },

  adminCourseDetails: async (req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.adminCourseDetails(String(req.params.id));
    res.json(result);
  },

  adminCreateLesson: async (req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.adminCreateLesson(
      String(req.params.id),
      req.body,
    );
    res.status(201).json(result);
  },

  adminUpdateLesson: async (req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.adminUpdateLesson(
      String(req.params.id),
      String(req.params.lessonId),
      req.body,
    );
    res.json(result);
  },

  adminDeleteLesson: async (req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.adminDeleteLesson(
      String(req.params.id),
      String(req.params.lessonId),
    );
    res.json(result);
  },

  adminDeleteCourse: async (req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.adminDeleteCourse(String(req.params.id));
    res.json(result);
  },

  adminBulkCourses: async (req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.adminBulkCourses(req.body);
    res.json(result);
  },

  adminCourseStudents: async (req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.adminCourseStudents(String(req.params.id));
    res.json(result);
  },

  adminSetCourseStudentEnrollment: async (
    req: AuthenticatedRequest,
    res: Response,
  ) => {
    const result = await lmsService.adminSetCourseStudentEnrollment(
      String(req.params.id),
      String(req.params.studentId),
      req.body?.enrolled,
    );
    res.json(result);
  },

  adminReports: async (_req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.adminReports();
    res.json(result);
  },

  adminRunBackup: async (_req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.adminRunBackup();
    res.json(result);
  },

  adminRunRestore: async (_req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.adminRunRestore();
    res.json(result);
  },

  adminSettingsOverview: async (_req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.adminSettingsOverview();
    res.json(result);
  },

  studentRequestCourseAccess: async (
    req: AuthenticatedRequest,
    res: Response,
  ) => {
    const result = await lmsService.studentRequestCourseAccess(
      req.user?.sub,
      req.body,
    );
    res.status(201).json(result);
  },

  studentListCourseAccessRequests: async (
    req: AuthenticatedRequest,
    res: Response,
  ) => {
    const result = await lmsService.studentListCourseAccessRequests(
      req.user?.sub,
    );
    res.json(result);
  },

  teacherListCourseAccessRequests: async (
    req: AuthenticatedRequest,
    res: Response,
  ) => {
    const result = await lmsService.teacherListCourseAccessRequests(
      req.user?.sub,
      req.query.status,
    );
    res.json(result);
  },

  adminListCourseAccessRequests: async (
    req: AuthenticatedRequest,
    res: Response,
  ) => {
    const result = await lmsService.adminListCourseAccessRequests(
      req.query.status,
    );
    res.json(result);
  },

  teacherReviewCourseAccessRequest: async (
    req: AuthenticatedRequest,
    res: Response,
  ) => {
    const result = await lmsService.teacherReviewCourseAccessRequest(
      req.user?.sub,
      String(req.params.id),
      req.body?.status,
    );
    res.json(result);
  },

  teacherCourses: async (req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.teacherCourses(req.user?.sub);
    res.json(result);
  },

  teacherCourseDetails: async (req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.teacherCourseDetails(
      req.user?.sub,
      String(req.params.id),
    );
    res.json(result);
  },

  teacherCreateCourseShareInvite: async (
    req: AuthenticatedRequest,
    res: Response,
  ) => {
    const result = await lmsService.teacherCreateCourseShareInvite(
      req.user?.sub,
      String(req.params.id),
    );
    res.json(result);
  },

  teacherCreateCourse: async (req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.teacherCreateCourse(
      req.user?.sub,
      req.body,
    );
    res.status(201).json(result);
  },

  teacherSetCourseVisibility: async (
    req: AuthenticatedRequest,
    res: Response,
  ) => {
    const result = await lmsService.teacherSetCourseVisibility(
      req.user?.sub,
      String(req.params.id),
      req.body?.isPublished,
    );
    res.json(result);
  },

  teacherCompleteCourse: async (req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.teacherCompleteCourse(
      req.user?.sub,
      String(req.params.id),
    );
    res.json(result);
  },

  teacherUpdateCourse: async (req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.teacherUpdateCourse(
      req.user?.sub,
      String(req.params.id),
      req.body,
    );
    res.json(result);
  },

  teacherDeleteCourse: async (req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.teacherDeleteCourse(
      req.user?.sub,
      String(req.params.id),
    );
    res.json(result);
  },

  teacherCreateAssignment: async (req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.teacherCreateAssignment(
      req.user?.sub,
      String(req.params.id),
      req.body,
    );
    res.status(201).json(result);
  },

  teacherUpdateAssignmentDeadline: async (
    req: AuthenticatedRequest,
    res: Response,
  ) => {
    const result = await lmsService.teacherUpdateAssignmentDeadline(
      req.user?.sub,
      String(req.params.id),
      req.body?.dueAt,
    );
    res.json(result);
  },

  teacherUploadMaterial: async (req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.teacherUploadMaterial(
      req.user?.sub,
      String(req.params.id),
      req.body,
    );
    res.status(201).json(result);
  },

  teacherCreateLesson: async (req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.teacherCreateLesson(
      req.user?.sub,
      String(req.params.id),
      req.body,
    );
    res.status(201).json(result);
  },

  teacherUpdateLesson: async (req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.teacherUpdateLesson(
      req.user?.sub,
      String(req.params.id),
      String(req.params.lessonId),
      req.body,
    );
    res.json(result);
  },

  teacherDeleteLesson: async (req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.teacherDeleteLesson(
      req.user?.sub,
      String(req.params.id),
      String(req.params.lessonId),
    );
    res.json(result);
  },

  teacherReorderLessons: async (req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.teacherReorderLessons(
      req.user?.sub,
      String(req.params.id),
      req.body?.lessonIds,
    );
    res.json(result);
  },

  teacherAddLessonMaterial: async (
    req: AuthenticatedRequest,
    res: Response,
  ) => {
    const result = await lmsService.teacherAddLessonMaterial(
      req.user?.sub,
      String(req.params.id),
      String(req.params.lessonId),
      req.body,
    );
    res.status(201).json(result);
  },

  teacherSetLessonVisibility: async (
    req: AuthenticatedRequest,
    res: Response,
  ) => {
    const result = await lmsService.teacherSetLessonVisibility(
      req.user?.sub,
      String(req.params.id),
      String(req.params.lessonId),
      req.body?.isVisibleToStudents,
    );
    res.json(result);
  },

  teacherMessageStudent: async (req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.teacherMessageStudent(
      req.user?.sub,
      String(req.params.id),
      String(req.params.studentId),
      req.body?.message,
    );
    res.status(201).json(result);
  },

  teacherCommentSubmission: async (
    req: AuthenticatedRequest,
    res: Response,
  ) => {
    const result = await lmsService.teacherCommentSubmission(
      req.user?.sub,
      String(req.params.id),
      req.body?.comment,
    );
    res.json(result);
  },

  teacherGradeSubmission: async (req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.teacherGradeSubmission(
      req.user?.sub,
      String(req.params.id),
      req.body?.score,
      req.body?.feedback,
    );
    res.json(result);
  },

  teacherGradesOverview: async (req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.teacherGradesOverview(req.user?.sub);
    res.json(result);
  },

  teacherDashboardOverview: async (
    req: AuthenticatedRequest,
    res: Response,
  ) => {
    const result = await lmsService.teacherDashboardOverview(req.user?.sub);
    res.json(result);
  },

  studentDashboardOverview: async (
    req: AuthenticatedRequest,
    res: Response,
  ) => {
    const result = await lmsService.studentDashboardOverview(req.user?.sub);
    res.json(result);
  },

  studentAssignments: async (req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.studentAssignments(req.user?.sub);
    res.json(result);
  },

  studentGradesOverview: async (req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.studentGradesOverview(req.user?.sub);
    res.json(result);
  },

  studentSubmitAssignment: async (req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.studentSubmitAssignment(
      req.user?.sub,
      String(req.params.id),
      req.body,
    );
    res.status(201).json(result);
  },

  studentCourses: async (req: AuthenticatedRequest, res: Response) => {
    const result = await lmsService.studentCourses(req.user?.sub);
    res.json(result);
  },

  studentSetLessonCompletion: async (
    req: AuthenticatedRequest,
    res: Response,
  ) => {
    const result = await lmsService.studentSetLessonCompletion(
      req.user?.sub,
      String(req.params.id),
      String(req.params.lessonId),
      req.body?.completed,
    );
    res.json(result);
  },
};
