import fs from "fs";
import path from "path";
import { RarityTier } from "./tokens";

export interface PlayerCard {
  player_id: string;
  name: string;
  roles: string[];
  team: string;
  team_rank: number;
  team_acronym: string | null;
  nationality: string;
  image_url: string | null;
  no_photo: boolean;
  rarity: string;
  overall: number;
  /** Optional CSS `object-position` override for the photo — e.g. "50% 26%" */
  photo_focus?: string;
  category_scores: {
    firepower: number;
    opening: number;
    clutching: number;
    entrying: number;
    trading: number;
    impact: number;
  };
}

export interface CategoryScores {
  firepower: number;
  opening: number;
  clutching: number;
  entrying: number;
  trading: number;
  impact: number;
}

export interface CardDisplay {
  player_id: string;
  name: string;
  overall: number;
  role: string;
  team: string;
  teamShort: string;
  teamRank: number;
  nationality: string;
  tier: RarityTier;
  image_url: string | null;
  no_photo: boolean;
  image_offset?: string;
  category_scores: CategoryScores;
}

const RARITY_MAP: Record<string, RarityTier> = {
  icon: "ICON",
  diamond: "DIAMOND",
  gold: "GOLD",
  silver: "SILVER",
  bronze: "BRONZE",
  legacy: "LEGACY",
};

// Normalize role variants → canonical abbreviation
// Non-player roles (Coach, Analyst, Caster…) are excluded — deriveRole returns null for them
const ROLE_MAP: Record<string, string> = {
  AWPer: "AWP", Awper: "AWP", Awp: "AWP",
  Rifler: "RIF", Rifle: "RIF",
  IGL: "IGL", Igl: "IGL",
  Entry: "ENT", Entryfragger: "ENT",
  Support: "SUP",
  Lurker: "LRK",
};

const PLAYER_ROLES = new Set(["AWP", "RIF", "IGL", "ENT", "SUP", "LRK"]);

function deriveRole(roles: string[]): string | null {
  for (const r of roles) {
    const mapped = ROLE_MAP[r];
    if (mapped) return mapped;
  }
  return null; // coach/analyst/caster → exclude
}

function deriveTeamShort(team: string, acronym: string | null): string {
  if (acronym) return acronym.toUpperCase().slice(0, 4);
  return team.slice(0, 3).toUpperCase();
}

function capitalizeName(name: string): string {
  if (!name) return name;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function resolveImage(p: PlayerCard): string | null {
  if (p.no_photo) return null;
  return `/api/player-image/${p.player_id}`;
}

let _cache: CardDisplay[] | null = null;
let _lootCache: string[] | null = null;

export function loadCards(): CardDisplay[] {
  if (_cache) return _cache;

  const filePath = path.join(process.cwd(), "../data_pipeline/output/players_cards.json");
  if (!fs.existsSync(filePath)) return [];

  const raw: PlayerCard[] = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  _cache = raw
    .filter((p) => {
      if (p.overall <= 0) return false;
      const role = deriveRole(p.roles);
      return role !== null; // exclude coaches, analysts, casters
    })
    .sort((a, b) => b.overall - a.overall)
    .map((p) => ({
      player_id: p.player_id,
      name: capitalizeName(p.name),
      overall: p.overall,
      role: deriveRole(p.roles)!,
      team: p.team,
      teamShort: deriveTeamShort(p.team, p.team_acronym),
      teamRank: p.team_rank ?? 999,
      nationality: p.nationality,
      tier: RARITY_MAP[p.rarity?.toLowerCase()] ?? "BRONZE",
      image_url: resolveImage(p),
      no_photo: p.no_photo ?? true,
      image_offset: p.photo_focus,
      category_scores: p.category_scores ?? { firepower: 0, opening: 0, clutching: 0, entrying: 0, trading: 0, impact: 0 },
    }));

  return _cache;
}

export function loadLootPool(): string[] {
  if (_lootCache) return _lootCache;
  const filePath = path.join(process.cwd(), "../data_pipeline/output/loot_pool.json");
  if (!fs.existsSync(filePath)) return [];
  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const poolIds = new Set<string>(raw.player_ids ?? []);
  const cards = loadCards();
  _lootCache = [...new Set(cards.filter((c) => poolIds.has(c.player_id)).map((c) => c.nationality).filter(Boolean))];
  return _lootCache;
}
