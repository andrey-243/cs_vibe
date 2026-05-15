"use client";

import { useState } from "react";
import { C, F, GEM_COLORS } from "../lib/tokens";
import XPBar from "./XPBar";
import Gem from "./Gem";

const GEM_TIERS = Object.keys(GEM_COLORS) as string[];

// Placeholder counts — remplacer par vraies données utilisateur quand auth dispo
const GEM_COUNTS: Record<string, number> = {
  TOP5: 0, TOP15: 0, TOP25: 0, TOP50: 0, TOP75: 0, TOP100: 0,
};

function GemsButton() {
  const [show, setShow] = useState(false);

  return (
    <div
      style={{ position: "relative", flexShrink: 0 }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onTouchStart={() => setShow(true)}
      onTouchEnd={() => setShow(false)}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "4px 6px",
          borderRadius: 999,
          background: "rgba(255,255,255,0.06)",
          border: `1px solid ${C.border}`,
          cursor: "default",
        }}
      >
        <Gem tier="TOP25" size={10} />
      </div>

      {show && (
        <div
          style={{
            position: "fixed",
            top: 44,
            right: 14,
            background: C.bg2,
            border: `1px solid ${C.borderHi}`,
            borderRadius: 8,
            padding: "6px 0",
            zIndex: 200,
            boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
            minWidth: 110,
          }}
        >
          {GEM_TIERS.map((tier) => (
            <div
              key={tier}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "5px 12px",
              }}
            >
              <Gem tier={tier} size={10} />
              <span style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: "0.08em", color: C.muted, flex: 1 }}>
                {tier}
              </span>
              <span style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 800, color: C.ink }}>
                {GEM_COUNTS[tier] ?? 0}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TopBar({ major = false }: { major?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "10px 14px 10px",
      }}
    >
      {/* Level pill */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          fontFamily: F.body,
          fontSize: 9,
          fontWeight: 700,
          background: "rgba(255,210,63,0.15)",
          color: C.gold,
          padding: "3px 8px",
          borderRadius: 999,
          border: `1px solid ${C.border}`,
          letterSpacing: "0.04em",
          flexShrink: 0,
        }}
      >
        LVL 23
      </div>

      {/* XP bar */}
      <div style={{ flex: 1 }}>
        <XPBar pct={64} color={major ? "crimson" : "gold"} height={5} />
      </div>

      {/* Gems */}
      <GemsButton />
    </div>
  );
}
