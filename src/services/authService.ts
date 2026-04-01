import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { supabase } from '../lib/supabase';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/jwt';
import { logger } from '../utils/logger';
import type { IGoogleToken, IGoogleUser } from '../types/google';
import { uploadProfileImageFromBuffer } from './profileImageService';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const BASE_URL = process.env.BASE_URL;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3009';

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function calcRefreshExpiryDate() {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString();
}

export async function rotateRefreshToken(rawRefreshToken: string) {
  let payload: { id: string; email: string; profile_image_url: string | null };
  try {
    payload = verifyRefreshToken(rawRefreshToken);
  } catch (error) {
    return { ok: false as const, code: "UNAUTHORIZED" as const };
  }

  const tokenHash = sha256(rawRefreshToken);

  const { data: current, error } = await supabase
    .from("refresh_tokens")
    .select("user_id, token_hash, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .single();

  if (error || !current) {
    await supabase
      .from("refresh_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("user_id", payload.id)
      .is("revoked_at", null);

    return { ok: false as const, code: "REUSE_DETECTED" as const };
  }

  if (current.revoked_at || new Date(current.expires_at).getTime() < Date.now()) {
    await supabase
      .from("refresh_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("user_id", current.user_id)
      .is("revoked_at", null);
    return { ok: false as const, code: "REUSE_DETECTED" as const };
  }

  const newAccessToken = signAccessToken({
    id: payload.id,
    email: payload.email,
    profile_image_url: payload.profile_image_url,
  });
  const newRefreshToken = signRefreshToken({
    id: payload.id,
    email: payload.email,
    profile_image_url: payload.profile_image_url,
  });
  const newHash = sha256(newRefreshToken);

  const nowIso = new Date().toISOString();

  const { error: revokeErr } = await supabase
    .from("refresh_tokens")
    .update({ revoked_at: nowIso })
    .eq("token_hash", tokenHash)
    .is("revoked_at", null);
  if (revokeErr) throw new Error(revokeErr.message);

  const { error: insertErr } = await supabase.from('refresh_tokens').insert({
    user_id: payload.id,
    token_hash: newHash,
    expires_at: calcRefreshExpiryDate(),
    revoked_at: null,
  });
  if (insertErr) throw new Error(insertErr.message);

  return {
    ok: true as const,
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
}

export async function registerUser({
  email,
  password,
  name,
  file,
}: {
  email: string;
  password: string;
  name: string;
  file?: Express.Multer.File;
}) {
  const passwordHash = await bcrypt.hash(password, 12);

  const { data, error } = await supabase
    .from("users")
    .insert({
      email: email,
      password_hash: passwordHash,
      name: name,
    })
    .select("id, email, name, created_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  if (file && data) {
    try {
      await uploadProfileImageFromBuffer({
        userId: data.id,
        buffer: file.buffer,
        contentType: file.mimetype,
      });
    } catch (uploadError) {
      console.error("프로필 이미지 업로드 실패:", uploadError);
    }
  }

  return data;
}

type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
  profile_image_url: string | null;
};

export async function issueSession(user: SessionUser) {
  const accessToken = signAccessToken({
    id: user.id,
    email: user.email,
    profile_image_url: user.profile_image_url,
  });

  const refreshToken = signRefreshToken({
    id: user.id,
    email: user.email,
    profile_image_url: user.profile_image_url,
  });

  const refreshTokenHash = sha256(refreshToken);

  const { error: rtError } = await supabase.from('refresh_tokens').insert({
    user_id: user.id,
    token_hash: refreshTokenHash,
    expires_at: calcRefreshExpiryDate(),
    revoked_at: null,
  });

  if (rtError) {
    throw new Error(rtError.message);
  }

  return {
    accessToken,
    refreshToken,
  };
}

export async function loginUser({ email, password }: { email: string; password: string }) {
  const { data: user, error } = await supabase
    .from("users")
    .select("id, email, password_hash, name, profile_image_url")
    .eq("email", email)
    .single();

  if (error || !user) {
    return { ok: false as const };
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return { ok: false as const };
  }

  const { accessToken, refreshToken } = await issueSession({
    id: user.id,
    email: user.email,
    profile_image_url: user.profile_image_url,
  });

  return {
    ok: true as const,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      profile_image_url: user.profile_image_url,
    },
    accessToken,
    refreshToken,
  };
}

const resetSessionStore = new Map<string, { userId: string; expiresAt: number }>();

function generateResetToken() {
  return crypto.randomBytes(32).toString("hex");
}

export async function requestPasswordResetService(params: {
  email: string;
  name: string;
}) {
  const { email, name } = params;

  const { data: user, error } = await supabase
    .from("users")
    .select("id, email, name")
    .eq("email", email)
    .eq("name", name)
    .single();

  if (error || !user) {
    return { ok: false as const, code: "USER_NOT_FOUND" as const };
  }

  const resetToken = generateResetToken();
  const expiresAt = Date.now() + 10 * 60 * 1000;
  resetSessionStore.set(resetToken, {
    userId: user.id,
    expiresAt,
  });

  return {
    ok: true as const,
    resetToken,
    expiresIn: 600,
  };
}

export async function confirmPasswordResetService(params: {
  resetToken: string;
  newPassword: string;
}) {
  const { resetToken, newPassword } = params;

  const session = resetSessionStore.get(resetToken);
  if (!session) {
    return { ok: false as const, code: "INVALID_RESET_TOKEN" as const };
  }

  if (session.expiresAt < Date.now()) {
    resetSessionStore.delete(resetToken);
    return { ok: false as const, code: "RESET_TOKEN_EXPIRED" as const };
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  const { error } = await supabase
    .from("users")
    .update({ password_hash: passwordHash })
    .eq("id", session.userId);
  if (error) {
    throw new Error(error.message);
  }
  resetSessionStore.delete(resetToken);
  return { ok: true as const };
}

function isConfigured() {
  return !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
}

export function getConsentUrl() {
  if (!isConfigured()) return null;

  const redirectUrl = `${BASE_URL}/auth/callback`;

  logger.debug('Google OAuth 동의 URL 생성', {
    BASE_URL,
    redirectUrl,
  });

  const SCOPES = ['openid', 'email', 'profile'];

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID as string,
    redirect_uri: redirectUrl,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function getFrontendUrl(path = '') {
  const base = FRONTEND_URL.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

function isGoogleToken(value: unknown): value is IGoogleToken {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  const hasValidRefreshToken = !('refresh_token' in v) || typeof v.refresh_token === 'string';
  return (
    typeof v.access_token === 'string' &&
    typeof v.expires_in === 'number' &&
    hasValidRefreshToken &&
    typeof v.scope === 'string' &&
    typeof v.token_type === 'string' &&
    typeof v.id_token === 'string'
  );
}

export async function exchangeCodeForTokens(code: string): Promise<IGoogleToken> {
  const redirectUrl = `${BASE_URL}/auth/callback`;

  logger.info('Google 토큰 엔드포인트 호출 시도', { redirectUrl });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID as string,
      client_secret: GOOGLE_CLIENT_SECRET as string,
      redirect_uri: redirectUrl,
      grant_type: 'authorization_code',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    logger.error('Token exchange failed', { status: res.status, body: err });
    throw new Error(`Token exchange failed: ${err}`);
  }

  logger.info('Token exchange 성공');

  const data: unknown = await res.json();

  if (!isGoogleToken(data)) {
    throw new Error('Invalid Google token response shape');
  }

  return data;
}

function isGoogleUserInfo(value: unknown): value is {
  id: string;
  email: string;
  name?: string;
  picture?: string;
} {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  const hasValidName = !('name' in v) || typeof v.name === 'string';
  const hasValidPicture = !('picture' in v) || typeof v.picture === 'string';
  return typeof v.id === 'string' && typeof v.email === 'string' && hasValidName && hasValidPicture;
}

export async function getUserInfo(accessToken: string): Promise<IGoogleUser> {
  logger.info('Google 사용자 정보 조회 시도');
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const err = await res.text();
    logger.error('Failed to fetch user info', {
      status: res.status,
      body: err,
    });
    throw new Error('Failed to fetch user info');
  }
  const data: unknown = await res.json();
  if (!isGoogleUserInfo(data)) {
    throw new Error('Invalid Google user info response shape');
  }
  logger.info('Google 사용자 정보 조회 성공', {
    userId: data.id,
    email: data.email,
  });
  return {
    id: data.id,
    email: data.email,
    name: data.name || null,
    picture: data.picture || null,
  };
}

export async function verifyGoogleCredential(credential: string): Promise<IGoogleUser> {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('GOOGLE_CLIENT_ID가 설정되지 않았습니다.');
  }

  const client = new OAuth2Client(GOOGLE_CLIENT_ID);

  const ticket = await client.verifyIdToken({
    idToken: credential,
    audience: GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();

  if (!payload || !payload.email) {
    throw new Error('유효하지 않은 Google token payload');
  }

  logger.info('Google credential 검증 성공', {
    email: payload.email,
    sub: payload.sub,
  });

  return {
    id: payload.sub,
    email: payload.email,
    name: payload.name || null,
    picture: payload.picture || null,
  };
}

export async function findOrCreateGoogleUser(googleUser: IGoogleUser): Promise<SessionUser> {
  const normalizedEmail = googleUser.email.trim().toLowerCase();

  const { data: existingUser, error: selectError } = await supabase
    .from('users')
    .select('id, email, name, profile_image_url')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (selectError) {
    throw new Error(selectError.message);
  }

  if (existingUser) {
    const updatePayload: { name?: string; profile_image_url?: string | null } =
      {};

    if (googleUser.name && googleUser.name !== existingUser.name) {
      updatePayload.name = googleUser.name;
    }
    if (
      googleUser.picture &&
      googleUser.picture !== existingUser.profile_image_url
    ) {
      updatePayload.profile_image_url = googleUser.picture;
    }

    if (Object.keys(updatePayload).length > 0) {
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update(updatePayload)
        .eq('id', existingUser.id)
        .select('id, email, name, profile_image_url')
        .single();

      if (updateError) {
        throw new Error(updateError.message);
      }

      return {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        profile_image_url: updatedUser.profile_image_url,
      };
    }

    return {
      id: existingUser.id,
      email: existingUser.email,
      name: existingUser.name,
      profile_image_url: existingUser.profile_image_url,
    };
  }

  const randomPassword = crypto.randomBytes(32).toString('hex');
  const passwordHash = await bcrypt.hash(randomPassword, 12);
  const fallbackName = normalizedEmail.split('@')[0] || 'google-user';

  const { data: createdUser, error: insertError } = await supabase
    .from('users')
    .insert({
      email: normalizedEmail,
      password_hash: passwordHash,
      name: googleUser.name ?? fallbackName,
      profile_image_url: googleUser.picture,
    })
    .select('id, email, name, profile_image_url')
    .single();

  if (insertError) {
    throw new Error(insertError.message);
  }

  return {
    id: createdUser.id,
    email: createdUser.email,
    name: createdUser.name,
    profile_image_url: createdUser.profile_image_url,
  };
}
