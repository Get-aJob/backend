import {supabase} from "../lib/supabase";
import { convertKeysToCamel } from "../utils/caseConverter";

const TABLE_NAME = 'user_interested_jobs';
const APPLICATION_TABLE_NAME = 'applications';

function throwSupabaseError(error: { message: string; code?: string }): never {
    const e = new Error(error.message) as Error & { code?: string };
    e.code = error.code;
    throw e;
}

export async function toggleScrap(userId : string, jobPostingId : string) {
    // 먼저 이미 스크랩되어 있는지 확인
    const { data: existing, error: checkError } = await supabase
        .from(TABLE_NAME)
        .select('id')
        .eq('user_id', userId)
        .eq('job_posting_id', jobPostingId)
        .maybeSingle();

    if (checkError) {
        throwSupabaseError(checkError);
    }

    // 이미 스크랩되어 있으면 삭제
    if (existing) {
        const { error: deleteError } = await supabase
            .from(TABLE_NAME)
            .delete()
            .eq('id', existing.id);

        if (deleteError) {
            throwSupabaseError(deleteError);
        }

        return { added: false };
    }

    // 스크랩되어 있지 않으면 추가
    const { error: insertError } = await supabase
        .from(TABLE_NAME)
        .insert([{ user_id: userId, job_posting_id: jobPostingId }]);

    if (insertError) {
        throwSupabaseError(insertError);
    }

    return { added: true };
}

export async function getScrapsByUser(
    userId : string,
    limit = 20,
    offset = 0,
    sortBy = 'created_at'
) {
    const today = new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Asia/Seoul",
    }).format(new Date());

    let query = supabase
        .from(TABLE_NAME)
        .select('*, job_postings(title, content, company_name, company_logo, deadline, location, experience)')
        .eq('user_id', userId);

    if (sortBy === 'deadline') {
        query = query
            .order('deadline', {
                ascending: true,
                nullsFirst: false,
                foreignTable: 'job_postings',
            } as any)
            .order('created_at', { ascending: false })
            .order('id', { ascending: false });
    } else {
        query = query.order(sortBy, { ascending: false });
    }

    const { data, error} = await query.range(offset, offset + limit - 1);

    if (error) {
        throwSupabaseError(error);
    }

    const convertedData = convertKeysToCamel<any[]>(data ?? []);

    const postingIds = convertedData
        .map((row: any) => row?.jobPostingId)
        .filter((id: any) => typeof id === 'string' && id.length > 0);

    let appliedPostingIdSet = new Set<string>();
    if (postingIds.length > 0) {
        const { data: applications, error: applicationsError } = await supabase
            .from(APPLICATION_TABLE_NAME)
            .select('job_posting_id, applied_at')
            .eq('user_id', userId)
            .in('job_posting_id', postingIds)
            .not('applied_at', 'is', null);

        if (applicationsError) {
            throwSupabaseError(applicationsError);
        }

        appliedPostingIdSet = new Set(
            (applications ?? []).map((row: any) =>
                convertKeysToCamel<{ jobPostingId: string }>(row).jobPostingId
            )
        );
    }

    const mappedRows = convertedData.map((row: any) => {
        const jobPostings = row?.jobPostings ?? {};
        const jobPostingId = row?.jobPostingId ?? "";
        const deadline = jobPostings.deadline ? String(jobPostings.deadline).split("T")[0] : "";

        return {
            jobPostingId,
            title: jobPostings.title ?? "",
            companyName: jobPostings.companyName ?? "",
            deadline,
            location: jobPostings.location ?? "",
            experience: jobPostings.experience ?? "",
            isApplied: appliedPostingIdSet.has(jobPostingId),
            expired: deadline !== "" && deadline < today,
            companyLogo: jobPostings.companyLogo ?? "",
            createdAt: row?.createdAt ? String(row.createdAt).split("T")[0] : "",
        };
    });

    return mappedRows;
}
