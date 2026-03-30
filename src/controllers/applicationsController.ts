import { Request, Response } from 'express';
import {
  getApplicationById,
  createApplication,
  updateApplication,
  deleteApplication,
  getApplicationsByUser,
  getAllApplicationStatuses,
} from '../services/applicationsService';

type AuthUser = {
  id?: string;
  payload?: unknown;
};

type AuthRequest = Request & {
  user?: AuthUser;
};

type AuthLocals = {
  user?: {
    id?: string;
    email?: string;
  };
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CREATE_ALLOWED_FIELDS = ['jobPostingId', 'statusId', 'appliedAt', 'notes'] as const;
const UPDATE_ALLOWED_FIELDS = ['statusId', 'appliedAt', 'notes'] as const;

function isUuid(value: unknown) {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

function findInvalidUuidField(payload: Record<string, unknown>) {
  const uuidFields = ['jobPostingId', 'userId', 'statusId'];
  for (const field of uuidFields) {
    const value = payload[field];
    if (value !== undefined && value !== null && !isUuid(value)) {
      return field;
    }
  }
  return null;
}

function pickAllowedFields(body: unknown, allowedFields: readonly string[]): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {};
  }

  const source = body as Record<string, unknown>;
  return Object.fromEntries(
    allowedFields
      .filter((field) => Object.prototype.hasOwnProperty.call(source, field))
      .map((field) => [field, source[field]])
  );
}

function getAuthUserId(req: AuthRequest, res: Response<any, AuthLocals>) {
  return res.locals.user?.id || req.user?.id;
}

export async function listApplicationsByUser(req: AuthRequest, res: Response<any, AuthLocals>) {
  try {
    const userId = getAuthUserId(req, res);
    if (!userId) {
      return res.status(400).json({ error: '유효한 사용자 정보가 없습니다.' });
    }

    const parsedLimit = typeof req.query.limit === 'string' ? Number(req.query.limit) : 20;
    const parsedOffset = typeof req.query.offset === 'string' ? Number(req.query.offset) : 0;
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      return res.status(400).json({ error: 'limit은 1~100 사이의 정수여야 합니다.' });
    }
    if (!Number.isInteger(parsedOffset) || parsedOffset < 0) {
      return res.status(400).json({ error: 'offset은 0 이상의 정수여야 합니다.' });
    }

    const result = await getApplicationsByUser(userId, parsedLimit, parsedOffset);

    res.status(200).json({
      applications: result.items,
      pagination: {
        totalCount: result.totalCount,
        hasNext: result.hasNext,
        nextOffset: result.nextOffset,
        limit: result.limit,
        offset: result.offset,
      },
    });
  } catch (err) {
    console.error('GET /applications/user', err);
    res.status(500).json({ error: '사용자 지원 내역 조회에 실패했습니다.' });
  }
}

export async function getApplication(req: AuthRequest, res: Response<any, AuthLocals>) {
  try {
    const id = String(req.params.id);
    const authUserId = getAuthUserId(req, res);
    if (!authUserId) {
      return res.status(401).json({ error: '권한이 없습니다.' });
    }
    const data = await getApplicationById(id);
    if (!data) {
      return res.status(404).json({ error: '지원 정보를 찾을 수 없습니다.' });
    }
    if (data.userId !== authUserId) {
      return res.status(403).json({ error: '권한이 없습니다. 본인 지원 건만 조회 가능합니다.' });
    }
    res.status(200).json({ application: data });
  } catch (err) {
    console.error('GET /applications/:id', err);
    res.status(500).json({ error: '지원 조회에 실패했습니다.' });
  }
}

