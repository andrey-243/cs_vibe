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
  claimed: boolean;
  pct: number;
}

interface DailyState {
  date: string;
  progress: Record<string, number>;
  done: Record<string, boolean>;
  claimed: Record<string, boolean>;
  rerollsUsed: number;
  rerolledKinds: Partial<Record<ChallengeKind, ChallengeTemplate>>;
  bonusClaimed: boolean;
}

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
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function buildPool(dateStr: string): ChallengeTemplate[] {
  const nationRng = seededRng(hashStr(dateStr) ^ 0xdeadbeef);
  const nation = NATIONS[Math.floor(nationRng() * NATIONS.length)];

  return [
    { id: "open_1",    kind: "open_packs",    label: "Ouvrir 1 pack aujourd'hui",    xp: 10, target: 1 },
    { id: "open_2",    kind: "open_packs",    label: "Ouvrir 2 packs aujourd'hui",   xp: 18, target: 2 },
    { id: "open_3",    kind: "open_packs",    label: "Ouvrir 3 packs aujourd'hui",   xp: 25, target: 3 },
    { id: "rarity_s",  kind: "obtain_rarity", label: "Obtenir 1 carte Silver+",      xp: 10, target: 1, rarity: "SILVER" },
    { id: "rarity_g",  kind: "obtain_rarity", label: "Obtenir 1 carte Gold+",        xp: 20, target: 1, rarity: "GOLD" },
    { id: "rarity_d",  kind: "obtain_rarity", label: "Obtenir 1 carte Diamond+",     xp: 35, target: 1, rarity: "DIAMOND" },
    { id: "trade_1",   kind: "complete_trade", label: "Compléter 1 trade",            xp: 15, target: 1 },
    { id: "decraft_1", kind: "decraft",        label: "Décraft 1 carte",              xp: 5,  target: 1 },
    { id: "decraft_3", kind: "decraft",        label: "Décraft 3 cartes",             xp: 10, target: 3 },
    { id: "decraft_5", kind: "decraft",        label: "Décraft 5 cartes",             xp: 18, target: 5 },
    { id: "nation",    kind: "obtain_nation",  label: `Joueur ${nation.name}`,        xp: 15, target: 1, nationIso: nation.iso2 },
  ];
}

// 5 challenges/day: one per kind, seeded. Total XP capped at 100.
export function getDailyChallenges(dateStr = todayStr()): ChallengeTemplate[] {
  const pool = buildPool(dateStr);
  const rng = seededRng(hashStr(dateStr));

  const kinds: ChallengeKind[] = [
    "open_packs", "obtain_rarity", "complete_trade", "decraft", "obtain_nation",
  ];

  const selected = kinds.map((kind) => {
    const variants = pool.filter((c) => c.kind === kind);
    return variants[Math.floor(rng() * variants.length)];
  });

  // Enforce 100 XP/day cap — downgrade highest first, deterministically
  const downgradeOrder: ChallengeKind[] = ["obtain_rarity", "open_packs", "decraft", "obtain_nation", "complete_trade"];
  let total = selected.reduce((s, c) => s + c.xp, 0);
  for (const kind of downgradeOrder) {
    if (total <= 100) break;
    const idx = selected.findIndex((c) => c.kind === kind);
    if (idx === -1) continue;
    const variants = pool.filter((c) => c.kind === kind).sort((a, b) => a.xp - b.xp);
    const curIdx = variants.findIndex((v) => v.id === selected[idx].id);
    if (curIdx > 0) {
      selected[idx] = variants[curIdx - 1];
      total = selected.reduce((s, c) => s + c.xp, 0);
    }
  }

  return selected;
}

// Returns effective templates (base + rerolls applied)
function getEffectiveTemplates(dateStr: string, state: DailyState): ChallengeTemplate[] {
  const base = getDailyChallenges(dateStr);
  return base.map((t) => state.rerolledKinds?.[t.kind] ?? t);
}

// --- localStorage ---

const LS_KEY = "csv-challenges";

function emptyState(dateStr: string): DailyState {
  return { date: dateStr, progress: {}, done: {}, claimed: {}, rerollsUsed: 0, rerolledKinds: {}, bonusClaimed: false };
}

function loadState(dateStr: string): DailyState {
  if (typeof window === "undefined") return emptyState(dateStr);
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return emptyState(dateStr);
    const state = JSON.parse(raw) as DailyState;
    if (state.date !== dateStr) return emptyState(dateStr);
    // Migrate old format (claimed didn't exist — auto-mark done as claimed)
    if (!state.claimed) {
      state.claimed = {};
      for (const id of Object.keys(state.done ?? {})) {
        if (state.done[id]) state.claimed[id] = true;
      }
    }
    if (!state.rerolledKinds) state.rerolledKinds = {};
    if (state.rerollsUsed === undefined) state.rerollsUsed = 0;
    if (state.bonusClaimed === undefined) state.bonusClaimed = false;
    return state;
  } catch {
    return emptyState(dateStr);
  }
}

function saveState(state: DailyState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_KEY, JSON.stringify(state));
  window.dispatchEvent(new Event("csv-challenges-updated"));
}

export function getChallengesWithState(dateStr = todayStr()): ChallengeWithState[] {
  const state = loadState(dateStr);
  const templates = getEffectiveTemplates(dateStr, state);
  return templates.map((t) => {
    const progress = state.progress[t.id] ?? 0;
    const done = state.done[t.id] ?? false;
    const claimed = state.claimed?.[t.id] ?? false;
    const pct = done ? 100 : Math.min(99, Math.round((progress / t.target) * 100));
    return { ...t, progress, done, claimed, pct };
  });
}

