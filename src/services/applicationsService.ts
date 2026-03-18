import { supabase } from '../lib/supabase.js'

const TABLE_NAME = 'applications'
const STATUS_TABLE_NAME = 'application_status_histories'

async function insertStatusHistory(applicationId: string, statusId: string, changedByUserId?: string) {
  const { error } = await supabase
    .from(STATUS_TABLE_NAME)
    .insert({
      application_id: applicationId,
      from_status_id: null,
      to_status_id: statusId,
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
    .select('*')
    .order('id', { ascending: true })
    .order('created_at', { ascending: false, foreignTable: 'application_status_histories' })
    .limit(1, { foreignTable: 'application_status_histories' })

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
    .select('*')
    .single()

  if (error) {
    const e = new Error(error.message) as Error & { code?: string }
    e.code = error.code
    throw e
  }

  if (statusId) {
    await insertStatusHistory(data.id, statusId, application.user_id as string)
  }

  return data ?? []
}

export async function updateApplication(id: string, updates: Record<string, unknown>, statusId?: string, changedByUserId?: string) {
  const hasApplicationFieldUpdates = Object.keys(updates ?? {}).length > 0

  let data: any = null
  if (hasApplicationFieldUpdates) {
    const { data: updatedData, error } = await supabase
      .from(TABLE_NAME)
      .update(updates)
      .eq('id', id)
      .select('*')
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
    await insertStatusHistory(id, statusId, changedByUserId)
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
  const to = `${date}T23:59:59Z`

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*, job_postings(title, content, company_name), application_statuses(display_name)')
    .gte('applied_at', from)
    .lte('applied_at', to)
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

