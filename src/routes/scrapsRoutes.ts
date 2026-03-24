import {Router} from 'express';
import {toggleScrapHandler} from '../controllers/scrapsController';
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

export default router;