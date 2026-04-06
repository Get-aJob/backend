// src/constants/notifications.ts

export const DEFAULT_NOTIFICATIONS_LIMIT = 20;
export const MAX_NOTIFICATIONS_LIMIT = 50;

export function normalizeNotificationsLimit(raw: unknown): number {
  const n =
    typeof raw === "string"
      ? Number.parseInt(raw, 10)
      : typeof raw === "number"
        ? raw
        : DEFAULT_NOTIFICATIONS_LIMIT;

  if (!Number.isFinite(n)) return DEFAULT_NOTIFICATIONS_LIMIT;

  const int = Math.trunc(n);
  if (int < 1) return 1;
  if (int > MAX_NOTIFICATIONS_LIMIT) return MAX_NOTIFICATIONS_LIMIT;

  return int;
}
