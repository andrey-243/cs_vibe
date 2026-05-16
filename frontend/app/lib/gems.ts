const KEY = "csv_gems";

type GemCounts = Record<string, number>;

export function getGems(): GemCounts {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function addGems(tier: string, amount: number): void {
  const gems = getGems();
  gems[tier] = (gems[tier] ?? 0) + amount;
  localStorage.setItem(KEY, JSON.stringify(gems));
  window.dispatchEvent(new Event("csv-gems-updated"));
}

export function removeGems(tier: string, amount: number): void {
  const gems = getGems();
  gems[tier] = Math.max(0, (gems[tier] ?? 0) - amount);
  if (gems[tier] === 0) delete gems[tier];
  localStorage.setItem(KEY, JSON.stringify(gems));
  window.dispatchEvent(new Event("csv-gems-updated"));
}
