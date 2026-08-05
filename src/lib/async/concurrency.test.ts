import { describe, expect, it } from 'vitest';
import { mapWithConcurrency } from './concurrency';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('mapWithConcurrency', () => {
  it('returns results in input order regardless of completion order', async () => {
    const results = await mapWithConcurrency([30, 10, 20], 3, async (delay) => {
      await new Promise((resolve) => setTimeout(resolve, delay / 10));
      return delay;
    });
    expect(results).toEqual([30, 10, 20]);
  });

  it('handles an empty list', async () => {
    expect(
      await mapWithConcurrency([], 4, async () => {
        throw new Error('should never run');
      }),
    ).toEqual([]);
  });

  it('never exceeds the limit', async () => {
    let active = 0;
    let peak = 0;
    await mapWithConcurrency(
      Array.from({ length: 20 }, (_, i) => i),
      4,
      async (value) => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 1));
        active -= 1;
        return value;
      },
    );
    expect(peak).toBeLessThanOrEqual(4);
    expect(peak).toBeGreaterThan(1);
  });

  it('actually overlaps work rather than running one at a time', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const started: number[] = [];

    const run = mapWithConcurrency([first, second], 2, async (item, index) => {
      started.push(index);
      return item.promise;
    });

    // Both workers must have started before either has finished.
    await Promise.resolve();
    expect(started).toEqual([0, 1]);

    second.resolve('b');
    first.resolve('a');
    expect(await run).toEqual(['a', 'b']);
  });

  it('treats a limit below one as one', async () => {
    let peak = 0;
    let active = 0;
    await mapWithConcurrency([1, 2, 3], 0, async (value) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active -= 1;
      return value;
    });
    expect(peak).toBe(1);
  });

  it('drains every worker before rethrowing the first failure', async () => {
    const finished: number[] = [];
    await expect(
      mapWithConcurrency([0, 1, 2, 3], 2, async (value) => {
        if (value === 1) throw new Error('boom');
        await new Promise((resolve) => setTimeout(resolve, 2));
        finished.push(value);
        return value;
      }),
    ).rejects.toThrow('boom');

    // The failure must not abandon the work that was already in flight.
    expect(finished.sort()).toEqual([0, 2, 3]);
  });
});
