import type { Response } from "express";
import * as studentService from "../services/studentService";
import type { AuthenticatedRequest } from "../types/auth";

export const studentController = {
  studentViewLesson: async (req: AuthenticatedRequest, res: Response) => {
    res.json(await studentService.studentViewLesson(req.user?.sub, String(req.params.id), String(req.params.lessonId)));
  },
  studentRequestCourseAccess: async (
    req: AuthenticatedRequest,
    res: Response,
  ) => {
    const result = await studentService.studentRequestCourseAccess(
      req.user?.sub,
      req.body,
    );
    res.status(201).json(result);
  },


  studentListCourseAccessRequests: async (
    req: AuthenticatedRequest,
    res: Response,
  ) => {
    const result = await studentService.studentListCourseAccessRequests(
      req.user?.sub,
    );
    res.json(result);
  },


  studentDashboardOverview: async (
    req: AuthenticatedRequest,
    res: Response,
  ) => {
    const result = await studentService.studentDashboardOverview(req.user?.sub);
    res.json(result);
  },


  studentAssignments: async (req: AuthenticatedRequest, res: Response) => {
    const result = await studentService.studentAssignments(req.user?.sub);
    res.json(result);
  },


  studentGradesOverview: async (req: AuthenticatedRequest, res: Response) => {
    const result = await studentService.studentGradesOverview(req.user?.sub);
    res.json(result);
  },


  studentSubmitAssignment: async (req: AuthenticatedRequest, res: Response) => {
    const result = await studentService.studentSubmitAssignment(
      req.user?.sub,
      String(req.params.id),
      req.body,
    );
    res.status(201).json(result);
  },


  studentCourses: async (req: AuthenticatedRequest, res: Response) => {
    const result = await studentService.studentCourses(req.user?.sub);
    res.json(result);
  },


  studentSetLessonCompletion: async (
    req: AuthenticatedRequest,
    res: Response,
  ) => {
    const result = await studentService.studentSetLessonCompletion(
      req.user?.sub,
      String(req.params.id),
      String(req.params.lessonId),
      req.body?.completed,
    );
    res.json(result);
  },
};
