import { Request, Response } from "express";
import * as jobCommentsService from "../services/jobCommentsService";
import { logger } from "../utils/logger";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string) {
  return UUID_REGEX.test(value);
}

function hasValidCommentPathIds(jobId: string, commentId: string) {
  return Boolean(jobId && commentId && isUuid(jobId) && isUuid(commentId));
}

export async function createJobCommentHandler(req: Request, res: Response) {
  try {
    const userId = res.locals.user?.id as string | undefined;
    const jobId = req.params.jobId as string;

    if (!userId) {
      logger.warn("공고 댓글 등록 거부: 인증 없음");
      return res.status(401).json({ error: "인증 정보가 없습니다." });
    }
    if (!jobId || !isUuid(jobId)) {
      logger.warn("공고 댓글 등록 거부: 유효하지 않은 jobId", { jobId });
      return res
        .status(400)
        .json({ error: "유효한 공고 ID(jobId)가 필요합니다." });
    }

    const result = await jobCommentsService.createJobPostingComment(
      userId,
      jobId,
      req.body?.content,
    );

    if (result.ok) {
      logger.info("공고 댓글 등록 성공", {
        commentId: result.comment.id,
        jobId: result.comment.jobId,
        userId,
      });
      return res.status(201).json({ comment: result.comment });
    }

    if (result.code === "EMPTY_CONTENT") {
      logger.warn("공고 댓글 등록 거부: 빈 content", { jobId, userId });
      return res.status(400).json({
        error: "댓글 내용(content)은 필수이며 공백만 올 수 없습니다.",
      });
    }

    logger.warn("공고 댓글 등록 거부: 공고 없음", { jobId, userId });
    return res.status(404).json({ error: "해당 공고를 찾을 수 없습니다." });
  } catch (error) {
    logger.error("POST /jobs/:jobId/comments 처리 중 오류", { error });
    return res.status(500).json({ error: "댓글 작성 중 오류가 발생했습니다." });
  }
}
export async function getJobComments(req: Request, res: Response) {
  try {
    const jobId = req.params.jobId as string;

    if (!jobId || !isUuid(jobId)) {
      logger.warn("공고 댓글 목록 거부: 유효하지 않은 jobId", { jobId });
      return res
        .status(400)
        .json({ error: "유효한 공고 ID(jobId)가 필요합니다." });
    }

    const result = await jobCommentsService.listJobPostingComments(jobId);

    if (!result.ok) {
      logger.warn("공고 댓글 목록 조회 거부: 공고 없음", { jobId });
      return res.status(404).json({ error: "해당 공고를 찾을 수 없습니다." });
    }

    return res.status(200).json({ comments: result.comments });
  } catch (error) {
    logger.error("GET /jobs/:jobId/comments 처리 중 오류", { error });
    return res
      .status(500)
      .json({ error: "댓글 목록 조회 중 오류가 발생했습니다." });
  }
}

export async function updateJobCommentHandler(req: Request, res: Response) {
  try {
    const userId = res.locals.user?.id as string | undefined;
    const jobId = req.params.jobId as string;
    const commentId = req.params.commentId as string;

    if (!userId) {
      logger.warn("공고 댓글 수정 거부: 인증 없음");
      return res.status(401).json({ error: "인증 정보가 없습니다." });
    }
    if (!hasValidCommentPathIds(jobId, commentId)) {
      logger.warn("공고 댓글 수정 거부: 유효하지 않은 path id", {
        jobId,
        commentId,
      });
      return res
        .status(400)
        .json({ error: "유효한 공고/댓글 ID가 필요합니다." });
    }

    const result = await jobCommentsService.updateJobPostingComment(
      userId,
      jobId,
      commentId,
      req.body?.content,
    );

    if (result.ok) {
      logger.info("공고 댓글 수정 성공", {
        jobId,
        commentId,
        userId,
      });
      return res.status(200).json({ comment: result.comment });
    }

    if (result.code === "EMPTY_CONTENT") {
      logger.warn("공고 댓글 수정 거부: 빈 content", { jobId, commentId, userId });
      return res.status(400).json({
        error: "댓글 내용(content)은 필수이며 공백만 올 수 없습니다.",
      });
    }
    if (result.code === "FORBIDDEN") {
      logger.warn("공고 댓글 수정 거부: 본인 아님", { jobId, commentId, userId });
      return res.status(403).json({ error: "본인 댓글만 수정할 수 있습니다." });
    }

    logger.warn("공고 댓글 수정 거부: 대상 댓글 없음", {
      jobId,
      commentId,
      userId,
    });
    return res.status(404).json({ error: "해당 댓글을 찾을 수 없습니다." });
  } catch (error) {
    logger.error("PUT /jobs/:jobId/comments/:commentId 처리 중 오류", { error });
    return res.status(500).json({ error: "댓글 수정 중 오류가 발생했습니다." });
  }
}
