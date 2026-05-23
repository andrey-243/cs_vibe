"use client";

import { useState, useEffect, useCallback } from "react";
import { C, F, GEM_COLORS, GEM_PACK_NAMES, GEM_PARTY_NAMES } from "../lib/tokens";
import { shiftPendingLevelUp, getPendingLevelUps, type PendingLevelUp, type RewardPackTier } from "../lib/xp";
import { addGems } from "../lib/gems";
import Gem from "./Gem";

const PHASE_LABEL: Record<string, string> = {
  cs2:    "CS2",
  faceit: "FACEIT",
  esea:   "ESEA",
};

const PHASE_COLOR: Record<string, string> = {
  cs2:    "#c9a565",
  faceit: "#f04f24",
  esea:   "#6db5c4",
};

const PACK_LABEL: Record<RewardPackTier, string> = {
  free:   "Pack gratuit",
  TOP5:   "CHOSEN FEW",
  TOP15:  "PRETENDERS",
  TOP25:  "GATEKEEPERS",
  TOP50:  "GRINDERS",
  TOP75:  "PICK'EM KILLERS",
  TOP100: "NO LAN NO FAME",
  ICON:   "Pack Icon",
};

const PACK_SUBLABEL: Record<RewardPackTier, string> = {
  free:   "5 cartes garanties",
  TOP5:   "S-Tier · 5 cartes",
  TOP15:  "Tier 1 · 5 cartes",
  TOP25:  "Tier 1.5 · 5 cartes",
  TOP50:  "Tier 2 · 5 cartes",
  TOP75:  "Tier 3 · 5 cartes",
  TOP100: "Tier 4 · 5 cartes",
  ICON:   "5 cartes garanties",
};

// Color gradient for the pack pill, reusing GEM_COLORS where applicable
function packColors(tier: RewardPackTier): [string, string] {
  const map: Partial<Record<RewardPackTier, [string, string]>> = {
    TOP5:   GEM_COLORS.TOP5,
    TOP15:  GEM_COLORS.TOP15,
    TOP25:  GEM_COLORS.TOP25,
    TOP50:  GEM_COLORS.TOP50,
    TOP75:  GEM_COLORS.TOP75,
    TOP100: GEM_COLORS.TOP100,
    ICON:   ["#b89cd4", "#3f2860"],
    free:   ["#6db5c4", "#1f3a5a"],
  };
  return map[tier] ?? ["#6db5c4", "#1f3a5a"];
}

function detectPhase(level: number): string {
  if (level <= 18) return "cs2";
  if (level <= 28) return "faceit";
  return "esea";
}

