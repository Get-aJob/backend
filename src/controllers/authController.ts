import { Request, Response } from 'express';
import {
  registerUser,
  loginUser,
  rotateRefreshToken,
  requestPasswordResetService,
  confirmPasswordResetService,
  getConsentUrl,
  getFrontendUrl,
  exchangeCodeForTokens,
  getUserInfo,
  findOrCreateGoogleUser,
  issueSession,
  verifyGoogleCredential,
} from '../services/authService';
import { accessCookieOptions, refreshCookieOptions } from '../config/auth';
import { logger } from '../utils/logger';

function setAuthCookies(res: Response, tokens: { accessToken: string; refreshToken: string }) {
  res.cookie('access_token', tokens.accessToken, accessCookieOptions());
  res.cookie('refresh_token', tokens.refreshToken, refreshCookieOptions());
}

function clearAuthCookies(res: Response) {
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
}

export async function join(req: Request, res: Response) {
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

  setAuthCookies(res, {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  });

  logger.info('유저 로그인:', { email: email });
  return res.status(200).json({
    user: result.user,
  });
}

export async function googleLogin(req: Request, res: Response) {
  const url = getConsentUrl();
  if (!url) {
    logger.error('Google 리다이렉트 URL 요청 에러', {
      GOOGLE_CLIENT_ID_SET: !!process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET_SET: !!process.env.GOOGLE_CLIENT_SECRET,
    });
    return res.status(500).json({ message: 'SERVER ERROR' });
  }

  logger.info('Google 동의 URL로 리다이렉트', { url });
  return res.redirect(302, url);
}

export async function callback(req: Request, res: Response) {
  const { code, error } = req.query;

  const frontRoot = getFrontendUrl('/');

  logger.info('GET /auth/callback 요청 수신', { query: req.query });

  if (error) {
    logger.error('Google OAuth 에러 파라미터 수신', { error });
    return res.redirect(302, frontRoot);
  }
  if (!code || typeof code !== 'string') {
    logger.error('OAuth callback에 code 쿼리가 없음');
    return res.redirect(302, frontRoot);
  }

  try {
    logger.info('인가 코드로 토큰 교환 시도');
    const tokens = await exchangeCodeForTokens(code);
    logger.info('토큰 교환 성공', { hasAccessToken: !!tokens.access_token });

    const googleUser = await getUserInfo(tokens.access_token);
    const user = await findOrCreateGoogleUser(googleUser);
    const session = await issueSession(user);

    logger.info('Google 사용자 정보 조회 성공', {
      userId: user.id,
      email: user.email,
      profile_image_url: user.profile_image_url,
    });

    setAuthCookies(res, session);

    logger.info('세션 발급/쿠키 설정 완료, 프론트로 리다이렉트', {
      redirectTo: frontRoot,
    });
    res.redirect(302, frontRoot);
  } catch (err) {
    const error = err instanceof Error ? err : new Error('Unknown callback error');
    logger.error('Auth callback 처리 중 에러', {
      message: error.message,
      stack: error.stack,
    });
    res.redirect(302, frontRoot);
  }
}

export async function googleCredentialLogin(req: Request, res: Response) {
  const { credential } = req.body ?? {};

  if (!credential) {
    return res.status(400).json({ error: 'credential이 없습니다.' });
  }

  try {
    const googleUser = await verifyGoogleCredential(credential);
    const user = await findOrCreateGoogleUser(googleUser);
    const session = await issueSession(user);

    setAuthCookies(res, session);

    logger.info('Google credential 로그인 성공', {
      userId: user.id,
      email: user.email,
    });

    return res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        profile_image_url: user.profile_image_url,
      },
    });
  } catch (err) {
    const error = err instanceof Error ? err : new Error('Unknown error');
    logger.error('Google credential 로그인 실패', { message: error.message });
    return res.status(401).json({ error: '유효하지 않은 Google 토큰입니다.' });
  }
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
    clearAuthCookies(res);
    return res.status(401).json({
      error: result.code === 'REUSE_DETECTED' ? 'TOKEN_REUSE_DETECTED' : 'UNAUTHORIZED',
    });
  }

  setAuthCookies(res, result);
  logger.info('토큰 재발급 성공');
  return res.status(200).json({ message: '토큰이 재발급되었습니다.' });
}

export async function logout(req: Request, res: Response) {
  clearAuthCookies(res);
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

  const result = await confirmPasswordResetService({ resetToken, newPassword });

  if (!result.ok) {
    return res.status(401).json({ error: result.code });
  }

  logger.info('비밀번호 재설정 완료');

  return res.status(200).json({ message: '비밀번호가 변경되었습니다.' });
}
