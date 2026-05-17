"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { openPack, spinWheel, reset, RARITY, preloadTickBuffer, type RevealCard } from "../lib/reveal";
import { F, C, GEM_PACK_NAMES, type RarityTier } from "../lib/tokens";
import { calcPackXP } from "../lib/xp";
import Flag from "./Flag";
import CardDetailModal from "./CardDetailModal";
import { type CardPortraitData } from "./CardPortrait";
import { removeOwnedId } from "../lib/owned";
import { addGems } from "../lib/gems";
import { onCardsDecrafted } from "../lib/challenges";

export type { RevealCard };

const DEFAULT_POOL: RevealCard[] = [
  { tier: "SILVER",  ovr: 76 },
  { tier: "GOLD",    ovr: 84 },
  { tier: "GOLD",    ovr: 81 },
  { tier: "DIAMOND", ovr: 89 },
  { tier: "GOLD",    ovr: 86 },
  { tier: "SILVER",  ovr: 78 },
  { tier: "DIAMOND", ovr: 91 },
  { tier: "GOLD",    ovr: 83 },
  { tier: "BRONZE",  ovr: 65 },
];

interface Props {
  open: boolean;
  packLabel?: string;
  cards: RevealCard[];
  pool?: RevealCard[];
  packMultiplier?: number;
  onClose: () => void;
  onCardsRevealed?: (cards: RevealCard[]) => void;
}

type Phase = "idle" | "pack" | "wheel" | "done";

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

const ROLE_FULL: Record<string, string> = {
  AWP: "AWPer", IGL: "IGL", RIF: "Rifler",
  ENT: "Entry", SUP: "Support", LRK: "Lurker",
};

const GEM_BY_RARITY: Record<string, number> = {
  BRONZE: 5, SILVER: 12, GOLD: 30, DIAMOND: 75, ICON: 400, LEGACY: 30,
};

const TIER_ORDER = ["BRONZE", "SILVER", "GOLD", "DIAMOND", "ICON"] as const;
type TierKey = (typeof TIER_ORDER)[number];

const GEM_TIER_ORDER = ["TOP5", "TOP15", "TOP25", "TOP50", "TOP75", "TOP100"];

const GEM_TIER_CLR: Record<string, string> = {
  TOP5: "#f5d76e", TOP15: "#c77dff", TOP25: "#4cc9f0",
  TOP50: "#56d6a4", TOP75: "#80e0b0", TOP100: "#8fa3ad",
};

function gemTierFromRank(teamRank?: number): string {
  if (!teamRank) return "TOP100";
  if (teamRank <= 5) return "TOP5";
  if (teamRank <= 15) return "TOP15";
  if (teamRank <= 25) return "TOP25";
  if (teamRank <= 50) return "TOP50";
  if (teamRank <= 75) return "TOP75";
  return "TOP100";
}

function calcGemsForCards(cards: RevealCard[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const c of cards) {
    const gt = gemTierFromRank(c.teamRank);
    const amt = GEM_BY_RARITY[c.tier] ?? 5;
    result[gt] = (result[gt] ?? 0) + amt;
  }
  return result;
}

const TIER_ABBR: Record<string, string> = {
  BRONZE: "BRZ", SILVER: "SLV", GOLD: "GLD", DIAMOND: "DIA", ICON: "ICN",
};

function revealCardToPortrait(card: RevealCard): CardPortraitData {
  return {
    player_id: card.player_id,
    name: card.name,
    overall: card.ovr,
    role: card.role,
    teamShort: card.teamShort,
    teamRank: card.teamRank,
    nationality: card.nationality ?? null,
    imageUrl: card.player_id ? `/api/player-image/${card.player_id}` : null,
    imageOffset: card.image_offset,
    categoryScores: card.categoryScores,
  };
}

// ── Diagonal card ribbon — NEW! or IN STOCK · X ─────────────────────────────

