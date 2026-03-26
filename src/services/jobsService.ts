import axios from "axios";
import { supabase } from "../lib/supabase";

const TABLE_NAME = "job_postings";

export interface CrawledJob {
  title: string;
  company: string;
  location?: string;
  link?: string;
  [key: string]: any;
}

export async function crawlAndSaveJob(url: string, userId: string) {
  try {
    const response = await axios.post(
      "https://job-crawler-lj5m.onrender.com/api/jobs/crawl",
      {
        url: url,
      },
    );

    const responseData = response.data as any;
    const crawledData =
      responseData && responseData.success && responseData.data
        ? (responseData.data as CrawledJob)
        : (responseData as CrawledJob);

    const rawDeadline = String(crawledData.deadline || "").trim();
    let deadline = null;
    let deadlineText = null;

    if (rawDeadline) {
      const parsedDate = new Date(rawDeadline);
      if (
        !isNaN(parsedDate.getTime()) &&
        /\d/.test(rawDeadline) &&
        rawDeadline.length > 5
      ) {
        deadline = parsedDate.toISOString();
      } else {
        deadlineText = rawDeadline;
      }
    }

    const jobData = {
      title: crawledData.title,
      company_name: crawledData.company,
      content: JSON.stringify(crawledData),
      source_type: "manual",
      created_by: userId,
      source_url: url,
      company_logo: crawledData.companyLogo || crawledData.company_logo || "",
      location: crawledData.location || null,
      experience: crawledData.experience || null,
      deadline: deadline,
      deadline_text: deadlineText,
      external_id: String(
        crawledData.externalId || crawledData.external_id || "",
      ),
    };

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .upsert(jobData, {
        onConflict: "source_type,external_id", // 쉼표 사이 공백 제거
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error: any) {
    console.error("crawlAndSaveJob error:", error.message);
    throw error;
  }
}

export async function getManualJobsByUser(userId: string) {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("*")
    .eq("created_by", userId)
    .eq("source_type", "manual")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}

export async function getAutoJobs(limit: number = 50, offset: number = 0) {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("*")
    .eq("source_type", "auto")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw error;
  }

  return data || [];
}

export async function deleteManualJob(userId: string, externalId: string) {
  const { data, error, count } = await supabase
    .from(TABLE_NAME)
    .delete({ count: "exact" })
    .eq("source_type", "manual")
    .eq("external_id", externalId)
    .eq("created_by", userId)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw error;
  }

  return data;
}
