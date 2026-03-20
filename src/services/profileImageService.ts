import crypto from "crypto";
import sharp from "sharp";
import { supabase } from "../lib/supabase";
import { logger } from "../utils/logger";

const PROFILE_BUCKET = "profile-images";
const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

/**
 * 프로필 이미지 objectPath를 서버에서 생성한다.
 * - 저장 포맷을 webp로 고정해 확장자도 webp로 통일
 * - userId prefix로 소유권 검증/정리가 쉬워짐
 */
function makeObjectPath(userId: string) {
  const rand = crypto.randomBytes(4).toString("hex");
  return `users/${userId}/profile-${Date.now()}-${rand}.webp`;
}

/**
 * 업로드 가능한 타입인지 검증한다.
 */
function validateContentType(contentType: string) {
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    throw new Error("UNSUPPORTED_CONTENT_TYPE");
  }
}

/**
 * 업로드 파일을 webp로 정규화한다.
 * - 저장 포맷을 통일해 전송/캐시 정책을 단순화
 * - quality는 과도한 화질 손실 없이 용량 절감을 노리는 기본값
 */
async function convertToWebp(buffer: Buffer) {
  return sharp(buffer).webp({ quality: 82 }).toBuffer();
}

/**
 * objectPath가 현재 로그인 사용자 영역인지 검증한다.
 * - 타인 경로를 commit하려는 시도를 차단
 */
function assertOwnedPath(userId: string, objectPath: string) {
  if (!objectPath.startsWith(`users/${userId}/`)) {
    throw new Error("FORBIDDEN_OBJECT_PATH");
  }
}

/**
 * 1단계: 업로드 URL 발급
 * - 서버는 URL과 objectPath만 발급
 * - 실제 파일 업로드는 클라이언트가 Supabase Storage로 직접 수행
 */
export async function issueMyImageUploadUrl(params: {
  userId: string;
  contentType: string;
}) {
  const { userId, contentType } = params;
  logger.info("프로필 이미지 업로드 URL 발급 시작", { userId, contentType });

  validateContentType(contentType);

  const objectPath = makeObjectPath(userId);

  const { data, error } = await supabase.storage
    .from(PROFILE_BUCKET)
    .createSignedUploadUrl(objectPath);

  if (error || !data) {
    logger.error("프로필 이미지 업로드 URL 발급 실패", {
      userId,
      contentType,
      objectPath,
      error: error?.message,
    });
    throw new Error(error?.message ?? "프로필 이미지 업로드에 실패했습니다.");
  }

  logger.info("프로필 이미지 업로드 URL 발급 성공", {
    userId,
    objectPath,
  });

  return {
    uploadUrl: data.signedUrl,
    token: data.token,
    objectPath,
    expiresIn: 120,
  };
}

/**
 * 단일 업로드 방식:
 * - 서버가 multipart 파일을 직접 받아 storage 업로드
 * - 업로드 성공 후 users.profile_image_url을 공개 URL로 갱신
 * - 기존 프로필 이미지는 storage에서 삭제
 */
export async function uploadProfileImageFromBuffer(params: {
  userId: string;
  buffer: Buffer;
  contentType: string;
}) {
  const { userId, buffer, contentType } = params;
  logger.info("프로필 이미지 단일 업로드 시작", {
    userId,
    contentType,
    size: buffer.length,
  });

  validateContentType(contentType);
  const webpBuffer = await convertToWebp(buffer);
  const objectPath = makeObjectPath(userId);
  const newUrl = toPublicUrl(objectPath);

  const { data: userRow, error: userErr } = await supabase
    .from("users")
    .select("profile_image_url")
    .eq("id", userId)
    .single();

  if (userErr || !userRow) {
    logger.error("프로필 이미지 단일 업로드 실패 - 사용자 조회 실패", {
      userId,
      error: userErr?.message,
    });
    throw new Error(userErr?.message ?? "USER_NOT_FOUND");
  }

  const { error: uploadErr } = await supabase.storage
    .from(PROFILE_BUCKET)
    .upload(objectPath, webpBuffer, {
      contentType: "image/webp",
      upsert: false,
    });

  if (uploadErr) {
    logger.error("프로필 이미지 단일 업로드 실패 - storage 업로드 실패", {
      userId,
      objectPath,
      error: uploadErr.message,
    });
    throw new Error(uploadErr.message);
  }

  const { error: updateErr } = await supabase
    .from("users")
    .update({ profile_image_url: newUrl })
    .eq("id", userId);

  if (updateErr) {
    logger.error("프로필 이미지 단일 업로드 실패 - DB 업데이트 실패", {
      userId,
      objectPath,
      newUrl,
      error: updateErr.message,
    });
    throw new Error(updateErr.message);
  }

  logger.info("프로필 이미지 webp 변환 완료", {
    userId,
    originalBytes: buffer.length,
    webpBytes: webpBuffer.length,
  });

  const prevUrl = userRow.profile_image_url as string | null;
  if (prevUrl) {
    const prevObjectPath = extractObjectPathFromUrl(prevUrl);
    if (prevObjectPath) {
      const { error: removeErr } = await supabase.storage
        .from(PROFILE_BUCKET)
        .remove([prevObjectPath]);
      if (removeErr) {
        logger.error("프로필 이미지 단일 업로드 실패 - 이전 파일 삭제 실패", {
          userId,
          prevObjectPath,
          error: removeErr.message,
        });
        throw new Error(removeErr.message);
      }
    }
  }

  logger.info("프로필 이미지 단일 업로드 성공", { userId, objectPath, newUrl });
  return { profileImageUrl: newUrl };
}

