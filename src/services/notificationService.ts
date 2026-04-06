import { supabase } from "../lib/supabase";
import {
  decodeNotificationCursor,
  type NotificationCursor,
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
}

/**
 * 3-1: notification_logs 목록 조회 서비스 (RPC 기반)
 * - cursor decode
 * - limit 정규화
 * - unreadOnly 필터 전달
 * - 실제 조회는 public.list_notification_logs_page RPC에 위임
 */
export async function listNotificationsForUser({
  userId,
  cursor,
  limit,
  unreadOnly,
}: IListNotificationsInput): Promise<IListNotificationsResult> {
  const normalizedLimit = normalizeNotificationsLimit(limit);
  const normalizedUnreadOnly = Boolean(unreadOnly);

  let decodedCursor: NotificationCursor | null = null;
  if (cursor) {
    decodedCursor = decodeNotificationCursor(cursor); // invalid면 InvalidCursorError throw
  }
  const { data, error } = await supabase.rpc("list_notification_logs_page", {
    p_user_id: userId,
    p_limit: normalizedLimit,
    p_unread_only: normalizedUnreadOnly,
    p_cursor_created_at: decodedCursor?.created_at ?? null,
    p_cursor_id: decodedCursor?.id ?? null,
  });
  if (error) {
    throw error;
  }

  return {
    notifications: (data ?? []) as INotificationLogRow[],
  };
}
