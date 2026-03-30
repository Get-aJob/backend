import { supabase } from "../lib/supabase";
import { convertKeysToCamel, convertKeysToSnake} from "../utils/caseConverter";

const TABLE_NAME = 'applications';
const STATUS_TABLE_NAME = 'application_status_histories';

function formatDateOnly(value: unknown) {
  if (!value) {
    return "";
  }

  return String(value).split("T")[0];
}

type NormalizeApplicationOptions = {
  includeHistories?: boolean;
};

function normalizeApplication(row: unknown, options: NormalizeApplicationOptions = {}): any {
  if (!row) {
    return row;
  }

  const { includeHistories = true } = options;

  const convertedRow = convertKeysToCamel<Record<string, any>>(row);
  const {
    applicationStatuses,
    applicationStatusHistories,
    jobPostings: rawJobPostings,
    ...rest
  } = convertedRow;
  const jobPostings = rawJobPostings ?? null;
  const statusName = applicationStatuses?.displayName ?? null;
  const histories = includeHistories && Array.isArray(applicationStatusHistories)
    ? applicationStatusHistories.map((history: Record<string, any>) => ({
        toStatusId: history.toStatusId ?? null,
        toStatusName: history.toStatusName ?? null,
        changedAt: history.changedAt ?? null,
      }))
    : undefined;

  return {
    ...rest,
    statusName,
    jobPostings: jobPostings
      ? {
          ...jobPostings,
          deadline: formatDateOnly(jobPostings.deadline),
        }
      : null,
    ...(includeHistories ? { histories } : {}),
  };
}

function normalizeApplications(rows: unknown[], options: NormalizeApplicationOptions = {}): any[] {
  return rows.map((row) => normalizeApplication(row, options));
}

function normalizeApplicationStatus(row: unknown): any {
  if (!row) {
    return row;
  }
  return convertKeysToCamel<Record<string, any>>(row);
}

function normalizeApplicationStatuses(rows: unknown[]): any[] {
  return rows.map((row) => normalizeApplicationStatus(row));
}

async function insertStatusHistory(applicationId: string, toStatusId: string, changedByUserId?: string, fromStatusId?: string) {
  const { error } = await supabase
    .from(STATUS_TABLE_NAME)
    .insert({
      application_id: applicationId,
      from_status_id: fromStatusId ?? null,
      to_status_id: toStatusId,
      changed_by_user_id: changedByUserId,
    });

  if (error) {
    const e = new Error(error.message) as Error & { code?: string };
    e.code = error.code;
    throw e;
  }
}

export async function getApplicationById(id: string): Promise<any> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*, job_postings(title, content, company_name, deadline), application_statuses(display_name), application_status_histories(to_status_id,changed_at)')
    .eq('id', id)
    .order('changed_at', { foreignTable: STATUS_TABLE_NAME, ascending: true })
    .maybeSingle();

  if (error) {
    const e = new Error(error.message) as Error & { code?: string };
    e.code = error.code;
    throw e;
  }

  if (data?.application_status_histories?.length) {
    const toStatusIds = Array.from(
      new Set(
        (data.application_status_histories as any[])
          .map((history: any) => history?.to_status_id)
          .filter((statusId: any) => typeof statusId === 'string' && statusId.length > 0)
      )
    );

    if (toStatusIds.length > 0) {
      const { data: statuses, error: statusesError } = await supabase
        .from('application_statuses')
        .select('id, display_name')
        .in('id', toStatusIds);

      if (statusesError) {
        const e = new Error(statusesError.message) as Error & { code?: string };
        e.code = statusesError.code;
        throw e;
      }

      const statusNameMap = new Map((statuses ?? []).map((status: any) => [status.id, status.display_name]));

      data.application_status_histories = (data.application_status_histories as any[]).map((history: any) => ({
        ...history,
        to_status_name: history?.to_status_id ? (statusNameMap.get(history.to_status_id) ?? null) : null,
      }));
    }
  }

  return normalizeApplication(data);
}

export async function createApplication(application: Record<string, unknown>, statusId?: string) {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert(convertKeysToSnake(application))
    .select('*, application_statuses(display_name)')
    .single();

  if (error) {
    const e = new Error(error.message) as Error & { code?: string };
    e.code = error.code;
    throw e;
  }

  if (statusId) {
    try {
      await insertStatusHistory(data.id, statusId, (application.user_id ?? application.userId) as string);
    } catch (err) {
      // 상태 이력 저장 실패 시 생성된 지원 데이터도 롤백
      const { error: rollbackError } = await supabase
        .from(TABLE_NAME)
        .delete()
        .eq('id', data.id);

      if (rollbackError) {
        const rollbackFailure = new Error(
          `상태 이력 저장 실패 후 생성 롤백도 실패했습니다: ${rollbackError.message}`
        ) as Error & { code?: string; cause?: unknown };
        rollbackFailure.code = rollbackError.code;
        rollbackFailure.cause = err;
        throw rollbackFailure;
      }

      throw err;
    }
  }

  return getApplicationById(data.id);
}

