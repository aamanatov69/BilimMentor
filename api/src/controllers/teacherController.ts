import type { Response } from "express";
import * as teacherService from "../services/teacherService";
import type { AuthenticatedRequest } from "../types/auth";

export const teacherController = {
  teacherListCourseAccessRequests: async (
    req: AuthenticatedRequest,
    res: Response,
  ) => {
    const result = await teacherService.teacherListCourseAccessRequests(
      req.user?.sub,
      req.query.status,
    );
    res.json(result);
  },


  teacherReviewCourseAccessRequest: async (
    req: AuthenticatedRequest,
    res: Response,
  ) => {
    const result = await teacherService.teacherReviewCourseAccessRequest(
      req.user?.sub,
      String(req.params.id),
      req.body?.status,
    );
    res.json(result);
  },


  teacherCourses: async (req: AuthenticatedRequest, res: Response) => {
    const result = await teacherService.teacherCourses(req.user?.sub);
    res.json(result);
  },


  teacherCourseDetails: async (req: AuthenticatedRequest, res: Response) => {
    const result = await teacherService.teacherCourseDetails(
      req.user?.sub,
      String(req.params.id),
    );
    res.json(result);
  },


  teacherCreateCourseShareInvite: async (
    req: AuthenticatedRequest,
    res: Response,
  ) => {
    const result = await teacherService.teacherCreateCourseShareInvite(
      req.user?.sub,
      String(req.params.id),
    );
    res.json(result);
  },


  teacherCreateCourse: async (req: AuthenticatedRequest, res: Response) => {
    const result = await teacherService.teacherCreateCourse(
      req.user?.sub,
      req.body,
    );
    res.status(201).json(result);
  },


  teacherSetCourseVisibility: async (
    req: AuthenticatedRequest,
    res: Response,
  ) => {
    const result = await teacherService.teacherSetCourseVisibility(
      req.user?.sub,
      String(req.params.id),
      req.body?.isPublished,
    );
    res.json(result);
  },


  teacherCompleteCourse: async (req: AuthenticatedRequest, res: Response) => {
    const result = await teacherService.teacherCompleteCourse(
      req.user?.sub,
      String(req.params.id),
    );
    res.json(result);
  },


  teacherUpdateCourse: async (req: AuthenticatedRequest, res: Response) => {
    const result = await teacherService.teacherUpdateCourse(
      req.user?.sub,
      String(req.params.id),
      req.body,
    );
    res.json(result);
  },


  teacherDeleteCourse: async (req: AuthenticatedRequest, res: Response) => {
    const result = await teacherService.teacherDeleteCourse(
      req.user?.sub,
      String(req.params.id),
    );
    res.json(result);
  },


  teacherCreateAssignment: async (req: AuthenticatedRequest, res: Response) => {
    const result = await teacherService.teacherCreateAssignment(
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
    const result = await teacherService.teacherUpdateAssignmentDeadline(
      req.user?.sub,
      String(req.params.id),
      req.body?.dueAt,
    );
    res.json(result);
  },


  teacherUpdateAssignment: async (req: AuthenticatedRequest, res: Response) => {
    const result = await teacherService.teacherUpdateAssignment(
      req.user?.sub,
      String(req.params.id),
      req.body,
    );
    res.json(result);
  },


  teacherDeleteAssignment: async (req: AuthenticatedRequest, res: Response) => {
    const result = await teacherService.teacherDeleteAssignment(
      req.user?.sub,
      String(req.params.id),
    );
    res.json(result);
  },


  teacherUploadMaterial: async (req: AuthenticatedRequest, res: Response) => {
    const result = await teacherService.teacherUploadMaterial(
      req.user?.sub,
      String(req.params.id),
      req.body,
    );
    res.status(201).json(result);
  },


  teacherCreateLesson: async (req: AuthenticatedRequest, res: Response) => {
    const result = await teacherService.teacherCreateLesson(
      req.user?.sub,
      String(req.params.id),
      req.body,
    );
    res.status(201).json(result);
  },


  teacherUpdateLesson: async (req: AuthenticatedRequest, res: Response) => {
    const result = await teacherService.teacherUpdateLesson(
      req.user?.sub,
      String(req.params.id),
      String(req.params.lessonId),
      req.body,
    );
    res.json(result);
  },


  teacherDeleteLesson: async (req: AuthenticatedRequest, res: Response) => {
    const result = await teacherService.teacherDeleteLesson(
      req.user?.sub,
      String(req.params.id),
      String(req.params.lessonId),
    );
    res.json(result);
  },


  teacherReorderLessons: async (req: AuthenticatedRequest, res: Response) => {
    const result = await teacherService.teacherReorderLessons(
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
    const result = await teacherService.teacherAddLessonMaterial(
      req.user?.sub,
      String(req.params.id),
      String(req.params.lessonId),
      req.body,
    );
    res.status(201).json(result);
  },


  teacherDeleteLessonMaterial: async (
    req: AuthenticatedRequest,
    res: Response,
  ) => {
    const result = await teacherService.teacherDeleteLessonMaterial(
      req.user?.sub,
      String(req.params.id),
      String(req.params.lessonId),
      String(req.params.materialId),
    );
    res.json(result);
  },


  teacherSetLessonVisibility: async (
    req: AuthenticatedRequest,
    res: Response,
  ) => {
    const result = await teacherService.teacherSetLessonVisibility(
      req.user?.sub,
      String(req.params.id),
      String(req.params.lessonId),
      req.body?.isVisibleToStudents,
    );
    res.json(result);
  },


  teacherMessageStudent: async (req: AuthenticatedRequest, res: Response) => {
    const result = await teacherService.teacherMessageStudent(
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
    const result = await teacherService.teacherCommentSubmission(
      req.user?.sub,
      String(req.params.id),
      req.body?.comment,
    );
    res.json(result);
  },


  teacherGradeSubmission: async (req: AuthenticatedRequest, res: Response) => {
    const result = await teacherService.teacherGradeSubmission(
      req.user?.sub,
      String(req.params.id),
      req.body?.score,
      req.body?.feedback,
    );
    res.json(result);
  },


  teacherGradesOverview: async (req: AuthenticatedRequest, res: Response) => {
    const result = await teacherService.teacherGradesOverview(req.user?.sub);
    res.json(result);
  },


  teacherDashboardOverview: async (
    req: AuthenticatedRequest,
    res: Response,
  ) => {
    const result = await teacherService.teacherDashboardOverview(req.user?.sub);
    res.json(result);
  },

};
