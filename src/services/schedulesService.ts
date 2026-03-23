import { supabase } from "../lib/supabase";
import { convertKeysToCamel } from "../utils/caseConverter";

const POSTING_TABLE_NAME = "job_postings";
const APPLICATION_TABLE_NAME = "applications";

type GetSchedulesParams = {
    startDate?: string;
    endDate?: string;
    isApplied?: boolean;
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
    const { startDate, endDate, isApplied, userId } = params;

    const startDateTime = startDate ? `${startDate}T00:00:00Z` : undefined;
    const endDateTimeExclusive = endDate
        ? new Date(new Date(`${endDate}T00:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000).toISOString()
        : undefined;

    if (isApplied === true && userId) {
        let applicationsQuery = supabase
            .from(APPLICATION_TABLE_NAME)
            .select("job_posting_id, applied_at, job_postings(id, title, company_name, deadline)")
            .eq("user_id", userId)
            .order("applied_at", { ascending: true });

        if (startDateTime) {
            applicationsQuery = applicationsQuery.gte("applied_at", startDateTime);
        }

        if (endDateTimeExclusive) {
            applicationsQuery = applicationsQuery.lt("applied_at", endDateTimeExclusive);
        }

        const { data: applications, error: applicationsError } = await applicationsQuery;
        if (applicationsError) {
            throw withCode(applicationsError);
        }

        const safeApplications = convertKeysToCamel<any[]>(applications ?? []);
        const events = safeApplications
            .filter((application: any) => !!application.jobPostings)
            .flatMap((application: any) => {
                const postingId = application.jobPostingId;
                const title = application.jobPostings.title;
                const companyName = cleanCompanyName(application.jobPostings.companyName);
                const deadline = application.jobPostings.deadline;
                const appliedAt = application.appliedAt;

                const eventArray = [];

                // 마감일 이벤트
                if (deadline) {
                    eventArray.push({
                        jobPostingId: postingId,
                        type: "job_post",
                        eventType: "deadline",
                        title,
                        companyName,
                        date: deadline.split("T")[0],
                        isApplied: true,
                    });
                }

                // 지원일 이벤트
                if (appliedAt) {
                    eventArray.push({
                        jobPostingId: postingId,
                        type: "job_post",
                        eventType: "applied",
                        title,
                        companyName,
                        date: appliedAt.split("T")[0],
                        isApplied: true,
                    });
                }

                return eventArray;
            });

        return {
            events,
        };
    }

    let query = supabase
        .from(POSTING_TABLE_NAME)
        .select("id, company_name, title, deadline, source_type, created_by");

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

    let appliedPostingIdSet = new Set<string>();

    if (userId) {
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

    const events = safePostings
        .filter((posting: any) => {

            if (posting.sourceType === "auto") {
                return true;
            }

            return !!userId && posting.createdBy === userId;
        })
        .map((posting: any) => {
            const isApplied = appliedPostingIdSet.has(posting.id);

            return {
                jobPostingId: posting.id,
                type: "job_post",
                eventType: "deadline",
                title: posting.title,
                companyName: cleanCompanyName(posting.companyName),
                date: posting.deadline?.split("T")[0], // yyyy-mm-dd
                isApplied,
            };
        });

    return {
        events,
    };
}