function CardBanner({ isNew, stockCount, cardW }: {
  isNew?: boolean;
  stockCount?: number;
  cardW: number;
}) {
  if (!isNew && !stockCount) return null;

  const text = isNew ? "NEW !" : `IN STOCK · ${(stockCount ?? 0) + 1}`;
  const bg = isNew
    ? "linear-gradient(90deg, #7a1515, #c22828, #7a1515)"
    : "linear-gradient(90deg, #4a2800, #9a5800, #4a2800)";
  const borderColor = isNew ? "rgba(255,140,140,0.4)" : "rgba(220,160,60,0.4)";

  // Ribbon spans left→right, angled so the right end lands near the flag (TR)
  const h = Math.max(14, cardW * 0.10);
  const top = cardW * 0.14;
  const left = -(cardW * 0.3);
  const width = cardW * 1.6;
  const fontSize = Math.max(5.5, cardW * 0.04);

  return (
    <div
      style={{
        position: "absolute",
        top,
        left,
        width,
        height: h,
        background: bg,
        border: `1px solid ${borderColor}`,
        transform: "rotate(-12deg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: F.body,
        fontWeight: 900,
        fontSize,
        color: "#fff",
        letterSpacing: "0.18em",
        textShadow: "0 1px 3px rgba(0,0,0,0.9)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.12)",
        zIndex: 10,
        pointerEvents: "none",
      }}
    >
      {text}
    </div>
  );
}

// ── Large flip card (shown one at a time after each wheel) ───────────────────

