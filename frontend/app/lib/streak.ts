export interface StreakState {
  streak: number;
  lastLoginDate: string;
  milestonePacks: number;
}

// Progression table — indexed by streak tier
// Tiers: S1(J1-6), S2(J7-13), S3(J14-20), S4(J21-27), S5(J28-34), M1(J35+)
export interface StreakTier {
  minDay: number;
  dailySlots: number;       // daily queue size
  spawnIntervalH: number;   // hours between daily pack spawns
  xpMult: number;           // applied to ALL xp gains (daily packs, challenges, etc.)
  dropGold: number;         // drop weight multiplier for Gold
  dropDiamond: number;
  dropIcon: number;
}

export const STREAK_TIERS: StreakTier[] = [
  { minDay: 35, dailySlots: 4, spawnIntervalH: 6,  xpMult: 1.50, dropGold: 1.50, dropDiamond: 1.30, dropIcon: 1.20 }, // M1+
  { minDay: 28, dailySlots: 3, spawnIntervalH: 8,  xpMult: 1.50, dropGold: 1.50, dropDiamond: 1.30, dropIcon: 1.20 }, // S5
  { minDay: 21, dailySlots: 3, spawnIntervalH: 8,  xpMult: 1.38, dropGold: 1.38, dropDiamond: 1.23, dropIcon: 1.15 }, // S4
  { minDay: 14, dailySlots: 2, spawnIntervalH: 12, xpMult: 1.25, dropGold: 1.25, dropDiamond: 1.15, dropIcon: 1.10 }, // S3
  { minDay:  7, dailySlots: 2, spawnIntervalH: 12, xpMult: 1.13, dropGold: 1.13, dropDiamond: 1.08, dropIcon: 1.05 }, // S2
  { minDay:  1, dailySlots: 1, spawnIntervalH: 12, xpMult: 1.05, dropGold: 1.00, dropDiamond: 1.00, dropIcon: 1.00 }, // S1
];

// Ads queue always has 1 fixed slot with these bonuses ON TOP of daily tier values
export const ADS_BONUS = { xpMult: 1.2, dropGold: 1.15, dropDiamond: 1.08, dropIcon: 1.05 };

const LS_KEY = "csv-streak";

function load(): StreakState {
  if (typeof window === "undefined") return { streak: 0, lastLoginDate: "", milestonePacks: 0 };
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { streak: 0, lastLoginDate: "", milestonePacks: 0 };
    return JSON.parse(raw) as StreakState;
  } catch {
    return { streak: 0, lastLoginDate: "", milestonePacks: 0 };
  }
}

function save(s: StreakState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_KEY, JSON.stringify(s));
  window.dispatchEvent(new Event("csv-streak-updated"));
}

export function getStreak(): StreakState {
  return load();
}

export function getStreakTier(streak: number): StreakTier {
  return STREAK_TIERS.find((t) => streak >= t.minDay) ?? STREAK_TIERS[STREAK_TIERS.length - 1];
}

// Call once per session on mount. Increments streak if new day, resets if gap > 1 day.
export function touchStreak(): { streak: number; newMilestonePack: boolean } {
  const today = new Date().toISOString().slice(0, 10);
  const state = load();

  if (state.lastLoginDate === today) {
    return { streak: state.streak, newMilestonePack: false };
  }

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const newStreak = state.lastLoginDate === yesterday ? state.streak + 1 : 1;
  const newMilestonePack = newStreak > 0 && newStreak % 7 === 0;

  save({
    streak: newStreak,
    lastLoginDate: today,
    milestonePacks: state.milestonePacks + (newMilestonePack ? 1 : 0),
  });

  return { streak: newStreak, newMilestonePack };
}

export function getStreakXPMultiplier(): number {
  return getStreakTier(load().streak).xpMult;
}

export function getStreakDropBoost(): { gold: number; diamond: number; icon: number } {
  const t = getStreakTier(load().streak);
  return { gold: t.dropGold, diamond: t.dropDiamond, icon: t.dropIcon };
}

export function getStreakDailyPackCount(): number {
  return getStreakTier(load().streak).dailySlots;
}

export function getStreakSpawnIntervalH(): number {
  return getStreakTier(load().streak).spawnIntervalH;
}

// Consume one milestone pack — returns false if none available
export function claimMilestonePack(): boolean {
  const state = load();
  if (state.milestonePacks <= 0) return false;
  save({ ...state, milestonePacks: state.milestonePacks - 1 });
  return true;
}

// Skip timer checkpoints per initial duration (ms → next checkpoint ms, or 0 for instant)
// Max 3 pubs to reach instant. Last non-zero checkpoint is always 10 min.
const TEN_MIN = 10 * 60 * 1000;
const THIRTY_MIN = 30 * 60 * 1000;
const ONE_H = 60 * 60 * 1000;
const TWO_H = 2 * ONE_H;

export function skipTimerCheckpoints(initialMs: number): number[] {
  if (initialMs <= ONE_H)   return [TEN_MIN, 0];
  if (initialMs <= 2 * ONE_H) return [THIRTY_MIN, TEN_MIN, 0];
  if (initialMs <= 6 * ONE_H) return [ONE_H, TEN_MIN, 0];
  if (initialMs <= 9 * ONE_H) return [ONE_H, TEN_MIN, 0];
  return [TWO_H, THIRTY_MIN, 0]; // 12h
}
