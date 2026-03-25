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
    const crawledData = (responseData && responseData.success && responseData.data) 
      ? responseData.data as CrawledJob 
      : responseData as CrawledJob;

    // deadline 처리: timestamp 형식이 아니면 deadline_text에 저장
    const rawDeadline = crawledData.deadline || null;
    let deadline = null;
    let deadlineText = null;

    if (rawDeadline) {
      if (!isNaN(Date.parse(rawDeadline))) {
        deadline = rawDeadline;
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
      external_id: String(crawledData.externalId || crawledData.external_id || ""),
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
