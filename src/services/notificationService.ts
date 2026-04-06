import { supabase } from "../lib/supabase";
import {
  decodeNotificationCursor,
  encodeNotificationCursor,
  type INotificationCursor,
} from "../utils/notificationCursor";
import { normalizeNotificationsLimit } from "../constants/notifications";

interface INotificationLogRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  payload: Record<string, unknown> | null;
  read_at: string | null;
  sent_at: string;
  created_at: string;
}

export interface IListNotificationsInput {
  userId: string;
  cursor?: string;
  limit?: number;
  unreadOnly?: boolean;
}

export interface IListNotificationsResult {
  notifications: INotificationLogRow[];
  next_cursor: string | null;
}

export interface IGetUnreadCountResult {
  unreadCount: number;
}

export interface IMarkOneReadResult {
  ok: boolean;
  notification?: INotificationLogRow;
  code?: "NOT_FOUND";
}

export interface IMarkAllReadResult {
  ok: boolean;
  updatedCount: number;
}
/**
 * 3-1: notification_logs 목록 조회 서비스 (RPC 기반)
 * - cursor decode
 * - limit 정규화
 * - unreadOnly 필터 전달
 * - 실제 조회는 public.list_notification_logs_page RPC에 위임
 * 3-2:
 * - RPC 기반 목록 조회
 * - limit+1 패턴으로 다음 페이지 존재 여부 판별
 * - next_cursor 계산
 */
export async function listNotificationsForUser({
  userId,
  cursor,
  limit,
  unreadOnly,
}: IListNotificationsInput): Promise<IListNotificationsResult> {
  const normalizedLimit = normalizeNotificationsLimit(limit);
  const normalizedUnreadOnly = Boolean(unreadOnly);

  let decodedCursor: INotificationCursor | null = null;
  if (cursor) {
    decodedCursor = decodeNotificationCursor(cursor); // invalid면 InvalidCursorError throw
  }

  // 핵심: limit + 1
  const fetchLimit = normalizedLimit + 1;

  const { data, error } = await supabase.rpc("list_notification_logs_page", {
    p_user_id: userId,
    p_limit: fetchLimit,
    p_unread_only: normalizedUnreadOnly,
    p_cursor_created_at: decodedCursor?.created_at ?? null,
    p_cursor_id: decodedCursor?.id ?? null,
  });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as INotificationLogRow[];
  const hasMore = rows.length > normalizedLimit;

  // 실제 응답은 요청 limit 만큼만
  const notifications = hasMore ? rows.slice(0, normalizedLimit) : rows;

  let next_cursor: string | null = null;
  if (hasMore && notifications.length > 0) {
    const last = notifications[notifications.length - 1];
    next_cursor = encodeNotificationCursor({
      created_at: last.created_at,
      id: last.id,
    });
  }

  return {
    notifications,
    next_cursor,
  };
}

export async function getUnreadCountByUser(
  userId: string,
): Promise<IGetUnreadCountResult> {
  const { count, error } = await supabase
    .from("notification_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) {
    throw error;
  }
  return {
    unreadCount: count ?? 0,
  };
}

export async function markNotificationAsRead(
  userId: string,
  notificationId: string,
): Promise<IMarkOneReadResult> {
  const { data: existing, error: existingErr } = await supabase
    .from("notification_logs")
    .select("id, user_id, type, title, body, payload, read_at, sent_at, created_at")
    .eq("id", notificationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingErr) {
    throw existingErr;
  }
  if (!existing) {
    return { ok: false, code: "NOT_FOUND" };
  }

  if (existing.read_at) {
    return { ok: true, notification: existing as INotificationLogRow };
  }

  const { data: updated, error: updateErr } = await supabase
    .from("notification_logs")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", userId)
    .select("id, user_id, type, title, body, payload, read_at, sent_at, created_at")
    .single();

  if (updateErr) {
    throw updateErr;
  }

  return { ok: true, notification: updated as INotificationLogRow };
}

export async function markAllNotificationsAsRead(
  userId: string,
): Promise<IMarkAllReadResult> {
  const { count, error: countErr } = await supabase
    .from("notification_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);

  if (countErr) {
    throw countErr;
  }

  const { error } = await supabase
    .from("notification_logs")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);

  if (error) {
    throw error;
  }

  return {
    ok: true,
    updatedCount: count ?? 0,
  };
}
