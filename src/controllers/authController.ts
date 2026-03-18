import { Request, Response } from "express";
import { registerUser, loginUser } from "../services/authService";
import { accessCookieOptions, refreshCookieOptions } from "../config/auth";
import { logger } from "../utils/logger";

export async function join(req: Request, res: Response) {
  // 0-3-3에서 구현: 이메일/비번 받아 회원 생성
  const { email, password, name } = req.body ?? {};

  if (!email || !password || !name) {
    return res.status(400).json({ error: "필수 정보를 입력하지 않았습니다." });
  }

  const user = await registerUser({ email, password, name });
  logger.info("회원가입 성공:", { email: user.email });
  return res.status(201).json({ message: "회원가입에 성공했습니다." });
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({ error: "필수 정보를 입력하지 않았습니다." });
  }

  const result = await loginUser({ email, password });

  if (!result.ok) {
    return res.status(401).json({ error: "UNAUTHORIZED" });
  }

  res.cookie("access_token", result.accessToken, accessCookieOptions());
  res.cookie("refresh_token", result.refreshToken, refreshCookieOptions());

  logger.info("유저 로그인:", { email: email });
  return res.status(200).json({
    user: result.user,
  });
}

export async function me(req: Request, res: Response) {
  const user = res.locals.user ?? null;
  logger.info("신원 확인:", { email: user?.email });
  return res.status(200).json({ user: user });
}

export async function refresh(req: Request, res: Response) {
  // 0-3-7에서 구현: refresh 쿠키 검증 + 롤링 + access 재발급
  res.status(501).json({ error: "NOT_IMPLEMENTED" });
}

export async function logout(req: Request, res: Response) {
  // 0-3-8에서 구현: 쿠키 삭제 + refresh 폐기
  res.status(501).json({ error: "NOT_IMPLEMENTED" });
}
