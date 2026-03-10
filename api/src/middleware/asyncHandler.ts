import type { NextFunction, Response } from "express";
import type { AsyncRequestHandler, AuthenticatedRequest } from "../types/auth";

export function asyncHandler(handler: AsyncRequestHandler) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
