import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { optionalAuth } from "../middlewares/optionalAuth";
import * as jobsController from "../controllers/jobsController";
import {
  createDirectJobHandler,
  updateDirectJobHandler,
  getDirectJobsHandler,
  deleteDirectJobHandler,
} from "../controllers/jobsController";

import * as jobCommentsController from "../controllers/jobCommentsController";

const router = Router();


/**
 * @swagger
 * /jobs/manual/preview:
 *   post:
 *     summary: 수동 채용 공고 크롤링 미리보기
 *     description: URL을 크롤링하여 공고 데이터를 반환합니다. DB에 저장하지 않습니다.
 *     tags: [Jobs]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [url]
 *             properties:
 *               url:
 *                 type: string
 *                 description: 채용 공고 URL
 *     responses:
 *       200:
 *         description: 크롤링 성공 (저장 전 미리보기 데이터 반환)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 preview:
 *                   type: object
 *                   properties:
 *                     title:
 *                       type: string
 *                     companyName:
 *                       type: string
 *                     companyLogo:
 *                       type: string
 *                     location:
 *                       type: string
 *                     experience:
 *                       type: string
 *                     deadline:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                     deadlineText:
 *                       type: string
 *                       nullable: true
 *                     sourceUrl:
 *                       type: string
 *                     externalId:
 *                       type: string
 *                     content:
 *                       type: object
 *                       description: 크롤링 원본 데이터
 *       400:
 *         description: URL 누락
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 크롤링 오류
 */
router.post("/manual/preview", requireAuth, jobsController.manualPreviewHandler);

/**
 * @swagger
 * /jobs/manual/save:
 *   post:
 *     summary: 수동 채용 공고 저장
 *     description: 미리보기에서 확인/수정한 공고 데이터를 DB에 저장합니다.
 *     tags: [Jobs]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, companyName, externalId]
 *             properties:
 *               title:
 *                 type: string
 *               companyName:
 *                 type: string
 *               externalId:
 *                 type: string
 *                 description: preview 응답에서 받은 externalId 값
 *               sourceUrl:
 *                 type: string
 *               companyLogo:
 *                 type: string
 *               location:
 *                 type: string
 *               experience:
 *                 type: string
 *               deadline:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *               deadlineText:
 *                 type: string
 *                 nullable: true
 *               content:
 *                 type: object
 *                 description: 크롤링 원본 데이터 (preview에서 받은 값 그대로)
 *     responses:
 *       201:
 *         description: 저장 성공
 *       400:
 *         description: 필수 항목 누락 (title, companyName, externalId)
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 저장 오류
 */
router.post("/manual/save", requireAuth, jobsController.manualSaveHandler);



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
router.get("/", optionalAuth, jobsController.getJobsHandler);

/**
 * @swagger
 * /jobs/manual/{externalId}:
 *   delete:
 *     summary: 수동 채용 공고 삭제
 *     description: 본인이 등록한 수동 공고를 externalId로 삭제합니다. source_type=manual + external_id + created_by(userId) 3중 검증으로 본인 공고만 삭제 가능합니다.
 *     tags: [Jobs]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: externalId
 *         required: true
 *         description: 삭제할 공고의 external_id
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: 삭제 성공 (응답 본문 없음)
 *       400:
 *         description: externalId 누락
 *       401:
 *         description: 인증 실패
 *       404:
 *         description: 해당 공고 없음 또는 삭제 권한 없음
 *       500:
 *         description: 서버 오류
 */
router.delete(
  "/manual/:externalId",
  requireAuth,
  jobsController.deleteManualJobHandler,
);

/**
 * @swagger
 * /jobs/direct:
 *   post:
 *     summary: 직접 입력 공고 생성
 *     tags: [Jobs]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, companyName]
 *             properties:
 *               title:
 *                 type: string
 *               companyName:
 *                 type: string
 *               location:
 *                 type: string
 *               experience:
 *                 type: string
 *               companyLogo:
 *                 type: string
 *               deadline:
 *                 type: string
 *                 format: date
 *               deadlineText:
 *                 type: string
 *               description:
 *                 type: string
 *               sourceUrl:
 *                 type: string
 *     responses:
 *       201:
 *         description: 공고 생성 성공
 *       400:
 *         description: 필수 항목 누락
 *       401:
 *         description: 인증 필요
 */
router.post("/direct", requireAuth, createDirectJobHandler);


/**
 * @swagger
 * /jobs/direct:
 *   get:
 *     summary: 내 직접 입력 공고 목록 조회
 *     tags: [Jobs]
 *     security:
 *       - cookieAuth: []
 *     parameters:
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
 *         description: 목록 조회 성공
 */
router.get("/direct", requireAuth, getDirectJobsHandler);

/**
 * @swagger
 * /jobs/direct/{externalId}:
 *   put:
 *     summary: 직접 입력 공고 수정
 *     tags: [Jobs]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: externalId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               companyName:
 *                 type: string
 *               location:
 *                 type: string
 *               experience:
 *                 type: string
 *               companyLogo:
 *                 type: string
 *               deadline:
 *                 type: string
 *                 format: date
 *               deadlineText:
 *                 type: string
 *               description:
 *                 type: string
 *               sourceUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: 수정 성공
 *       400:
 *         description: 수정할 항목 없음
 *       401:
 *         description: 인증 필요
 *       404:
 *         description: 공고 없음
 */

router.put("/direct/:externalId", requireAuth, updateDirectJobHandler);

/**
 * @swagger
 * /jobs/direct/{externalId}:
 *   delete:
 *     summary: 직접 입력 공고 삭제
 *     tags: [Jobs]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: externalId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: 삭제 성공
 */
router.delete("/direct/:externalId", requireAuth, deleteDirectJobHandler);

/**
 * @swagger
 * /jobs/{jobId}/comments:
 *   post:
 *     summary: 공고 댓글 작성
 *     tags: [Jobs]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 공고(job_postings) ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content:
 *                 type: string
 *     responses:
 *       201:
 *         description: 작성 성공
 *       400:
 *         description: jobId 형식 오류 또는 content 누락/공백
 *       401:
 *         description: 인증 필요
 *       404:
 *         description: 공고 없음
 *       500:
 *         description: 서버 오류
 */
router.post(
  "/:jobId/comments",
  requireAuth,
  jobCommentsController.createJobCommentHandler,
);

/**
 * @swagger
 * /jobs/{jobId}/comments:
 *   get:
 *     summary: 공고 댓글 목록
 *     description: 비로그인도 조회 가능합니다(쿠키 선택).
 *     tags: [Jobs]
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 공고(job_postings) ID
 *     responses:
 *       200:
 *         description: 조회 성공
 *       400:
 *         description: jobId 형식 오류
 *       404:
 *         description: 공고 없음
 *       500:
 *         description: 서버 오류
 */
router.get(
  "/:jobId/comments",
  optionalAuth,
  jobCommentsController.getJobComments,
);

/**
 * @swagger
 * /jobs/{jobId}/comments/{commentId}:
 *   put:
 *     summary: 공고 댓글 수정
 *     tags: [Jobs]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 공고(job_postings) ID
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 댓글 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content:
 *                 type: string
 *     responses:
 *       200:
 *         description: 수정 성공
 *       400:
 *         description: path id 형식 오류 또는 content 누락/공백
 *       401:
 *         description: 인증 필요
 *       403:
 *         description: 본인 댓글 아님
 *       404:
 *         description: 대상 댓글 없음
 *       500:
 *         description: 서버 오류
 */
router.put(
  "/:jobId/comments/:commentId",
  requireAuth,
  jobCommentsController.updateJobCommentHandler,
);


export default router;
