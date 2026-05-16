"use client";

import { useEffect, useState } from "react";
import { C, F, GEM_COLORS, R, RarityTier, rarityChrome } from "../lib/tokens";
import { CardPortraitData } from "./CardPortrait";
import { CategoryScores } from "../lib/cards";
import { removeOwnedId } from "../lib/owned";
import { addGems } from "../lib/gems";
import { onCardsDecrafted } from "../lib/challenges";

const STAT_LABELS: [keyof CategoryScores, string][] = [
  ["firepower", "FIR"],
  ["opening", "OPN"],
  ["clutching", "CLU"],
  ["entrying", "ENT"],
  ["trading", "TRD"],
  ["impact", "IMP"],
];

const ROLE_FULL: Record<string, string> = {
  AWP: "AWPer",
  IGL: "IGL",
  RIF: "Rifler",
  ENT: "Entry",
  SUP: "Support",
  LRK: "Lurker",
};

const GEM_BY_RARITY: Record<RarityTier, number> = {
  BRONZE: 5,
  SILVER: 12,
  GOLD: 30,
  DIAMOND: 75,
  ICON: 400,
  LEGACY: 30,
};

function gemTier(teamRank: number): string {
  if (teamRank <= 5) return "TOP5";
  if (teamRank <= 15) return "TOP15";
  if (teamRank <= 25) return "TOP25";
  if (teamRank <= 50) return "TOP50";
  if (teamRank <= 75) return "TOP75";
  return "TOP100";
}

const BTN_LINK: React.CSSProperties = {
  flex: 1,
  padding: "13px 0",
  borderRadius: 12,
  background: "rgba(56,200,210,0.14)",
  border: "1px solid rgba(56,200,210,0.45)",
  color: "#7ee8ed",
  fontFamily: F.body,
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.06em",
  cursor: "pointer",
  touchAction: "manipulation",
  textDecoration: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const BTN_GRAY: React.CSSProperties = {
  flex: 1,
  padding: "13px 0",
  borderRadius: 12,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.10)",
  color: C.faint,
  fontFamily: F.body,
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.06em",
  cursor: "not-allowed",
  touchAction: "manipulation",
};

