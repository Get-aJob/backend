import { Request, Response } from 'express'
import {
  getAllApplications,
  getApplicationById,
  createApplication,
  updateApplication,
  deleteApplication,
  getApplicationsByUser,
  getAllApplicationStatuses,
} from '../services/applicationsService'

type AuthUser = {
  id?: string
  payload?: unknown
}

type AuthRequest = Request & {
  user?: AuthUser
}

type AuthLocals = {
  user?: {
    id?: string
    email?: string
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUuid(value: unknown) {
  return typeof value === 'string' && UUID_REGEX.test(value)
}

function findInvalidUuidField(payload: Record<string, unknown>) {
  const uuidFields = ['job_posting_id', 'user_id', 'status_id']
  for (const field of uuidFields) {
    const value = payload[field]
    if (value !== undefined && value !== null && !isUuid(value)) {
      return field
    }
  }
  return null
}

function toDbApplication(input: Record<string, unknown> = {}) {
  const mapped: Record<string, unknown> = {
    job_posting_id: input.job_posting_id ?? input.jobPostingId,
    user_id: input.user_id ?? input.userId,
    status_id: input.status_id ?? input.statusId ?? input.status,
    applied_at: input.applied_at ?? input.appliedAt,
    notes: input.notes,
  }

  return Object.fromEntries(
    Object.entries(mapped).filter(([, value]) => value !== undefined)
  )
}

function toApiApplication(row: any) {
  if (!row) return row
  const status = row.application_statuses?.display_name ?? null
  return {
    id: row.id,
    jobPostingId: row.job_posting_id,
    userId: row.user_id,
    statusId: row.status_id,
    status: status,
    appliedAt: row.applied_at,
    notes: row.notes,
    jobPostings: row.job_postings,
  }
}

function getAuthUserId(req: AuthRequest, res: Response<any, AuthLocals>) {
  return res.locals.user?.id || req.user?.id || (req.query?.userId as string | undefined) || (req.body?.userId as string | undefined)
}

export async function listApplications(req: Request, res: Response) {
  try {
    const data = await getAllApplications()
    res.status(200).json({ applications: data.map(toApiApplication) })
  } catch (err) {
    console.error('GET /applications', err)
    res.status(500).json({ error: '지원 목록 조회에 실패했습니다.' })
  }
}

export async function listApplicationsByUser(req: AuthRequest, res: Response<any, AuthLocals>) {
  try {
    const userId = getAuthUserId(req, res)
    if (!userId) {
      return res.status(400).json({ error: '유효한 사용자 정보가 없습니다.' })
    }
    const data = await getApplicationsByUser(userId)
    res.status(200).json({ applications: data.map(toApiApplication) })
  } catch (err) {
    console.error('GET /applications/user', err)
    res.status(500).json({ error: '사용자 지원 내역 조회에 실패했습니다.' })
  }
}

export async function getApplication(req: Request, res: Response) {
  try {
    const id = String(req.params.id)
    const data = await getApplicationById(id)
    if (!data) {
      return res.status(404).json({ error: '지원 정보를 찾을 수 없습니다.' })
    }
    const authUserId = (res.locals as AuthLocals).user?.id
    if (authUserId && data.user_id !== authUserId) {
      return res.status(403).json({ error: '권한이 없습니다. 본인 지원 건만 조회 가능합니다.' })
    }
    res.status(200).json({ application: toApiApplication(data) })
  } catch (err) {
    console.error('GET /applications/:id', err)
    res.status(500).json({ error: '지원 조회에 실패했습니다.' })
  }
}

export async function createApplicationHandler(req: AuthRequest, res: Response<any, AuthLocals>) {
  try {
    const userId = getAuthUserId(req, res)
    if (!userId) {
      return res.status(401).json({ error: '권한이 없습니다.' })
    }

    const payload = {
      ...toDbApplication(req.body),
      user_id: userId,
    }

    const invalidField = findInvalidUuidField(payload)
    if (invalidField) {
      return res.status(400).json({ error: `${invalidField} 값이 UUID 형식이 아닙니다.` })
    }

    const statusId = (req.body?.status_id ?? req.body?.statusId ?? req.body?.status) as string | undefined
    if (!statusId) {
      return res.status(400).json({ error: 'statusId는 필수입니다.' })
    }

    const data = await createApplication(payload, statusId)
    res.status(201).json({ application: toApiApplication(data) })
  } catch (err: any) {
    console.error('POST /applications', err)
    if (err?.code === '22P02') {
      return res.status(400).json({ error: 'UUID 형식이 잘못된 값이 포함되어 있습니다.' })
    }
    if (err?.code === '23505') {
      return res.status(409).json({ error: '이미 지원한 공고입니다.' })
    }
    res.status(500).json({ error: '지원 생성에 실패했습니다.' })
  }
}

export async function updateApplicationHandler(req: AuthRequest, res: Response<any, AuthLocals>) {
  try {
    const id = String(req.params.id)
    const userId = getAuthUserId(req, res)

    const existing = await getApplicationById(id)
    if (!existing) {
      return res.status(404).json({ error: '지원 정보를 찾을 수 없습니다.' })
    }
    if (existing.user_id !== userId) {
      return res.status(403).json({ error: '권한이 없습니다. 본인 지원 건만 수정 가능합니다.' })
    }

    const updates = toDbApplication(req.body)
    const invalidField = findInvalidUuidField(updates)
    if (invalidField) {
      return res.status(400).json({ error: `${invalidField} 값이 UUID 형식이 아닙니다.` })
    }

    const statusId = (req.body?.status_id ?? req.body?.statusId ?? req.body?.status) as string | undefined
    const data = await updateApplication(id, updates, statusId, userId)
    if (!data) {
      return res.status(404).json({ error: '지원 정보를 찾을 수 없습니다.' })
    }

    res.status(200).json({ application: toApiApplication(data) })
  } catch (err: any) {
    console.error('PUT /applications/:id', err)
    if (err?.code === '22P02') {
      return res.status(400).json({ error: 'UUID 형식이 잘못된 값이 포함되어 있습니다.' })
    }
    res.status(500).json({ error: '지원 수정에 실패했습니다.' })
  }
}

export async function deleteApplicationHandler(req: AuthRequest, res: Response<any, AuthLocals>) {
  try {
    const id = String(req.params.id)
    const userId = getAuthUserId(req, res)

    const existing = await getApplicationById(id)
    if (!existing) {
      return res.status(404).json({ error: '지원 정보를 찾을 수 없습니다.' })
    }
    if (existing.user_id !== userId) {
      return res.status(403).json({ error: '권한이 없습니다. 본인 지원 건만 삭제 가능합니다.' })
    }

    await deleteApplication(id)
    res.status(204).send()
  } catch (err) {
    console.error('DELETE /applications/:id', err)
    res.status(500).json({ error: '지원 삭제에 실패했습니다.' })
  }
}
// 지원 상태 목록 조회
export async function listStatus(req: Request, res: Response) {
  try {
    const data = await getAllApplicationStatuses()
    res.status(200).json({ statuses: data })
  } catch (err) {
    console.error('GET /applications/statuses', err)
    res.status(500).json({ error: '지원 상태 목록 조회에 실패했습니다.' })
  }
}

