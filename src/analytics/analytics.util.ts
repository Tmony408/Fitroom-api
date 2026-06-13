/**
 * Pure analytics helpers — no I/O, easy to unit-test. The service queries the
 * DB then delegates the arithmetic/shaping here.
 */

/** Safe percentage (0–100, 1 dp). rate(0,0) = 0, never NaN/Infinity. */
export function ratePct(numerator: number, denominator: number): number {
  if (!denominator || denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export interface CountItem { key: string; count: number }

/** Counts occurrences of each value, sorted desc, top `limit`. Skips null/empty. */
export function topCounts(values: (string | null | undefined)[], limit = 5): CountItem[] {
  const map = new Map<string, number>();
  for (const v of values) {
    if (!v) continue;
    map.set(v, (map.get(v) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, limit);
}

export function sum(values: number[]): number {
  return values.reduce((s, v) => s + v, 0);
}
