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
 *     summary: 채용 공고 조회 (자동/수동 필터링)
 *     tags: [Jobs]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: sourceType
 *         required: true
 *         description: 공고 출처 필터 (auto, manual)
 *         schema:
 *           type: string
 *           enum: [auto, manual]
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: 조회 성공
 *       400:
 *         description: 잘못된 요청 (sourceType 누락 등)
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.get("/", requireAuth, jobsController.getJobsHandler);

export default router;
