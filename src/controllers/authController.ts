import { Request, Response } from 'express';
import {
  registerUser,
  loginUser,
  rotateRefreshToken,
  requestPasswordResetService,
  confirmPasswordResetService,
} from '../services/authService';
import { accessCookieOptions, refreshCookieOptions } from '../config/auth';
import { logger } from '../utils/logger';

export async function join(req: Request, res: Response) {
  // 0-3-3에서 구현: 이메일/비번 받아 회원 생성
  const { email, password, name } = req.body ?? {};
  const file = req.file;

  if (!email || !password || !name) {
    return res.status(400).json({ error: '필수 정보를 입력하지 않았습니다.' });
  }

  const user = await registerUser({ email, password, name, file });
  logger.info('회원가입 성공:', { email: user.email });
  return res.status(201).json({ message: '회원가입에 성공했습니다.' });
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({ error: '필수 정보를 입력하지 않았습니다.' });
  }

  const result = await loginUser({ email, password });

  if (!result.ok) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }

  res.cookie('access_token', result.accessToken, accessCookieOptions());
  res.cookie('refresh_token', result.refreshToken, refreshCookieOptions());

  logger.info('유저 로그인:', { email: email });
  return res.status(200).json({
    user: result.user,
  });
}

export async function me(req: Request, res: Response) {
  const user = res.locals.user ?? null;
  logger.info('신원 확인:', { email: user?.email });
  return res.status(200).json({ user: user });
}

export async function refresh(req: Request, res: Response) {
  const token = req.cookies?.refresh_token as string | undefined;
  if (!token) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }

  const result = await rotateRefreshToken(token);

  if (!result.ok) {
    // 침해 의심 시 쿠키 즉시 정리
    res.clearCookie('access_token', {
      httpOnly: true,
      secure: accessCookieOptions().secure,
      sameSite: accessCookieOptions().sameSite,
      domain: accessCookieOptions().domain,
      path: accessCookieOptions().path,
    });
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: refreshCookieOptions().secure,
      sameSite: refreshCookieOptions().sameSite,
      domain: refreshCookieOptions().domain,
      path: refreshCookieOptions().path,
    });
    return res.status(401).json({
      error: result.code === 'REUSE_DETECTED' ? 'TOKEN_REUSE_DETECTED' : 'UNAUTHORIZED',
    });
  }

  // rotate 성공: 신규 access/refresh 재쿠키 세팅
  res.cookie('access_token', result.accessToken, accessCookieOptions());
  res.cookie('refresh_token', result.refreshToken, refreshCookieOptions());
  logger.info('토큰 재발급 성공');
  return res.status(200).json({ message: '토큰이 재발급되었습니다.' });
}

export async function logout(req: Request, res: Response) {
  // 1) refresh 폐기 로직이 있다면 여기서 수행
  // 예: await revokeRefreshToken(...)

  // 2) access 쿠키 삭제 (로그인 시와 동일한 path/domain/sameSite/secure를 맞춰야 삭제됨)
  res.clearCookie('access_token', {
    httpOnly: true,
    secure: accessCookieOptions().secure,
    sameSite: accessCookieOptions().sameSite,
    domain: accessCookieOptions().domain,
    path: accessCookieOptions().path,
  });

  // 3) refresh 쿠키 삭제 (path가 /auth/refresh 이므로 반드시 동일하게 맞춰야 함)
  res.clearCookie('refresh_token', {
    httpOnly: true,
    secure: refreshCookieOptions().secure,
    sameSite: refreshCookieOptions().sameSite,
    domain: refreshCookieOptions().domain,
    path: refreshCookieOptions().path,
  });

  logger.info('유저 로그아웃');
  return res.status(200).json({ message: '로그아웃에 성공했습니다.' });
}
export async function requestPasswordReset(req: Request, res: Response) {
  const { email, name } = req.body ?? {};

  if (!email || !name) {
    return res.status(400).json({ error: 'INVALID_INPUT' });
  }

  const result = await requestPasswordResetService({ email, name });

  if (!result.ok) {
    return res.status(404).json({ error: 'USER_NOT_FOUND' });
  }

  logger.info('비밀번호 재설정 요청 성공', { email });
  return res.status(200).json({
    message: '사용자 확인 완료',
    reset_token: result.resetToken,
    expires_in: result.expiresIn,
  });
}

export async function confirmPasswordReset(req: Request, res: Response) {
  const { reset_token: resetToken, password: newPassword } = req.body ?? {};

  if (!resetToken || !newPassword) {
    return res.status(400).json({ error: 'INVALID_INPUT' });
  }

  /*
  if (String(newPassword).length < 8) {
    return res.status(400).json({ error: "WEAK_PASSWORD" });
  }
  */

  const result = await confirmPasswordResetService({ resetToken, newPassword });

  if (!result.ok) {
    return res.status(401).json({ error: result.code });
  }

  logger.info('비밀번호 재설정 완료');

  return res.status(200).json({ message: '비밀번호가 변경되었습니다.' });
}
