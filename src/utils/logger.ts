type LogLevel = "INFO" | "ERROR" | "WARN" | "DEBUG";
function log(level: LogLevel, message: string, meta?: unknown) {
  const ts = formatNow();
  if (meta !== undefined) {
    // 메타데이터가 있으면 JSON으로 같이 출력
    // ex) [2026-03-15 12:34:56][INFO] 회원가입 성공 { email: "test@example.com" }
    // eslint-disable-next-line no-console
    console.log(`[${ts}][${level}] ${message}`, meta);
  } else {
    // eslint-disable-next-line no-console
    console.log(`[${ts}][${level}] ${message}`);
  }
}
export const logger = {
  info: (message: string, meta?: unknown) => log("INFO", message, meta),
  error: (message: string, meta?: unknown) => log("ERROR", message, meta),
  warn: (message: string, meta?: unknown) => log("WARN", message, meta),
  debug: (message: string, meta?: unknown) => log("DEBUG", message, meta),
};

function formatNow(options?: Intl.DateTimeFormatOptions): string {
  const now = new Date();
  const baseOptions: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul", // 한국 시간 기준
  };
  return new Intl.DateTimeFormat("ko-KR", {
    ...baseOptions,
    ...options,
  }).format(now);
}
/**
 * ISO 문자열이 필요할 때 (KST 기준 offset 반영)
 */
function nowIsoKst(): string {
  const now = new Date();
  // 실제 DB에는 UTC를 쓰고, 로그용으로만 formatNow를 쓰는 것도 가능
  return now.toISOString();
}
