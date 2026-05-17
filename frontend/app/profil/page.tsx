"use client";

import { useState, useEffect } from "react";
import { C, F, RarityTier, GEM_COLORS, GEM_PARTY_NAMES, GEM_PACK_NAMES } from "../lib/tokens";
import TopBar from "../components/TopBar";
import MiniCard from "../components/MiniCard";
import XPBar from "../components/XPBar";
import Gem from "../components/Gem";
import { getTotalXP, getLevelInfo } from "../lib/xp";
import { getGems, addGems, removeGems } from "../lib/gems";

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

export default function ProfilPage() {
  const [levelInfo, setLevelInfo] = useState(() => getLevelInfo(getTotalXP()));
  const [gems, setGems] = useState<Record<string, number>>(() => getGems());
  const [convertOpen, setConvertOpen] = useState(false);

  useEffect(() => {
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
  const xp = totalXP - current.xpStart;
  const xpNext = next ? next.xpStart - current.xpStart : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflowY: "auto", fontFamily: F.body, color: C.ink }}>
      <TopBar />

      {/* Hero avatar */}
      <div style={{ position: "relative", padding: "4px 14px 0", textAlign: "center" }}>
        <div
          style={{
            position: "absolute",
            top: 60,
            left: "50%",
            width: 200,
            height: 200,
            transform: "translate(-50%, -50%)",
            background: `radial-gradient(circle, ${C.gold}88 0%, transparent 65%)`,
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "relative",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: `linear-gradient(180deg, ${C.gold}, ${C.goldDk})`,
            border: "3px solid rgba(255,255,255,0.3)",
            boxShadow: `0 6px 18px rgba(0,0,0,0.5), 0 0 20px ${C.gold}66, inset 0 2px 0 rgba(255,255,255,0.4)`,
            fontFamily: F.body,
            fontSize: 36,
            fontWeight: 800,
            color: "#1a1208",
          }}
        >
          ?
        </div>
        <div style={{ position: "relative", marginTop: 8 }}>
          <div style={{ fontFamily: F.body, fontSize: 20, fontWeight: 800, letterSpacing: "-0.01em", color: C.muted }}>
            Non connecté
          </div>
          <div style={{ fontFamily: F.mono, fontSize: 9.5, color: C.faint, letterSpacing: "0.14em", marginTop: 2 }}>
            CONNECTE-TOI POUR SAUVEGARDER
          </div>
        </div>
      </div>

      {/* Level + XP */}
      <div style={{ padding: "12px 14px 0" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 12px",
            borderRadius: 12,
            background: "rgba(255,255,255,0.05)",
            border: `1px solid ${C.border}`,
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              background: `linear-gradient(180deg, ${C.gold}, ${C.goldDk})`,
              color: "#1a1208",
              padding: "6px 12px",
              borderRadius: 999,
              flexShrink: 0,
            }}
          >
            <span style={{ fontFamily: F.body, fontSize: 14, fontWeight: 800 }}>{current.level}</span>
          </div>
          <div style={{ flex: 1 }}>
            <XPBar pct={progressPct} color="gold" height={8} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
              <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: C.muted }}>
                {xp} / {xpNext > 0 ? xpNext : "MAX"} XP
              </div>
              <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: C.gold }}>
                {next ? `→ ${next.name}` : "MAX RANK"}
              </div>
            </div>
          </div>
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
                    {GEM_PACK_NAMES[tier] ?? tier}
                  </span>
                  <span style={{ fontFamily: F.mono, fontSize: 8, letterSpacing: "0.08em", color: C.faint, marginTop: 1 }}>
                    {GEM_PARTY_NAMES[tier] ?? tier}
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
              style={{
                flex: 1,
                padding: "7px 14px",
                borderRadius: 8,
                background: `linear-gradient(180deg, ${C.teal} 0%, #3a8094 100%)`,
                border: "1px solid rgba(255,255,255,0.18)",
                fontFamily: F.body,
                fontSize: 11,
                fontWeight: 700,
                color: "#0a1a1f",
                cursor: "pointer",
                touchAction: "manipulation",
              }}
            >
              Craft pack
            </button>
            <button
              onClick={() => setConvertOpen((v) => !v)}
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
