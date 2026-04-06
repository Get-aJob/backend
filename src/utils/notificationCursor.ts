export interface INotificationCursor {
  created_at: string; // ISO timestamp string
  id: string; // uuid
}

export class InvalidCursorError extends Error {
  constructor(message = "INVALID_CURSOR") {
    super(message);
    this.name = "InvalidCursorError";
  }
}

export function encodeNotificationCursor(cursor: INotificationCursor): string {
  // opaque cursor: JSON -> base64url
  const json = JSON.stringify(cursor);
  return Buffer.from(json, "utf8").toString("base64url");
}

export function decodeNotificationCursor(
  rawCursor: string,
): INotificationCursor {
  try {
    const json = Buffer.from(rawCursor, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as {
      created_at?: unknown;
      id?: unknown;
    };

    if (
      typeof parsed.created_at !== "string" ||
      typeof parsed.id !== "string"
    ) {
      throw new InvalidCursorError();
    }

    return {
      created_at: parsed.created_at,
      id: parsed.id,
    };
  } catch {
    throw new InvalidCursorError();
  }
}
