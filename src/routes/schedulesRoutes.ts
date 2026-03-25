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
 *     description: 채용 일정 목록을 조회합니다. 비로그인 시 오픈 공고만 반환되며, 로그인 시에는 사용자 지원 여부 필터(isApplied)를 사용할 수 있습니다.
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
 *         name: isApplied
 *         required: false
 *         schema:
 *           type: boolean
 *         description: 지원한 공고만 조회(true=지원한 공고만 조회, 로그인 필수)
 *     responses:
 *       200:
 *         description: 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 schedules:
 *                   type: object
 *                   properties:
 *                     events:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           jobPostingId:
 *                             type: string
 *                           type:
 *                             type: string
 *                             example: job_post
 *                           eventType:
 *                             type: string
 *                             enum: [deadline, applied]
 *                             description: deadline=공고 마감일 기준, applied=지원일 기준
 *                           title:
 *                             type: string
 *                           companyName:
 *                             type: string
 *                           sourceType:
 *                             type: string
 *                             description: 공고 수집 출처 유형
 *                             example: auto
 *                           companyLogo:
 *                             type: string
 *                             description: 회사 로고 URL. 값이 없으면 빈 문자열
 *                             example: https://example.com/company-logo.png
 *                           date:
 *                             type: string
 *                             example: 2026-03-31
 *                           isApplied:
 *                             type: boolean
 *                             description: 해당 공고에 지원했는지 여부
 *       400:
 *         description: 잘못된 쿼리 파라미터
 */
router.get("/", optionalAuth, listSchedules);

export default router;
