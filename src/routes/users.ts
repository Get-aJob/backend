import { Request, Response, Router } from "express";
import { getUsers, withdrawUser } from "../controllers/usersController";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: User
 *     description: 사용자 API
 * components:
 *   schemas:
 *     UserItem:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "1"
 *         email:
 *           type: string
 *           format: email
 *           example: user@example.com
 *         name:
 *           type: string
 *           example: 홍길동
 *         profile_image_url:
 *           type: string
 *           nullable: true
 *           example: https://example.com/profile.png
 *         email_notification:
 *           type: boolean
 *           example: true
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /users:
 *   get:
 *     tags: [User]
 *     summary: 회원 목록 조회
 *     description: 회원 목록을 조회합니다.
 *     responses:
 *       200:
 *         description: 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/UserItem'
 *       500:
 *         description: 서버 에러
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: 회원 목록 조회에 실패했습니다.
 */
router.get("/", getUsers);

/**
 * @swagger
 * /users/me:
 *   delete:
 *     tags: [User]
 *     summary: 회원탈퇴
 *     description: 현재 로그인한 사용자와 연관 데이터를 즉시 삭제하고 모든 세션을 종료합니다.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: 회원탈퇴 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 회원탈퇴에 성공했습니다.
 *       401:
 *         description: 인증 실패
 */
router.delete("/me", requireAuth, withdrawUser);

export default router;