export default function LevelUpModal() {
  const [current, setCurrent] = useState<PendingLevelUp | null>(null);
  const [claiming, setClaiming] = useState(false);

  const tryDequeue = useCallback(() => {
    const lu = shiftPendingLevelUp();
    if (lu) setCurrent(lu);
  }, []);

  useEffect(() => {
    // Check for level-ups that accumulated before mount (e.g. across pages)
    if (getPendingLevelUps().length > 0) tryDequeue();

    const onLevelUp = () => tryDequeue();
    window.addEventListener("csv-level-up", onLevelUp);
    return () => window.removeEventListener("csv-level-up", onLevelUp);
  }, [tryDequeue]);

  function handleClaim() {
    if (!current || claiming) return;
    setClaiming(true);

    const { reward } = current;

    // Grant gems immediately
    if (reward.gems) {
      addGems(reward.gems.tier, reward.gems.amount);
    }

    // Signal pack grants to page.tsx
    const packs = [reward.pack, reward.extraPack].filter(Boolean) as RewardPackTier[];
    packs.forEach((p) =>
      window.dispatchEvent(new CustomEvent("csv-pack-granted", { detail: { packTier: p } }))
    );

    // Short delay so the button feels snappy
    setTimeout(() => {
      setClaiming(false);
      setCurrent(null);
      // Chain next pending level-up if any
      setTimeout(tryDequeue, 300);
    }, 260);
  }

  if (!current) return null;

  const phase = detectPhase(current.level);
  const phaseColor = PHASE_COLOR[phase] ?? C.gold;
  const { reward } = current;

  return (
    <div
      className="csv-levelup-overlay"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 700,
        background: "rgba(0,0,0,0.82)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      {/* Glow behind card */}
      <div
        className="csv-levelup-glow"
        style={{
          position: "absolute",
          width: 320,
          height: 320,
          borderRadius: "50%",
          background: `radial-gradient(ellipse, ${phaseColor}28 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />

      <div
        className="csv-levelup-card"
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 320,
          background: C.bg1,
          border: `1px solid ${phaseColor}55`,
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: `0 0 40px ${phaseColor}22, 0 24px 60px rgba(0,0,0,0.7)`,
        }}
      >
        {/* Shine sweep */}
        <div
          className="csv-levelup-shine"
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(100deg, transparent 30%, rgba(255,255,255,0.12) 50%, transparent 70%)",
            pointerEvents: "none",
            zIndex: 2,
          }}
        />

        {/* Top stripe */}
        <div style={{
          height: 3,
          background: `linear-gradient(90deg, transparent, ${phaseColor}, transparent)`,
        }} />

        <div style={{ padding: "24px 24px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>

          {/* Header label */}
          <div style={{
            fontFamily: F.mono,
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.22em",
            color: phaseColor,
            textTransform: "uppercase",
            marginBottom: 14,
          }}>
            LEVEL UP
          </div>

          {/* Phase badge */}
          <div style={{
            fontFamily: F.mono,
            fontSize: 8,
            fontWeight: 700,
            letterSpacing: "0.18em",
            color: "rgba(255,255,255,0.4)",
            background: `${phaseColor}18`,
            border: `1px solid ${phaseColor}44`,
            borderRadius: 4,
            padding: "2px 8px",
            marginBottom: 10,
          }}>
            {PHASE_LABEL[phase]}
          </div>

          {/* Level number */}
          <div
            className="csv-levelup-badge"
            style={{
              fontFamily: F.body,
              fontSize: 52,
              fontWeight: 800,
              lineHeight: 1,
              color: phaseColor,
              textShadow: `0 0 32px ${phaseColor}88`,
              marginBottom: 6,
            }}
          >
            {current.level}
          </div>

          {/* Rank name */}
          <div style={{
            fontFamily: F.body,
            fontSize: 18,
            fontWeight: 800,
            color: C.ink,
            letterSpacing: "0.02em",
            marginBottom: 24,
            textAlign: "center",
          }}>
            {current.levelName}
          </div>

          {/* Reward section */}
          {(reward.pack || reward.extraPack || reward.gems) && (
            <div style={{
              width: "100%",
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              padding: "14px 16px",
              marginBottom: 20,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}>
              <div style={{
                fontFamily: F.mono,
                fontSize: 7.5,
                fontWeight: 700,
                letterSpacing: "0.18em",
                color: C.faint,
                textTransform: "uppercase",
                marginBottom: 2,
              }}>
                RÉCOMPENSE
              </div>

              {/* Pack rows */}
              {([reward.pack, reward.extraPack].filter(Boolean) as RewardPackTier[]).map((p) => {
                const [c1, c2] = packColors(p);
                return (
                  <div key={p} style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    background: `linear-gradient(90deg, ${c1}18, ${c2}12)`,
                    border: `1px solid ${c1}44`,
                    borderRadius: 8,
                    padding: "8px 12px",
                  }}>
                    <div style={{
                      width: 28,
                      height: 36,
                      borderRadius: 4,
                      background: `linear-gradient(160deg, ${c1}, ${c2})`,
                      border: "1px solid rgba(255,255,255,0.18)",
                      flexShrink: 0,
                      boxShadow: `0 2px 8px ${c1}44`,
                    }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ fontFamily: F.body, fontSize: 13, fontWeight: 800, color: C.ink }}>
                        {PACK_LABEL[p]}
                      </span>
                      <span style={{ fontFamily: F.mono, fontSize: 7.5, color: C.faint, letterSpacing: "0.08em" }}>
                        {PACK_SUBLABEL[p]}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Gems reward */}
              {reward.gems && (() => {
                const tier = reward.gems.tier;
                const [c1] = GEM_COLORS[tier] ?? ["#6db5c4", "#1f3a5a"];
                return (
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    background: `${c1}12`,
                    border: `1px solid ${c1}44`,
                    borderRadius: 8,
                    padding: "8px 12px",
                  }}>
                    <Gem tier={tier} size={22} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ fontFamily: F.body, fontSize: 13, fontWeight: 800, color: C.ink }}>
                        {reward.gems.amount} gemmes
                      </span>
                      <span style={{ fontFamily: F.mono, fontSize: 7.5, color: C.faint, letterSpacing: "0.06em" }}>
                        {GEM_PACK_NAMES[tier]} · {GEM_PARTY_NAMES[tier]}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Claim button */}
          <button
            onClick={handleClaim}
            disabled={claiming}
            style={{
              width: "100%",
              padding: "12px 0",
              borderRadius: 8,
              border: "none",
              background: claiming
                ? "rgba(255,255,255,0.06)"
                : `linear-gradient(135deg, ${phaseColor}cc, ${phaseColor}88)`,
              color: claiming ? C.muted : "#0a0a0d",
              fontFamily: F.body,
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: "0.08em",
              cursor: claiming ? "default" : "pointer",
              transition: "background 200ms, transform 100ms",
              transform: claiming ? "scale(0.98)" : "scale(1)",
              boxShadow: claiming ? "none" : `0 4px 16px ${phaseColor}44`,
            }}
          >
            {claiming ? "..." : "RÉCLAMER"}
          </button>
        </div>
      </div>
    </div>
  );
}
