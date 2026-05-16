import { NextResponse } from "next/server";
import { loadCards } from "../../lib/cards";
import type { CardDisplay } from "../../lib/cards";

// Drop weight per rarity — reflects the distribution from PROJECT.md:
// Bronze 21% / Silver 38% / Gold 31% / Diamond 10% / Icon <1%
const RARITY_WEIGHT: Record<string, number> = {
  BRONZE: 210,
  SILVER: 380,
  GOLD:   310,
  DIAMOND: 95,
  ICON:    5,
  LEGACY:  0, // not droppable
};

function weightedPick(pool: CardDisplay[]): CardDisplay {
  const totalWeight = pool.reduce((s, c) => s + (RARITY_WEIGHT[c.tier] ?? 0), 0);
  let r = Math.random() * totalWeight;
  for (const card of pool) {
    r -= RARITY_WEIGHT[card.tier] ?? 0;
    if (r <= 0) return card;
  }
  return pool[pool.length - 1];
}

export async function GET() {
  const all = loadCards().filter((c) => (RARITY_WEIGHT[c.tier] ?? 0) > 0);
  if (all.length === 0) {
    return NextResponse.json({ error: "no cards" }, { status: 500 });
  }

  // Pick 5 cards — allow duplicates (same as a real pack)
  const picks: CardDisplay[] = [];
  for (let i = 0; i < 5; i++) {
    picks.push(weightedPick(all));
  }

  return NextResponse.json(picks);
}
