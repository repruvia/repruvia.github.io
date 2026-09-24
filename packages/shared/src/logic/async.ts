/**
 * Map over `items` with at most `limit` calls in flight, preserving input order
 * in the result. Used for uploads: parallel enough to be fast, bounded so a
 * 50-step report doesn't open 50 simultaneous requests.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index]!, index);
    }
  };
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker);
  await Promise.all(workers);
  return results;
}

/**
 * Reject if `promise` hasn't settled within `ms`. A defensive wrapper for work
 * that has no guaranteed answer — an IndexedDB open that never fires an event,
 * a worker that stalls — so a caller waiting on it surfaces an error instead of
 * hanging forever. The timer is always cleared, so a settled call leaves
 * nothing pending behind it.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message = "Timed out",
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    const settle = (run: () => void): void => {
      clearTimeout(timer);
      run();
    };
    promise.then(
      (value) => settle(() => resolve(value)),
      (error: unknown) => settle(() => reject(error)),
    );
  });
}
