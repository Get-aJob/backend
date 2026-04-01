import crypto from "crypto";
import { supabase } from "../lib/supabase";
import { logger } from "../utils/logger";

const PORTFOLIO_BUCKET = "portfolios";

function makeObjectPath(userId: string, originalName: string) {
  const rand = crypto.randomBytes(4).toString("hex");
  const extension = originalName.split(".").pop();
  return `temp/users/${userId}/portfolio-${Date.now()}-${rand}.${extension}`;
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

function extractObjectPathFromUrl(url: string) {
  const publicMarker = `/storage/v1/object/public/${PORTFOLIO_BUCKET}/`;
  const publicIdx = url.indexOf(publicMarker);
  if (publicIdx !== -1) {
    return url.slice(publicIdx + publicMarker.length);
  }

  const signMarker = `/storage/v1/object/sign/${PORTFOLIO_BUCKET}/`;
  const signIdx = url.indexOf(signMarker);
  if (signIdx !== -1) {
    const path = url.slice(signIdx + signMarker.length);
    return path.split("?")[0];
  }

  return null;
}

export async function deletePortfolioFilesFromUrls(
  userId: string,
  urls: string[],
) {
  if (urls.length === 0) return;

  const userPrefix = `users/${userId}/`;
  const tempUserPrefix = `temp/users/${userId}/`;

  const objectPaths = urls
    .map((url) => extractObjectPathFromUrl(url))
    .filter((path): path is string => {
      if (!path) return false;
      return path.startsWith(userPrefix) || path.startsWith(tempUserPrefix);
    });

  if (objectPaths.length === 0) {
    if (urls.length > 0) {
      logger.warn(
        "포트폴리오 파일 삭제 시도 중 본인 소유가 아닌 파일이 포함됨",
        {
          userId,
          urls,
        },
      );
    }
    return;
  }

  logger.info("포트폴리오 파일 삭제 시작", {
    userId,
    count: objectPaths.length,
    objectPaths,
  });

  const { error } = await supabase.storage
    .from(PORTFOLIO_BUCKET)
    .remove(objectPaths);

  if (error) {
    logger.error("포트폴리오 파일 삭제 실패", {
      userId,
      error: error.message,
      objectPaths,
    });
  } else {
    logger.info("포트폴리오 파일 삭제 성공", {
      userId,
      count: objectPaths.length,
    });
  }
}

export async function finalizePortfolioFile(
  userId: string,
  url: string,
): Promise<string> {
  const objectPath = extractObjectPathFromUrl(url);
  const tempUserPrefix = `temp/users/${userId}/`;

  if (!objectPath || !objectPath.startsWith("temp/")) {
    return url;
  }

  if (!objectPath.startsWith(tempUserPrefix)) {
    logger.warn("타인의 임시 포트폴리오 파일 확정 시도가 차단됨", {
      userId,
      objectPath,
    });
    return url;
  }

  const newPath = objectPath.replace("temp/", "");
  logger.info("포트폴리오 파일 확정(이동) 시작", {
    userId,
    from: objectPath,
    to: newPath,
  });

  const { error: moveErr } = await supabase.storage
    .from(PORTFOLIO_BUCKET)
    .move(objectPath, newPath);

  if (moveErr) {
    logger.error("포트폴리오 파일 이동 실패", {
      userId,
      from: objectPath,
      to: newPath,
      error: moveErr.message,
    });
    throw new Error(`파일 확정에 실패했습니다: ${moveErr.message}`);
  }

  const { data: publicUrlData } = supabase.storage
    .from(PORTFOLIO_BUCKET)
    .getPublicUrl(newPath);

  logger.info("포트폴리오 파일 확정 성공", {
    userId,
    from: objectPath,
    to: newPath,
  });
  return publicUrlData.publicUrl;
}

export async function generateSignedUrl(
  storedFileUrl: string,
  expiresIn = 3600, 
): Promise<string | null> {
  const objectPath = extractObjectPathFromUrl(storedFileUrl);
  if (!objectPath) return null;

  const { data, error } = await supabase.storage
    .from(PORTFOLIO_BUCKET)
    .createSignedUrl(objectPath, expiresIn);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function copyPortfolioFile(
  userId: string,
  sourceFileUrl: string,
): Promise<string | null> {
  const objectPath = extractObjectPathFromUrl(sourceFileUrl);
  if (!objectPath) return null;

  const userPrefix = `users/${userId}/`;
  if (!objectPath.startsWith(userPrefix)) {
    logger.warn("타인의 포트폴리오 파일 복사 시도가 차단됨", {
      userId,
      objectPath,
    });
    return null;
  }

  const extension = objectPath.split(".").pop() || "pdf";
  const rand = crypto.randomBytes(4).toString("hex");
  const newPath = `users/${userId}/portfolio-${Date.now()}-${rand}.${extension}`;

  logger.info("포트폴리오 파일 복사 시작", {
    userId,
    from: objectPath,
    to: newPath,
  });

  const { error } = await supabase.storage
    .from(PORTFOLIO_BUCKET)
    .copy(objectPath, newPath);

  if (error) {
    logger.error("포트폴리오 파일 복사 실패", {
      userId,
      from: objectPath,
      to: newPath,
      error: error.message,
    });
    return null;
  }

  const { data: publicUrlData } = supabase.storage
    .from(PORTFOLIO_BUCKET)
    .getPublicUrl(newPath);

  logger.info("포트폴리오 파일 복사 성공", {
    userId,
    from: objectPath,
    to: newPath,
  });

  return publicUrlData.publicUrl;
}
