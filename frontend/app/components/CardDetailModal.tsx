"use client";

import { useEffect } from "react";
import { C, F, R, RarityTier, rarityChrome } from "../lib/tokens";
import { CardPortraitData } from "./CardPortrait";
import { CategoryScores } from "../lib/cards";

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


export default function CardDetailModal({
  card,
  tier,
  onClose,
}: {
  card: CardPortraitData | null;
  tier: RarityTier;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!card) return;
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
          gap: 14,
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

          {/* Heavy fade from bottom — covers name + stats zone */}
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
            {/* Name */}
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

            {/* Team */}
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
              {STAT_LABELS.map(([key, label], i) => (
                <div
                  key={key}
                  style={{
                    textAlign: "center",
                    padding: "9px 0",
                  }}
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

        {/* ── ACTION BUTTONS ─────────────────────────────────── */}
        <div style={{ display: "flex", gap: 10, width: 270 }}>
          <button
            onClick={(e) => e.stopPropagation()}
            style={{
              flex: 1,
              padding: "14px 0",
              borderRadius: 12,
              background: "rgba(56,200,210,0.18)",
              border: "1px solid rgba(56,200,210,0.55)",
              color: "#7ee8ed",
              fontFamily: F.body,
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.06em",
              cursor: "pointer",
              touchAction: "manipulation",
            }}
          >
            Détails
          </button>
          <button
            onClick={(e) => e.stopPropagation()}
            style={{
              flex: 1,
              padding: "14px 0",
              borderRadius: 12,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.14)",
              color: C.muted,
              fontFamily: F.body,
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.06em",
              cursor: "pointer",
              touchAction: "manipulation",
            }}
          >
            Trade
          </button>
        </div>
      </div>
    </div>
  );
}
