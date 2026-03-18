import bcrypt from "bcrypt";
import crypto from "crypto";
import { supabase } from "../lib/supabase";
import { signAccessToken, signRefreshToken } from "../lib/jwt";

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export async function registeUser({
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
