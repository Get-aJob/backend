import bcrypt from "bcrypt";
import crypto from "crypto";
import { supabase } from "../lib/supabase";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../lib/jwt";
import { logger } from "../utils/logger";
import type { IGoogleToken, IGoogleUser } from "../types/google";
import { uploadProfileImageFromBuffer } from "./profileImageService";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const BASE_URL = process.env.BASE_URL;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3009";

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

/**
 * refresh token 만료 시각 계산
 * - 현재는 정책값 14일 고정
 * - 추후 env(JWT_REFRESH_EXPIRES_IN)와 동기화 가능
 */
function calcRefreshExpiryDate() {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString();
}

/**
 * refresh token 회전(rotate) + 재사용 탐지(reuse-detection)
 *
 * 성공 시:
 * 1) 기존 refresh 폐기(revoked_at 설정)
 * 2) 신규 access/refresh 발급
 * 3) 신규 refresh hash를 DB 저장
 *
 * 실패 시:
 * - 서명/만료 불일치 -> UNAUTHORIZED
 * - 이미 회전/폐기된 refresh 재사용 의심 -> REUSE_DETECTED
 */
export async function rotateRefreshToken(rawRefreshToken: string) {
  // 1) JWT 자체 검증 (서명/만료)
  // 여기서 실패하면 "애초에 신뢰할 수 없는 토큰"이므로 401 처리한다.
  let payload: { id: string; email: string; profile_image_url: string | null };
  try {
    payload = verifyRefreshToken(rawRefreshToken);
  } catch (error) {
    return { ok: false as const, code: "UNAUTHORIZED" as const };
  }

  // [2] 전달받은 refresh 토큰을 hash로 변환해 DB 조회 키로 사용
  const tokenHash = sha256(rawRefreshToken);

  // [3] DB에서 현재 refresh 레코드 조회
  const { data: current, error } = await supabase
    .from("refresh_tokens")
    .select("user_id, token_hash, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .single();

  // [4] 레코드가 없으면 "이미 회전되어 사라진 토큰 재사용"일 가능성이 높다.
  // 즉, 탈취/재생 공격(replay) 신호로 간주하고 해당 유저 세션 전체를 폐기한다.
  if (error || !current) {
    // reuse-detection: 해당 유저(=payload.id) 전체 세션 폐기
    await supabase
      .from("refresh_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("user_id", payload.id)
      .is("revoked_at", null);

    return { ok: false as const, code: "REUSE_DETECTED" as const };
  }

  // [5] 토큰이 존재하더라도 이미 revoke 되었거나 만료되었으면 비정상 사용으로 본다.
  // 이 경우도 보수적으로 전체 세션 revoke 처리해 추가 피해를 차단한다.
  if (
    current.revoked_at ||
    new Date(current.expires_at).getTime() < Date.now()
  ) {
    await supabase
      .from("refresh_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("user_id", current.user_id)
      .is("revoked_at", null);
    return { ok: false as const, code: "REUSE_DETECTED" as const };
  }

  // [6] 정상 경로: 토큰 회전 수행
  // - access는 짧은 수명으로 재발급
  // - refresh도 새로 발급해 "1회성에 가깝게" 운용
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

  // [7] 기존 refresh 레코드를 먼저 revoke 처리
  // is("revoked_at", null) 조건으로 중복 revoke/경쟁 상황을 완화한다.
  const { error: revokeErr } = await supabase
    .from("refresh_tokens")
    .update({ revoked_at: nowIso })
    .eq("token_hash", tokenHash)
    .is("revoked_at", null);
  if (revokeErr) throw new Error(revokeErr.message);

  // [8] 새 refresh hash 저장
  // 여기까지 성공해야만 "회전 완료" 상태가 된다.
  const { error: insertErr } = await supabase.from("refresh_tokens").insert({
    user_id: payload.id,
    token_hash: newHash,
    expires_at: calcRefreshExpiryDate(),
    revoked_at: null,
  });
  if (insertErr) throw new Error(insertErr.message);

  // [9] 컨트롤러는 이 값을 받아 쿠키(access/refresh)를 교체한다.
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

  const { error: rtError } = await supabase.from("refresh_tokens").insert({
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

export async function loginUser({
  email,
  password,
}: {
  email: string;
  password: string;
}) {
  // 1) 유저 조회
  const { data: user, error } = await supabase
    .from("users")
    .select("id, email, password_hash, name, profile_image_url")
    .eq("email", email)
    .single();

  // 이메일이 없거나 조회 에러면 동일하게 실패 처리
  if (error || !user) {
    return { ok: false as const };
  }

  // 2) 비밀번호 검증
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return { ok: false as const };
  }

  // 3) 공통 세션 발급 (email/google 로그인 공통 경로)
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
// 메모리 저장(개발용). 운영에서는 redis/DB 권장
const resetSessionStore = new Map<
  string,
  { userId: string; expiresAt: number }
>();

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
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10분
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
  // 1회용 토큰
  resetSessionStore.delete(resetToken);
  return { ok: true as const };
}

/**
 * Google 관련 로직
 */

function isConfigured() {
  return !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
}

export function getConsentUrl() {
  if (!isConfigured()) return null;

  const redirectUrl = `${BASE_URL}/auth/callback`;

  logger.debug("Google OAuth 동의 URL 생성", {
    BASE_URL,
    redirectUrl,
  });

  const SCOPES = ["openid", "email", "profile"];

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID as string,
    redirect_uri: redirectUrl,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function getFrontendUrl(path = "") {
  const base = FRONTEND_URL.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

function isGoogleToken(value: unknown): value is IGoogleToken {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const hasValidRefreshToken =
    !("refresh_token" in v) || typeof v.refresh_token === "string";
  return (
    typeof v.access_token === "string" &&
    typeof v.expires_in === "number" &&
    hasValidRefreshToken &&
    typeof v.scope === "string" &&
    typeof v.token_type === "string" &&
    typeof v.id_token === "string"
  );
}
/**
 * 인가 코드로 액세스 토큰 교환
 */
export async function exchangeCodeForTokens(
  code: string,
): Promise<IGoogleToken> {
  const redirectUrl = `${BASE_URL}/auth/callback`;

  logger.info("Google 토큰 엔드포인트 호출 시도", { redirectUrl });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID as string,
      client_secret: GOOGLE_CLIENT_SECRET as string,
      redirect_uri: redirectUrl,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    logger.error("Token exchange failed", { status: res.status, body: err });
    throw new Error(`Token exchange failed: ${err}`);
  }

  logger.info("Token exchange 성공");

  const data: unknown = await res.json();

  if (!isGoogleToken(data)) {
    throw new Error("Invalid Google token response shape");
  }

  return data;
}

function isGoogleUserInfo(value: unknown): value is {
  id: string;
  email: string;
  name?: string;
  picture?: string;
} {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const hasValidName = !("name" in v) || typeof v.name === "string";
  const hasValidPicture = !("picture" in v) || typeof v.picture === "string";
  return (
    typeof v.id === "string" &&
    typeof v.email === "string" &&
    hasValidName &&
    hasValidPicture
  );
}

/**
 * 액세스 토큰으로 사용자 정보 조회
 */
export async function getUserInfo(accessToken: string): Promise<IGoogleUser> {
  logger.info("Google 사용자 정보 조회 시도");
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const err = await res.text();
    logger.error("Failed to fetch user info", {
      status: res.status,
      body: err,
    });
    throw new Error("Failed to fetch user info");
  }
  const data: unknown = await res.json();
  if (!isGoogleUserInfo(data)) {
    throw new Error("Invalid Google user info response shape");
  }
  logger.info("Google 사용자 정보 조회 성공", {
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

export async function findOrCreateGoogleUser(
  googleUser: IGoogleUser,
): Promise<SessionUser> {
  const normalizedEmail = googleUser.email.trim().toLowerCase();

  const { data: existingUser, error: selectError } = await supabase
    .from("users")
    .select("id, email, name, profile_image_url")
    .eq("email", normalizedEmail)
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
        .from("users")
        .update(updatePayload)
        .eq("id", existingUser.id)
        .select("id, email, profile_image_url")
        .single();

      if (updateError) {
        throw new Error(updateError.message);
      }

      return {
        id: updatedUser.id,
        email: updatedUser.email,
        profile_image_url: updatedUser.profile_image_url,
      };
    }

    return {
      id: existingUser.id,
      email: existingUser.email,
      profile_image_url: existingUser.profile_image_url,
    };
  }

  const randomPassword = crypto.randomBytes(32).toString("hex");
  const passwordHash = await bcrypt.hash(randomPassword, 12);
  const fallbackName = normalizedEmail.split("@")[0] || "google-user";

  const { data: createdUser, error: insertError } = await supabase
    .from("users")
    .insert({
      email: normalizedEmail,
      password_hash: passwordHash,
      name: googleUser.name ?? fallbackName,
      profile_image_url: googleUser.picture,
    })
    .select("id, email, profile_image_url")
    .single();

  if (insertError) {
    throw new Error(insertError.message);
  }

  return {
    id: createdUser.id,
    email: createdUser.email,
    profile_image_url: createdUser.profile_image_url,
  };
}
