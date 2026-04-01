const { supabase } = require("../lib/supabase");
import {
  ResumeContent,
  ResumeRecord,
  ResumeListItem,
  ResumeListResponse,
} from "../types/resume";
import { ConflictError, NotFoundError } from "../utils/errors";
import {
  deletePortfolioFilesFromUrls,
  finalizePortfolioFile,
  generateSignedUrl,
  copyPortfolioFile,
} from "./portfolioService";
import { Portfolio } from "../types/resume";

async function finalizeResumePortfolios(
  userId: string,
  portfolios?: Portfolio[],
): Promise<void> {
  if (!portfolios || portfolios.length === 0) return;

  for (const p of portfolios) {
    if (
      p.fileUrl &&
      p.fileUrl.includes("/storage/v1/object/public/portfolios/temp/")
    ) {
      try {
        const finalizedUrl = await finalizePortfolioFile(userId, p.fileUrl);
        p.fileUrl = finalizedUrl;
      } catch (err) {
        console.error("포트폴리오 파일 확정 중 오류:", err);
      }
    }
  }
}

export async function createResume(
  userId: string,
  title: string,
  content: ResumeContent,
): Promise<ResumeListResponse> {
  await finalizeResumePortfolios(userId, content.portfolio);

  const { data, error } = await supabase
    .from("resumes")
    .insert({
      user_id: userId,
      title,
      content: JSON.stringify(content),
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

async function getRawResumeById(
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
    if (error.code === "PGRST116") return null;
    throw new Error(`이력서 조회 실패: ${error.message}`);
  }

  const content =
    typeof data.content === "string" ? JSON.parse(data.content) : data.content;

  return { ...data, content } as ResumeRecord;
}


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

export async function getResumeById(
  resumeId: string,
  userId: string,
): Promise<ResumeRecord | null> {
  const record = await getRawResumeById(resumeId, userId);
  if (!record) return null;

  if (record.content.portfolio) {
    for (const p of record.content.portfolio) {
      if (p.fileUrl) {
        const signedUrl = await generateSignedUrl(p.fileUrl);
        if (signedUrl) p.fileUrl = signedUrl;
      }
    }
  }

  return record;
}

export async function updateResume(
  resumeId: string,
  userId: string,
  updates: { title?: string; content?: Partial<ResumeContent> },
): Promise<{ id: string; title: string; updated_at: string } | null> {
  const currentRecord = await getRawResumeById(resumeId, userId);
  if (!currentRecord) {
    throw new NotFoundError("해당 이력서를 찾을 수 없습니다.");
  }

  const body: any = {};
  let removedUrls: string[] = [];

  if (updates.title) body.title = updates.title;

  if (updates.content) {
    const mergedContent = {
      ...currentRecord.content,
      ...updates.content,
    };

    await finalizeResumePortfolios(userId, mergedContent.portfolio);

    const oldUrls =
      currentRecord.content.portfolio
        ?.map((p) => p.fileUrl)
        .filter((url): url is string => !!url) || [];
    const newUrls =
      mergedContent.portfolio
        ?.map((p) => p.fileUrl)
        .filter((url): url is string => !!url) || [];

    removedUrls = oldUrls.filter((url) => !newUrls.includes(url));
    body.content = JSON.stringify(mergedContent);
  }

  body.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("resumes")
    .update(body)
    .eq("id", resumeId)
    .eq("user_id", userId)
    .eq("updated_at", currentRecord.updated_at)
    .select("id, title, updated_at")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new ConflictError(
        "이미 다른 기기나 탭에서 수정된 내용이 있습니다. 페이지를 새로고침 해주세요.",
      );
    }
    throw new Error(`이력서 수정 실패: ${error.message}`);
  }

  if (removedUrls.length > 0) {
    deletePortfolioFilesFromUrls(userId, removedUrls).catch((err) =>
      console.error("포트폴리오 파일 삭제 중 오류 (업데이트 성공 후):", err),
    );
  }

  return data;
}

export async function deleteResume(
  resumeId: string,
  userId: string,
): Promise<boolean> {
  const record = await getRawResumeById(resumeId, userId);

  const { error, count } = await supabase
    .from("resumes")
    .delete({ count: "exact" })
    .eq("id", resumeId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`이력서 삭제 실패: ${error.message}`);
  }

  const isDeleted = (count ?? 0) > 0;

  if (isDeleted && record && record.content.portfolio) {
    const urls = record.content.portfolio
      .map((p) => p.fileUrl)
      .filter((url): url is string => !!url);

    if (urls.length > 0) {
      deletePortfolioFilesFromUrls(userId, urls).catch((err) =>
        console.error("포트폴리오 파일 삭제 중 오류 (이력서 삭제):", err),
      );
    }
  }

  return isDeleted;
}

export async function duplicateResume(
  resumeId: string,
  userId: string,
): Promise<ResumeListResponse> {
  const original = await getRawResumeById(resumeId, userId);
  if (!original) {
    throw new NotFoundError("해당 이력서를 찾을 수 없습니다.");
  }

  const content = JSON.parse(JSON.stringify(original.content));

  const baseTitle = original.title;
  const escapedTitle = baseTitle
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
  const { data: existingResumes } = await supabase
    .from("resumes")
    .select("title")
    .eq("user_id", userId)
    .like("title", `${escapedTitle}(%)`);

  let nextNum = 1;
  if (existingResumes && existingResumes.length > 0) {
    const numbers = existingResumes
      .map((r: { title: string }) => {
        const match = r.title.match(/\((\d+)\)$/);
        return match ? parseInt(match[1]) : 0;
      })
      .filter((n: number) => n > 0);
    if (numbers.length > 0) {
      nextNum = Math.max(...numbers) + 1;
    }
  }

  const newTitle = `${baseTitle}(${nextNum})`;

  if (content.portfolio) {
    for (const p of content.portfolio) {
      if (p.fileUrl) {
        const copiedUrl = await copyPortfolioFile(userId, p.fileUrl);
        if (copiedUrl) p.fileUrl = copiedUrl;
      }
    }
  }

  const { data: newResume, error: insertError } = await supabase
    .from("resumes")
    .insert({
      user_id: userId,
      title: newTitle,
      content: JSON.stringify(content),
    })
    .select("id, title, created_at")
    .single();

  if (insertError) {
    throw new Error(`이력서 복제 실패: ${insertError.message}`);
  }

  return {
    id: newResume.id,
    title: newResume.title,
    createdAt: newResume.created_at,
  };
}

