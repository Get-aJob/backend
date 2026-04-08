const viewCache = new Map<string, number>(); 

const TTL_MS = 5 * 60 * 1000; 

export function canIncrementView(identifier: string, jobId: string): boolean {
  const key = `${identifier}:${jobId}`;
  const expiry = viewCache.get(key);


  if (!expiry || Date.now() > expiry) {
    viewCache.set(key, Date.now() + TTL_MS);
    return true;
  }

  return false; 
}
