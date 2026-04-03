import { supabase } from "../lib/supabase";

export type JobCommentAuthor = {
  id: string;
  name: string | null;
  profileImageUrl: string | null;
};

/** comments 테이블 한 행(DB 컬럼 그대로) */
type CommentRow = {
  id: string;
  job_posting_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  user_id: string;
};

/** 목록 조회 시 `users (...)` 조인으로 붙는 한 줄 (Supabase는 배열로 추론할 수 있음) */
type CommentUserEmbed = {
  id: string;
  name: string | null;
  profile_image_url: string | null;
};

/** 목록 쿼리 결과 한 행 = 댓글 행 + 작성자 embed */
type JobCommentListRow = CommentRow & {
  users?: CommentUserEmbed | CommentUserEmbed[] | null;
};

export type JobCommentApi = {
  id: string;
  jobId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: JobCommentAuthor;
};

function pickUserEmbed(
  users: CommentUserEmbed | CommentUserEmbed[] | null | undefined,
): CommentUserEmbed | null {
  if (users == null) return null;
  return Array.isArray(users) ? (users[0] ?? null) : users;
}

function authorFromEmbed(
  fallbackUserId: string,
  users: CommentUserEmbed | CommentUserEmbed[] | null | undefined,
): JobCommentAuthor {
  const u = pickUserEmbed(users);
  return {
    id: u?.id ?? fallbackUserId,
    name: u?.name ?? null,
    profileImageUrl: u?.profile_image_url ?? null,
  };
}

function listRowToApi(row: JobCommentListRow): JobCommentApi {
  const base: CommentRow = {
    id: row.id,
    job_posting_id: row.job_posting_id,
    content: row.content,
    created_at: row.created_at,
    updated_at: row.updated_at,
    user_id: row.user_id,
  };
  return toApiComment(base, authorFromEmbed(row.user_id, row.users ?? null));
}

function toApiComment(row: CommentRow, author: JobCommentAuthor): JobCommentApi {
  return {
    id: row.id,
    jobId: row.job_posting_id,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    author,
  };
}

export async function createJobPostingComment(
  userId: string,
  jobPostingId: string,
  rawContent: unknown,
): Promise<
  | { ok: true; comment: JobCommentApi }
  | { ok: false; code: "EMPTY_CONTENT" | "JOB_NOT_FOUND" }
> {
  const content = typeof rawContent === "string" ? rawContent.trim() : "";

  if (!content) {
    return { ok: false, code: "EMPTY_CONTENT" };
  }

  const { data: job, error: jobErr } = await supabase
    .from("job_postings")
    .select("id")
    .eq("id", jobPostingId)
    .maybeSingle();

  if (jobErr) {
    throw jobErr;
  }
  if (!job) {
    return { ok: false, code: "JOB_NOT_FOUND" };
  }

  const { data: row, error: insErr } = await supabase
    .from("comments")
    .insert({
      user_id: userId,
      job_posting_id: jobPostingId,
      content,
    })
    .select("id, job_posting_id, content, created_at, updated_at, user_id")
    .single();

  if (insErr) {
    throw insErr;
  }

  const { data: userRow, error: userErr } = await supabase
    .from("users")
    .select("id, name, profile_image_url")
    .eq("id", userId)
    .single();
  if (userErr) {
    throw userErr;
  }

  const author: JobCommentAuthor = {
    id: userRow.id,
    name: userRow.name,
    profileImageUrl: userRow.profile_image_url,
  };

  return { ok: true, comment: toApiComment(row as CommentRow, author) };
}

export async function listJobPostingComments(
  jobPostingId: string,
): Promise<
  { ok: true; comments: JobCommentApi[] } | { ok: false; code: "JOB_NOT_FOUND" }
> {
  const { data: job, error: jobErr } = await supabase
    .from("job_postings")
    .select("id")
    .eq("id", jobPostingId)
    .maybeSingle();

  if (jobErr) {
    throw jobErr;
  }
  if (!job) {
    return { ok: false, code: "JOB_NOT_FOUND" };
  }

  const { data: rows, error: listErr } = await supabase
    .from("comments")
    .select(
      `
      id,
      job_posting_id,
      content,
      created_at,
      updated_at,
      user_id,
      users (
        id,
        name,
        profile_image_url
      )
    `,
    )
    .eq("job_posting_id", jobPostingId)
    .order("created_at", { ascending: false });

  if (listErr) {
    throw listErr;
  }

  const listRows = (rows ?? []) as JobCommentListRow[];
  const comments = listRows.map(listRowToApi);

  return { ok: true, comments };
}

export async function updateJobPostingComment(
  userId: string,
  jobPostingId: string,
  commentId: string,
  rawContent: unknown,
): Promise<
  | { ok: true; comment: JobCommentApi }
  | { ok: false; code: "EMPTY_CONTENT" | "COMMENT_NOT_FOUND" | "FORBIDDEN" }
> {
  const content = typeof rawContent === "string" ? rawContent.trim() : "";
  if (!content) {
    return { ok: false, code: "EMPTY_CONTENT" };
  }

  const { data: commentRow, error: commentErr } = await supabase
    .from("comments")
    .select("id, job_posting_id, content, created_at, updated_at, user_id")
    .eq("id", commentId)
    .eq("job_posting_id", jobPostingId)
    .maybeSingle();

  if (commentErr) {
    throw commentErr;
  }
  if (!commentRow) {
    return { ok: false, code: "COMMENT_NOT_FOUND" };
  }
  if (commentRow.user_id !== userId) {
    return { ok: false, code: "FORBIDDEN" };
  }

  const { data: updatedRow, error: updateErr } = await supabase
    .from("comments")
    .update({ content })
    .eq("id", commentId)
    .eq("job_posting_id", jobPostingId)
    .select("id, job_posting_id, content, created_at, updated_at, user_id")
    .single();

  if (updateErr) {
    throw updateErr;
  }

  const { data: userRow, error: userErr } = await supabase
    .from("users")
    .select("id, name, profile_image_url")
    .eq("id", userId)
    .single();
  if (userErr) {
    throw userErr;
  }

  const author: JobCommentAuthor = {
    id: userRow.id,
    name: userRow.name,
    profileImageUrl: userRow.profile_image_url,
  };

  return { ok: true, comment: toApiComment(updatedRow as CommentRow, author) };
}
