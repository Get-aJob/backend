import { Router } from "express";
import {
  join,
  login,
  me,
  logout,
  refresh,
  requestPasswordReset,
  confirmPasswordReset,
} from "../controllers/authController";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: 인증 API
 */

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     cookieAuth:
 *       type: apiKey
 *       in: cookie
 *       name: access_token
 *   schemas:
 *     AuthJoinRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *         - name
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: user@example.com
 *         password:
 *           type: string
 *           example: P@ssw0rd!
 *         name:
 *           type: string
 *           example: 홍길동
 *     AuthLoginRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: user@example.com
 *         password:
 *           type: string
 *           example: P@ssw0rd!
 *     AuthUser:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
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
 *           example: https://xxx.supabase.co/storage/v1/object/public/profile-images/users/xxx/profile.webp
 */

/**
 * @swagger
 * /auth/join:
 *   post:
 *     tags: [Auth]
 *     summary: 회원가입
 *     description: 이메일, 비밀번호, 이름으로 회원가입합니다.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AuthJoinRequest'
 *     responses:
 *       201:
 *         description: 회원가입 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 회원가입에 성공했습니다.
 *       400:
 *         description: 필수 값 누락
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: 필수 정보를 입력하지 않았습니다.
 */
router.post("/join", join);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: 로그인
 *     description: 로그인 성공 시 access/refresh 토큰 쿠키를 발급합니다.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AuthLoginRequest'
 *     responses:
 *       200:
 *         description: 로그인 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/AuthUser'
 *       400:
 *         description: 필수 값 누락
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: 필수 정보를 입력하지 않았습니다.
 *       401:
 *         description: 인증 실패
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: UNAUTHORIZED
 */
router.post("/login", login);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: 내 정보 조회
 *     description: access_token 쿠키를 사용해 현재 로그인한 사용자 정보를 조회합니다.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/AuthUser'
 *       401:
 *         description: 인증 실패
 */
router.get("/me", requireAuth, me);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: 로그아웃
 *     description: 인증 쿠키(access_token, refresh_token)를 제거해 로그아웃합니다.
 *     responses:
 *       200:
 *         description: 로그아웃 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 로그아웃에 성공했습니다.
 */
router.post("/logout", logout);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: 토큰 재발급
 *     description: refresh_token 쿠키를 검증하고 access/refresh 토큰을 회전 발급합니다.
 *     responses:
 *       200:
 *         description: 재발급 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 토큰이 재발급되었습니다.
 *       401:
 *         description: refresh 검증 실패 또는 재사용 감지
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: TOKEN_REUSE_DETECTED
 */
router.post("/refresh", refresh);

router.post("/password/reset", requestPasswordReset);
router.put("/password/reset", confirmPasswordReset);

export default router;
