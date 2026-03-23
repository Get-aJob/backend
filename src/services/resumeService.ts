const { supabase } = require("../lib/supabase");
import {
  ResumeContent,
  ResumeRecord,
  ResumeListItem,
  ResumeListResponse,
} from "../types/resume";

// 이력서 생성

export async function createResume(
  userId: string,
  title: string,
  content: ResumeContent,
): Promise<ResumeListResponse> {
  const { data, error } = await supabase
    .from("resumes")
    .insert({
      user_id: userId,
      title,
      content: JSON.stringify(content), // 객체를 문자열로 저장
    })
    .select("id, title, created_at")
    .single();

  if (error) {
    throw new Error(`이력서 생성 실패: ${error.message}`);
  }

  return {
    id: data.id,
    title: data.title,
    createdAt: data.created_at,
  };
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

  // content가 문자열(text)로 저장되어 있으므로 다시 객체로 변환
  const content =
    typeof data.content === "string" ? JSON.parse(data.content) : data.content;

  return {
    ...data,
    content,
  } as ResumeRecord;
}

// 이력서 수정

export async function updateResume(
  resumeId: string,
  userId: string,
  updates: { title?: string; content?: ResumeContent },
): Promise<{ id: string; title: string; updated_at: string } | null> {
  const body: any = { ...updates };
  if (updates.content) {
    body.content = JSON.stringify(updates.content);
  }
  body.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("resumes")
    .update(body)
    .eq("id", resumeId)
    .eq("user_id", userId)
    .select("id, title, updated_at")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`이력서 수정 실패: ${error.message}`);
  }

  return data;
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
