/**
 * Runs an async worker over a list with a bounded number of workers in flight.
 *
 * `Promise.all` over a whole binder page would fire every request at once,
 * which a public API answers with 429s and a wave of backoff - slower than
 * running them one at a time. A small cap keeps the requests overlapping
 * without ever looking like a burst.
 *
 * Results come back in input order. If a worker throws, the remaining workers
 * still drain to completion before the first error is rethrown, so nothing is
 * left running unobserved.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  if (items.length === 0) return results;

  const queue = [...items.entries()];
  const workerCount = Math.max(1, Math.min(Math.trunc(limit), queue.length));
  let cursor = 0;
  // An array rather than a nullable local: the assignment happens inside a
  // closure, where TypeScript cannot narrow a reassigned variable afterwards.
  const failures: unknown[] = [];

  const drain = async (): Promise<void> => {
    for (;;) {
      const entry = queue[cursor];
      cursor += 1;
      if (!entry) return;
      const [index, item] = entry;
      try {
        results[index] = await worker(item, index);
      } catch (error) {
        failures.push(error);
      }
    }
  };

  await Promise.all(Array.from({ length: workerCount }, drain));
  if (failures.length > 0) throw failures[0];
  return results;
}
