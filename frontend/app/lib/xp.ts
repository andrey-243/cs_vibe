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
  // CS2 ranks (1-18)
  // Silver I–III atteignables en ~1 semaine casual (~305 XP)
  { level: 1,  name: "Silver I",               phase: "cs2",    xpStart: 0     }, // j1
  { level: 2,  name: "Silver II",              phase: "cs2",    xpStart: 60    }, // j1-2
  { level: 3,  name: "Silver III",             phase: "cs2",    xpStart: 150   }, // j3-4
  { level: 4,  name: "Silver IV",              phase: "cs2",    xpStart: 280   }, // j6 (fin sem 1)
  { level: 5,  name: "Silver Elite",           phase: "cs2",    xpStart: 450   }, // sem 2
  { level: 6,  name: "Silver Elite Master",    phase: "cs2",    xpStart: 660   },
  { level: 7,  name: "Gold Nova I",            phase: "cs2",    xpStart: 920   },
  { level: 8,  name: "Gold Nova II",           phase: "cs2",    xpStart: 1230  },
  { level: 9,  name: "Gold Nova III",          phase: "cs2",    xpStart: 1600  },
  { level: 10, name: "Gold Nova Master",       phase: "cs2",    xpStart: 2030  },
  { level: 11, name: "Master Guardian I",      phase: "cs2",    xpStart: 2520  },
  { level: 12, name: "Master Guardian II",     phase: "cs2",    xpStart: 3060  },
  { level: 13, name: "Master Guardian Elite",  phase: "cs2",    xpStart: 3640  },
  { level: 14, name: "Distinguished MG",       phase: "cs2",    xpStart: 4180  },
  { level: 15, name: "Legendary Eagle",        phase: "cs2",    xpStart: 4550  },
  { level: 16, name: "Legendary Eagle Master", phase: "cs2",    xpStart: 4780  },
  { level: 17, name: "Supreme MFC",            phase: "cs2",    xpStart: 4910  },
  { level: 18, name: "Global Elite",           phase: "cs2",    xpStart: 5000  },
  // Faceit (19-28)
  { level: 19, name: "Faceit 1",               phase: "faceit", xpStart: 5500  },
  { level: 20, name: "Faceit 2",               phase: "faceit", xpStart: 6100  },
  { level: 21, name: "Faceit 3",               phase: "faceit", xpStart: 6800  },
  { level: 22, name: "Faceit 4",               phase: "faceit", xpStart: 7600  },
  { level: 23, name: "Faceit 5",               phase: "faceit", xpStart: 8500  },
  { level: 24, name: "Faceit 6",               phase: "faceit", xpStart: 9500  },
  { level: 25, name: "Faceit 7",               phase: "faceit", xpStart: 10600 },
  { level: 26, name: "Faceit 8",               phase: "faceit", xpStart: 11800 },
  { level: 27, name: "Faceit 9",               phase: "faceit", xpStart: 13100 },
  { level: 28, name: "Faceit 10",              phase: "faceit", xpStart: 14500 },
  // ESEA (29-41)
  { level: 29, name: "ESEA D-",                phase: "esea",   xpStart: 15100 },
  { level: 30, name: "ESEA D",                 phase: "esea",   xpStart: 15750 },
  { level: 31, name: "ESEA D+",                phase: "esea",   xpStart: 16450 },
  { level: 32, name: "ESEA C-",                phase: "esea",   xpStart: 17000 },
  { level: 33, name: "ESEA C",                 phase: "esea",   xpStart: 17500 },
  { level: 34, name: "ESEA C+",                phase: "esea",   xpStart: 17950 },
  { level: 35, name: "ESEA B-",                phase: "esea",   xpStart: 18350 },
  { level: 36, name: "ESEA B",                 phase: "esea",   xpStart: 18700 },
  { level: 37, name: "ESEA B+",                phase: "esea",   xpStart: 19000 },
  { level: 38, name: "ESEA A-",                phase: "esea",   xpStart: 19250 },
  { level: 39, name: "ESEA A",                 phase: "esea",   xpStart: 19500 },
  { level: 40, name: "ESEA A+",                phase: "esea",   xpStart: 19750 },
  { level: 41, name: "ESEA S",                 phase: "esea",   xpStart: 20000 },
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
