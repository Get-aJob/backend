// 이력서 라우트 정의
import { Router } from "express";
import * as resumeController from "../controllers/resumeController";

const router = Router();

// 이력서 업로드
router.post("/", resumeController.uploadResume);

// 이력서 목록 조회
router.get("/", resumeController.listResumes);

// 이력서 상세 조회
router.get("/:resumeId", resumeController.getResume);

// 이력서 수정
router.patch("/:resumeId", resumeController.updateResume);

// 이력서 삭제
router.delete("/:resumeId", resumeController.deleteResume);

export default router;