/**
 * 2단계: 업로드 완료 커밋
 * - 업로드가 성공한 파일을 "공식 프로필 이미지"로 반영
 * - 기존 프로필 파일이 있으면 제거해서 고아 파일 방지
 */
export async function commitProfileImage(params: {
  userId: string;
  objectPath: string;
}) {
  const { userId, objectPath } = params;
  logger.info("프로필 이미지 커밋 시작", { userId, objectPath });

  assertOwnedPath(userId, objectPath);

  const { data: userRow, error: userErr } = await supabase
    .from("users")
    .select("profile_image_url")
    .eq("id", userId)
    .single();

  if (userErr || !userRow) {
    logger.error("프로필 이미지 커밋 실패 - 사용자 조회 실패", {
      userId,
      objectPath,
      error: userErr?.message,
    });
    throw new Error(userErr?.message ?? "USER_NOT_FOUND");
  }

  const newUrl = toPublicUrl(objectPath);

  const { error: updateErr } = await supabase
    .from("users")
    .update({ profile_image_url: newUrl })
    .eq("id", userId);
  if (updateErr) {
    logger.error("프로필 이미지 커밋 실패 - DB 업데이트 실패", {
      userId,
      objectPath,
      newUrl,
      error: updateErr.message,
    });
    throw new Error(updateErr.message);
  }

  const prevUrl = userRow.profile_image_url as string | null;

  if (prevUrl) {
    const prevObjectPath = extractObjectPathFromUrl(prevUrl);
    if (prevObjectPath) {
      const { error: removeErr } = await supabase.storage
        .from(PROFILE_BUCKET)
        .remove([prevObjectPath]);
      if (removeErr) {
        logger.error("프로필 이미지 커밋 실패 - 이전 파일 삭제 실패", {
          userId,
          prevObjectPath,
          error: removeErr.message,
        });
        throw new Error(removeErr.message);
      }
      logger.info("프로필 이미지 커밋 - 이전 파일 삭제 성공", {
        userId,
        prevObjectPath,
      });
    }
  }

  logger.info("프로필 이미지 커밋 성공", { userId, objectPath, newUrl });
  return { ok: true as const, objectPath };
}

/**
 * 현재 프로필 이미지 삭제
 * - storage 파일 삭제 + DB path null 처리
 */
export async function deleteProfileImage(params: { userId: string }) {
  const { userId } = params;
  logger.info("프로필 이미지 삭제 시작", { userId });
  const { data: userRow, error: userErr } = await supabase
    .from("users")
    .select("profile_image_url")
    .eq("id", userId)
    .single();
  if (userErr || !userRow) {
    logger.error("프로필 이미지 삭제 실패 - 사용자 조회 실패", {
      userId,
      error: userErr?.message,
    });
    throw new Error(userErr?.message ?? "USER_NOT_FOUND");
  }

  const currentUrl = userRow.profile_image_url as string | null;
  if (currentUrl) {
    const currentObjectPath = extractObjectPathFromUrl(currentUrl);
    if (!currentObjectPath) {
      logger.error("프로필 이미지 삭제 실패 - URL 파싱 실패", {
        userId,
        currentUrl,
      });
      throw new Error("INVALID_PROFILE_IMAGE_URL");
    }
    const { error: removeErr } = await supabase.storage
      .from(PROFILE_BUCKET)
      .remove([currentObjectPath]);
    if (removeErr) {
      logger.error("프로필 이미지 삭제 실패 - storage 삭제 실패", {
        userId,
        currentObjectPath,
        error: removeErr.message,
      });
      throw new Error(removeErr.message);
    }
    logger.info("프로필 이미지 삭제 - storage 파일 삭제 성공", {
      userId,
      currentObjectPath,
    });
  }

  const { error: updateErr } = await supabase
    .from("users")
    .update({ profile_image_url: null })
    .eq("id", userId);
  if (updateErr) {
    logger.error("프로필 이미지 삭제 실패 - DB null 업데이트 실패", {
      userId,
      error: updateErr.message,
    });
    throw new Error(updateErr.message);
  }
  logger.info("프로필 이미지 삭제 성공", { userId });
  return { ok: true as const };
}

/**
 * objectPath -> public URL 변환
 * 주의:
 * - private bucket이면 이 URL로 접근이 안 될 수 있다.
 * - 버킷 정책 변경 시 기존 DB URL이 무효화될 수 있어 운영 정책을 고정해야 한다.
 */
function toPublicUrl(objectPath: string) {
  const { data } = supabase.storage.from(PROFILE_BUCKET).getPublicUrl(objectPath);
  if (!data?.publicUrl) throw new Error("PUBLIC_URL_CREATE_FAILED");
  return data.publicUrl;
}


/**
 * DB에 저장된 public URL에서 objectPath를 역추출한다.
 *
 * 이유:
 * - Storage remove()는 URL이 아니라 objectPath를 받는다.
 * - URL 저장 전략에서는 삭제 시 역추출이 필요하다.
 *
 * 예:
 * https://.../storage/v1/object/public/profile-images/users/xxx/a.png
 * -> users/xxx/a.png
 *
 * 실패 시 null 반환:
 * - URL 포맷이 예상과 다르면 안전하게 삭제를 건너뛰거나 에러 처리 분기 필요
 */
function extractObjectPathFromUrl(url: string) {
  // 예: .../storage/v1/object/public/profile-images/users/xxx/profile-123.png
  const marker = "/storage/v1/object/public/profile-images/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}