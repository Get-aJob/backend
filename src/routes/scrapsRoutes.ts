import {Router} from 'express';
import {toggleScrapHandler, getMyScrapsHandler} from '../controllers/scrapsController';
import {requireAuth} from '../middlewares/requireAuth';

const router = Router();

/**
 * @swagger
 * /scraps/{jobPostingId}:
 *   post:
 *     summary: 공고 스크랩 토글
 *     description: 공고를 스크랩하거나 스크랩을 해제합니다. 스크랩된 공고면 스크랩을 해제하고, 스크랩되지 않은 공고면 스크랩합니다.
 *     tags:
 *       - Scraps
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: jobPostingId
 *         required: true
 *         schema:
 *           type: string
 *         description: 채용공고 ID (UUID)
 *     responses:
 *       200:
 *         description: 스크랩 토글 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 scrap:
 *                   type: object
 *                   properties:
 *                     added:
 *                       type: boolean
 *                       example: true
 *                       description: true면 스크랩 추가됨, false면 스크랩 해제됨
 *       400:
 *         description: 필수 필드 누락 또는 유효하지 않은 데이터
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: 유효한 사용자 정보가 없습니다.
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: 스크랩 처리에 실패했습니다.
 */
router.post('/:jobPostingId', requireAuth, toggleScrapHandler);

/**
 * @swagger
 * /scraps:
 *   get:
 *     summary: 내 스크랩 목록 조회
 *     description: 로그인 사용자의 스크랩 목록을 조회합니다.
 *     tags:
 *       - Scraps
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 30
 *           minimum: 1
 *           maximum: 100
 *       - in: query
 *         name: offset
 *         required: false
 *         schema:
 *           type: integer
 *           default: 0
 *           minimum: 0
 *       - in: query
 *         name: sortBy
 *         required: false
 *         schema:
 *           type: string
 *           enum: [recent, deadline]
 *           default: recent
 *         description: recent=스크랩 최신순(created_at desc), deadline=마감임박순(deadline asc, null은 마지막)
 *     responses:
 *       200:
 *         description: 스크랩 목록 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 scraps:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       jobPostingId:
 *                         type: string
 *                       title:
 *                         type: string
 *                       companyName:
 *                         type: string
 *                       deadline:
 *                         type: string
 *                         example: 2026-03-23
 *                       location:
 *                         type: string
 *                       experience:
 *                         type: string
 *                       isApplied:
 *                         type: boolean
 *                         description: applications 테이블에서 applied_at 값이 존재하면 true
 *                       expired:
 *                         type: boolean
 *                         description: 마감일(deadline)이 오늘보다 이전이면 true
 *                       companyLogo:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         example: 2026-03-25
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     totalCount:
 *                       type: integer
 *                       description: 전체 스크랩 수
 *                     hasNext:
 *                       type: boolean
 *                       description: 다음 페이지 존재 여부
 *                     nextOffset:
 *                       type: integer
 *                       nullable: true
 *                       description: 다음 페이지 offset (hasNext가 false면 null)
 *                     limit:
 *                       type: integer
 *                     offset:
 *                       type: integer
 *       400:
 *         description: 유효하지 않은 파라미터
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: limit은 1~100 사이의 정수여야 합니다.
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */

router.get('/', requireAuth, getMyScrapsHandler);

export default router;