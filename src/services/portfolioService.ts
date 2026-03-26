import crypto from "crypto";
import { supabase } from "../lib/supabase";
import { logger } from "../utils/logger";

const PORTFOLIO_BUCKET = "portfolios";

function makeObjectPath(userId: string, originalName: string) {
  const rand = crypto.randomBytes(4).toString("hex");
  const extension = originalName.split(".").pop();
  return `users/${userId}/portfolio-${Date.now()}-${rand}.${extension}`;
}

export async function uploadPortfolioFile(params: {
  userId: string;
  buffer: Buffer;
  fileName: string;
  contentType: string;
}) {
  const { userId, buffer, fileName, contentType } = params;
  logger.info("포트폴리오 파일 업로드 시작", {
    userId,
    fileName,
    contentType,
    size: buffer.length,
  });

  const objectPath = makeObjectPath(userId, fileName);

  const { data: uploadData, error: uploadErr } = await supabase.storage
    .from(PORTFOLIO_BUCKET)
    .upload(objectPath, buffer, {
      contentType,
      upsert: false,
    });

  if (uploadErr) {
    logger.error("포트폴리오 파일 업로드 실패", {
      userId,
      objectPath,
      error: uploadErr.message,
    });
    throw new Error(`파일 업로드에 실패했습니다: ${uploadErr.message}`);
  }

  const { data: publicUrlData } = supabase.storage
    .from(PORTFOLIO_BUCKET)
    .getPublicUrl(objectPath);

  if (!publicUrlData?.publicUrl) {
    logger.error("포트폴리오 공개 URL 생성 실패", { userId, objectPath });
    throw new Error("공개 URL 생성에 실패했습니다.");
  }

  logger.info("포트폴리오 파일 업로드 성공", {
    userId,
    objectPath,
    publicUrl: publicUrlData.publicUrl,
  });

  return {
    fileUrl: publicUrlData.publicUrl,
    objectPath,
  };
}

/**
 * DB에 저장된 public URL에서 objectPath를 역추출한다.
 */
function extractObjectPathFromUrl(url: string) {
  const marker = `/storage/v1/object/public/${PORTFOLIO_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}

/**
 * 여러 개의 포트폴리오 URL을 받아 스토리지에서 삭제한다.
 */
export async function deletePortfolioFilesFromUrls(urls: string[]) {
  if (urls.length === 0) return;

  const objectPaths = urls
    .map((url) => extractObjectPathFromUrl(url))
    .filter((path): path is string => path !== null);

  if (objectPaths.length === 0) return;

  logger.info("포트폴리오 파일 삭제 시작", { count: objectPaths.length, objectPaths });

  const { error } = await supabase.storage
    .from(PORTFOLIO_BUCKET)
    .remove(objectPaths);

  if (error) {
    logger.error("포트폴리오 파일 삭제 실패", { error: error.message, objectPaths });
    // 삭제 실패가 비즈니스 로직 전체를 중단시키지는 않도록 함 (고아 파일 발생 허용)
  } else {
    logger.info("포트폴리오 파일 삭제 성공", { count: objectPaths.length });
  }
}
