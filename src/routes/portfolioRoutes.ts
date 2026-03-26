import express from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { portfolioUploadSingle } from "../middlewares/upload";
import { uploadPortfolio } from "../controllers/portfolioController";

const router = express.Router();

/**
 * @openapi
 * /portfolios/upload:
 *   post:
 *     summary: 포트폴리오 파일 업로드
 *     description: 사용자가 이력서에 첨부할 포트폴리오 파일을 업로드합니다.
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: 업로드 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 fileUrl:
 *                   type: string
 *       400:
 *         description: 파일 없음
 *       401:
 *         description: 인증 실패
 *       413:
 *         description: 파일 크기 초과 (10MB)
 *       500:
 *         description: 업로드 실패
 */
router.post("/upload", requireAuth, portfolioUploadSingle, uploadPortfolio);

export default router;
