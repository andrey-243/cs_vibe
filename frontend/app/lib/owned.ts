// Client-side owned cards store — persisted in localStorage.
// Stores a count per player_id so duplicates are tracked.
// Dispatches "csv-owned-updated" on window after every write so any
// mounted component can react without a full re-render of the page.

const KEY = "csv_owned_counts";
const LEGACY_KEY = "csv_owned_ids";

function readCounts(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Record<string, number>;
    // Migrate from old Set-based format
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const ids: string[] = JSON.parse(legacy);
      const counts: Record<string, number> = {};
      ids.forEach((id) => { counts[id] = 1; });
      localStorage.setItem(KEY, JSON.stringify(counts));
      localStorage.removeItem(LEGACY_KEY);
      return counts;
    }
    return {};
  } catch {
    return {};
  }
}

/** Returns player_id → copy count for all owned cards. */
export function getOwnedCounts(): Record<string, number> {
  return readCounts();
}

/** Returns the set of player_ids owned at least once (for locked/unlocked display). */
export function getOwnedIds(): Set<string> {
  return new Set(Object.keys(readCounts()));
}

/** Increments the count for each id (duplicates accumulate). */
export function addOwnedIds(ids: string[]): void {
  if (typeof window === "undefined") return;
  const counts = readCounts();
  ids.forEach((id) => { counts[id] = (counts[id] ?? 0) + 1; });
  localStorage.setItem(KEY, JSON.stringify(counts));
  window.dispatchEvent(new Event("csv-owned-updated"));
}

/** Decrements the count for id by 1. Removes key if count reaches 0. */
export function removeOwnedId(id: string): void {
  if (typeof window === "undefined") return;
  const counts = readCounts();
  if (!counts[id]) return;
  counts[id] -= 1;
  if (counts[id] <= 0) delete counts[id];
  localStorage.setItem(KEY, JSON.stringify(counts));
  window.dispatchEvent(new Event("csv-owned-updated"));
}

/** Remove specific counts for multiple ids in a single write + dispatch. */
export function bulkRemoveOwned(entries: { id: string; count: number }[]): void {
  if (typeof window === "undefined") return;
  const counts = readCounts();
  for (const { id, count } of entries) {
    if (!counts[id]) continue;
    counts[id] -= count;
    if (counts[id] <= 0) delete counts[id];
  }
  localStorage.setItem(KEY, JSON.stringify(counts));
  window.dispatchEvent(new Event("csv-owned-updated"));
}

export function clearOwned(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
  localStorage.removeItem(LEGACY_KEY);
  window.dispatchEvent(new Event("csv-owned-updated"));
}
