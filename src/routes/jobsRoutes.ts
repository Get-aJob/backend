import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import * as jobsController from "../controllers/jobsController";

const router = Router();

/**
 * @swagger
 * /jobs/manual:
 *   post:
 *     summary: 수동 채용 공고 크롤링
 *     tags: [Jobs]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               url:
 *                 type: string
 *                 description: 채용 공고 URL
 *     responses:
 *       201:
 *         description: 크롤링 및 저장 성공
 *       400:
 *         description: URL 누락
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.post("/manual", requireAuth, jobsController.manualCrawlHandler);

/**
 * @swagger
 * /jobs:
 *   get:
 *     summary: 사용자별 채용 공고 조회 (수동 크롤링 전용)
 *     tags: [Jobs]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: sourceType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [manual]
 *     responses:
 *       200:
 *         description: 조회 성공
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.get("/", requireAuth, jobsController.getManualJobsHandler);

export default router;
