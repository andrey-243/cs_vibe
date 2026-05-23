import { NextResponse } from "next/server";
import { loadCards } from "../../lib/cards";
import type { CardDisplay } from "../../lib/cards";
import { STREAK_TIERS, ADS_BONUS } from "../../lib/streak";

// Base drop weight per rarity — Bronze 21% / Silver 38% / Gold 31% / Diamond 10% / Icon <1%
const BASE_WEIGHT: Record<string, number> = {
  BRONZE:  210,
  SILVER:  380,
  GOLD:    310,
  DIAMOND:  95,
  ICON:      5,
  LEGACY:    0,
};

function applyMultipliers(
  base: Record<string, number>,
  gold: number,
  diamond: number,
  icon: number,
): Record<string, number> {
  return {
    ...base,
    GOLD:    Math.round(base.GOLD    * gold),
    DIAMOND: Math.round(base.DIAMOND * diamond),
    ICON:    Math.round(base.ICON    * icon),
  };
}

function weightedPick(pool: CardDisplay[], weights: Record<string, number>): CardDisplay {
  const total = pool.reduce((s, c) => s + (weights[c.tier] ?? 0), 0);
  let r = Math.random() * total;
  for (const card of pool) {
    r -= weights[card.tier] ?? 0;
    if (r <= 0) return card;
  }
  return pool[pool.length - 1];
}

// Max team rank per reward tier (inclusive). Absent = no filter.
const REWARD_TIER_MAX_RANK: Record<string, number> = {
  TOP5:   5,
  TOP15:  15,
  TOP25:  25,
  TOP50:  50,
  TOP75:  75,
  TOP100: 100,
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const streakDays = parseInt(searchParams.get("streakDays") ?? "0", 10);
  const isAds = searchParams.get("type") === "ads";
  const rewardTier = searchParams.get("rewardTier") ?? null;

  // Resolve streak tier
  const tier = STREAK_TIERS.find((t) => streakDays >= t.minDay) ?? STREAK_TIERS[STREAK_TIERS.length - 1];

  // Build drop weights: start from streak tier values, then layer ads bonus on top if ads pack
  let weights = applyMultipliers(BASE_WEIGHT, tier.dropGold, tier.dropDiamond, tier.dropIcon);
  if (isAds) {
    weights = applyMultipliers(weights, ADS_BONUS.dropGold, ADS_BONUS.dropDiamond, ADS_BONUS.dropIcon);
  }

  let pool = loadCards().filter((c) => (weights[c.tier] ?? 0) > 0);

  // For tier reward packs, restrict pool to teams within that rank bracket
  const maxRank = rewardTier ? REWARD_TIER_MAX_RANK[rewardTier] : null;
  if (maxRank != null) {
    const filtered = pool.filter((c) => c.teamRank <= maxRank);
    if (filtered.length >= 5) pool = filtered;
    // fallback: keep full pool if bracket has fewer than 5 cards
  }

  if (pool.length === 0) {
    return NextResponse.json({ error: "no cards" }, { status: 500 });
  }

  const picks: CardDisplay[] = [];
  for (let i = 0; i < 5; i++) {
    picks.push(weightedPick(pool, weights));
  }

  return NextResponse.json(picks);
}
