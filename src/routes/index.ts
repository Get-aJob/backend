import express from "express";
import { formatUptime } from "../utils/time";

const router = express.Router();

/**
 * @openapi
 * /healthy:
 *   get:
 *     summary: 서버 헬스체크
 *     description: 서버 및 기본 의존성(프로세스)이 살아있는지 확인합니다.
 *     responses:
 *       200:
 *         description: 서버가 정상 동작 중일 때 반환됩니다.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 uptime:
 *                   type: string
 *                   example: HH:mm:ss
 */
router.get("/healthy", (req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: formatUptime(process.uptime()),
  });
});

export default router;
