import {supabase} from "../lib/supabase";
import { convertKeysToCamel } from "../utils/caseConverter";

const TABLE_NAME = 'user_interested_jobs';

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

type ScrapPageRow = {
    jobPostingId?: string;
    title?: string;
    companyName?: string;
    deadline?: string | null;
    location?: string | null;
    experience?: string | null;
    isApplied?: boolean;
    expired?: boolean;
    companyLogo?: string | null;
    createdAt?: string | null;
    totalCount?: number | string | null;
};

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

    const fetchScrapPage = async (pageLimit: number, pageOffset: number) => {
        const { data, error } = await supabase.rpc('get_user_scraps_page', {
            p_user_id: userId,
            p_limit: pageLimit,
            p_offset: pageOffset,
            p_sort_by: sortBy,
        });

        if (error) {
            throwSupabaseError(error);
        }

        return convertKeysToCamel<ScrapPageRow[]>(data ?? []);
    };

    const pageRows = await fetchScrapPage(limit, offset);

    const resolveTotalCount = async () => {
        const rawTotalCount = pageRows[0]?.totalCount;
        if (rawTotalCount !== undefined && rawTotalCount !== null) {
            return Number(rawTotalCount);
        }

        if (offset === 0) {
            return 0;
        }

        const firstPageRows = await fetchScrapPage(1, 0);
        return Number(firstPageRows[0]?.totalCount ?? 0);
    };

    const mappedRows: ScrapRow[] = pageRows.map((row) => {
        const deadline = row?.deadline ? String(row.deadline).split("T")[0] : "";
        const createdAtRaw = row?.createdAt ? String(row.createdAt) : "";

        return {
            jobPostingId: row?.jobPostingId ?? "",
            title: row?.title ?? "",
            companyName: row?.companyName ?? "",
            deadline,
            location: row?.location ?? "",
            experience: row?.experience ?? "",
            isApplied: row?.isApplied ?? false,
            expired: row?.expired ?? false,
            companyLogo: row?.companyLogo ?? "",
            createdAt: createdAtRaw ? createdAtRaw.split("T")[0] : "",
        };
    });

    const items = mappedRows;

    const totalCount = await resolveTotalCount();
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
