import { addXP } from "./xp";

export type ChallengeKind =
  | "open_packs"
  | "obtain_rarity"
  | "complete_trade"
  | "decraft"
  | "obtain_nation";

export interface ChallengeTemplate {
  id: string;
  kind: ChallengeKind;
  label: string;
  xp: number;
  target: number;
  rarity?: string;
  nationIso?: string;
}

export interface ChallengeWithState extends ChallengeTemplate {
  progress: number;
  done: boolean;
  pct: number;
}

interface DailyState {
  date: string;
  progress: Record<string, number>;
  done: Record<string, boolean>;
}

// Nations pool (ISO2 + display name in French)
const NATIONS = [
  { iso2: "dk", name: "Danemark" },
  { iso2: "fr", name: "France" },
  { iso2: "ru", name: "Russie" },
  { iso2: "se", name: "Suède" },
  { iso2: "br", name: "Brésil" },
  { iso2: "ua", name: "Ukraine" },
  { iso2: "us", name: "États-Unis" },
  { iso2: "fi", name: "Finlande" },
  { iso2: "de", name: "Allemagne" },
  { iso2: "nl", name: "Pays-Bas" },
  { iso2: "pl", name: "Pologne" },
  { iso2: "cz", name: "Rép. Tchèque" },
  { iso2: "kz", name: "Kazakhstan" },
  { iso2: "hr", name: "Croatie" },
  { iso2: "ba", name: "Bosnie" },
  { iso2: "rs", name: "Serbie" },
  { iso2: "au", name: "Australie" },
  { iso2: "ca", name: "Canada" },
  { iso2: "no", name: "Norvège" },
  { iso2: "bg", name: "Bulgarie" },
];

function seededRng(seed: number) {
  let s = seed >>> 0;
  return (): number => {
    s = ((Math.imul(1664525, s) + 1013904223) | 0) >>> 0;
    return s / 0x100000000;
  };
}

function hashStr(str: string): number {
  return str.split("").reduce((h, c) => (Math.imul(31, h) + c.charCodeAt(0)) | 0, 0);
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildPool(dateStr: string): ChallengeTemplate[] {
  // Nation picked via a separate seed so it doesn't shift with group selection
  const nationRng = seededRng(hashStr(dateStr) ^ 0xdeadbeef);
  const nation = NATIONS[Math.floor(nationRng() * NATIONS.length)];

  return [
    { id: "open_1",    kind: "open_packs",    label: "Ouvrir 1 pack aujourd'hui",    xp: 10, target: 1 },
    { id: "open_2",    kind: "open_packs",    label: "Ouvrir 2 packs aujourd'hui",   xp: 18, target: 2 },
    { id: "open_3",    kind: "open_packs",    label: "Ouvrir 3 packs aujourd'hui",   xp: 25, target: 3 },
    { id: "rarity_s",  kind: "obtain_rarity", label: "Obtenir 1 carte Silver+",      xp: 10, target: 1, rarity: "SILVER" },
    { id: "rarity_g",  kind: "obtain_rarity", label: "Obtenir 1 carte Gold+",        xp: 20, target: 1, rarity: "GOLD" },
    { id: "rarity_d",  kind: "obtain_rarity", label: "Obtenir 1 carte Diamond+",     xp: 35, target: 1, rarity: "DIAMOND" },
    { id: "trade_1",   kind: "complete_trade", label: "Compléter 1 trade",           xp: 15, target: 1 },
    { id: "decraft_1", kind: "decraft",        label: "Décraft 1 carte",             xp: 5,  target: 1 },
    { id: "decraft_3", kind: "decraft",        label: "Décraft 3 cartes",            xp: 10, target: 3 },
    { id: "decraft_5", kind: "decraft",        label: "Décraft 5 cartes",            xp: 18, target: 5 },
    { id: "nation",    kind: "obtain_nation",  label: `Joueur ${nation.name}`,       xp: 15, target: 1, nationIso: nation.iso2 },
  ];
}

// 5 challenges/day: exactly one variant per kind group, picked by seeded RNG
export function getDailyChallenges(dateStr = todayStr()): ChallengeTemplate[] {
  const pool = buildPool(dateStr);
  const rng = seededRng(hashStr(dateStr));

  const kinds: ChallengeKind[] = [
    "open_packs",
    "obtain_rarity",
    "complete_trade",
    "decraft",
    "obtain_nation",
  ];

  return kinds.map((kind) => {
    const variants = pool.filter((c) => c.kind === kind);
    return variants[Math.floor(rng() * variants.length)];
  });
}

// --- localStorage ---

const LS_KEY = "csv-challenges";

function loadState(dateStr: string): DailyState {
  if (typeof window === "undefined") return { date: dateStr, progress: {}, done: {} };
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { date: dateStr, progress: {}, done: {} };
    const state = JSON.parse(raw) as DailyState;
    // Auto-reset on new day
    if (state.date !== dateStr) return { date: dateStr, progress: {}, done: {} };
    return state;
  } catch {
    return { date: dateStr, progress: {}, done: {} };
  }
}

function saveState(state: DailyState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_KEY, JSON.stringify(state));
  window.dispatchEvent(new Event("csv-challenges-updated"));
}

export function getChallengesWithState(dateStr = todayStr()): ChallengeWithState[] {
  const templates = getDailyChallenges(dateStr);
  const state = loadState(dateStr);
  return templates.map((t) => {
    const progress = state.progress[t.id] ?? 0;
    const done = state.done[t.id] ?? false;
    const pct = done ? 100 : Math.min(99, Math.round((progress / t.target) * 100));
    return { ...t, progress, done, pct };
  });
}

function advance(id: string, by = 1): void {
  const dateStr = todayStr();
  const state = loadState(dateStr);
  if (state.done[id]) return;
  const template = getDailyChallenges(dateStr).find((t) => t.id === id);
  if (!template) return;
  const newProgress = (state.progress[id] ?? 0) + by;
  state.progress[id] = newProgress;
  if (newProgress >= template.target) {
    state.done[id] = true;
    addXP(template.xp);
  }
  saveState(state);
}

// --- Event hooks (called from page/components) ---

export function onPackOpened(): void {
  getDailyChallenges().filter((t) => t.kind === "open_packs").forEach((t) => advance(t.id));
}

const RARITY_ORDER = ["BRONZE", "SILVER", "GOLD", "DIAMOND", "EVENT_MVP", "ICON"];

export function onCardsObtained(tiers: string[], nations: string[]): void {
  for (const t of getDailyChallenges()) {
    if (t.kind === "obtain_rarity" && t.rarity) {
      const minIdx = RARITY_ORDER.indexOf(t.rarity);
      if (tiers.some((tier) => RARITY_ORDER.indexOf(tier.toUpperCase()) >= minIdx)) {
        advance(t.id);
      }
    }
    if (t.kind === "obtain_nation" && t.nationIso) {
      if (nations.some((n) => n.toLowerCase() === t.nationIso)) {
        advance(t.id);
      }
    }
  }
}

export function onTradeCompleted(): void {
  getDailyChallenges().filter((t) => t.kind === "complete_trade").forEach((t) => advance(t.id));
}

export function onCardsDecrafted(count = 1): void {
  getDailyChallenges().filter((t) => t.kind === "decraft").forEach((t) => advance(t.id, count));
}
