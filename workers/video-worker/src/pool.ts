/**
 * Run tasks with bounded concurrency.
 *
 * The pipeline used to process a fixed batch strictly one after
 * another, once a minute, which capped tagging at four images per
 * minute regardless of how idle the machine was. At that rate the
 * 7,438 image Anamaya library takes 31 hours. Nothing about the work
 * requires that: each image is independent and mostly spent waiting on
 * a network round trip.
 */
export async function pool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker),
  );
  return results;
}
