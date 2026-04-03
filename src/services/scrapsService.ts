import {supabase} from "../lib/supabase";
import { convertKeysToCamel } from "../utils/caseConverter";

const TABLE_NAME = 'user_interested_jobs';
const APPLICATION_TABLE_NAME = 'applications';

type ScrapRow = {
    jobPostingId: string;
    title: string;
    companyName: string;
    deadline: string;
    location: string;
    experience: string;
    isApplied: boolean;
    expired: boolean;
    companyLogo: string;
    createdAt: string;
};

const SCRAP_SELECT = '*, job_postings(title, content, company_name, company_logo, deadline, location, experience)';

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
    limit = 30,
    offset = 0,
    sortBy = 'created_at'
) {
    const today = new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Asia/Seoul",
    }).format(new Date());

    let data: any[] = [];
    let count = 0;

    if (sortBy === 'deadline') {
        const baseCountQuery = supabase
            .from(TABLE_NAME)
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId);

        const { count: totalCount, error: totalCountError } = await baseCountQuery;
        if (totalCountError) {
            throwSupabaseError(totalCountError);
        }

        count = totalCount ?? 0;

        const buildSegmentQuery = (segment: 'active' | 'no_deadline' | 'expired') => {
            let segmentQuery = supabase
                .from(TABLE_NAME)
                .select(SCRAP_SELECT, { count: 'exact' })
                .eq('user_id', userId);

            if (segment === 'active') {
                segmentQuery = segmentQuery
                    .not('job_postings.deadline', 'is', null)
                    .gte('job_postings.deadline', today)
                    .order('deadline', {
                        ascending: true,
                        nullsFirst: false,
                        referencedTable: 'job_postings',
                    } as any)
                    .order('created_at', { ascending: false })
                    .order('id', { ascending: false });
            } else if (segment === 'no_deadline') {
                segmentQuery = segmentQuery
                    .is('job_postings.deadline', null)
                    .order('created_at', { ascending: false })
                    .order('id', { ascending: false });
            } else {
                segmentQuery = segmentQuery
                    .not('job_postings.deadline', 'is', null)
                    .lt('job_postings.deadline', today)
                    .order('deadline', {
                        ascending: true,
                        nullsFirst: false,
                        referencedTable: 'job_postings',
                    } as any)
                    .order('created_at', { ascending: false })
                    .order('id', { ascending: false });
            }

            return segmentQuery;
        };

        const buildSegmentCountQuery = (segment: 'active' | 'no_deadline' | 'expired') => {
            let segmentCountQuery = supabase
                .from(TABLE_NAME)
                .select('id, job_postings(deadline)', { count: 'exact', head: true })
                .eq('user_id', userId);

            if (segment === 'active') {
                segmentCountQuery = segmentCountQuery
                    .not('job_postings.deadline', 'is', null)
                    .gte('job_postings.deadline', today);
            } else if (segment === 'no_deadline') {
                segmentCountQuery = segmentCountQuery
                    .is('job_postings.deadline', null);
            } else {
                segmentCountQuery = segmentCountQuery
                    .not('job_postings.deadline', 'is', null)
                    .lt('job_postings.deadline', today);
            }

            return segmentCountQuery;
        };

        const readSegmentWindow = async (
            segment: 'active' | 'no_deadline' | 'expired',
            prefixCount: number,
            requestedStart: number,
            requestedEnd: number
        ) => {
            const countQuery = buildSegmentCountQuery(segment);
            const { count: segmentCount, error: segmentCountError } = await countQuery;

            if (segmentCountError) {
                throwSupabaseError(segmentCountError);
            }

            const safeSegmentCount = segmentCount ?? 0;
            if (safeSegmentCount === 0) {
                return { rows: [] as any[], segmentCount: 0 };
            }

            const segmentStartInGlobal = prefixCount;
            const segmentEndInGlobal = prefixCount + safeSegmentCount - 1;

            const overlapStart = Math.max(requestedStart, segmentStartInGlobal);
            const overlapEnd = Math.min(requestedEnd, segmentEndInGlobal);
            if (overlapStart > overlapEnd) {
                return { rows: [] as any[], segmentCount: safeSegmentCount };
            }

            const localStart = overlapStart - segmentStartInGlobal;
            const localEnd = overlapEnd - segmentStartInGlobal;

            const rowsQuery = buildSegmentQuery(segment).range(localStart, localEnd);
            const { data: segmentRows, error: segmentRowsError } = await rowsQuery;

            if (segmentRowsError) {
                throwSupabaseError(segmentRowsError);
            }

            return {
                rows: segmentRows ?? [],
                segmentCount: safeSegmentCount,
            };
        };

        const requestedStart = offset;
        const requestedEnd = offset + limit - 1;

        let runningPrefix = 0;

        const activeResult = await readSegmentWindow('active', runningPrefix, requestedStart, requestedEnd);
        runningPrefix += activeResult.segmentCount;

        const noDeadlineResult = await readSegmentWindow('no_deadline', runningPrefix, requestedStart, requestedEnd);
        runningPrefix += noDeadlineResult.segmentCount;

        const expiredResult = await readSegmentWindow('expired', runningPrefix, requestedStart, requestedEnd);

        data = [
            ...activeResult.rows,
            ...noDeadlineResult.rows,
            ...expiredResult.rows,
        ];
    } else {
        let query = supabase
            .from(TABLE_NAME)
            .select(SCRAP_SELECT, { count: 'exact' })
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .order('id', { ascending: false })
            .order(sortBy, { ascending: false })
            .range(offset, offset + limit - 1);

        const { data: pageData, error, count: totalCount } = await query;

        if (error) {
            throwSupabaseError(error);
        }

        data = pageData ?? [];
        count = totalCount ?? 0;
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

    const mappedRows: ScrapRow[] = convertedData.map((row: any) => {
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

    const items = mappedRows;

    const totalCount = count ?? 0;
    const hasNext = offset + items.length < totalCount;
    const nextOffset = hasNext ? offset + items.length : null;

    return {
        items,
        totalCount,
        hasNext,
        nextOffset,
        limit,
        offset,
    };
}
