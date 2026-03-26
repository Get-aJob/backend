import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../lib/jwt";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.access_token as string | undefined;
  if (!token) {
    return res.status(401).json({ error: "UNAUTHORIZED" });
  }
  try {
    const payload = verifyAccessToken(token);
    res.locals.user = {
      id: payload.id,
      email: payload.email,
      profile_image_url: payload.profile_image_url,
    };
    next();
  } catch {
    return res.status(401).json({ error: "UNAUTHORIZED" });
  }
}
