import type { Response } from "express";
import * as messageService from "../services/messageService";
import type { AuthenticatedRequest } from "../types/auth";

export const messageController = {
  listUsers: async (req: AuthenticatedRequest, res: Response) => {
    const result = await messageService.listUsersForMessaging(
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
    const result = await messageService.listMessages(
      req.user?.sub,
      withUserId,
      req.query.withRole,
    );
    res.json(result);
  },


  sendMessage: async (req: AuthenticatedRequest, res: Response) => {
    const result = await messageService.sendMessage(req.user?.sub, req.body);
    res.status(201).json(result);
  },

};
