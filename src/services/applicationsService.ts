import { supabase } from '../lib/supabase.js'

const TABLE_NAME = 'applications'
const STATUS_TABLE_NAME = 'application_status_histories'

async function insertStatusHistory(applicationId: string, toStatusId: string, changedByUserId?: string, fromStatusId?: string) {
  const { error } = await supabase
    .from(STATUS_TABLE_NAME)
    .insert({
      application_id: applicationId,
      from_status_id: fromStatusId ?? null,
      to_status_id: toStatusId,
      changed_by_user_id: changedByUserId,
      changed_at: new Date().toISOString(),
    })

  if (error) {
    const e = new Error(error.message) as Error & { code?: string }
    e.code = error.code
    throw e
  }
}

export async function getAllApplications() {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*, application_statuses(display_name)')
    .order('id', { ascending: true })

  if (error) {
    const e = new Error(error.message) as Error & { code?: string }
    e.code = error.code
    throw e
  }

  return data ?? []
}

export async function getApplicationById(id: string) {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*, application_statuses(display_name)')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    const e = new Error(error.message) as Error & { code?: string }
    e.code = error.code
    throw e
  }

  return data ?? null
}

export async function createApplication(application: Record<string, unknown>, statusId?: string) {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert(application)
    .select('*, application_statuses(display_name)')
    .single()

  if (error) {
    const e = new Error(error.message) as Error & { code?: string }
    e.code = error.code
    throw e
  }

  if (statusId) {
    try {
      await insertStatusHistory(data.id, statusId, application.user_id as string)
    } catch (err) {
      // 상태 이력 저장 실패 시 생성된 지원 데이터도 롤백
      await supabase.from(TABLE_NAME).delete().eq('id', data.id)
      throw err
    }
  }

  return data ?? []
}

export async function updateApplication(id: string, updates: Record<string, unknown>, statusId?: string, changedByUserId?: string) {
  const hasApplicationFieldUpdates = Object.keys(updates ?? {}).length > 0

  // 상태 변경 이력에 from_status_id 기록을 위해 업데이트 전 기존 status_id 조회
  let fromStatusId: string | undefined
  if (statusId) {
    const current = await getApplicationById(id)
    fromStatusId = (current?.status_id as string | undefined) ?? undefined
  }

  let data: any = null
  if (hasApplicationFieldUpdates) {
    const { data: updatedData, error } = await supabase
      .from(TABLE_NAME)
      .update(updates)
      .eq('id', id)
      .select('*, application_statuses(display_name)')
      .maybeSingle()

    if (error) {
      const e = new Error(error.message) as Error & { code?: string }
      e.code = error.code
      throw e
    }

    data = updatedData
  } else {
    data = await getApplicationById(id)
  }

  if (!data) {
    return null
  }

  if (statusId) {
    try {
      await insertStatusHistory(id, statusId, changedByUserId, fromStatusId)
    } catch (err) {
      // 상태 이력 저장 실패 시 수정된 내용을 원복
      if (hasApplicationFieldUpdates) {
        await supabase.from(TABLE_NAME).update(Object.fromEntries(
          Object.keys(updates).map(k => [k, (data as any)[k]])
        )).eq('id', id)
      }
      throw err
    }
  }

  return data
}

export async function deleteApplication(id: string) {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .delete()
    .eq('id', id)
    .maybeSingle()

  if (error) {
    const e = new Error(error.message) as Error & { code?: string }
    e.code = error.code
    throw e
  }

  return data ?? []
}

export async function getApplicationsByUser(userId: string) {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*, job_postings(title, content, company_name), application_statuses(display_name)')
    .eq('user_id', userId)
    .order('applied_at', { ascending: false })

  if (error) {
    const e = new Error(error.message) as Error & { code?: string }
    e.code = error.code
    throw e
  }

  return data ?? []
}

export async function getApplicationsByJob(jobPostingId: string) {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*, job_postings(title, content, company_name), application_statuses(display_name)')
    .eq('job_posting_id', jobPostingId)
    .order('applied_at', { ascending: false })

  if (error) {
    const e = new Error(error.message) as Error & { code?: string }
    e.code = error.code
    throw e
  }

  return data ?? []
}

export async function getApplicationsByDate(date: string) {
  const from = `${date}T00:00:00Z`
  // 다음 날 00:00:00 이전까지 조회
  const nextDate = new Date(`${date}T00:00:00.000Z`)
  nextDate.setUTCDate(nextDate.getUTCDate() + 1)
  const to = nextDate.toISOString()

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*, job_postings(title, content, company_name), application_statuses(display_name)')
    .gte('applied_at', from)
    .lt('applied_at', to)
    .order('applied_at', { ascending: true })

  if (error) {
    const e = new Error(error.message) as Error & { code?: string }
    e.code = error.code
    throw e
  }

  return data ?? []
}
// 지원 상태 목록 조회
export async function getAllApplicationStatuses() {
  const { data, error } = await supabase
    .from('application_statuses')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  if (error) {
    const e = new Error(error.message) as Error & { code?: string }
    e.code = error.code
    throw e
  }

  return data ?? []
}

