const { supabase } = require("../lib/supabase");
import { ResumeContent, ResumeRecord, ResumeListItem } from "../types/resume";

// 이력서 생성

export async function createResume(
  userId: string,
  title: string,
  content: ResumeContent,
): Promise<ResumeRecord> {
  const { data, error } = await supabase
    .from("resumes")
    .insert({
      user_id: userId,
      title,
      content,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`이력서 생성 실패: ${error.message}`);
  }

  return data as ResumeRecord;
}

// 사용자별 이력서 목록 조회

export async function getResumesByUser(
  userId: string,
): Promise<ResumeListItem[]> {
  const { data, error } = await supabase
    .from("resumes")
    .select("id, title, created_at, updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`이력서 목록 조회 실패: ${error.message}`);
  }

  return (data ?? []) as ResumeListItem[];
}

//이력서 상세 조회

export async function getResumeById(
  resumeId: string,
  userId: string,
): Promise<ResumeRecord | null> {
  const { data, error } = await supabase
    .from("resumes")
    .select("*")
    .eq("id", resumeId)
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`이력서 조회 실패: ${error.message}`);
  }

  return data as ResumeRecord;
}

// 이력서 수정

export async function updateResume(
  resumeId: string,
  userId: string,
  updates: { title?: string; content?: ResumeContent },
): Promise<ResumeRecord | null> {
  const { data, error } = await supabase
    .from("resumes")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", resumeId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`이력서 수정 실패: ${error.message}`);
  }

  return data as ResumeRecord;
}

// 이력서 삭제
export async function deleteResume(
  resumeId: string,
  userId: string,
): Promise<boolean> {
  const { error, count } = await supabase
    .from("resumes")
    .delete({ count: "exact" })
    .eq("id", resumeId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`이력서 삭제 실패: ${error.message}`);
  }

  return (count ?? 0) > 0;
}
