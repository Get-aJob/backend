// 이력서 라우트 정의
import { Router } from "express";
import * as resumeController from "../controllers/resumeController";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     ResumeContent:
 *       type: object
 *       properties:
 *         profile:
 *           type: string
 *         experience:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Experience'
 *         education:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Education'
 *         skill:
 *           type: string
 *         additionalInfo:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/AdditionalInfo'
 *         language:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Language'
 *         portfolio:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Portfolio'
 *     Experience:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *         position:
 *           type: string
 *         period:
 *           $ref: '#/components/schemas/Period'
 *         description:
 *           type: string
 *     Education:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *         period:
 *           $ref: '#/components/schemas/Period'
 *         description:
 *           type: string
 *     AdditionalInfo:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *         date:
 *           type: string
 *           format: date
 *           nullable: true
 *         type:
 *           type: string
 *           enum: [수상, 자격증, 활동]
 *           nullable: true
 *         description:
 *           type: string
 *     Language:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *         level:
 *           type: string
 *           enum: [유창함, 고급 비즈니스 레벨, 비즈니스 레벨, 일상 회화]
 *           nullable: true
 *         test:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/LanguageTest'
 *     LanguageTest:
 *       type: object
 *       properties:
 *         testName:
 *           type: string
 *         date:
 *           type: string
 *           format: date
 *           nullable: true
 *         score:
 *           type: string
 *     Portfolio:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *         url:
 *           type: string
 *         fileUrl:
 *           type: string
 *           nullable: true
 *     Period:
 *       type: object
 *       properties:
 *         startDate:
 *           type: string
 *           format: date
 *           nullable: true
 *         endDate:
 *           type: string
 *           format: date
 *           nullable: true
 */

// 모든 이력서 관련 요청에 대해 인증 필요
router.use(requireAuth);

/**
 * @swagger
 * /resumes:
 *   post:
 *     summary: 이력서 생성 (업로드)
 *     tags: [Resumes]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, resume]
 *             properties:
 *               title:
 *                 type: string
 *               resume:
 *                 $ref: '#/components/schemas/ResumeContent'
 *     responses:
 *       201:
 *         description: 생성 성공
 *       400:
 *         description: 필수 필드 누락
 *       401:
 *         description: 인증 실패
 */
router.post("/", resumeController.uploadResume);

/**
 * @swagger
 * /resumes:
 *   get:
 *     summary: 이력서 목록 조회
 *     tags: [Resumes]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: 조회 성공
 *       401:
 *         description: 인증 실패
 */
// 이력서 목록 조회
router.get("/", resumeController.listResumes);

/**
 * @swagger
 * /resumes/{resumeId}:
 *   get:
 *     summary: 이력서 상세 조회
 *     tags: [Resumes]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: resumeId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 조회 성공
 *       404:
 *         description: 이력서를 찾을 수 없음
 *       401:
 *         description: 인증 실패
 */
// 이력서 상세 조회
router.get("/:resumeId", resumeController.getResume);

/**
 * @swagger
 * /resumes/{resumeId}:
 *   patch:
 *     summary: 이력서 수정
 *     tags: [Resumes]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: resumeId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               resume:
 *                 $ref: '#/components/schemas/ResumeContent'
 *     responses:
 *       200:
 *         description: 수정 성공
 *       404:
 *         description: 이력서를 찾을 수 없음
 *       409:
 *         description: 충돌 (낙관적 잠금 실패)
 *       401:
 *         description: 인증 실패
 *       400:
 *         description: 필수 필드 누락
 *
 */
// 이력서 수정
router.patch("/:resumeId", resumeController.updateResume);


/**
 * @swagger
 * /resumes/{resumeId}/duplicate:
 *   post:
 *     summary: 이력서 복제
 *     tags: [Resumes]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: resumeId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: 복제 성공
 *       404:
 *         description: 이력서를 찾을 수 없음
 *       401:
 *         description: 인증 실패
 */
// 이력서 복제
router.post("/:resumeId/duplicate", resumeController.duplicateResume);


/**
 * @swagger
 * /resumes/{resumeId}:
 *   delete:
 *     summary: 이력서 삭제
 *     tags: [Resumes]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: resumeId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: 삭제 성공
 *       404:
 *         description: 이력서를 찾을 수 없음
 *       401:
 *         description: 인증 실패
 */
// 이력서 삭제
router.delete("/:resumeId", resumeController.deleteResume);

export default router;
