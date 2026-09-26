import type { Response } from "express";
import * as courseService from "../services/courseService";
import type { AuthenticatedRequest } from "../types/auth";

export const courseController = {
  listCourses: async (req: AuthenticatedRequest, res: Response) => {
    const result = await courseService.listCourses(req.user?.sub);
    res.json(result);
  },


  getCourseById: async (req: AuthenticatedRequest, res: Response) => {
    const result = await courseService.getCourseById(
      String(req.params.id),
      req.user?.sub,
    );
    res.json(result);
  },


  createCourseLegacy: async (req: AuthenticatedRequest, res: Response) => {
    const result = await courseService.createCourseLegacy(req.body);
    res.status(201).json(result);
  },


  discoverCourses: async (req: AuthenticatedRequest, res: Response) => {
    const result = await courseService.discoverStudentCourses(req.user?.sub);
    res.json(result);
  },


  publicCourses: async (_req: AuthenticatedRequest, res: Response) => {
    const result = await courseService.listPublicCourses();
    res.json(result);
  },


  publicStats: async (_req: AuthenticatedRequest, res: Response) => {
    const result = await courseService.getPublicStats();
    res.json(result);
  },

};
