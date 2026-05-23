const XP_PER_TIER: Record<string, number> = {
  BRONZE: 1,
  SILVER: 2,
  GOLD: 5,
  DIAMOND: 12,
  EVENT_MVP: 25,
  ICON: 60,
};

// Pack XP multipliers applied ON TOP of the streak multiplier (already in addXP)
// daily/milestone: streak mult is the only driver — no extra fixed mult
// ads: always ×1.2 on top (ads queue is always superior to daily)
// major: ×1.5 fixed
export const PACK_MULTIPLIER: Record<string, number> = {
  daily:     1.0,
  milestone: 1.0,
  ads:       1.2,
  major:     1.5,
};

export function xpForTier(tier: string): number {
  return XP_PER_TIER[tier.toUpperCase()] ?? 1;
}

export function calcPackXP(tiers: string[], multiplier = 1.0): number {
  const raw = tiers.reduce((sum, t) => sum + xpForTier(t), 0);
  return Math.round(raw * multiplier);
}

export type LevelDef = {
  level: number;
  name: string;
  phase: "cs2" | "faceit" | "esea";
  xpStart: number;
};

export const LEVELS: LevelDef[] = [
  // CS2 ranks (1-18) — Silver III atteignable fin semaine 1 casual (~623 XP)
  { level: 1,  name: "Silver I",               phase: "cs2",    xpStart: 0      },
  { level: 2,  name: "Silver II",              phase: "cs2",    xpStart: 240    },
  { level: 3,  name: "Silver III",             phase: "cs2",    xpStart: 620    }, // fin sem 1 casual
  { level: 4,  name: "Silver IV",              phase: "cs2",    xpStart: 1120   },
  { level: 5,  name: "Silver Elite",           phase: "cs2",    xpStart: 1800   },
  { level: 6,  name: "Silver Elite Master",    phase: "cs2",    xpStart: 2640   },
  { level: 7,  name: "Gold Nova I",            phase: "cs2",    xpStart: 3680   },
  { level: 8,  name: "Gold Nova II",           phase: "cs2",    xpStart: 4920   },
  { level: 9,  name: "Gold Nova III",          phase: "cs2",    xpStart: 6400   },
  { level: 10, name: "Gold Nova Master",       phase: "cs2",    xpStart: 8120   },
  { level: 11, name: "Master Guardian I",      phase: "cs2",    xpStart: 10080  },
  { level: 12, name: "Master Guardian II",     phase: "cs2",    xpStart: 12240  },
  { level: 13, name: "Master Guardian Elite",  phase: "cs2",    xpStart: 14560  },
  { level: 14, name: "Distinguished MG",       phase: "cs2",    xpStart: 16720  },
  { level: 15, name: "Legendary Eagle",        phase: "cs2",    xpStart: 18200  },
  { level: 16, name: "Legendary Eagle Master", phase: "cs2",    xpStart: 19120  },
  { level: 17, name: "Supreme MFC",            phase: "cs2",    xpStart: 19640  },
  { level: 18, name: "Global Elite",           phase: "cs2",    xpStart: 20000  },
  // Faceit (19-28)
  { level: 19, name: "Faceit 1",               phase: "faceit", xpStart: 22000  },
  { level: 20, name: "Faceit 2",               phase: "faceit", xpStart: 24400  },
  { level: 21, name: "Faceit 3",               phase: "faceit", xpStart: 27200  },
  { level: 22, name: "Faceit 4",               phase: "faceit", xpStart: 30400  },
  { level: 23, name: "Faceit 5",               phase: "faceit", xpStart: 34000  },
  { level: 24, name: "Faceit 6",               phase: "faceit", xpStart: 38000  },
  { level: 25, name: "Faceit 7",               phase: "faceit", xpStart: 42400  },
  { level: 26, name: "Faceit 8",               phase: "faceit", xpStart: 47200  },
  { level: 27, name: "Faceit 9",               phase: "faceit", xpStart: 52400  },
  { level: 28, name: "Faceit 10",              phase: "faceit", xpStart: 58000  },
  // ESEA (29-41)
  { level: 29, name: "ESEA D-",                phase: "esea",   xpStart: 60400  },
  { level: 30, name: "ESEA D",                 phase: "esea",   xpStart: 63000  },
  { level: 31, name: "ESEA D+",                phase: "esea",   xpStart: 65800  },
  { level: 32, name: "ESEA C-",                phase: "esea",   xpStart: 68000  },
  { level: 33, name: "ESEA C",                 phase: "esea",   xpStart: 70000  },
];

export const LEVEL_SVG: Record<number, string> = {
  0:  "lvl0_mm0",  1:  "lvl1_mm1",  2:  "lvl2_mm2",  3:  "lvl3_mm3",
  4:  "lvl4_mm4",  5:  "lvl5_mm5",  6:  "lvl6_mm6",  7:  "lvl7_dz1",
  8:  "lvl8_dz2",  9:  "lvl9_dz3",  10: "lvl10_dz4", 11: "lvl11_dz5",
  12: "lvl12_dz6", 13: "lvl13_mm7", 14: "lvl14_mm8", 15: "lvl15_mm9",
  16: "lvl16_mm10",17: "lvl17_mm11",18: "lvl18_mm12",19: "lvl19_mm13",
  20: "lvl20_dz7", 21: "lvl21_dz8", 22: "lvl22_dz9", 23: "lvl23_dz10",
  24: "lvl24_dz11",25: "lvl25_dz12",26: "lvl26_mm14",27: "lvl27_mm15",
  28: "lvl28_mm16",29: "lvl29_mm17",30: "lvl30_mm18",31: "lvl31_dz13",
  32: "lvl32_dz14",33: "lvl33_dz15",
};

