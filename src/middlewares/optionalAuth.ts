import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../lib/jwt";

export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.access_token as string | undefined;
  if (!token) {
    return next();
  }

  try {
    const payload = verifyAccessToken(token);
    res.locals.user = { id: payload.id, email: payload.email };
  } catch {
    //토큰이 없으면 익명사용자
  }

  return next();
}