function FlipCard({ card }: { card: RevealCard }) {
  const r = RARITY[card.tier] ?? RARITY.GOLD;
  const W = 200;
  const H = Math.round(W * 1.476);
  const imgUrl = card.player_id ? `/api/player-image/${card.player_id}` : null;

  return (
    <div style={{ position: "relative" }}>
      {/* halo */}
      <div style={{
        position: "absolute", inset: -14, borderRadius: 26,
        background: `radial-gradient(ellipse, ${r.glow}, transparent 68%)`,
        filter: "blur(10px)", pointerEvents: "none",
      }} />

      <div className="csv-flip-card" style={{
        position: "relative", width: W, height: H, borderRadius: 14,
        background: `linear-gradient(160deg, ${r.from}, ${r.to})`,
        border: "1.5px solid rgba(255,255,255,0.24)",
        boxShadow: `0 0 40px ${r.glow}, 0 24px 48px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.22)`,
        overflow: "hidden",
      }}>
        {imgUrl && (
          <img src={imgUrl} alt={card.name ?? ""} style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            objectFit: "cover", objectPosition: card.image_offset ?? "top center",
          }} />
        )}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to bottom, transparent 25%, rgba(0,0,0,0.45) 62%, rgba(0,0,0,0.88) 100%)",
        }} />
        <div className="csv-flip-sheen" style={{
          position: "absolute", top: 0, bottom: 0, left: "-80%", width: "50%",
          background: "linear-gradient(105deg, transparent 20%, rgba(255,255,255,0.22) 50%, transparent 80%)",
          pointerEvents: "none",
        }} />

        <CardBanner isNew={card.isNew} stockCount={card.stockCount} cardW={W} />

        {/* TL */}
        <div style={{ position: "absolute", top: 10, left: 11 }}>
          <div style={{ fontFamily: F.body, fontSize: 34, fontWeight: 800, color: "#fff", lineHeight: 0.85, letterSpacing: "-0.04em", textShadow: "0 2px 10px rgba(0,0,0,0.8)" }}>
            {card.ovr ?? "?"}
          </div>
          {card.role && (
            <div style={{ fontFamily: F.mono, fontSize: 7.5, fontWeight: 700, letterSpacing: "0.1em", color: r.label, marginTop: 3 }}>
              {ROLE_FULL[card.role] ?? card.role}
            </div>
          )}
        </div>

        {/* TR */}
        {card.nationality && (
          <div style={{ position: "absolute", top: 10, right: 10 }}>
            <Flag code={card.nationality.toLowerCase()} width={20} rounded />
          </div>
        )}

        {/* Bottom */}
        <div style={{ position: "absolute", bottom: 12, left: 11, right: 11 }}>
          <div style={{ fontFamily: F.body, fontSize: 18, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em", textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>
            {card.name ?? "?"}
          </div>
          {(card.team ?? card.teamShort) && (
            <div style={{ fontFamily: F.mono, fontSize: 8, letterSpacing: "0.1em", color: "rgba(255,255,255,0.55)", marginTop: 3 }}>
              {card.team ?? card.teamShort}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Medium card for the 3+2 recap grid ──────────────────────────────────────

function RecapCard({ card, w, onClick }: { card: RevealCard; w: number; onClick: () => void }) {
  const r = RARITY[card.tier] ?? RARITY.GOLD;
  const h = Math.round(w * 1.476);
  const imgUrl = card.player_id ? `/api/player-image/${card.player_id}` : null;

  return (
    <div
      onClick={onClick}
      style={{ position: "relative", flexShrink: 0, cursor: "pointer" }}
    >
      {/* halo */}
      <div style={{
        position: "absolute", inset: -8, borderRadius: 16,
        background: `radial-gradient(ellipse, ${r.glow}, transparent 70%)`,
        filter: "blur(7px)", pointerEvents: "none",
      }} />

      <div style={{
        position: "relative", width: w, height: h, borderRadius: 10,
        background: `linear-gradient(160deg, ${r.from}, ${r.to})`,
        border: "1.5px solid rgba(255,255,255,0.22)",
        boxShadow: `0 0 18px ${r.glow}, 0 10px 24px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.18)`,
        overflow: "hidden",
        transition: "transform 150ms ease, box-shadow 150ms ease",
      }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLDivElement).style.transform = "scale(1.04)";
          (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 28px ${r.glow}, 0 14px 32px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.22)`;
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLDivElement).style.transform = "scale(1)";
          (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 18px ${r.glow}, 0 10px 24px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.18)`;
        }}
      >
        {imgUrl && (
          <img src={imgUrl} alt={card.name ?? ""} style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            objectFit: "cover", objectPosition: card.image_offset ?? "top center",
          }} />
        )}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to bottom, transparent 28%, rgba(0,0,0,0.42) 62%, rgba(0,0,0,0.86) 100%)",
        }} />

        <CardBanner isNew={card.isNew} stockCount={card.stockCount} cardW={w} />

        {/* TL */}
        <div style={{ position: "absolute", top: 6, left: 7 }}>
          <div style={{ fontFamily: F.body, fontSize: Math.round(w * 0.175), fontWeight: 800, color: "#fff", lineHeight: 0.85, letterSpacing: "-0.04em", textShadow: "0 1px 6px rgba(0,0,0,0.9)" }}>
            {card.ovr ?? "?"}
          </div>
          <div style={{ fontFamily: F.mono, fontSize: 5.5, fontWeight: 700, letterSpacing: "0.1em", color: r.label, marginTop: 2 }}>
            {card.tier}
          </div>
        </div>

        {/* TR */}
        {card.nationality && (
          <div style={{ position: "absolute", top: 6, right: 6 }}>
            <Flag code={card.nationality.toLowerCase()} width={14} rounded />
          </div>
        )}

        {/* Bottom */}
        <div style={{ position: "absolute", bottom: 7, left: 7, right: 7 }}>
          <div style={{ fontFamily: F.body, fontSize: Math.round(w * 0.083), fontWeight: 800, color: "#fff", letterSpacing: "-0.01em", textShadow: "0 1px 3px rgba(0,0,0,0.9)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {card.name ?? "?"}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main modal ───────────────────────────────────────────────────────────────

export default function PackOpenModal({
  open,
  packLabel = "DAILY",
  cards,
  pool,
  packMultiplier = 1.0,
  onClose,
  onCardsRevealed,
}: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [cardIdx, setCardIdx] = useState(0);
  const [revealed, setRevealed] = useState<RevealCard[]>([]);
  const [revealingCard, setRevealingCard] = useState<RevealCard | null>(null);
  const [selectedCard, setSelectedCard] = useState<RevealCard | null>(null);
  const cancelledRef = useRef(false);
  const [preview, setPreview] = useState<{ cards: RevealCard[]; gems: Record<string, number>; label: string } | null>(null);
  const [rarityExpanded, setRarityExpanded] = useState(false);

  const runSequence = useCallback(async () => {
    const container = stageRef.current;
    if (!container) return;
    cancelledRef.current = false;

    setPhase("pack");
    reset(container);
    await openPack({ container, label: packLabel, previewCards: cards.length > 0 ? cards : undefined });

    if (cancelledRef.current) return;
    await delay(500);

    setPhase("wheel");
    const newRevealed: RevealCard[] = [];

    for (let i = 0; i < cards.length; i++) {
      if (cancelledRef.current) return;
      setCardIdx(i);
      reset(container);

      await spinWheel({
        container, pool: pool ?? DEFAULT_POOL,
        target: cards[i], duration: 6500,
        label: `CARTE ${i + 1} / ${cards.length}`,
      });

      if (cancelledRef.current) return;
      await delay(350);
      reset(container);
      setRevealingCard(cards[i]);

      // Auto-advance after flip animation (550ms) + viewing time
      await delay(1800);

      if (cancelledRef.current) return;
      setRevealingCard(null);
      newRevealed.push(cards[i]);
      setRevealed([...newRevealed]);
      await delay(180);
    }

    if (cancelledRef.current) return;
    onCardsRevealed?.(newRevealed);
    setPhase("done");
  }, [packLabel, cards, pool, onCardsRevealed]);

  // Preload all audio assets on mount so they're ready for the first pack open
  useEffect(() => { preloadTickBuffer(); }, []);

  useEffect(() => {
    if (!open) {
      cancelledRef.current = true;
      setPhase("idle");
      setCardIdx(0);
      setRevealed([]);
      setRevealingCard(null);
      setSelectedCard(null);
      setPreview(null);
      setRarityExpanded(false);
      return;
    }
    runSequence();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open && phase === "idle") return null;

  // Recap card sizing — 3 per row, 8px gap, 16px total padding
  const RECAP_GAP = 8;
  const RECAP_PAD = 16;
  const RECAP_W = Math.floor((Math.min(398, 430 - RECAP_PAD * 2) - RECAP_GAP * 2) / 3);

  const isDone = phase === "done";

  const dupeCards = isDone ? revealed.filter(c => !c.isNew) : [];

  function getCardsUpTo(tier: TierKey): RevealCard[] {
    const maxIdx = TIER_ORDER.indexOf(tier);
    return revealed.filter(c => {
      const idx = (TIER_ORDER as readonly string[]).indexOf(c.tier);
      return idx >= 0 && idx <= maxIdx;
    });
  }

  function openPreview(cards: RevealCard[], label: string) {
    setPreview({ cards, gems: calcGemsForCards(cards), label });
  }

  function confirmUncraft() {
    if (!preview) return;
    preview.cards.forEach(c => { if (c.player_id) removeOwnedId(c.player_id); });
    Object.entries(preview.gems).forEach(([t, a]) => addGems(t, a));
    if (preview.cards.length > 0) onCardsDecrafted(preview.cards.length);
    setPreview(null);
    onClose();
  }

  const actionW = RECAP_W * 3 + RECAP_GAP * 2;

  return (
    <>
      <div style={{
        position: "fixed", inset: 0, zIndex: 400,
        background:
          "radial-gradient(ellipse 80% 60% at 50% -10%, #1e1957 0%, transparent 60%), " +
          "radial-gradient(ellipse 60% 60% at 50% 110%, #2a1845 0%, transparent 60%), " +
          "linear-gradient(180deg, #05050f 0%, #0b0a22 100%)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        fontFamily: F.body, color: C.ink,
      }}>
        {/* Wheel counter — hidden during done */}
        {!isDone && (
          <div style={{
            fontFamily: F.mono, fontSize: 9, letterSpacing: "0.22em",
            color: "rgba(255,255,255,0.45)", textTransform: "uppercase",
            minHeight: 20, marginBottom: 8,
            opacity: phase === "wheel" && !revealingCard ? 1 : 0,
            transition: "opacity 200ms",
          }}>
            CARTE {cardIdx + 1}&nbsp;/&nbsp;{cards.length}
          </div>
        )}

        {/* Wheel stage — hidden during flip reveal and done */}
        {!isDone && (
          <div ref={stageRef} style={{
            width: "100%", maxWidth: 430, minHeight: 280,
            display: revealingCard ? "none" : "flex",
            alignItems: "center", justifyContent: "center", padding: "0 8px",
          }} />
        )}

        {/* ── Flip reveal — no button, auto-advances ── */}
        {revealingCard && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28 }}>
            {/* Tier label */}
            <div style={{
              fontFamily: F.mono, fontSize: 9, letterSpacing: "0.24em",
              color: (RARITY[revealingCard.tier] ?? RARITY.GOLD).label,
              textTransform: "uppercase",
            }}>
              {revealingCard.tier}
            </div>

            <FlipCard card={revealingCard} />
          </div>
        )}

        {/* ── Done — 3+2 recap ── */}
        {isDone && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                fontFamily: F.mono, fontSize: 10, letterSpacing: "0.22em",
                textTransform: "uppercase", color: C.teal,
              }}>
                PACK OUVERT
              </div>
              <div style={{
                fontFamily: F.body, fontSize: 11, fontWeight: 800,
                color: C.gold, letterSpacing: "0.06em",
                background: "rgba(201,165,101,0.12)",
                border: "1px solid rgba(201,165,101,0.28)",
                borderRadius: 999, padding: "2px 9px",
              }}>
                +{calcPackXP(revealed.map(c => c.tier), packMultiplier)} XP
              </div>
            </div>

            {/* Row 1 — cards 0 1 2 */}
            <div style={{ display: "flex", gap: RECAP_GAP }}>
              {revealed.slice(0, 3).map((c, i) => (
                <RecapCard key={i} card={c} w={RECAP_W} onClick={() => setSelectedCard(c)} />
              ))}
            </div>

            {/* Row 2 — cards 3 4, centered under the gaps of row 1 */}
            {revealed.length > 3 && (
              <div style={{ display: "flex", gap: RECAP_GAP }}>
                {revealed.slice(3).map((c, i) => (
                  <RecapCard key={i + 3} card={c} w={RECAP_W} onClick={() => setSelectedCard(c)} />
                ))}
              </div>
            )}

            {/* ── Action section ── */}
            <div style={{ width: actionW, display: "flex", flexDirection: "column", gap: 7, marginTop: 2 }}>
              {preview ? (
                // Preview — gems breakdown + confirm
                <div style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 12, padding: "12px 14px",
                  display: "flex", flexDirection: "column", gap: 10,
                }}>
                  <div style={{
                    fontFamily: F.mono, fontSize: 9, letterSpacing: "0.2em",
                    color: "rgba(255,255,255,0.4)", textTransform: "uppercase",
                  }}>
                    {preview.label} · {preview.cards.length} carte{preview.cards.length > 1 ? "s" : ""}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {GEM_TIER_ORDER
                      .filter(t => preview.gems[t])
                      .map(t => (
                        <div key={t} style={{
                          fontFamily: F.body, fontSize: 11, fontWeight: 700,
                          color: GEM_TIER_CLR[t] ?? "#fff",
                          background: "rgba(255,255,255,0.06)",
                          border: `1px solid ${(GEM_TIER_CLR[t] ?? "#fff")}44`,
                          borderRadius: 6, padding: "4px 9px", letterSpacing: "0.04em",
                        }}>
                          💎 {GEM_PACK_NAMES[t] ?? t} · {preview.gems[t]}
                        </div>
                      ))
                    }
                  </div>
                  <div style={{ display: "flex", gap: 7 }}>
                    <button
                      onClick={() => setPreview(null)}
                      style={{
                        flex: 1, padding: "10px 0", borderRadius: 9,
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        fontFamily: F.body, fontSize: 12, fontWeight: 700,
                        color: "rgba(255,255,255,0.5)", letterSpacing: "0.06em", cursor: "pointer",
                      }}
                    >
                      ANNULER
                    </button>
                    <button
                      onClick={confirmUncraft}
                      style={{
                        flex: 1, padding: "10px 0", borderRadius: 9,
                        background: "rgba(220,60,60,0.16)",
                        border: "1px solid rgba(220,60,60,0.42)",
                        fontFamily: F.body, fontSize: 12, fontWeight: 800,
                        color: "#f08080", letterSpacing: "0.06em", cursor: "pointer",
                      }}
                    >
                      CONFIRMER
                    </button>
                  </div>
                </div>
              ) : (
                // Select mode — 3 action buttons
                <>
                  <button
                    onClick={onClose}
                    style={{
                      padding: "12px 16px", borderRadius: 10,
                      background: `linear-gradient(180deg, ${C.teal} 0%, ${C.tealDk} 100%)`,
                      border: "1px solid rgba(255,255,255,0.2)",
                      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18), 0 0 18px rgba(109,181,196,0.3)`,
                      fontFamily: F.body, fontSize: 12, fontWeight: 800,
                      color: "#071318", letterSpacing: "0.08em", cursor: "pointer",
                    }}
                  >
                    TOUT GARDER
                  </button>

                  {dupeCards.length > 0 && (
                    <button
                      onClick={() => openPreview(dupeCards, "UNCRAFT DUPES")}
                      style={{
                        padding: "10px 16px", borderRadius: 10,
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.11)",
                        fontFamily: F.body, fontSize: 11, fontWeight: 700,
                        color: "rgba(255,255,255,0.6)", letterSpacing: "0.06em", cursor: "pointer",
                      }}
                    >
                      UNCRAFT DUPES · {dupeCards.length} doublon{dupeCards.length > 1 ? "s" : ""}
                    </button>
                  )}

                  {rarityExpanded ? (
                    <div style={{ display: "flex", gap: 5 }}>
                      {(TIER_ORDER as readonly TierKey[])
                        .filter(tier => revealed.some(c => c.tier === tier))
                        .map(tier => {
                          const tierCards = getCardsUpTo(tier);
                          const r = RARITY[tier] ?? RARITY.GOLD;
                          return (
                            <button
                              key={tier}
                              onClick={() => { openPreview(tierCards, `${TIER_ABBR[tier] ?? tier}+`); setRarityExpanded(false); }}
                              style={{
                                flex: 1, padding: "8px 2px", borderRadius: 8,
                                background: `linear-gradient(160deg, ${r.from}28, ${r.to}18)`,
                                border: `1px solid ${r.from}55`,
                                fontFamily: F.mono, fontSize: 8, fontWeight: 700,
                                color: r.label, letterSpacing: "0.06em", cursor: "pointer",
                              }}
                            >
                              {TIER_ABBR[tier] ?? tier.slice(0, 3)}+
                            </button>
                          );
                        })
                      }
                      <button
                        onClick={() => setRarityExpanded(false)}
                        style={{
                          padding: "8px 10px", borderRadius: 8,
                          background: "rgba(255,255,255,0.06)",
                          border: "1px solid rgba(255,255,255,0.10)",
                          fontFamily: F.body, fontSize: 11, fontWeight: 700,
                          color: "rgba(255,255,255,0.4)", cursor: "pointer",
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setRarityExpanded(true)}
                      style={{
                        padding: "10px 16px", borderRadius: 10,
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.11)",
                        fontFamily: F.body, fontSize: 11, fontWeight: 700,
                        color: "rgba(255,255,255,0.6)", letterSpacing: "0.06em", cursor: "pointer",
                      }}
                    >
                      UNCRAFT RARITY ▾
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Card detail modal — on top of the pack modal */}
      {selectedCard && (
        <div style={{ position: "fixed", inset: 0, zIndex: 500 }}>
          <CardDetailModal
            card={revealCardToPortrait(selectedCard)}
            tier={selectedCard.tier as RarityTier}
            ownedCount={(selectedCard.stockCount ?? 0) + 1}
            onClose={() => setSelectedCard(null)}
          />
        </div>
      )}
    </>
  );
}
