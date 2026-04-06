import { Router } from "express";
import {
  getNotificationsHandler,
  getUnreadCountHandler,
} from "../controllers/notificationController";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: 내 알림 목록 조회 (커서 기반)
 *     tags: [Notifications]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: cursor
 *         required: false
 *         schema:
 *           type: string
 *         description: 다음 페이지 조회용 opaque cursor
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 20
 *         description: 페이지 크기 (서버에서 최대값 제한)
 *       - in: query
 *         name: unread_only
 *         required: false
 *         schema:
 *           type: boolean
 *         description: true면 미읽음 알림만
 *     responses:
 *       200:
 *         description: 조회 성공
 *       400:
 *         description: 유효하지 않은 cursor
 *       401:
 *         description: 인증 필요
 *       500:
 *         description: 서버 오류
 */
router.get("/", requireAuth, getNotificationsHandler);

router.get("/unread-count", requireAuth, getUnreadCountHandler);
export default router;
