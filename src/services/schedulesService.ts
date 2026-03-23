import { supabase } from "../lib/supabase";
import { convertKeysToCamel } from "../utils/caseConverter";

const POSTING_TABLE_NAME = "job_postings";
const APPLICATION_TABLE_NAME = "applications";

type GetSchedulesParams = {
    startDate?: string;
    endDate?: string;
    appliedYN?: "Y" | "N";
    userId?: string;
};

function withCode(error: { message: string; code?: string }) {
    const e = new Error(error.message) as Error & { code?: string };
    e.code = error.code;
    return e;
}

function cleanCompanyName(name: string) {
    if (!name) return "";

    return name
        .replace(/\n/g, "")
        .replace(/\t/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/1000대.*$/, "");
}

export async function getSchedules(params: GetSchedulesParams) {
    const { startDate, endDate, appliedYN, userId } = params;

    let query = supabase
        .from(POSTING_TABLE_NAME)
        .select("id, company_name, title, deadline, source_type, created_by")
        if (startDate) {
        query = query.gte("deadline", startDate);
        }
        if (endDate) {
            query = query.lte("deadline", endDate);
        }
        query = query.order("deadline", { ascending: true });

    const { data: postings, error: postingsError } = await query;
    if (postingsError) {
        throw withCode(postingsError);
    }

    const safePostings = convertKeysToCamel<any[]>(postings ?? []);

    // 🔹 지원 여부 조회
    let appliedPostingIdSet = new Set<string>();

    if (appliedYN === "Y" && userId) {
        const { data: userApplications, error: applicationsError } = await supabase
            .from(APPLICATION_TABLE_NAME)
            .select("job_posting_id")
            .eq("user_id", userId);

        if (applicationsError) {
            throw withCode(applicationsError);
        }

        appliedPostingIdSet = new Set(
            (userApplications ?? []).map((row: any) =>
                convertKeysToCamel<{ jobPostingId: string }>(row).jobPostingId
            )
        );
    }

    //  일정 이벤트 생성
    const events = safePostings
        .filter((posting: any) => {
            if (appliedYN === "Y") {
                return appliedPostingIdSet.has(posting.id);
            }

            if (posting.sourceType === "auto") {
                return true;
            }

            return !!userId && posting.createdBy === userId;
        })
        .map((posting: any) => {
            const isApplied = appliedPostingIdSet.has(posting.id);

            return {
                id: posting.id,
                type: "job_post",
                eventType: "deadline",
                title: posting.title,
                company: cleanCompanyName(posting.companyName),
                date: posting.deadline?.split("T")[0], // yyyy-mm-dd
                appliedYN: isApplied ? "Y" : "N",
            };
        });

    return {
        events,
    };
}