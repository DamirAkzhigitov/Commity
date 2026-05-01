/**
 * Chat history rows are often fetched newest-first (SQL `ORDER BY created_at DESC LIMIT n`).
 * This returns the most recent `limit` rows in oldest→newest order for display.
 */
export function recentSliceOldestFirst<T>(rowsNewestFirst: readonly T[], limit: number): T[] {
  const take = Math.max(0, Math.floor(limit));
  return [...rowsNewestFirst].slice(0, take).reverse();
}