import { getStreakXPMultiplier } from "./streak";

const LS_KEY = "csv-xp-total";
const LS_PENDING_KEY = "csv-pending-levelups";

// ─── Reward types ────────────────────────────────────────────────────────────

export type RewardPackTier = "free" | "TOP100" | "TOP75" | "TOP50" | "TOP25" | "TOP15" | "TOP5" | "ICON";

export type LevelReward = {
  pack?: RewardPackTier;
  extraPack?: RewardPackTier;
  gems?: { tier: string; amount: number };
};

export type PendingLevelUp = {
  level: number;
  levelName: string;
  reward: LevelReward;
};


export const LEVEL_REWARDS: Record<number, LevelReward> = {
  // CS2
  1:  { pack: "TOP100" },
  2:  { pack: "free" }, 3:  { pack: "free" }, 4:  { pack: "free" },
  5:  { pack: "free" },
  6:  { pack: "free", extraPack: "TOP75" },        // Silver Elite Master
  7:  { pack: "free" }, 8:  { pack: "free" }, 9:  { pack: "free" },
  10: { pack: "free" }, 11: { pack: "free" },
  12: { pack: "free", extraPack: "TOP75" },        // Master Guardian II
  13: { pack: "free" }, 14: { pack: "free" }, 15: { pack: "free" },
  16: { pack: "free" }, 17: { pack: "free" }, 18: { pack: "free" },
  // Faceit
  19: { pack: "free", extraPack: "TOP25" },        // Faceit 1
  20: { pack: "free" }, 21: { pack: "free" }, 22: { pack: "free" },
  23: { pack: "free" }, 24: { pack: "free" },
  25: { pack: "free", extraPack: "TOP15" },        // Faceit 7
  26: { pack: "free" }, 27: { pack: "free" }, 28: { pack: "free" },
  // ESEA
  29: { pack: "free" }, 30: { pack: "free", extraPack: "TOP15" },
  31: { pack: "TOP5" },
  32: { pack: "TOP5" },
  33: { pack: "TOP5" },
};

// ─── Pending queue ────────────────────────────────────────────────────────────

export function getPendingLevelUps(): PendingLevelUp[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(LS_PENDING_KEY) ?? "[]"); }
  catch { return []; }
}

export function shiftPendingLevelUp(): PendingLevelUp | null {
  const queue = getPendingLevelUps();
  if (!queue.length) return null;
  const [first, ...rest] = queue;
  localStorage.setItem(LS_PENDING_KEY, JSON.stringify(rest));
  return first;
}

function pushPendingLevelUp(lu: PendingLevelUp) {
  const queue = getPendingLevelUps();
  localStorage.setItem(LS_PENDING_KEY, JSON.stringify([...queue, lu]));
}

// ─── Core XP functions ───────────────────────────────────────────────────────

export function getTotalXP(): number {
  if (typeof window === "undefined") return 0;
  return parseInt(localStorage.getItem(LS_KEY) ?? "0", 10) || 0;
}

export function addXP(amount: number): void {
  if (typeof window === "undefined") return;
  const mult = getStreakXPMultiplier();
  const oldXP = getTotalXP();
  const newXP = oldXP + Math.round(amount * mult);
  const oldLevel = getLevelInfo(oldXP).current.level;
  localStorage.setItem(LS_KEY, String(newXP));
  const newLevel = getLevelInfo(newXP).current.level;

  window.dispatchEvent(new Event("csv-xp-updated"));

  if (newLevel > oldLevel) {
    for (let lvl = oldLevel + 1; lvl <= newLevel; lvl++) {
      const def = LEVELS.find((l) => l.level === lvl);
      if (!def) continue;
      pushPendingLevelUp({ level: lvl, levelName: def.name, reward: LEVEL_REWARDS[lvl] ?? {} });
    }
    window.dispatchEvent(new Event("csv-level-up"));
  }
}

export type LevelInfo = {
  current: LevelDef;
  next: LevelDef | null;
  progressPct: number;
  totalXP: number;
};

export function getLevelInfo(totalXP: number): LevelInfo {
  let current = LEVELS[0];
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (totalXP >= LEVELS[i].xpStart) {
      current = LEVELS[i];
      break;
    }
  }
  const idx = current.level - 1;
  const next = idx < LEVELS.length - 1 ? LEVELS[idx + 1] : null;
  const progressPct = next
    ? Math.min(100, Math.round(((totalXP - current.xpStart) / (next.xpStart - current.xpStart)) * 100))
    : 100;
  return { current, next, progressPct, totalXP };
}