export async function createApplicationHandler(req: AuthRequest, res: Response<any, AuthLocals>) {
  try {
    const userId = getAuthUserId(req, res);
    if (!userId) {
      return res.status(401).json({ error: '권한이 없습니다.' });
    }

    const payload: Record<string, unknown> = {
      ...pickAllowedFields(req.body, CREATE_ALLOWED_FIELDS),
      userId,
    };

    const rawAppliedAt = req.body?.appliedAt as string | undefined;
    if (rawAppliedAt === '') {
      payload.appliedAt = null;
    }

    const jobPostingId = payload.jobPostingId as string | undefined;
    if (!jobPostingId) {
      return res.status(400).json({ error: 'jobPostingId는 필수입니다.' });
    }

    const invalidField = findInvalidUuidField(payload);
    if (invalidField) {
      return res.status(400).json({ error: `${invalidField} 값이 UUID 형식이 아닙니다.` });
    }

    const statusId = req.body?.statusId as string | undefined;
    if (!statusId) {
      return res.status(400).json({ error: 'statusId는 필수입니다.' });
    }

    const data = await createApplication(payload, statusId);
    res.status(201).json({ application: data });
  } catch (err: any) {
    console.error('POST /applications', err);
    if (err?.code === '22P02') {
      return res.status(400).json({ error: 'UUID 형식이 잘못된 값이 포함되어 있습니다.' });
    }
    if (err?.code === '23505') {
      return res.status(409).json({ error: '이미 지원한 공고입니다.' });
    }
    res.status(500).json({ error: '지원 생성에 실패했습니다.' });
  }
}

export async function updateApplicationHandler(req: AuthRequest, res: Response<any, AuthLocals>) {
  try {
    const id = String(req.params.id);
    const userId = getAuthUserId(req, res);

    const existing = await getApplicationById(id);
    if (!existing) {
      return res.status(404).json({ error: '지원 정보를 찾을 수 없습니다.' });
    }
    if (existing.userId !== userId) {
      return res.status(403).json({ error: '권한이 없습니다. 본인 지원 건만 수정 가능합니다.' });
    }

    const updates = pickAllowedFields(req.body, UPDATE_ALLOWED_FIELDS);
    const rawAppliedAt = req.body?.appliedAt as string | undefined;
    if (rawAppliedAt === '') {
      updates.appliedAt = null;
    }
    const invalidField = findInvalidUuidField(updates);
    if (invalidField) {
      return res.status(400).json({ error: `${invalidField} 값이 UUID 형식이 아닙니다.` });
    }

    const statusId = req.body?.statusId as string | undefined;
    const data = await updateApplication(id, updates, statusId, userId);
    if (!data) {
      return res.status(404).json({ error: '지원 정보를 찾을 수 없습니다.' });
    }

    res.status(200).json({ application: data });
  } catch (err: any) {
    console.error('PUT /applications/:id', err);
    if (err?.code === '22P02') {
      return res.status(400).json({ error: 'UUID 형식이 잘못된 값이 포함되어 있습니다.' });
    }
    res.status(500).json({ error: '지원 수정에 실패했습니다.' });
  }
}

export async function deleteApplicationHandler(req: AuthRequest, res: Response<any, AuthLocals>) {
  try {
    const id = String(req.params.id);
    const userId = getAuthUserId(req, res);

    const existing = await getApplicationById(id);
    if (!existing) {
      return res.status(404).json({ error: '지원 정보를 찾을 수 없습니다.' });
    }
    if (existing.userId !== userId) {
      return res.status(403).json({ error: '권한이 없습니다. 본인 지원 건만 삭제 가능합니다.' });
    }

    await deleteApplication(id);
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /applications/:id', err);
    res.status(500).json({ error: '지원 삭제에 실패했습니다.' });
  }
}
// 지원 상태 목록 조회
export async function listStatus(req: Request, res: Response) {
  try {
    const data = await getAllApplicationStatuses();
    res.status(200).json({ statuses: data });
  } catch (err) {
    console.error('GET /applications/statuses', err);
    res.status(500).json({ error: '지원 상태 목록 조회에 실패했습니다.' });
  }
}

