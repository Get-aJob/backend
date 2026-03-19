import { Request, Response } from "express";
import { accessCookieOptions, refreshCookieOptions } from "../config/auth";
import { getAllUsers, withdraw } from "../services/usersService";
import { logger } from "../utils/logger";

export async function getUsers(req: Request, res: Response): Promise<void> {
  try {
    const data = await getAllUsers();
    res.status(200).json({ users: data });
  } catch (err) {
    console.error("GET /users", err);
    res.status(500).json({ error: "회원 목록 조회에 실패했습니다." });
  }
}

export async function withdrawUser(req: Request, res: Response) {
  const user = res.locals.user as { id: string; email: string } | undefined;
  if (!user?.id) {
    return res.status(401).json({ error: "UNAUTHORIZED" });
  }

  await withdraw(user.id);

  // 현재 브라우저 쿠키 정리
  res.clearCookie("access_token", {
    httpOnly: true,
    secure: accessCookieOptions().secure,
    sameSite: accessCookieOptions().sameSite,
    domain: accessCookieOptions().domain,
    path: accessCookieOptions().path,
  });
  res.clearCookie("refresh_token", {
    httpOnly: true,
    secure: refreshCookieOptions().secure,
    sameSite: refreshCookieOptions().sameSite,
    domain: refreshCookieOptions().domain,
    path: refreshCookieOptions().path,
  });

  logger.info("회원탈퇴 완료", { userId: user.id, email: user.email });
  return res.status(200).json({ message: "회원탈퇴에 성공했습니다." });
}
