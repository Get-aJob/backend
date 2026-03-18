import type { CookieOptions } from "express";
import type { SignOptions } from "jsonwebtoken";

function toBool(v: string | undefined, fallback: boolean) {
  if (v === undefined) return fallback;
  return v.toLowerCase() === "true";
}

export const authConfig = {
  access: {
    expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN ??
      "15m") as SignOptions["expiresIn"],
    cookieName: "access_token",
  },
  refresh: {
    expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN ??
      "14d") as SignOptions["expiresIn"],
    cookieName: "refresh_token",
  },
  cookie: {
    secure: toBool(
      process.env.COOKIE_SECURE,
      process.env.NODE_ENV === "production",
    ),
    sameSite: (process.env.COOKIE_SAMESITE ?? "lax") as
      | "lax"
      | "strict"
      | "none",
    domain: process.env.COOKIE_DOMAIN || undefined,
  },
};

export function accessCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: authConfig.cookie.secure,
    sameSite: authConfig.cookie.sameSite,
    domain: authConfig.cookie.domain,
    path: "/", // access는 전체 요청에 필요
    maxAge: 15 * 60 * 1000, // 15분
  };
}

export function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: authConfig.cookie.secure,
    sameSite: authConfig.cookie.sameSite,
    domain: authConfig.cookie.domain,
    path: "auth/refresh", // refresh는 refresh endpoint에서만 자동 전송
    maxAge: 14 * 24 * 60 * 60 * 1000, // 14일
  };
}
