import { Request, Response } from "express";
import * as resumeService from "../services/resumeService";
import { CreateResumeBody, UpdateResumeBody } from "../types/resume";

// 이력서 업로드 (생성)
export async function uploadResume(req: Request, res: Response): Promise<void> {
  try {
    const { title, resume } = req.body as CreateResumeBody;

    if (!title || !resume) {
      res.status(400).json({ error: "title과 resume 필드가 없습니다." });
      return;
    }

    const userId = (req as any).user?.id ?? "temp-user-id";

    const record = await resumeService.createResume(userId, title, resume);

    res.status(201).json({
      id: record.id,
      title: record.title,
      createdAt: record.created_at,
    });
  } catch (err) {
    console.error("이력서 업로드 오류:", err);
    res.status(400).json({ error: "이력서 업로드에 실패했습니다." });
  }
}

// 이력서 목록 조회
export async function listResumes(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.id ?? "temp-user-id";

    const resumes = await resumeService.getResumesByUser(userId);

    const result = resumes.map((r) => ({
      id: r.id,
      title: r.title,
      createdAt: r.created_at,
    }));

    res.status(200).json(result);
  } catch (err) {
    console.error("이력서 목록 조회 오류:", err);
    res.status(500).json({ error: "이력서 목록 조회에 실패했습니다." });
  }
}

// 이력서 상세 조회
export async function getResume(req: Request, res: Response): Promise<void> {
  try {
    const resumeId = req.params.resumeId as string;
    const userId = (req as any).user?.id ?? "temp-user-id";

    const record = await resumeService.getResumeById(resumeId, userId);

    if (!record) {
      res.status(404).json({ error: "이력서를 찾을 수 없습니다." });
      return;
    }

    res.status(200).json({
      id: record.id,
      title: record.title,
      content: record.content,
      createdAt: record.created_at,
    });
  } catch (err) {
    console.error("이력서 상세 조회 오류:", err);
    res.status(500).json({ error: "이력서 조회에 실패했습니다." });
  }
}

// 이력서 수정

export async function updateResume(req: Request, res: Response): Promise<void> {
  try {
    const resumeId = req.params.resumeId as string;
    const { title, resume } = req.body as UpdateResumeBody;

    if (!title && !resume) {
      res.status(400).json({ error: "수정할 내용이 없습니다." });
      return;
    }

    const userId = (req as any).user?.id ?? "temp-user-id";

    const updates: { title?: string; content?: any } = {};
    if (title) updates.title = title;
    if (resume) updates.content = resume;

    const record = await resumeService.updateResume(resumeId, userId, updates);

    if (!record) {
      res.status(404).json({ error: "이력서를 찾을 수 없습니다." });
      return;
    }

    res.status(200).json({
      id: record.id,
      title: record.title,
      updatedAt: record.updated_at,
    });
  } catch (err) {
    console.error("이력서 수정 오류:", err);
    res.status(400).json({ error: "이력서 수정에 실패했습니다." });
  }
}

// 이력서 삭제

export async function deleteResume(req: Request, res: Response): Promise<void> {
  try {
    const resumeId = req.params.resumeId as string;
    const userId = (req as any).user?.id ?? "temp-user-id";

    const deleted = await resumeService.deleteResume(resumeId, userId);

    if (!deleted) {
      res.status(404).json({ error: "이력서를 찾을 수 없습니다." });
      return;
    }

    res.status(204).send();
  } catch (err) {
    console.error("이력서 삭제 오류:", err);
    res.status(500).json({ error: "이력서 삭제에 실패했습니다." });
  }
}
