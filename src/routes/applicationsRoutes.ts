import { Router } from 'express';
import {
  listApplicationsByUser,
  getApplication,
  createApplicationHandler,
  updateApplicationHandler,
  deleteApplicationHandler,
  listStatus
} from '../controllers/applicationsController';
import { requireAuth } from '../middlewares/requireAuth';

const router = Router();

/**
 * @swagger
 * /applications/user:
 *   get:
 *     summary: 사용자 지원 현황 조회
 *     description: 인증된 사용자의 모든 지원 내역을 조회합니다.
 *     tags:
 *       - Applications
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: 지원 목록 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Application'
 *       401:
 *         description: 인증 실패
 */
router.get('/user', requireAuth, listApplicationsByUser);

/**
 * @swagger
 * /applications/statuses:
 *   get:
 *     summary: 지원상태 목록 조회
 *     description: 사용 가능한 모든 지원 상태를 조회합니다.
 *     tags:
 *       - Applications
 *     responses:
 *       200:
 *         description: 상태 목록 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   display_name:
 *                     type: string
 *                   is_active:
 *                     type: boolean
 *                   display_order:
 *                     type: number
 */
router.get('/statuses', listStatus);

/**
 * @swagger
 * /applications/{id}:
 *   get:
 *     summary: 특정 지원 정보 조회
 *     description: 지원 ID로 특정 지원 정보를 조회합니다. 본인의 지원만 조회 가능합니다.
 *     tags:
 *       - Applications
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 지원 ID
 *     responses:
 *       200:
 *         description: 지원 정보 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Application'
 *       401:
 *         description: 인증 실패
 *       403:
 *         description: 권한 없음
 *       404:
 *         description: 지원 정보를 찾을 수 없음
 */
router.get('/:id', requireAuth, getApplication);

/**
 * @swagger
 * /applications:
 *   post:
 *     summary: 새로운 지원 생성
 *     description: 새로운 지원 기록을 생성합니다.
 *     tags:
 *       - Applications
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - jobPostingId
 *               - statusId
 *             properties:
 *               jobPostingId:
 *                 type: string
 *                 description: 채용공고 ID
 *               statusId:
 *                 type: string
 *                 description: 지원 상태 ID
 *               appliedAt:
 *                 type: string
 *                 format: date-time
 *                 description: 지원 일시
 *               notes:
 *                 type: string
 *                 description: 메모
 *     responses:
 *       201:
 *         description: 지원 생성 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Application'
 *       400:
 *         description: 필수 필드 누락 또는 유효하지 않은 데이터
 *       401:
 *         description: 인증 실패
 *       23505:
 *         description: 동일한 공고에 이미 지원함
 */
router.post('/', requireAuth, createApplicationHandler);

/**
 * @swagger
 * /applications/{id}:
 *   put:
 *     summary: 지원 정보 수정
 *     description: 지원 정보를 수정합니다. 본인의 지원만 수정 가능합니다.
 *     tags:
 *       - Applications
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 지원 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               statusId:
 *                 type: string
 *                 description: 지원 상태 ID
 *               appliedAt:
 *                 type: string
 *                 format: date-time
 *                 description: 지원 일시
 *               notes:
 *                 type: string
 *                 description: 메모
 *     responses:
 *       200:
 *         description: 지원 수정 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Application'
 *       401:
 *         description: 인증 실패
 *       403:
 *         description: 권한 없음
 *       404:
 *         description: 지원 정보를 찾을 수 없음
 */
router.put('/:id', requireAuth, updateApplicationHandler);

/**
 * @swagger
 * /applications/{id}:
 *   delete:
 *     summary: 지원 삭제
 *     description: 지원 기록을 삭제합니다. 본인의 지원만 삭제 가능합니다.
 *     tags:
 *       - Applications
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 지원 ID
 *     responses:
 *       200:
 *         description: 지원 삭제 성공
 *       401:
 *         description: 인증 실패
 *       403:
 *         description: 권한 없음
 *       404:
 *         description: 지원 정보를 찾을 수 없음
 */
router.delete('/:id', requireAuth, deleteApplicationHandler);

/**
 * @swagger
 * components:
 *   schemas:
 *     Application:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: 지원 ID
 *         jobPostingId:
 *           type: string
 *           description: 채용공고 ID
 *         userId:
 *           type: string
 *           description: 사용자 ID
 *         statusId:
 *           type: string
 *           description: 지원 상태 ID
 *         appliedAt:
 *           type: string
 *           format: date-time
 *           description: 지원 일시
 *         notes:
 *           type: string
 *           description: 메모
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: 생성일시
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: 수정일시
 *   securitySchemes:
 *     cookieAuth:
 *       type: apiKey
 *       in: cookie
 *       name: access_token
 */

export default router;