export default function CardDetailModal({
  card,
  tier,
  ownedCount = 0,
  onClose,
}: {
  card: CardPortraitData | null;
  tier: RarityTier;
  ownedCount?: number;
  onClose: () => void;
}) {
  const [uncrafting, setUncrafting] = useState(false);

  useEffect(() => {
    if (!card) return;
    setUncrafting(false);
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, onClose]);

  if (!card) return null;

  const chrome = rarityChrome(tier);
  const r = R[tier];
  const showPhoto = card.imageUrl && !card.noPhoto;
  const roleFull = ROLE_FULL[card.role ?? "RIF"] ?? card.role ?? "Rifler";

  // External links
  const hltvUrl = card.player_id && card.name
    ? `https://www.hltv.org/player/${card.player_id}/${card.name.toLowerCase()}`
    : `https://www.hltv.org/search?query=${encodeURIComponent(card.name ?? "")}`;
  const liqUrl = card.name
    ? `https://liquipedia.net/counterstrike/Special:Search?search=${encodeURIComponent(card.name)}`
    : "https://liquipedia.net/counterstrike/";

  // Uncraft
  const gTier = gemTier(card.teamRank ?? 999);
  const gAmt = GEM_BY_RARITY[tier] ?? 5;
  const [gemFrom, gemTo] = GEM_COLORS[gTier] ?? ["#c9a565", "#705028"];
  const canUncraft = ownedCount >= 1;

  function doUncraft() {
    if (!card?.player_id || !canUncraft) return;
    removeOwnedId(card.player_id);
    addGems(gTier, gAmt);
    onCardsDecrafted(1);
    onClose();
  }

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 500,
        background: "rgba(3,3,8,0.82)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 24px",
        animation: "cv-fade-in 180ms ease-out",
      }}
    >
      <style jsx>{`
        @keyframes cv-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes cv-pop-in {
          from { opacity: 0; transform: scale(0.88) translateY(10px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);    }
        }
      `}</style>

      <button
        onClick={onClose}
        aria-label="Fermer"
        style={{
          position: "absolute",
          top: 18,
          right: 18,
          width: 36,
          height: 36,
          borderRadius: 18,
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.14)",
          color: C.ink,
          fontFamily: F.body,
          fontSize: 16,
          fontWeight: 600,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          touchAction: "manipulation",
        }}
      >
        ✕
      </button>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          animation: "cv-pop-in 240ms cubic-bezier(0.2, 0.9, 0.3, 1.2)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
        }}
      >
        {/* ── FOCUS CARD ─────────────────────────────────────── */}
        <div
          style={{
            position: "relative",
            width: 270,
            height: 390,
            borderRadius: 16,
            border: `1px solid rgba(255,255,255,0.16)`,
            boxShadow: `0 20px 60px rgba(0,0,0,0.75), 0 0 50px ${r.glow}`,
            overflow: "hidden",
            color: "#fff",
            fontFamily: F.body,
          }}
        >
          {/* Photo full bleed */}
          {showPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={card.imageUrl!}
              alt={card.name ?? ""}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "top center",
              }}
            />
          ) : (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: chrome.bg,
              }}
            />
          )}

          {/* Heavy fade from bottom */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(0deg, rgba(0,0,0,0.93) 0%, rgba(0,0,0,0.75) 35%, rgba(0,0,0,0.15) 60%, transparent 80%)",
              pointerEvents: "none",
            }}
          />

          {/* Sheen */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.06) 50%, transparent 70%)",
              pointerEvents: "none",
              zIndex: 2,
            }}
          />

          {/* TL — overall + tier */}
          <div style={{ position: "absolute", top: 12, left: 14, zIndex: 3 }}>
            <div
              style={{
                fontSize: 60,
                fontWeight: 800,
                lineHeight: 0.85,
                letterSpacing: "-0.04em",
                textShadow: "0 2px 10px rgba(0,0,0,0.8)",
              }}
            >
              {card.overall ?? 84}
            </div>
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.2em",
                color: r.label,
                marginTop: 5,
                textShadow: "0 1px 4px rgba(0,0,0,0.7)",
              }}
            >
              {tier}
            </div>
          </div>

          {/* TR — flag + role */}
          <div
            style={{
              position: "absolute",
              top: 12,
              right: 14,
              textAlign: "right",
              zIndex: 3,
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: 5,
            }}
          >
            {card.nationality && (
              <span
                className={`fi fi-${card.nationality.toLowerCase()}`}
                style={{
                  width: 22,
                  height: 16,
                  display: "block",
                  borderRadius: 2,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.6)",
                }}
              />
            )}
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textShadow: "0 1px 4px rgba(0,0,0,0.7)",
              }}
            >
              {roleFull}
            </div>
          </div>

          {/* Bottom overlay — name + team + stats */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              padding: "0 14px 14px",
              zIndex: 3,
            }}
          >
            <div
              style={{
                fontSize: 26,
                fontWeight: 800,
                lineHeight: 1,
                letterSpacing: "-0.01em",
                textShadow: "0 2px 8px rgba(0,0,0,0.9)",
              }}
            >
              {card.name ?? "Player"}
            </div>

            <div
              style={{
                fontFamily: F.mono,
                fontSize: 9.5,
                letterSpacing: "0.14em",
                opacity: 0.75,
                marginTop: 4,
                marginBottom: 14,
                textTransform: "uppercase",
                textShadow: "0 1px 4px rgba(0,0,0,0.8)",
              }}
            >
              {(card.team ?? card.teamShort ?? "TBD").toUpperCase()}
              {typeof card.teamRank === "number" &&
                card.teamRank < 999 &&
                ` · #${card.teamRank}`}
            </div>

            {/* Stats 3×2 grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                borderTop: "1px solid rgba(255,255,255,0.15)",
              }}
            >
              {STAT_LABELS.map(([key, label]) => (
                <div
                  key={key}
                  style={{ textAlign: "center", padding: "9px 0" }}
                >
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 800,
                      lineHeight: 1,
                      textShadow: "0 1px 4px rgba(0,0,0,0.8)",
                    }}
                  >
                    {card.categoryScores?.[key] ?? 0}
                  </div>
                  <div
                    style={{
                      fontFamily: F.mono,
                      fontSize: 7.5,
                      letterSpacing: "0.14em",
                      opacity: 0.6,
                      marginTop: 3,
                    }}
                  >
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── ACTION BUTTONS 2×2 ─────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, width: 270 }}>

          {/* Row 1 — external links */}
          <div style={{ display: "flex", gap: 10 }}>
            <a
              href={hltvUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={BTN_LINK}
            >
              HLTV
            </a>
            <a
              href={liqUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={BTN_LINK}
            >
              Liquipedia
            </a>
          </div>

          {/* Row 2 — trade + uncraft */}
          <div style={{ display: "flex", gap: 10 }}>
            {uncrafting ? (
              <>
                {/* Cancel */}
                <button
                  onClick={() => setUncrafting(false)}
                  style={{
                    ...BTN_GRAY,
                    cursor: "pointer",
                    color: C.muted,
                    border: "1px solid rgba(255,255,255,0.18)",
                  }}
                >
                  ✕ Annuler
                </button>
                {/* Confirm */}
                <button
                  onClick={doUncraft}
                  style={{
                    flex: 1,
                    padding: "13px 0",
                    borderRadius: 12,
                    background: `linear-gradient(135deg, ${gemFrom}33, ${gemTo}55)`,
                    border: `1px solid ${gemFrom}88`,
                    color: gemFrom,
                    fontFamily: F.body,
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: "0.05em",
                    cursor: "pointer",
                    touchAction: "manipulation",
                  }}
                >
                  {gAmt} 💎 {gTier}
                </button>
              </>
            ) : (
              <>
                {/* Trade — grayed */}
                <button style={BTN_GRAY} disabled>
                  Trade
                </button>
                {/* Uncraft */}
                <button
                  onClick={() => canUncraft && setUncrafting(true)}
                  style={{
                    flex: 1,
                    padding: "13px 0",
                    borderRadius: 12,
                    background: canUncraft
                      ? `linear-gradient(135deg, ${gemFrom}22, ${gemTo}44)`
                      : "rgba(255,255,255,0.04)",
                    border: canUncraft
                      ? `1px solid ${gemFrom}66`
                      : "1px solid rgba(255,255,255,0.08)",
                    color: canUncraft ? gemFrom : C.faint,
                    fontFamily: F.body,
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    cursor: canUncraft ? "pointer" : "not-allowed",
                    touchAction: "manipulation",
                  }}
                >
                  Uncraft
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
