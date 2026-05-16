const XP_PER_TIER: Record<string, number> = {
  BRONZE: 1,
  SILVER: 2,
  GOLD: 5,
  DIAMOND: 12,
  EVENT_MVP: 25,
  ICON: 60,
};

export const PACK_MULTIPLIER: Record<string, number> = {
  daily: 1.0,
  bonus: 1.2,
  major: 1.5,
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
  { level: 34, name: "ESEA C+",                phase: "esea",   xpStart: 71800  },
  { level: 35, name: "ESEA B-",                phase: "esea",   xpStart: 73400  },
  { level: 36, name: "ESEA B",                 phase: "esea",   xpStart: 74800  },
  { level: 37, name: "ESEA B+",                phase: "esea",   xpStart: 76000  },
  { level: 38, name: "ESEA A-",                phase: "esea",   xpStart: 77000  },
  { level: 39, name: "ESEA A",                 phase: "esea",   xpStart: 78000  },
  { level: 40, name: "ESEA A+",                phase: "esea",   xpStart: 79000  },
  { level: 41, name: "ESEA S",                 phase: "esea",   xpStart: 80000  },
];

const LS_KEY = "csv-xp-total";

export function getTotalXP(): number {
  if (typeof window === "undefined") return 0;
  return parseInt(localStorage.getItem(LS_KEY) ?? "0", 10) || 0;
}

export function addXP(amount: number): void {
  if (typeof window === "undefined") return;
  const current = getTotalXP();
  localStorage.setItem(LS_KEY, String(current + amount));
  window.dispatchEvent(new Event("csv-xp-updated"));
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
