import axios from "axios";
import { supabase } from "../lib/supabase";
import { convertKeysToCamel } from "../utils/caseConverter";

const TABLE_NAME = "job_postings";

export interface CrawledJob {
  title: string;
  company: string;
  location?: string;
  link?: string;
  requirements?: string; 
  preferred?: string;    
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

    if (!responseData?.success || !responseData?.data) {
      const errorMessage = responseData?.message || responseData?.error || '크롤링에 실패했습니다.';
      throw new Error(errorMessage);
    }

    const crawledData = responseData.data as CrawledJob;

    const externalId = String(crawledData.externalId || crawledData.external_id || "").trim();
      if (!externalId) {
        throw new Error('크롤링된 공고의 ID를 확인할 수 없습니다.');
      }

    const rawDeadline = String(crawledData.deadline || "").trim();
    const { deadline, deadlineText } = parseDeadline(rawDeadline);

    const contentParts: string[] = [];
    if (crawledData.requirements) contentParts.push(`[지원자격]\n${crawledData.requirements}`);
    if (crawledData.preferred) contentParts.push(`[우대사항]\n${crawledData.preferred}`);

    return {
      title: crawledData.title,
      companyName: crawledData.company,
      companyLogo: crawledData.companyLogo || crawledData.company_logo || "",
      location: crawledData.location || null,
      experience: crawledData.experience || null,
      deadline,
      deadlineText,
      sourceUrl: crawledData.link || url,
      externalId,
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
    sourceUrl?: string;
    externalId?: string;
    description?: string
    content?: any;
  },
) {
  try {
    const externalId = data.externalId || crypto.randomUUID();

    let content = null;
    if (data.content) {
      content = data.content;
    } else if (data.description) {
      content = { description: data.description };
    }

    const jobData = {
      title: data.title,
      company_name: data.companyName,
      company_logo: data.companyLogo || "",
      location: data.location || null,
      experience: data.experience || null,
      deadline: data.deadline ? new Date(data.deadline) : null,
      deadline_text: data.deadlineText || null,
      content,
      source_type: "manual",
      created_by: userId,
      source_url: data.sourceUrl || "",
      external_id: externalId,
    };

    const { data: existing } = await supabase
      .from(TABLE_NAME)
      .select("id")
      .eq("source_type", "manual")
      .eq("external_id", externalId)
      .eq("created_by", userId)
      .maybeSingle();


    const { data: saved, error } = existing
      ? await supabase
          .from(TABLE_NAME)
          .update(jobData)
          .eq("id", existing.id)
          .select()
          .single()
      : await supabase
          .from(TABLE_NAME)
          .insert(jobData)
          .select()
          .single();

    if (error) throw error;


    return convertKeysToCamel(saved);
  } catch (error: any) {
    console.error("saveManualJob error:", error.message);
    throw error;
  }
}

export async function getManualJobsByUser(
  userId: string,
  limit: number = 20,
  offset: number = 0,
  filters?: {
    keyword?: string;
    excludeExpired?: boolean;
    sortBy?: "createdAt" | "deadline" | "viewCount";
  }
) {
  let query = supabase
    .from(TABLE_NAME)
    .select("*", { count: "exact" })
    .eq("created_by", userId)
    .eq("source_type", "manual");

  if (filters?.keyword) {
    const keyword = filters.keyword
      .replace(/,/g, "")   
      .replace(/\./g, "")  
      .trim();

    query = query.or(
      `title.ilike.%${keyword}%,company_name.ilike.%${keyword}%`
    );
  }

  if (filters?.excludeExpired) {
    const today = new Date().toISOString();
    query = query.or(`deadline.is.null,deadline.gte.${today}`);
  }

  if (filters?.sortBy === "deadline") {
    query = query.order("deadline", { ascending: true, nullsFirst: false });
  } else if (filters?.sortBy === "viewCount") {
    query = query.order("view_count", { ascending: false, nullsFirst: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) throw error;

  return {
    jobs: (data ?? []).map(convertKeysToCamel),
    totalCount: count ?? 0,
  };
}

export async function updateManualJob(
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
    .from(TABLE_NAME)
    .select("id, content")
    .eq("source_type", "manual")
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
    const prevContent = typeof existing.content === "string"
      ? JSON.parse(existing.content || "{}")
      : (existing.content || {});
    updatePayload.content = { ...prevContent, description: data.description };
  }

  const { data: updated, error } = await supabase
    .from(TABLE_NAME)
    .update(updatePayload)
    .eq("source_type", "manual")
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


export async function getAutoJobs(
  limit: number = 50,
  offset: number = 0,
  filters?: {
    keyword?: string;
    location?: string;
    experience?: string;
    sourceSite?: string;
    excludeExpired?: boolean;
    sortBy?: "createdAt" | "deadline" | "viewCount";
  }
) {
  let query = supabase
    .from(TABLE_NAME)
    .select("*", { count: "exact" })
    .eq("source_type", "auto");

  if (filters?.keyword) {
    const keyword = filters.keyword
      .replace(/,/g, "")  
      .replace(/\./g, "") 
      .trim();

    query = query.or(
      `title.ilike.%${keyword}%,company_name.ilike.%${keyword}%`
    );
  }

  if (filters?.location) {
    query = query.ilike("location", `%${filters.location}%`);
  }

  if (filters?.experience) {
    query = query.ilike("experience", `%${filters.experience}%`);
  }

  if (filters?.sourceSite) {
    query = query.eq("source_site_name", filters.sourceSite);
  }

  if (filters?.excludeExpired) {
    const today = new Date().toISOString();
    query = query.or(`deadline.is.null,deadline.gte.${today}`);
  }

  if (filters?.sortBy === "deadline") {
    query = query
      .order("deadline", { ascending: true, nullsFirst: false });
  } else if (filters?.sortBy === "viewCount") {
    query = query.order("view_count", { ascending: false, nullsFirst: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  query = query.range(offset, offset + limit - 1);

  const { data, count, error } = await query;
  if (error) throw error;

  const { data: sitesData } = await supabase
    .from(TABLE_NAME)
    .select("source_site_name")
    .eq("source_type", "auto");

  const sourceSites = Array.from(
    new Set(sitesData?.map((item) => item.source_site_name).filter(Boolean))
  );

  return {
    jobs: (data ?? []).map(convertKeysToCamel),
    totalCount: count || 0,
    sourceSites,
  };
}

export async function getManualJobByExternalId(userId: string, externalId: string) {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("*")
    .eq("source_type", "manual")
    .eq("external_id", externalId)
    .eq("created_by", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }

  return convertKeysToCamel(data);
}

export async function getJobById(jobId: string) {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("*")
    .eq("id", jobId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }

  return convertKeysToCamel(data);
}

export async function incrementViewCount(jobId: string) {
  const { data, error } = await supabase
    .rpc("increment_view_count", { job_id: jobId });

  if (error) throw error;
  if (!data || data.length === 0) return null;

  return convertKeysToCamel(data[0]);
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
