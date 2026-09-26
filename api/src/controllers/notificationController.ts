import type { Response } from "express";
import * as notificationService from "../services/notificationService";
import type { AuthenticatedRequest } from "../types/auth";

export const notificationController = {
  notifications: async (req: AuthenticatedRequest, res: Response) => {
    const result = await notificationService.listNotifications(req.user?.sub);
    res.json(result);
  },


  unreadNotificationCount: async (req: AuthenticatedRequest, res: Response) => {
    const result = await notificationService.getUnreadNotificationCount(req.user?.sub);
    res.json(result);
  },


  markNotificationAsRead: async (req: AuthenticatedRequest, res: Response) => {
    const result = await notificationService.markNotificationAsRead(
      req.user?.sub,
      String(req.params.id),
    );
    res.json(result);
  },


  markAllNotificationsAsRead: async (
    req: AuthenticatedRequest,
    res: Response,
  ) => {
    const result = await notificationService.markAllNotificationsAsRead(req.user?.sub);
    res.json(result);
  },

};
