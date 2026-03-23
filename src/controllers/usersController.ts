import { Request, Response } from "express";
import { accessCookieOptions, refreshCookieOptions } from "../config/auth";
import {
  uploadProfileImageFromBuffer,
  deleteProfileImage,
} from "../services/profileImageService";
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

/**
 * /users/me/image
 * - multipart 파일을 직접 받아 업로드 + DB 반영
 */
export async function uploadMyProfileImage(req: Request, res: Response) {
  const user = res.locals.user as { id: string; email: string } | undefined;

  if (!user?.id) return res.status(401).json({ error: "UNAUTHORIZED" });

  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: "FILE_REQUIRED" });
  }

  try {
    logger.info("프로필 이미지 업로드 요청", {
      userId: user.id,
      mimetype: file.mimetype,
      size: file.size,
    });

    const result = await uploadProfileImageFromBuffer({
      userId: user.id,
      buffer: file.buffer,
      contentType: file.mimetype,
    });

    return res.status(200).json({
      message: "프로필 이미지가 반영되었습니다.",
      profileImageUrl: result.profileImageUrl,
    });
  } catch (e) {
    logger.error("프로필 이미지 업로드 요청 실패", {
      userId: user.id,
      mimetype: file.mimetype,
      error: e instanceof Error ? e.message : String(e),
    });
    return res.status(500).json({ error: "PROFILE_IMAGE_UPLOAD_FAILED" });
  }
}

/**
 * /users/me/image
 * - 현재 프로필 이미지 삭제
 */
export async function deleteMyProfileImage(req: Request, res: Response) {
  const user = res.locals.user as { id: string; email: string } | undefined;

  if (!user?.id) return res.status(401).json({ error: "UNAUTHORIZED" });

  try {
    logger.info("프로필 이미지 삭제 요청", { userId: user.id });

    await deleteProfileImage({ userId: user.id });

    return res.status(200).json({ message: "프로필 이미지를 삭제했습니다." });
  } catch (e) {
    logger.error("프로필 이미지 삭제 요청 실패", {
      userId: user.id,
      error: e instanceof Error ? e.message : String(e),
    });

    return res.status(500).json({ error: "PROFILE_IMAGE_DELETE_FAILED" });
  }
}
