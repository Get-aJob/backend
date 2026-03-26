import { Request, Response } from "express";
import { uploadPortfolioFile } from "../services/portfolioService";
import { logger } from "../utils/logger";

export async function uploadPortfolio(req: Request, res: Response) {
  const user = res.locals.user as { id: string; email: string } | undefined;

  if (!user?.id) {
    return res.status(401).json({ error: "UNAUTHORIZED" });
  }

  const file = req.file;
  if (!file) {
    return res
      .status(400)
      .json({ error: "FILE_REQUIRED", message: "업로드할 파일이 없습니다." });
  }

  try {
    logger.info("포트폴리오 업로드 요청 수신", {
      userId: user.id,
      fileName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    });

    const result = await uploadPortfolioFile({
      userId: user.id,
      buffer: file.buffer,
      fileName: file.originalname,
      contentType: file.mimetype,
    });

    return res.status(200).json({
      message: "파일 업로드에 성공했습니다.",
      fileUrl: result.fileUrl,
    });
  } catch (error) {
    logger.error("포트폴리오 업로드 컨트롤러 에러", {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    });

    return res.status(500).json({
      error: "PORTFOLIO_UPLOAD_FAILED",
      message:
        error instanceof Error
          ? error.message
          : "파일 업로드 중 오류가 발생했습니다.",
    });
  }
}
