"use client";

import { useState, useEffect } from "react";
import { C, F, GEM_COLORS, GEM_PARTY_NAMES } from "../lib/tokens";
import Gem from "./Gem";
import { getTotalXP, getLevelInfo, LEVEL_SVG, LEVEL_REWARDS, type RewardPackTier } from "../lib/xp";
import { getGems } from "../lib/gems";

const GEM_TIERS = Object.keys(GEM_COLORS) as string[];

const PACK_PARTY: Record<string, string> = {
  TOP5:   "CHOSEN FEW",
  TOP15:  "PRETENDERS",
  TOP25:  "GATEKEEPERS",
  TOP50:  "GRINDERS",
  TOP75:  "PICK'EM KILLERS",
  TOP100: "NO LAN NO FAME",
  ICON:   "Pack Icon",
};

function nextRewardLabel(nextLevel: number): string {
  const r = LEVEL_REWARDS[nextLevel];
  if (!r) return "+1 Pack";
  const packs = [r.pack, r.extraPack].filter(Boolean) as RewardPackTier[];
  if (!packs.length) return "";
  const themed = packs.find((p) => p !== "free");
  const freeCount = packs.filter((p) => p === "free").length;
  if (themed) {
    const name = PACK_PARTY[themed] ?? themed;
    return freeCount > 0 ? `${name} +${freeCount}` : name;
  }
  return `+${packs.length} Pack`;
}

function LevelIcon({ level, size }: { level: number; size: number }) {
  const file = LEVEL_SVG[level];
  if (!file) return null;
  return (
    <img
      src={`/ranks/levels/${file}.svg`}
      width={size}
      height={size}
      alt={`lvl${level}`}
      style={{ display: "block", objectFit: "contain" }}
    />
  );
}

export default function TopBar({ major = false }: { major?: boolean }) {
  const [levelInfo, setLevelInfo] = useState(() => getLevelInfo(0));
  const [showGems, setShowGems] = useState(false);
  const [showXP, setShowXP] = useState(false);
  const [gemCounts, setGemCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    function syncXP()  { setLevelInfo(getLevelInfo(getTotalXP())); }
    function syncGems() { setGemCounts(getGems()); }
    syncXP();
    syncGems();
    window.addEventListener("csv-xp-updated", syncXP);
    window.addEventListener("csv-gems-updated", syncGems);
    return () => {
      window.removeEventListener("csv-xp-updated", syncXP);
      window.removeEventListener("csv-gems-updated", syncGems);
    };
  }, []);

  const { current, next, progressPct, totalXP } = levelInfo;
  const xpInLevel  = totalXP - current.xpStart;
  const xpForLevel = next ? next.xpStart - current.xpStart : 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px" }}>

      {/* Current level icon — hover shows gems breakdown */}
      <div
        style={{ position: "relative", flexShrink: 0 }}
        onMouseEnter={() => setShowGems(true)}
        onMouseLeave={() => setShowGems(false)}
      >
        <div style={{ cursor: "default" }}>
          <LevelIcon level={current.level} size={40} />
        </div>

        {showGems && (
          <div
            style={{
              position: "fixed",
              top: 52,
              left: 14,
              background: C.bg2,
              border: `1px solid ${C.borderHi}`,
              borderRadius: 8,
              padding: "6px 0",
              zIndex: 200,
              boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
              minWidth: 160,
            }}
          >
            {GEM_TIERS.map((tier) => (
              <div key={tier} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 12px" }}>
                <Gem tier={tier} size={10} />
                <span style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: "0.06em", color: C.muted, flex: 1 }}>
                  {GEM_PARTY_NAMES[tier] ?? tier}
                </span>
                <span style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 800, color: C.ink }}>
                  {gemCounts[tier] ?? 0}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* XP bar */}
      <div
        style={{ flex: 1, position: "relative" }}
        onMouseEnter={() => setShowXP(true)}
        onMouseLeave={() => setShowXP(false)}
      >
        <div style={{
          height: 6,
          borderRadius: 99,
          overflow: "hidden",
          background: "rgba(0,0,0,0.4)",
          border: `1px solid ${C.border}`,
          position: "relative",
        }}>
          {/* Fill */}
          <div style={{
            position: "absolute", inset: 0,
            width: `${progressPct}%`,
            background: major
              ? `linear-gradient(90deg, ${C.crimson}, ${C.majorDk})`
              : `linear-gradient(90deg, ${C.gold}, ${C.goldDk})`,
            borderRadius: 8,
          }}>
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: "40%",
              background: "linear-gradient(180deg, rgba(255,255,255,0.18), transparent)",
              borderRadius: 8,
            }} />
          </div>

        </div>

        {/* Hover tooltip */}
        {showXP && (
          <div style={{
            position: "absolute",
            top: "calc(100% + 5px)",
            left: "50%",
            transform: "translateX(-50%)",
            width: "max-content",
            background: C.bg2,
            border: `1px solid ${C.borderHi}`,
            borderRadius: 6,
            padding: "5px 10px",
            zIndex: 200,
            boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 3,
          }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 800, color: C.gold }}>
                {xpInLevel.toLocaleString()}
              </span>
              <span style={{ fontFamily: F.mono, fontSize: 9, color: C.faint }}>
                / {xpForLevel > 0 ? xpForLevel.toLocaleString() : "—"} XP
              </span>
            </div>
            {next && (
              <span style={{ fontFamily: F.mono, fontSize: 8, color: C.teal, letterSpacing: "0.06em" }}>
                {nextRewardLabel(next.level)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Next level icon */}
      {next && (
        <div style={{ flexShrink: 0, opacity: 0.5 }}>
          <LevelIcon level={next.level} size={40} />
        </div>
      )}
    </div>
  );
}
