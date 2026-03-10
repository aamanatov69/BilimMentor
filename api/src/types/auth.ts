import type { UserRole } from "@prisma/client";
import type { Request } from "express";

export interface JwtPayload {
  sub: string;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

export type AsyncRequestHandler = (
  req: AuthenticatedRequest,
  res: import("express").Response,
  next: import("express").NextFunction,
) => Promise<unknown>;
