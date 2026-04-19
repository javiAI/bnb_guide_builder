// Shared retry helper for assistant provider calls (Voyage, Cohere).
// Retries on 408/429/5xx and network-level errors with exponential backoff
// plus jitter. Non-retryable errors (4xx other than 408/429) throw immediately.

const RETRY_BASE_MS = 300;
const RETRY_MAX_ATTEMPTS = 4; // 1 initial + 3 retries

export async function retryWithBackoff<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < RETRY_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const isLast = attempt === RETRY_MAX_ATTEMPTS - 1;
      if (isLast || !isRetryable(err)) throw err;
      const delay = RETRY_BASE_MS * 2 ** attempt + Math.floor(Math.random() * 100);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastErr;
}

function isRetryable(err: unknown): boolean {
  const status = (err as { status?: number }).status;
  if (typeof status === "number") {
    if (status === 408 || status === 429) return true;
    if (status >= 500 && status < 600) return true;
    return false;
  }
  return true;
}
