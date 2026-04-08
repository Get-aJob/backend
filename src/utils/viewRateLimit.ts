const viewCache = new Map<string, number>();

const TTL_MS = 5 * 60 * 1000; 

export function canIncrementView(identifier: string, jobId: string): boolean {
  const key = `${identifier}:${jobId}`;
  const expiry = viewCache.get(key);
  return !expiry || Date.now() > expiry;
}

export function recordView(identifier: string, jobId: string): void {
  const key = `${identifier}:${jobId}`;
  viewCache.set(key, Date.now() + TTL_MS);
}

setInterval(() => {
  const now = Date.now();
  for (const [key, expiry] of viewCache.entries()) {
    if (now > expiry) viewCache.delete(key);
  }
}, 10 * 60 * 1000);
