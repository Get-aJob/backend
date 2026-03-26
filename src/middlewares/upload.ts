import multer from "multer";
import { Request, Response, NextFunction } from "express";

const profileImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

const portfolioUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

export function profileImageUploadSingle(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  profileImageUpload.single("file")(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        error: "PAYLOAD_TOO_LARGE",
        message: "파일 크기는 5MB 이하여야 합니다.",
      });
    }

    if (err) {
      return res.status(400).json({
        error: "INVALID_MULTIPART_REQUEST",
      });
    }

    next();
  });
}

export function portfolioUploadSingle(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  portfolioUpload.single("file")(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        error: "PAYLOAD_TOO_LARGE",
        message: "파일 크기는 10MB 이하여야 합니다.",
      });
    }

    if (err) {
      return res.status(400).json({
        error: "INVALID_MULTIPART_REQUEST",
      });
    }

    next();
  });
}