// Advance progress for a kind — called by event hooks
function advanceByKind(kind: ChallengeKind, by = 1): void {
  const dateStr = todayStr();
  const state = loadState(dateStr);
  const templates = getEffectiveTemplates(dateStr, state);
  let changed = false;
  for (const t of templates) {
    if (t.kind !== kind) continue;
    if (state.done[t.id]) continue;
    const newProgress = (state.progress[t.id] ?? 0) + by;
    state.progress[t.id] = newProgress;
    if (newProgress >= t.target) state.done[t.id] = true;
    changed = true;
  }
  if (changed) saveState(state);
}

// User clicks "Récupérer" — grants XP
export function claimChallenge(id: string): number {
  const dateStr = todayStr();
  const state = loadState(dateStr);
  if (!state.done[id] || state.claimed?.[id]) return 0;
  const template = getEffectiveTemplates(dateStr, state).find((t) => t.id === id);
  if (!template) return 0;
  if (!state.claimed) state.claimed = {};
  state.claimed[id] = true;
  addXP(template.xp);
  saveState(state);
  return template.xp;
}

// Reroll a challenge kind — max 3/day
export function canRerollKind(_kind: ChallengeKind): boolean {
  return true;
}

export function rerollChallenge(kind: ChallengeKind): boolean {
  const dateStr = todayStr();
  const state = loadState(dateStr);
  if ((state.rerollsUsed ?? 0) >= 3) return false;

  const currentTemplates = getEffectiveTemplates(dateStr, state);
  const current = currentTemplates.find((t) => t.kind === kind);
  if (!current || state.done[current.id]) return false;

  // Pick any challenge from full pool not already active (by id)
  const pool = buildPool(dateStr);
  const usedIds = new Set(currentTemplates.map((t) => t.id));
  const candidates = pool.filter((c) => !usedIds.has(c.id));

  // Add nation variants as candidates (different nation than currently active ones)
  const usedNations = new Set(
    currentTemplates.filter((t) => t.nationIso).map((t) => t.nationIso as string)
  );
  const nationCandidates = NATIONS.filter((n) => !usedNations.has(n.iso2)).map((n) => ({
    id: `nation_reroll_${n.iso2}`,
    kind: "obtain_nation" as ChallengeKind,
    label: `Joueur ${n.name}`,
    xp: 15,
    target: 1,
    nationIso: n.iso2,
  }));

  const allCandidates = [...candidates, ...nationCandidates];
  if (allCandidates.length === 0) return false;

  const newTemplate = allCandidates[Math.floor(Math.random() * allCandidates.length)];

  // Clear old progress
  delete state.progress[current.id];
  delete state.done[current.id];
  if (state.claimed) delete state.claimed[current.id];

  if (!state.rerolledKinds) state.rerolledKinds = {};
  state.rerolledKinds[kind] = newTemplate;
  state.rerollsUsed = (state.rerollsUsed ?? 0) + 1;

  saveState(state);
  return true;
}

export function getRerollsUsed(dateStr = todayStr()): number {
  return loadState(dateStr).rerollsUsed ?? 0;
}

// Bonus XP when all 5 quests done: total × 1.5 rounded to nearest 5
export function getDailyBonusXP(dateStr = todayStr()): number {
  const challenges = getChallengesWithState(dateStr);
  const total = challenges.reduce((s, c) => s + c.xp, 0);
  return Math.round((total * 1.5) / 5) * 5;
}

export function canClaimDailyBonus(dateStr = todayStr()): boolean {
  const state = loadState(dateStr);
  if (state.bonusClaimed) return false;
  const templates = getEffectiveTemplates(dateStr, state);
  return templates.every((t) => state.done[t.id] ?? false);
}

export function getBonusClaimed(dateStr = todayStr()): boolean {
  return loadState(dateStr).bonusClaimed ?? false;
}

export function claimDailyBonus(dateStr = todayStr()): number {
  const state = loadState(dateStr);
  if (state.bonusClaimed) return 0;
  const templates = getEffectiveTemplates(dateStr, state);
  if (!templates.every((t) => state.done[t.id] ?? false)) return 0;
  const bonusXP = getDailyBonusXP(dateStr);
  addXP(bonusXP);
  state.bonusClaimed = true;
  saveState(state);
  return bonusXP;
}

// --- Event hooks ---

export function onPackOpened(): void {
  advanceByKind("open_packs");
}

const RARITY_ORDER = ["BRONZE", "SILVER", "GOLD", "DIAMOND", "EVENT_MVP", "ICON"];

export function onCardsObtained(tiers: string[], nations: string[]): void {
  const dateStr = todayStr();
  const state = loadState(dateStr);
  const templates = getEffectiveTemplates(dateStr, state);
  let changed = false;

  for (const t of templates) {
    if (state.done[t.id]) continue;

    if (t.kind === "obtain_rarity" && t.rarity) {
      const minIdx = RARITY_ORDER.indexOf(t.rarity);
      if (tiers.some((tier) => RARITY_ORDER.indexOf(tier.toUpperCase()) >= minIdx)) {
        state.progress[t.id] = (state.progress[t.id] ?? 0) + 1;
        if ((state.progress[t.id] ?? 0) >= t.target) state.done[t.id] = true;
        changed = true;
      }
    }

    if (t.kind === "obtain_nation" && t.nationIso) {
      if (nations.some((n) => n.toLowerCase() === t.nationIso)) {
        state.progress[t.id] = (state.progress[t.id] ?? 0) + 1;
        if ((state.progress[t.id] ?? 0) >= t.target) state.done[t.id] = true;
        changed = true;
      }
    }
  }

  if (changed) saveState(state);
}

export function onTradeCompleted(): void {
  advanceByKind("complete_trade");
}

export function onCardsDecrafted(count = 1): void {
  advanceByKind("decraft", count);
}
