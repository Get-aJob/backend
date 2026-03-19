import bcrypt from "bcrypt";
import crypto from "crypto";
import { supabase } from "../lib/supabase";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../lib/jwt";

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
  let payload: { id: string; email: string };
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
    .select("user_id, token_hash, expires_at, revoded_at")
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
    current.revoded_at ||
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
  });
  const newRefreshToken = signRefreshToken({
    id: payload.id,
    email: payload.email,
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
}: {
  email: string;
  password: string;
  name: string;
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
    // 중복 이메일 등은 error.code로 분기 가능
    throw new Error(error.message);
  }

  return data;
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
    .select("id, email, password_hash, name")
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

  // 3) 토큰 발급
  const accessToken = signAccessToken({
    id: user.id,
    email: user.email,
  });

  const refreshToken = signRefreshToken({
    id: user.id,
    email: user.email,
  });

  // 4) refresh token DB 저장 (해시된 토큰으로 저장해야 DB가 털려도 원문이 없음)
  const refreshTokenHash = sha256(refreshToken);

  const expiresAt = new Date();
  // JWT_REFRESH_EXPIRES_IN을 파싱해도 되지만, 우선 고정
  expiresAt.setDate(expiresAt.getDate() + 14);

  const { error: rtError } = await supabase.from("refresh_tokens").insert({
    user_id: user.id,
    token_hash: refreshTokenHash,
    expires_at: expiresAt.toISOString(),
  });

  if (rtError) {
    throw new Error(rtError.message);
  }

  return {
    ok: true as const,
    user: { id: user.id, email: user.email, name: user.name },
    accessToken,
    refreshToken,
  };
}
