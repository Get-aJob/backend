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
 *     description: 인증된 사용자의 지원 내역을 페이지네이션으로 조회합니다.
 *     tags:
 *       - Applications
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 20
 *         description: 페이지 크기
 *       - in: query
 *         name: offset
 *         required: false
 *         schema:
 *           type: integer
 *           default: 0
 *         description: 시작 위치
 *     responses:
 *       200:
 *         description: 지원 목록 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApplicationsByUserResponse'
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
 *               $ref: '#/components/schemas/ApplicationStatusesResponse'
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
 *               $ref: '#/components/schemas/ApplicationResponse'
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
 *               $ref: '#/components/schemas/ApplicationResponse'
 *       400:
 *         description: 필수 필드 누락 또는 유효하지 않은 데이터
 *       401:
 *         description: 인증 실패
 *       409:
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
 *               $ref: '#/components/schemas/ApplicationResponse'
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
 *       204:
 *         description: 지원 삭제 성공 (No Content)
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
 *         statusChangedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: 상태 변경 일시
 *         notes:
 *           type: string
 *           description: 메모
 *         statusName:
 *           type: string
 *           nullable: true
 *           description: 지원 상태명
 *         jobPostings:
 *           type: object
 *           nullable: true
 *           description: 연관 채용공고 정보
 *         histories:
 *           type: array
 *           description: 지원 상태 변경 이력 목록
 *           items:
 *             type: object
 *             properties:
 *               toStatusId:
 *                 type: string
 *                 nullable: true
 *               toStatusName:
 *                 type: string
 *                 nullable: true
 *               changedAt:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *     ApplicationResponse:
 *       type: object
 *       properties:
 *         application:
 *           $ref: '#/components/schemas/Application'
 *     ApplicationsByUserResponse:
 *       type: object
 *       properties:
 *         applications:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Application'
 *         pagination:
 *           type: object
 *           properties:
 *             totalCount:
 *               type: integer
 *             hasNext:
 *               type: boolean
 *             nextOffset:
 *               type: integer
 *               nullable: true
 *             limit:
 *               type: integer
 *             offset:
 *               type: integer
 *     ApplicationStatus:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         displayName:
 *           type: string
 *           description: 지원 상태명
 *         isActive:
 *           type: boolean
 *           description: 활성화 여부
 *         displayOrder:
 *           type: number
 *           description: 표시 순서
 *     ApplicationStatusesResponse:
 *       type: object
 *       properties:
 *         statuses:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ApplicationStatus'
 *   securitySchemes:
 *     cookieAuth:
 *       type: apiKey
 *       in: cookie
 *       name: access_token
 */

export default router;
