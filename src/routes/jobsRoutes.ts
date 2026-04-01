import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { optionalAuth } from "../middlewares/optionalAuth";
import * as jobsController from "../controllers/jobsController";
import * as jobCommentsController from "../controllers/jobCommentsController";

const router = Router();

/**
 * @swagger
 * /jobs/manual:
 *   post:
 *     summary: ?˜ë™ ì±„ìš© ê³µê³  ?¬ë¡¤ë§?
 *     tags: [Jobs]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               url:
 *                 type: string
 *                 description: ì±„ìš© ê³µê³  URL
 *     responses:
 *       201:
 *         description: ?¬ë¡¤ë§?ë°??€???±ê³µ
 *       400:
 *         description: URL ?„ë½
 *       401:
 *         description: ?¸ì¦ ?¤íŒ¨
 *       500:
 *         description: ?œë²„ ?¤ë¥˜
 */
router.post("/manual", requireAuth, jobsController.manualCrawlHandler);

/**
 * @swagger
 * /jobs:
 *   get:
 *     summary: ì±„ìš© ê³µê³  ì¡°íšŒ (?ë™/?˜ë™ ?„í„°ë§?
 *     tags: [Jobs]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: sourceType
 *         required: true
 *         description: ê³µê³  ì¶œì²˜ ?„í„° (auto, manual)
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
 *         description: ì¡°íšŒ ?±ê³µ
 *       400:
 *         description: ?˜ëª»???”ì²­ (sourceType ?„ë½ ??
 *       401:
 *         description: ?¸ì¦ ?¤íŒ¨
 *       500:
 *         description: ?œë²„ ?¤ë¥˜
 */
router.get("/", optionalAuth, jobsController.getJobsHandler);

/**
 * @swagger
 * /jobs/manual/{externalId}:
 *   delete:
 *     summary: ?˜ë™ ì±„ìš© ê³µê³  ?? œ
 *     description: ë³¸ì¸???±ë¡???˜ë™ ê³µê³ ë¥?externalIdë¡??? œ?©ë‹ˆ?? source_type=manual + external_id + created_by(userId) 3ì¤?ê²€ì¦ìœ¼ë¡?ë³¸ì¸ ê³µê³ ë§??? œ ê°€?¥í•©?ˆë‹¤.
 *     tags: [Jobs]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: externalId
 *         required: true
 *         description: ?? œ??ê³µê³ ??external_id
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: ?? œ ?±ê³µ (?‘ë‹µ ë³¸ë¬¸ ?†ìŒ)
 *       400:
 *         description: externalId ?„ë½
 *       401:
 *         description: ?¸ì¦ ?¤íŒ¨
 *       404:
 *         description: ?´ë‹¹ ê³µê³  ?†ìŒ ?ëŠ” ?? œ ê¶Œí•œ ?†ìŒ
 *       500:
 *         description: ?œë²„ ?¤ë¥˜
 */
router.delete(
  "/manual/:externalId",
  requireAuth,
  jobsController.deleteManualJobHandler,
);

/**
 * @swagger
 * /jobs/{jobId}/comments:
 *   post:
 *     summary: ê³µê³  ?“ê? ?‘ì„±
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
 *         description: ê³µê³ (job_postings) ID
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
 *         description: ?‘ì„± ?±ê³µ
 *       400:
 *         description: jobId ?•ì‹ ?¤ë¥˜ ?ëŠ” content ?„ë½/ê³µë°±
 *       401:
 *         description: ?¸ì¦ ?„ìš”
 *       404:
 *         description: ê³µê³  ?†ìŒ
 *       500:
 *         description: ?œë²„ ?¤ë¥˜
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
 *     summary: ê³µê³  ?“ê? ëª©ë¡
 *     description: ë¹„ë¡œê·¸ì¸??ì¡°íšŒ ê°€?¥í•©?ˆë‹¤(ì¿ í‚¤ ? íƒ).
 *     tags: [Jobs]
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ê³µê³ (job_postings) ID
 *     responses:
 *       200:
 *         description: ì¡°íšŒ ?±ê³µ
 *       400:
 *         description: jobId ?•ì‹ ?¤ë¥˜
 *       404:
 *         description: ê³µê³  ?†ìŒ
 *       500:
 *         description: ?œë²„ ?¤ë¥˜
 */
router.get(
  "/:jobId/comments",
  optionalAuth,
  jobCommentsController.getJobComments,
);

export default router;
