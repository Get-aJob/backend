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

// 사용자 지원 현황 조회 (인증 필요)
router.get('/user', requireAuth, listApplicationsByUser);
// 지원상태 목록 조회
router.get('/statuses', listStatus);
// 특정 지원 정보 조회
router.get('/:id', requireAuth, getApplication);
// 새로운 지원 생성 (인증 필요)
router.post('/', requireAuth, createApplicationHandler);
// 지원 정보 수정 (인증 필요)
router.put('/:id', requireAuth, updateApplicationHandler);
// 지원 삭제 (인증 필요)
router.delete('/:id', requireAuth, deleteApplicationHandler);

export default router;
