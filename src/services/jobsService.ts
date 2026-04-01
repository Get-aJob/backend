import axios from "axios";
import { supabase } from "../lib/supabase";
import { convertKeysToCamel } from "../utils/caseConverter";

const TABLE_NAME = "job_postings";

export interface CrawledJob {
  title: string;
  company: string;
  location?: string;
  link?: string;
  [key: string]: any;
}

function parseDeadline(rawDeadline: string) {
  let deadline = null;
  let deadlineText = null;

  if (rawDeadline) {
    const parsedDate = new Date(rawDeadline);
    if (!isNaN(parsedDate.getTime()) && /\d/.test(rawDeadline) && rawDeadline.length > 5) {
      deadline = parsedDate.toISOString();
    } else {
      deadlineText = rawDeadline;
    }
  }

  return { deadline, deadlineText };
}

export async function crawlJob(url: string) {
  try {
    const response = await axios.post(
      "https://job-crawler-lj5m.onrender.com/api/jobs/crawl",
      { url },
    );

    const responseData = response.data as any;
    const crawledData =
      responseData && responseData.success && responseData.data
        ? (responseData.data as CrawledJob)
        : (responseData as CrawledJob);

    const rawDeadline = String(crawledData.deadline || "").trim();
    const { deadline, deadlineText } = parseDeadline(rawDeadline);

    return {
      title: crawledData.title,
      companyName: crawledData.company,
      companyLogo: crawledData.companyLogo || crawledData.company_logo || "",
      location: crawledData.location || null,
      experience: crawledData.experience || null,
      deadline,
      deadlineText,
      sourceUrl: crawledData.link || url,
      externalId: String(crawledData.externalId || crawledData.external_id || ""),
      content: crawledData,
    };
  } catch (error: any) {
    console.error("crawlJob error:", error.message);
    throw error;
  }
}

export async function saveManualJob(
  userId: string,
  data: {
    title: string;
    companyName: string;
    companyLogo?: string;
    location?: string;
    experience?: string;
    deadline?: string | null;
    deadlineText?: string | null;
    sourceUrl: string;
    externalId: string;
    content?: any;
  },
) {
  try {
    const jobData = {
      title: data.title,
      company_name: data.companyName,
      company_logo: data.companyLogo || "",
      location: data.location || null,
      experience: data.experience || null,
      deadline: data.deadline || null,
      deadline_text: data.deadlineText || null,
      content: JSON.stringify(data.content || {}),
      source_type: "manual",
      created_by: userId,
      source_url: data.sourceUrl,
      external_id: data.externalId,
    };

    const { data: saved, error } = await supabase
      .from(TABLE_NAME)
      .upsert(jobData, { onConflict: "source_type,external_id" })
      .select()
      .single();

    if (error) throw error;

    return convertKeysToCamel(saved);
  } catch (error: any) {
    console.error("saveManualJob error:", error.message);
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
  const { data, count, error } = await supabase
    .from(TABLE_NAME)
    .select("*", { count: "exact" })
    .eq("source_type", "auto")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw error;
  }

  const { data: sitesData, error: sitesError } = await supabase
    .from(TABLE_NAME)
    .select("source_site_name")
    .eq("source_type", "auto");

  if (sitesError) {
    throw sitesError;
  }

  const sourceSites = Array.from(
    new Set(sitesData?.map((item) => item.source_site_name).filter(Boolean))
  );

  return {
    jobs: data || [],
    totalCount: count || 0,
    sourceSites,
  };
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


export async function createDirectJob(
  userId: string,
  data: {
    title: string;
    companyName: string;
    location?: string;
    experience?: string;
    companyLogo?: string;
    deadline?: string;       
    deadlineText?: string;
    description?: string;    
    sourceUrl?: string;       
  }
) {
  const externalId = crypto.randomUUID(); 

  const { data: job, error } = await supabase
    .from("job_postings")
    .insert({
      title: data.title,
      company_name: data.companyName,
      location: data.location,
      experience: data.experience,
      company_logo: data.companyLogo,
      deadline: data.deadline ? new Date(data.deadline) : null,
      deadline_text: data.deadlineText,
      content: JSON.stringify({ description: data.description }),
      source_url: data.sourceUrl ?? "",
      source_type: "direct",
      source_site_name: null,
      external_id: externalId,
      created_by: userId,
    })
    .select()
    .single();

  if (error) {
    const e = new Error(error.message) as Error & { code?: string };
    e.code = error.code;
    throw e;
  }

  return convertKeysToCamel(job);
}

// 직접 입력 공고 수정
export async function updateDirectJob(
  userId: string,
  externalId: string,
  data: {
    title?: string;
    companyName?: string;
    location?: string;
    experience?: string;
    companyLogo?: string;
    deadline?: string;
    deadlineText?: string;
    description?: string;
    sourceUrl?: string;
  }
) {

  const { data: existing, error: fetchError } = await supabase
    .from("job_postings")
    .select("id, content")
    .eq("source_type", "direct")
    .eq("external_id", externalId)
    .eq("created_by", userId)
    .single();

  if (fetchError || !existing) {
    const e = new Error("Not found") as Error & { code?: string };
    e.code = "NOT_FOUND";
    throw e;
  }

  const updatePayload: Record<string, any> = {};
  if (data.title !== undefined) updatePayload.title = data.title;
  if (data.companyName !== undefined) updatePayload.company_name = data.companyName;
  if (data.location !== undefined) updatePayload.location = data.location;
  if (data.experience !== undefined) updatePayload.experience = data.experience;
  if (data.companyLogo !== undefined) updatePayload.company_logo = data.companyLogo;
  if (data.deadlineText !== undefined) updatePayload.deadline_text = data.deadlineText;
  if (data.sourceUrl !== undefined) updatePayload.source_url = data.sourceUrl;
  if (data.deadline !== undefined)
    updatePayload.deadline = data.deadline ? new Date(data.deadline) : null;
  if (data.description !== undefined) {
    const prevContent = JSON.parse(existing.content || "{}");
    updatePayload.content = JSON.stringify({ ...prevContent, description: data.description });
  }

  const { data: updated, error } = await supabase
    .from("job_postings")
    .update(updatePayload)
    .eq("source_type", "direct")
    .eq("external_id", externalId)
    .eq("created_by", userId)
    .select()
    .single();

  if (error) {
    const e = new Error(error.message) as Error & { code?: string };
    e.code = error.code;
    throw e;
  }

  return convertKeysToCamel(updated);
}

export async function getDirectJobsByUser(
  userId: string,
  limit: number = 20,
  offset: number = 0
) {
  const { data: jobs, error, count } = await supabase
    .from("job_postings")
    .select("*", { count: "exact" })
    .eq("source_type", "direct")
    .eq("created_by", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    const e = new Error(error.message) as Error & { code?: string };
    e.code = error.code;
    throw e;
  }

  return {
    jobs: (jobs ?? []).map(convertKeysToCamel),
    totalCount: count ?? 0,
  };
}

export async function deleteDirectJob(userId: string, externalId: string) {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .delete()
    .eq("source_type", "direct")
    .eq("external_id", externalId)
    .eq("created_by", userId)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // 없는 경우
    throw error;
  }

  return data;
}