export async function updateApplication(id: string, updates: Record<string, unknown>, statusId?: string, changedByUserId?: string) {
  const hasApplicationFieldUpdates = Object.keys(updates ?? {}).length > 0;

  let originalData: any = null;

  // 상태 변경 이력에 from_status_id 기록을 위해 업데이트 전 기존 status_id 조회
  let fromStatusId: string | undefined;
  if (statusId) {
    const current = await getApplicationById(id);
    fromStatusId = (current?.statusId as string | undefined) ?? undefined;
  }

  const hasStatusChanged = !!statusId && statusId !== fromStatusId;

  let data: any = null;
  if (hasApplicationFieldUpdates) {
    originalData = await getApplicationById(id);
    if (!originalData) {
      return null;
    }

    const { data: updatedData, error } = await supabase
      .from(TABLE_NAME)
      .update(convertKeysToSnake(updates))
      .eq('id', id)
      .select('*, application_statuses(display_name)')
      .maybeSingle();

    if (error) {
      const e = new Error(error.message) as Error & { code?: string };
      e.code = error.code;
      throw e;
    }

    data = updatedData;
  } else {
    data = await getApplicationById(id);
  }

  if (!data) {
    return null;
  }

  if (!hasApplicationFieldUpdates && !hasStatusChanged) {
    return data;
  }

  if (hasStatusChanged) {
    try {
      await insertStatusHistory(id, statusId, changedByUserId, fromStatusId);
    } catch (err) {
      // 상태 이력 저장 실패 시 수정된 내용을 원복
      if (hasApplicationFieldUpdates && originalData) {
        const { error: rollbackError } = await supabase
          .from(TABLE_NAME)
          .update(convertKeysToSnake(Object.fromEntries(
            Object.keys(updates).map(k => [k, (originalData as any)[k]])
          )))
          .eq('id', id);

        if (rollbackError) {
          const rollbackFailure = new Error(
            `상태 이력 저장 실패 후 수정 롤백도 실패했습니다: ${rollbackError.message}`
          ) as Error & { code?: string; cause?: unknown };
          rollbackFailure.code = rollbackError.code;
          rollbackFailure.cause = err;
          throw rollbackFailure;
        }
      }
      throw err;
    }
  }

  return getApplicationById(data.id);
}

export async function deleteApplication(id: string) {
  // 보상 복구를 위해 이력 원본을 먼저 백업한다.
  const { data: historyBackup, error: historyReadError } = await supabase
    .from(STATUS_TABLE_NAME)
    .select('*')
    .eq('application_id', id);

  if (historyReadError) {
    const e = new Error(historyReadError.message) as Error & { code?: string };
    e.code = historyReadError.code;
    throw e;
  }

  const { error: historyError } = await supabase
    .from(STATUS_TABLE_NAME)
    .delete()
    .eq('application_id', id);

  if (historyError) {
    const e = new Error(historyError.message) as Error & { code?: string };
    e.code = historyError.code;
    throw e;
  }

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .delete()
    .eq('id', id)
    .maybeSingle();

  if (error) {
    if ((historyBackup ?? []).length > 0) {
      const { error: restoreError } = await supabase
        .from(STATUS_TABLE_NAME)
        .insert(historyBackup as Record<string, unknown>[]);

      if (restoreError) {
        const restoreFailure = new Error(
          `지원 삭제 실패 후 이력 복구도 실패했습니다: ${restoreError.message}`
        ) as Error & { code?: string; cause?: unknown };
        restoreFailure.code = restoreError.code;
        restoreFailure.cause = error;
        throw restoreFailure;
      }
    }

    const e = new Error(error.message) as Error & { code?: string };
    e.code = error.code;
    throw e;
  }

  return data ?? [];
}

export async function getApplicationsByUser(userId: string, limit = 20, offset = 0) {
  const { data, error, count } = await supabase
    .from(TABLE_NAME)
    .select('*, job_postings(title, content, company_name,deadline), application_statuses(display_name)', { count: 'exact' })
    .eq('user_id', userId)
    .order('applied_at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    const e = new Error(error.message) as Error & { code?: string };
    e.code = error.code;
    throw e;
  }

  const convertedData = normalizeApplications(data ?? [], { includeHistories: false });
  const totalCount = count ?? 0;
  const hasNext = offset + convertedData.length < totalCount;
  const nextOffset = hasNext ? offset + convertedData.length : null;

  return {
    items: convertedData,
    totalCount,
    hasNext,
    nextOffset,
    limit,
    offset,
  };
}

// 지원 상태 목록 조회
export async function getAllApplicationStatuses() {
  const { data, error } = await supabase
    .from('application_statuses')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) {
    const e = new Error(error.message) as Error & { code?: string };
    e.code = error.code;
    throw e;
  }

  return normalizeApplicationStatuses(data ?? []);
}

