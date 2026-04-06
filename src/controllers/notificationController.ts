import { Request, Response } from "express";
import {
  decodeNotificationCursor,
  InvalidCursorError,
} from "../utils/notificationCursor";
import { normalizeNotificationsLimit } from "../constants/notifications";
import {
  listNotificationsForUser,
  getUnreadCountByUser,
} from "../services/notificationService";

export async function getNotificationsHandler(req: Request, res: Response) {
  try {
    const userId = res.locals.user?.id as string | undefined;
    if (!userId) {
      return res.status(401).json({ error: "인증 정보가 없습니다." });
    }

    const limit = normalizeNotificationsLimit(req.query.limit);
    const unread_only =
      req.query.unread_only === "true" || req.query.unread_only === "1";

    const cursorRaw = req.query.cursor as string | undefined;

    // 여기부터 3단계 서비스 호출로 연결
    const result = await listNotificationsForUser({
      userId,
      cursor: cursorRaw,
      limit,
      unreadOnly: unread_only,
    });

    return res.status(200).json({
      notifications: result.notifications,
      next_cursor: result.next_cursor,
    });
  } catch (error) {
    if (error instanceof InvalidCursorError) {
      return res.status(400).json({ error: "유효하지 않은 cursor 입니다." });
    }
    return res
      .status(500)
      .json({ error: "알림 목록 조회 중 오류가 발생했습니다." });
  }
}

export async function getUnreadCountHandler(req: Request, res: Response) {
  try {
    const userId = res.locals.user?.id as string | undefined;
    if (!userId) {
      return res.status(401).json({ error: "인증 정보가 없습니다." });
    }

    const result = await getUnreadCountByUser(userId);
    return res.status(200).json(result);
  } catch (error) {
    return res
      .status(500)
      .json({ error: "미읽음 알림 수 조회 중 오류가 발생했습니다." });
  }
}
