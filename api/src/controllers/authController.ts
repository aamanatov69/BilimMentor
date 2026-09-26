import type { Response } from "express";
import * as authService from "../services/authService";
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

export const authController = {
  register: async (req: AuthenticatedRequest, res: Response) => {
    const result = await authService.register(req.body);
    setAuthCookie(res, result.token);
    const { token: _token, ...payload } = result;
    res.status(201).json(payload);
  },


  login: async (req: AuthenticatedRequest, res: Response) => {
    const result = await authService.login(req.body);
    setAuthCookie(res, result.token);
    const { token: _token, ...payload } = result;
    res.json(payload);
  },


  logout: async (_req: AuthenticatedRequest, res: Response) => {
    clearAuthCookie(res);
    res.json({ message: "Выход выполнен" });
  },


  forgotPassword: async (req: AuthenticatedRequest, res: Response) => {
    const result = await authService.requestPasswordReset(req.body);
    res.json(result);
  },


  resetPassword: async (req: AuthenticatedRequest, res: Response) => {
    const result = await authService.resetPasswordByToken(req.body);
    res.json(result);
  },


  validateResetPasswordToken: async (
    req: AuthenticatedRequest,
    res: Response,
  ) => {
    const token =
      typeof req.query.token === "string" ? req.query.token : undefined;
    const result = await authService.validateResetPasswordToken({ token });
    res.json(result);
  },


  me: async (req: AuthenticatedRequest, res: Response) => {
    const result = await authService.me(req.user?.sub);
    res.json(result);
  },

};
