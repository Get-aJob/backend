import {supabase} from "../lib/supabase";

const TABLE_NAME = 'user_interested_jobs';

export async function toggleScrap(userId : string, jobPostingId : string) {
    // 먼저 이미 스크랩되어 있는지 확인
    const { data: existing, error: checkError } = await supabase
        .from(TABLE_NAME)
        .select('id')
        .eq('user_id', userId)
        .eq('job_posting_id', jobPostingId)
        .maybeSingle();

    if (checkError) {
        const e = new Error(checkError.message) as Error & { code?: string }
        e.code = checkError.code
        throw e
    }

    // 이미 스크랩되어 있으면 삭제
    if (existing) {
        const { error: deleteError } = await supabase
            .from(TABLE_NAME)
            .delete()
            .eq('id', existing.id);

        if (deleteError) {
            const e = new Error(deleteError.message) as Error & { code?: string }
            e.code = deleteError.code
            throw e
        }

        return { added: false };
    }

    // 스크랩되어 있지 않으면 추가
    const { error: insertError } = await supabase
        .from(TABLE_NAME)
        .insert([{ user_id: userId, job_posting_id: jobPostingId }]);

    if (insertError) {
        const e = new Error(insertError.message) as Error & { code?: string }
        e.code = insertError.code
        throw e
    }

    return { added: true };
}