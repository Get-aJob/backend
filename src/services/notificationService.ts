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
