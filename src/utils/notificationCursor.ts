const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type NotificationCursor = {
  created_at: string; // ISO timestamp string
  id: string; // uuid
};

export class InvalidCursorError extends Error {
  constructor(message = "INVALID_CURSOR") {
    super(message);
    this.name = "InvalidCursorError";
  }
}

function isValidIsoDate(value: string) {
  const ts = Date.parse(value);
  return Number.isFinite(ts);
}

function isValidUuid(value: string) {
  return UUID_REGEX.test(value);
}

function assertCursorShape(
  value: unknown,
): asserts value is NotificationCursor {
  if (!value || typeof value !== "object") {
    throw new InvalidCursorError();
  }
  const v = value as { created_at?: unknown; id?: unknown };
  if (typeof v.created_at !== "string" || !isValidIsoDate(v.created_at)) {
    throw new InvalidCursorError();
  }
  if (typeof v.id !== "string" || !isValidUuid(v.id)) {
    throw new InvalidCursorError();
  }
}

export function encodeNotificationCursor(cursor: NotificationCursor): string {
  // opaque cursor: JSON -> base64url
  const json = JSON.stringify(cursor);
  return Buffer.from(json, "utf8").toString("base64url");
}

export function decodeNotificationCursor(
  rawCursor: string,
): NotificationCursor {
  try {
    const json = Buffer.from(rawCursor, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as unknown;
    assertCursorShape(parsed);
    return parsed;
  } catch {
    throw new InvalidCursorError();
  }
}
