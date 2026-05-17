"use client";

import { useState, useEffect } from "react";
import { C, F, GEM_COLORS, GEM_PACK_NAMES } from "../lib/tokens";
import Gem from "./Gem";
import { getTotalXP, getLevelInfo } from "../lib/xp";
import { getGems } from "../lib/gems";

const GEM_TIERS = Object.keys(GEM_COLORS) as string[];

function nextLevelReward(nextLevel: number): string {
  if (nextLevel === 7)  return "Pack TOP100";
  if (nextLevel === 18) return "Pack TOP25";
  if (nextLevel === 28) return "Pack TOP10";
  if (nextLevel === 41) return "Pack ICON";
  if (nextLevel >= 19)  return "+Pack · Gems";
  return "+1 Pack";
}

export default function TopBar({ major = false }: { major?: boolean }) {
  const [levelInfo, setLevelInfo] = useState(() => getLevelInfo(getTotalXP()));
  const [showGems, setShowGems] = useState(false);
  const [showXP, setShowXP] = useState(false);
  const [gemCounts, setGemCounts] = useState<Record<string, number>>(() => getGems());

  useEffect(() => {
    function syncXP()  { setLevelInfo(getLevelInfo(getTotalXP())); }
    function syncGems() { setGemCounts(getGems()); }
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
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>

      {/* Level pill — hover shows gems breakdown */}
      <div
        style={{ position: "relative", flexShrink: 0 }}
        onMouseEnter={() => setShowGems(true)}
        onMouseLeave={() => setShowGems(false)}
      >
        <div
          style={{
            display: "inline-flex",
            flexDirection: "column",
            alignItems: "center",
            fontFamily: F.body,
            fontWeight: 700,
            background: "rgba(255,210,63,0.15)",
            color: C.gold,
            padding: "3px 8px",
            borderRadius: 999,
            border: `1px solid ${C.border}`,
            letterSpacing: "0.04em",
            lineHeight: 1,
            cursor: "default",
          }}
        >
          <span style={{ fontSize: 8, opacity: 0.7 }}>LVL {current.level}</span>
          <span style={{ fontSize: 8, marginTop: 1 }}>{current.name}</span>
        </div>

        {showGems && (
          <div
            style={{
              position: "fixed",
              top: 44,
              left: 14,
              background: C.bg2,
              border: `1px solid ${C.borderHi}`,
              borderRadius: 8,
              padding: "6px 0",
              zIndex: 200,
              boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
              minWidth: 148,
            }}
          >
            {GEM_TIERS.map((tier) => (
              <div key={tier} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 12px" }}>
                <Gem tier={tier} size={10} />
                <span style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: "0.06em", color: C.muted, flex: 1 }}>
                  {GEM_PACK_NAMES[tier] ?? tier}
                </span>
                <span style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 800, color: C.ink }}>
                  {gemCounts[tier] ?? 0}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* XP bar — tall, next level overlaid inside */}
      <div
        style={{ flex: 1, position: "relative" }}
        onMouseEnter={() => setShowXP(true)}
        onMouseLeave={() => setShowXP(false)}
      >
        {/* Bar track */}
        <div style={{
          height: 16,
          borderRadius: 8,
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

          {/* Next level text — overlaid right */}
          {next && (
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center",
              justifyContent: "flex-end",
              paddingRight: 9, gap: 5,
            }}>
              <span style={{
                fontFamily: F.mono, fontSize: 8, fontWeight: 800,
                color: "rgba(255,255,255,0.82)",
                letterSpacing: "0.03em",
                textShadow: "0 1px 4px rgba(0,0,0,0.9)",
                whiteSpace: "nowrap",
              }}>
                → {next.name}
              </span>
              <span style={{
                fontFamily: F.mono, fontSize: 7.5,
                color: C.teal,
                letterSpacing: "0.04em",
                textShadow: "0 1px 4px rgba(0,0,0,0.9)",
                whiteSpace: "nowrap",
              }}>
                {nextLevelReward(next.level)}
              </span>
            </div>
          )}
        </div>

        {/* Hover tooltip — XP detail */}
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
            padding: "4px 10px",
            zIndex: 200,
            boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "baseline",
            gap: 4,
          }}>
            <span style={{ fontFamily: F.mono, fontSize: 9, fontWeight: 800, color: C.gold }}>
              {xpInLevel.toLocaleString()}
            </span>
            <span style={{ fontFamily: F.mono, fontSize: 9, color: C.faint }}>
              / {xpForLevel > 0 ? xpForLevel.toLocaleString() : "—"} XP
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
