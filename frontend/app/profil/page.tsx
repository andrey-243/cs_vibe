"use client";

import { useState, useEffect } from "react";
import { C, F, RarityTier, GEM_COLORS, GEM_PARTY_NAMES, GEM_PACK_NAMES } from "../lib/tokens";
import MiniCard from "../components/MiniCard";
import Gem from "../components/Gem";
import { getTotalXP, getLevelInfo, LEVEL_SVG, LEVEL_REWARDS, type RewardPackTier } from "../lib/xp";
import { getGems, addGems, removeGems } from "../lib/gems";
import { skipTimerCheckpoints } from "../lib/streak";

const PACK_PARTY: Record<string, string> = {
  TOP5: "CHOSEN FEW", TOP15: "PRETENDERS", TOP25: "GATEKEEPERS",
  TOP50: "GRINDERS", TOP75: "PICK'EM KILLERS", TOP100: "NO LAN NO FAME",
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

const GEM_TIERS = ["TOP5", "TOP15", "TOP25", "TOP50", "TOP75", "TOP100"] as const;
const CRAFT_THRESHOLD = 250;

const CONVERSIONS: { from: string; cost: number; to: string; gain: number }[] = [
  { from: "TOP100", cost: 100, to: "TOP75",  gain: 10 },
  { from: "TOP75",  cost: 10,  to: "TOP50",  gain: 1  },
  { from: "TOP50",  cost: 5,   to: "TOP25",  gain: 1  },
  { from: "TOP25",  cost: 5,   to: "TOP15",  gain: 1  },
  { from: "TOP15",  cost: 5,   to: "TOP5",   gain: 1  },
];

const SHOWCASE_SLOTS: (RarityTier | null)[] = [null, null, null, null, null];

// Opening timer per gem tier (PROJECT.md: "Pack gem crafté")
const CRAFT_TIMER_MS: Record<string, number> = {
  TOP100: 1  * 3_600_000,
  TOP75:  2  * 3_600_000,
  TOP50:  4  * 3_600_000,
  TOP25:  6  * 3_600_000,
  TOP15:  8  * 3_600_000,
  TOP5:   12 * 3_600_000,
};

// Writes a crafted pack directly to the daily queue localStorage key (page.tsx may not be mounted)
function pushCraftedPack(rewardTier: string) {
  const duration = CRAFT_TIMER_MS[rewardTier] ?? 3_600_000;
  const checkpoints = skipTimerCheckpoints(duration);
  let queue: unknown[] = [];
  try { queue = JSON.parse(localStorage.getItem("csv-daily-queue") ?? "[]"); } catch { /* */ }
  queue.push({
    id: `milestone-${Date.now()}-craft`,
    type: "milestone",
    rewardTier,
    endsAt: 0,
    initialDuration: duration,
    adsUsed: 0,
    adsMax: checkpoints.length,
    claimed: false,
  });
  localStorage.setItem("csv-daily-queue", JSON.stringify(queue));
}

export default function ProfilPage() {
  const [levelInfo, setLevelInfo] = useState(() => getLevelInfo(0));
  const [gems, setGems] = useState<Record<string, number>>({});
  const [convertOpen, setConvertOpen] = useState(false);
  const [craftOpen, setCraftOpen] = useState(false);
  const [craftedTier, setCraftedTier] = useState<string | null>(null);
  const [showXP, setShowXP] = useState(false);

  useEffect(() => {
    // Hydrate from localStorage after mount
    setLevelInfo(getLevelInfo(getTotalXP()));
    setGems(getGems());

    function syncXP() { setLevelInfo(getLevelInfo(getTotalXP())); }
    function syncGems() { setGems(getGems()); }
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
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflowY: "auto", fontFamily: F.body, color: C.ink }}>

      {/* Hero panel */}
      <div style={{ padding: "14px 14px 0" }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "16px 16px",
          borderRadius: 14,
          background: "rgba(255,255,255,0.045)",
          border: `1px solid ${C.border}`,
        }}>
          {/* Level icon */}
          <div style={{ flexShrink: 0 }}>
            {LEVEL_SVG[current.level] && (
              <img
                src={`/ranks/levels/${LEVEL_SVG[current.level]}.svg`}
                width={54}
                height={54}
                alt={current.name}
                style={{ objectFit: "contain", display: "block" }}
              />
            )}
          </div>
          {/* Identity */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
            <div style={{ fontFamily: F.body, fontSize: 17, fontWeight: 800, color: C.muted, letterSpacing: "-0.01em" }}>
              Non connecté
            </div>
            <div style={{ fontFamily: F.mono, fontSize: 8.5, color: C.faint, letterSpacing: "0.14em" }}>
              CONNECTE-TOI POUR SAUVEGARDER
            </div>
          </div>

          {/* XP ring */}
          {(() => {
            const SIZE = 42;
            const STROKE = 1.5;
            const R = (SIZE - STROKE) / 2;
            const CIRC = 2 * Math.PI * R;
            const offset = CIRC * (1 - progressPct / 100);
            return (
              <div
                style={{ position: "relative", flexShrink: 0, alignSelf: "center" }}
                onMouseEnter={() => setShowXP(true)}
                onMouseLeave={() => setShowXP(false)}
              >
                <svg width={SIZE} height={SIZE} style={{ display: "block", transform: "rotate(-90deg)" }}>
                  {/* Track */}
                  <circle
                    cx={SIZE / 2} cy={SIZE / 2} r={R}
                    fill="none"
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth={STROKE}
                  />
                  {/* Fill */}
                  <circle
                    cx={SIZE / 2} cy={SIZE / 2} r={R}
                    fill="none"
                    stroke={C.gold}
                    strokeWidth={STROKE}
                    strokeLinecap="round"
                    strokeDasharray={CIRC}
                    strokeDashoffset={offset}
                    style={{ transition: "stroke-dashoffset 0.4s ease" }}
                  />
                </svg>
                {/* Next level icon centered in ring */}
                {next && LEVEL_SVG[next.level] && (
                  <img
                    src={`/ranks/levels/${LEVEL_SVG[next.level]}.svg`}
                    width={24}
                    height={24}
                    alt={`lvl${next.level}`}
                    style={{
                      position: "absolute",
                      top: "50%", left: "50%",
                      transform: "translate(-50%, -50%)",
                      objectFit: "contain",
                      opacity: 0.5,
                    }}
                  />
                )}
                {/* Hover tooltip */}
                {showXP && (
                  <div style={{
                    position: "absolute",
                    bottom: "calc(100% + 6px)",
                    right: 0,
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
            );
          })()}
        </div>
      </div>

      {/* Showcase */}
      <div style={{ padding: "12px 14px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: C.crimson }}>
            ★ SHOWCASE · 5 FAVORIS
          </div>
          <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: C.muted }}>
            ÉDITER
          </div>
        </div>
        <div style={{ display: "flex", gap: 5, justifyContent: "space-between" }}>
          {SHOWCASE_SLOTS.map((tier, i) =>
            tier ? (
              <MiniCard key={i} tier={tier} w={54} h={82} />
            ) : (
              <div
                key={i}
                style={{
                  width: 54,
                  height: 82,
                  borderRadius: 6,
                  border: `1.5px dashed ${C.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: F.body,
                  fontSize: 18,
                  fontWeight: 700,
                  color: C.faint,
                }}
              >
                +
              </div>
            )
          )}
        </div>
      </div>

      {/* Gems table */}
      <div style={{ padding: "12px 14px 14px" }}>
        <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: C.teal }}>
          ● GEMMES · PAR TIER
        </div>
        <div
          style={{
            marginTop: 8,
            padding: "10px 12px",
            borderRadius: 12,
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${C.border}`,
          }}
        >
          {/* Gem rows */}
          {GEM_TIERS.map((tier, i) => {
            const amount = gems[tier] ?? 0;
            const pct = Math.min(100, (amount / CRAFT_THRESHOLD) * 100);
            const ready = amount >= CRAFT_THRESHOLD;
            const [gemFrom] = GEM_COLORS[tier] ?? [C.teal];
            return (
              <div
                key={tier}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "5px 0",
                  borderTop: i > 0 ? `1px solid ${C.border}` : "none",
                }}
              >
                <Gem tier={tier} size={14} />
                <div style={{ display: "flex", flexDirection: "column", width: 112 }}>
                  <span style={{ fontFamily: F.body, fontSize: 11, fontWeight: 800, letterSpacing: "0.04em", color: C.ink }}>
                    {GEM_PARTY_NAMES[tier] ?? tier}
                  </span>
                  <span style={{ fontFamily: F.mono, fontSize: 8, letterSpacing: "0.08em", color: C.faint, marginTop: 1 }}>
                    {GEM_PACK_NAMES[tier] ?? tier}
                  </span>
                </div>
                {ready ? (
                  <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center" }}>
                    <span className="gem-pack-dispo" style={{ "--gem-color": gemFrom } as React.CSSProperties}>
                      PACK DISPO
                    </span>
                  </div>
                ) : (
                  <div style={{ flex: 1, height: 4, borderRadius: 2, background: "rgba(0,0,0,0.3)", overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${pct}%`,
                        height: "100%",
                        background: `linear-gradient(90deg, ${C.teal}, ${C.tealDk})`,
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                )}
                <div style={{ fontFamily: F.mono, fontSize: 12, fontWeight: 800, width: 44, textAlign: "right", color: ready ? gemFrom : amount > 0 ? C.ink : C.faint }}>
                  {amount}
                </div>
              </div>
            );
          })}

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <button
              onClick={() => { setCraftOpen((v) => !v); setConvertOpen(false); setCraftedTier(null); }}
              style={{
                flex: 1,
                padding: "7px 14px",
                borderRadius: 8,
                background: craftOpen ? "rgba(255,255,255,0.10)" : `linear-gradient(180deg, ${C.teal} 0%, #3a8094 100%)`,
                border: craftOpen ? `1px solid ${C.borderHi}` : "1px solid rgba(255,255,255,0.18)",
                fontFamily: F.body,
                fontSize: 11,
                fontWeight: 700,
                color: craftOpen ? C.ink : "#0a1a1f",
                cursor: "pointer",
                touchAction: "manipulation",
              }}
            >
              {craftOpen ? "✕ Fermer" : "Craft pack"}
            </button>
            <button
              onClick={() => { setConvertOpen((v) => !v); setCraftOpen(false); }}
              style={{
                flex: 1,
                padding: "7px 14px",
                borderRadius: 8,
                background: convertOpen ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.06)",
                border: `1px solid ${convertOpen ? C.borderHi : "rgba(255,255,255,0.12)"}`,
                fontFamily: F.body,
                fontSize: 11,
                fontWeight: 700,
                color: C.ink,
                cursor: "pointer",
                touchAction: "manipulation",
              }}
            >
              {convertOpen ? "✕ Fermer" : "Convertir"}
            </button>
          </div>

          {/* Craft panel */}
          {craftOpen && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
              <div style={{ fontFamily: F.mono, fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", color: C.faint, marginBottom: 6 }}>
                250 GEMMES → 1 PACK THÉMATIQUE
              </div>
              {craftedTier ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0" }}>
                  <Gem tier={craftedTier} size={16} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontFamily: F.body, fontSize: 12, fontWeight: 800, color: GEM_COLORS[craftedTier]?.[0] ?? C.teal }}>
                      {GEM_PARTY_NAMES[craftedTier]} — {GEM_PACK_NAMES[craftedTier]} pack
                    </span>
                    <span style={{ fontFamily: F.mono, fontSize: 8, color: C.faint, letterSpacing: "0.08em" }}>
                      ajouté dans tes packs ✓
                    </span>
                  </div>
                </div>
              ) : (
                GEM_TIERS.map((tier) => {
                  const amount = gems[tier] ?? 0;
                  const canCraft = amount >= CRAFT_THRESHOLD;
                  const [c1, c2] = GEM_COLORS[tier] ?? [C.teal, C.tealDk];
                  return (
                    <div
                      key={tier}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 0",
                        borderTop: `1px solid ${C.border}`,
                        opacity: canCraft ? 1 : 0.4,
                      }}
                    >
                      <Gem tier={tier} size={13} />
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1 }}>
                        <span style={{ fontFamily: F.body, fontSize: 11, fontWeight: 800, color: canCraft ? c1 : C.faint }}>
                          {GEM_PARTY_NAMES[tier]}
                        </span>
                        <span style={{ fontFamily: F.mono, fontSize: 7.5, color: C.faint, letterSpacing: "0.06em" }}>
                          {GEM_PACK_NAMES[tier]} · {amount}/{CRAFT_THRESHOLD} 💎
                        </span>
                      </div>
                      <button
                        disabled={!canCraft}
                        onClick={() => {
                          removeGems(tier, CRAFT_THRESHOLD);
                          pushCraftedPack(tier);
                          setGems(getGems());
                          setCraftedTier(tier);
                        }}
                        style={{
                          padding: "5px 12px",
                          borderRadius: 6,
                          background: canCraft ? `linear-gradient(135deg, ${c1}, ${c2})` : "rgba(255,255,255,0.04)",
                          border: canCraft ? "1px solid rgba(255,255,255,0.22)" : `1px solid ${C.border}`,
                          color: canCraft ? "#07121a" : C.faint,
                          fontFamily: F.body,
                          fontSize: 10,
                          fontWeight: 800,
                          cursor: canCraft ? "pointer" : "not-allowed",
                          touchAction: "manipulation",
                          letterSpacing: "0.04em",
                        }}
                      >
                        CRAFT
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Conversion panel */}
          {convertOpen && (
            <div
              style={{
                marginTop: 10,
                paddingTop: 10,
                borderTop: `1px solid ${C.border}`,
              }}
            >
              <div style={{ fontFamily: F.mono, fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", color: C.faint, marginBottom: 6 }}>
                CONVERSION ASCENDANTE
              </div>
              {CONVERSIONS.map(({ from, cost, to, gain }) => {
                const have = gems[from] ?? 0;
                const maxTimes = Math.floor(have / cost);
                const [fromColor] = GEM_COLORS[from] ?? [C.muted];
                const [toColor] = GEM_COLORS[to] ?? [C.teal];

                function doConvert(times: number) {
                  if (times <= 0) return;
                  removeGems(from, cost * times);
                  addGems(to, gain * times);
                }

                const BTN_W = 36;
                const multiBtns: { label: string; times: number }[] = [
                  { label: "×1",   times: 1 },
                  { label: "×10",  times: 10 },
                  { label: "×100", times: 100 },
                  { label: "ALL",  times: maxTimes },
                ];

                return (
                  <div
                    key={from}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "6px 0",
                      borderTop: `1px solid ${C.border}`,
                    }}
                  >
                    {/* Rate label */}
                    <Gem tier={from} size={11} />
                    <span style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 800, color: maxTimes > 0 ? fromColor : C.faint, minWidth: 24 }}>
                      {cost}
                    </span>
                    <span style={{ fontFamily: F.mono, fontSize: 9, color: C.faint }}>→</span>
                    <Gem tier={to} size={11} />
                    <span style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 800, color: toColor, minWidth: 16 }}>
                      {gain}
                    </span>

                    {/* Dispo */}
                    <span style={{ fontFamily: F.mono, fontSize: 8, color: C.faint, flex: 1 }}>
                      {maxTimes > 0 ? `×${maxTimes}` : `${have}/${cost}`}
                    </span>

                    {/* 4 buttons same width */}
                    <div style={{ display: "flex", gap: 3 }}>
                      {multiBtns.map(({ label, times }) => {
                        const can = times > 0 && have >= cost * times;
                        return (
                          <button
                            key={label}
                            onClick={() => doConvert(times)}
                            disabled={!can}
                            style={{
                              width: BTN_W,
                              padding: "4px 0",
                              borderRadius: 5,
                              background: can ? `linear-gradient(135deg, ${toColor}2e, ${toColor}18)` : "rgba(255,255,255,0.03)",
                              border: can ? `1px solid ${toColor}55` : "1px solid rgba(255,255,255,0.07)",
                              color: can ? toColor : C.faint,
                              fontFamily: F.mono,
                              fontSize: 9,
                              fontWeight: 800,
                              cursor: can ? "pointer" : "not-allowed",
                              touchAction: "manipulation",
                              letterSpacing: "0.02em",
                            }}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
