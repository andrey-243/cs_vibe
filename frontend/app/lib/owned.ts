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

export function clearOwned(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
  localStorage.removeItem(LEGACY_KEY);
  window.dispatchEvent(new Event("csv-owned-updated"));
}
