import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "./auth";
import { Errors } from "./errors";

export interface AuthRequest extends Request {
  userId?: string;
}

export function authMiddleware(
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    throw Errors.unauthorized();
  }

  const payload = verifyAccessToken(token);
  if (!payload) {
    throw Errors.unauthorized();
  }

  req.userId = payload.sub;
  next();
}

// Async route handler wrapper to catch errors
export function asyncHandler(
  fn: (req: AuthRequest, res: Response) => Promise<void>,
) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res)).catch(next);
  };
}
