// Client-side owned cards store — persisted in localStorage.
// Dispatches "csv-owned-updated" on window after every write so any
// mounted component can react without a full re-render of the page.

const KEY = "csv_owned_ids";

export function getOwnedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(KEY);
    return new Set<string>(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

export function addOwnedIds(ids: string[]): void {
  if (typeof window === "undefined") return;
  const current = getOwnedIds();
  ids.forEach((id) => current.add(id));
  localStorage.setItem(KEY, JSON.stringify([...current]));
  window.dispatchEvent(new Event("csv-owned-updated"));
}

export function clearOwned(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("csv-owned-updated"));
}
