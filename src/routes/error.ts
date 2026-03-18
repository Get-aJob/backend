import { Request, Response, NextFunction } from "express";
/**
 * 에러 처리 미들웨어 (4-arg: err, req, res, next)
 * JSON 파싱 실패 등 클라이언트 요청 오류 시 400 반환.
 */
function errorRouter(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (err instanceof SyntaxError) {
    return res.status(400).json({ error: "Invalid JSON in request body" });
  }
  next(err);
}

export default errorRouter;
