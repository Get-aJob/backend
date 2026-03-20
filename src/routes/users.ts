import { Request, Response, Router } from "express";
import {
  getUsers,
  withdrawUser,
  uploadMyProfileImage,
  deleteMyProfileImage,
} from "../controllers/usersController";
import { requireAuth } from "../middlewares/requireAuth";
import { profileImageUploadSingle } from "../middlewares/upload";

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
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *           example: INVALID_INPUT
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

/**
 * @swagger
 * /users/me/image:
 *   post:
 *     tags: [User]
 *     summary: 프로필 이미지 업로드
 *     description: |
 *       multipart/form-data 파일(file)을 받아 storage에 업로드하고,
 *       users.profile_image_url을 최신 URL로 갱신합니다.
 *       기존 프로필 이미지가 있으면 storage에서 함께 삭제합니다.
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: 업로드 및 반영 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 프로필 이미지가 반영되었습니다.
 *                 profileImageUrl:
 *                   type: string
 *                   example: https://kbszzyohznsuggbgkqme.supabase.co/storage/v1/object/public/profile-images/users/...
 *       400:
 *         description: 파일 누락 또는 검증 실패
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: 인증 실패
 *       413:
 *         description: 업로드 파일 크기 초과(5MB)
 *       500:
 *         description: storage/DB 처리 실패
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  "/me/image",
  requireAuth,
  profileImageUploadSingle,
  uploadMyProfileImage,
);

/**
 * @swagger
 * /users/me/image:
 *   delete:
 *     tags: [User]
 *     summary: 프로필 이미지 삭제
 *     description: |
 *       현재 사용자 프로필 이미지 파일을 storage에서 삭제하고,
 *       users.profile_image_url 값을 null로 초기화합니다.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: 삭제 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 프로필 이미지를 삭제했습니다.
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: storage/DB 처리 실패
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete("/me/image", requireAuth, deleteMyProfileImage);

export default router;
