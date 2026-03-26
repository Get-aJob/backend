import jwt from "jsonwebtoken";
import { authConfig } from "../config/auth";

type JwtPayload = {
  id: string;
  email: string;
  profile_image_url: string | null;
};

export function signAccessToken(payload: JwtPayload) {
  // 다음 단계에서 env/만료시간 적용
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET as string, {
    expiresIn: authConfig.access.expiresIn,
  });
}

export function signRefreshToken(payload: JwtPayload) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET as string, {
    expiresIn: authConfig.refresh.expiresIn,
  });
}

export function verifyAccessToken(token: string) {
  return jwt.verify(
    token,
    process.env.JWT_ACCESS_SECRET as string,
  ) as JwtPayload;
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(
    token,
    process.env.JWT_REFRESH_SECRET as string,
  ) as JwtPayload;
}
