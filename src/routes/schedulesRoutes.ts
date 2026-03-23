import { Router } from "express";
import { listSchedules } from "../controllers/schedulesController";
import { optionalAuth } from "../middlewares/optionalAuth";

const router = Router();

/**
 * @swagger
 * /schedules:
 *   get:
 *     tags: [Schedules]
 *     summary: 일정 목록 조회
 *     description: 채용 일정 목록을 조회합니다. 비로그인 시 오픈 공고만 반환되며, 로그인 시에는 사용자 지원 여부 필터(appliedYN)를 사용할 수 있습니다.
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: false
 *         schema:
 *           type: string
 *           example: 2026-03-01
 *         description: 조회 시작일(YYYY-MM-DD). endDate와 함께 전달해야 합니다.
 *       - in: query
 *         name: endDate
 *         required: false
 *         schema:
 *           type: string
 *           example: 2026-03-31
 *         description: 조회 종료일(YYYY-MM-DD). startDate와 함께 전달해야 합니다.
 *       - in: query
 *         name: appliedYN
 *         required: false
 *         schema:
 *           type: string
 *           enum: [Y, N]
 *         description: 사용자 지원 여부 필터(Y=지원한 공고, N=미지원 공고)
 *     responses:
 *       200:
 *         description: 조회 성공
 *       400:
 *         description: 잘못된 쿼리 파라미터
 */
router.get("/", optionalAuth, listSchedules);

export default router;
