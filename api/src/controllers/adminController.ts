import type { Response } from "express";
import { listAdminCourses } from "../services/adminCourseListService";
import * as adminService from "../services/adminService";
import type { AuthenticatedRequest } from "../types/auth";

export const adminController = {
  adminListCourses: async (req: AuthenticatedRequest, res: Response) => {
    res.json(await listAdminCourses(req.query));
  },
  adminOverview: async (_req: AuthenticatedRequest, res: Response) => {
    const result = await adminService.adminOverview();
    res.json(result);
  },


  adminListUsers: async (_req: AuthenticatedRequest, res: Response) => {
    const result = await adminService.adminListUsers();
    res.json(result);
  },


  adminCreateUser: async (req: AuthenticatedRequest, res: Response) => {
    const result = await adminService.adminCreateUser(req.body);
    res.status(201).json(result);
  },


  adminUpdateUser: async (req: AuthenticatedRequest, res: Response) => {
    const result = await adminService.adminUpdateUser(
      req.user?.sub,
      String(req.params.id),
      req.body,
    );
    res.json(result);
  },


  adminDeleteUser: async (req: AuthenticatedRequest, res: Response) => {
    const result = await adminService.adminDeleteUser(
      req.user?.sub,
      String(req.params.id),
    );
    res.json(result);
  },


  adminBlockUser: async (req: AuthenticatedRequest, res: Response) => {
    const result = await adminService.adminBlockUser(
      req.user?.sub,
      String(req.params.id),
    );
    res.json(result);
  },


  adminUnblockUser: async (req: AuthenticatedRequest, res: Response) => {
    const result = await adminService.adminUnblockUser(
      req.user?.sub,
      String(req.params.id),
    );
    res.json(result);
  },


  adminResetUserPassword: async (req: AuthenticatedRequest, res: Response) => {
    const result = await adminService.adminResetUserPassword(
      req.user?.sub,
      String(req.params.id),
      req.body?.password,
    );
    res.json(result);
  },


  adminCreateCourse: async (req: AuthenticatedRequest, res: Response) => {
    const result = await adminService.adminCreateCourse(req.body);
    res.status(201).json(result);
  },


  adminUpdateCourse: async (req: AuthenticatedRequest, res: Response) => {
    const result = await adminService.adminUpdateCourse(
      String(req.params.id),
      req.body,
    );
    res.json(result);
  },


  adminCourseDetails: async (req: AuthenticatedRequest, res: Response) => {
    const result = await adminService.adminCourseDetails(String(req.params.id));
    res.json(result);
  },


  adminCreateLesson: async (req: AuthenticatedRequest, res: Response) => {
    const result = await adminService.adminCreateLesson(
      String(req.params.id),
      req.body,
    );
    res.status(201).json(result);
  },


  adminUpdateLesson: async (req: AuthenticatedRequest, res: Response) => {
    const result = await adminService.adminUpdateLesson(
      String(req.params.id),
      String(req.params.lessonId),
      req.body,
    );
    res.json(result);
  },


  adminDeleteLesson: async (req: AuthenticatedRequest, res: Response) => {
    const result = await adminService.adminDeleteLesson(
      String(req.params.id),
      String(req.params.lessonId),
    );
    res.json(result);
  },


  adminDeleteLessonMaterial: async (
    req: AuthenticatedRequest,
    res: Response,
  ) => {
    const result = await adminService.adminDeleteLessonMaterial(
      String(req.params.id),
      String(req.params.lessonId),
      String(req.params.materialId),
    );
    res.json(result);
  },


  adminUpdateAssignment: async (req: AuthenticatedRequest, res: Response) => {
    const result = await adminService.adminUpdateAssignment(
      String(req.params.id),
      req.body,
    );
    res.json(result);
  },


  adminDeleteAssignment: async (req: AuthenticatedRequest, res: Response) => {
    const result = await adminService.adminDeleteAssignment(
      String(req.params.id),
    );
    res.json(result);
  },


  adminDeleteCourse: async (req: AuthenticatedRequest, res: Response) => {
    const result = await adminService.adminDeleteCourse(String(req.params.id));
    res.json(result);
  },


  adminBulkCourses: async (req: AuthenticatedRequest, res: Response) => {
    const result = await adminService.adminBulkCourses(req.body);
    res.json(result);
  },


  adminCourseStudents: async (req: AuthenticatedRequest, res: Response) => {
    const result = await adminService.adminCourseStudents(String(req.params.id));
    res.json(result);
  },


  adminSetCourseStudentEnrollment: async (
    req: AuthenticatedRequest,
    res: Response,
  ) => {
    const result = await adminService.adminSetCourseStudentEnrollment(
      String(req.params.id),
      String(req.params.studentId),
      req.body?.enrolled,
    );
    res.json(result);
  },


  adminReports: async (_req: AuthenticatedRequest, res: Response) => {
    const result = await adminService.adminReports();
    res.json(result);
  },


  adminRunBackup: async (_req: AuthenticatedRequest, res: Response) => {
    const result = await adminService.adminRunBackup();
    res.json(result);
  },


  adminRunRestore: async (_req: AuthenticatedRequest, res: Response) => {
    const result = await adminService.adminRunRestore();
    res.json(result);
  },


  adminSettingsOverview: async (_req: AuthenticatedRequest, res: Response) => {
    const result = await adminService.adminSettingsOverview();
    res.json(result);
  },


  adminListCourseAccessRequests: async (
    req: AuthenticatedRequest,
    res: Response,
  ) => {
    const result = await adminService.adminListCourseAccessRequests(
      req.query.status,
    );
    res.json(result);
  },

};
