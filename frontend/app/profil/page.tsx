import { C, F, RarityTier } from "../lib/tokens";
import TopBar from "../components/TopBar";
import MiniCard from "../components/MiniCard";
import XPBar from "../components/XPBar";
import Gem from "../components/Gem";

const GEMS = [
  { tier: "TOP5", amount: 0 },
  { tier: "TOP15", amount: 0 },
  { tier: "TOP25", amount: 0 },
  { tier: "TOP50", amount: 0 },
  { tier: "TOP75", amount: 0 },
  { tier: "TOP100", amount: 0 },
] as const;

const SHOWCASE_SLOTS: (RarityTier | null)[] = [null, null, null, null, null];

export default function ProfilPage() {
  const xp = 0;
  const xpNext = 100;

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
            <span style={{ fontFamily: F.body, fontSize: 14, fontWeight: 800 }}>1</span>
          </div>
          <div style={{ flex: 1 }}>
            <XPBar pct={0} color="gold" height={8} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
              <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: C.muted }}>
                {xp} / {xpNext} XP
              </div>
              <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: C.gold }}>
                → Silver I
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
          {GEMS.map(({ tier, amount }, i) => (
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
              <div style={{ fontFamily: F.body, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", width: 56 }}>
                {tier}
              </div>
              <div style={{ flex: 1, height: 4, borderRadius: 2, background: "rgba(0,0,0,0.3)", overflow: "hidden" }}>
                <div style={{ width: `${Math.min(100, amount / 50)}%`, height: "100%", background: `linear-gradient(90deg, ${C.teal}, ${C.tealDk})` }} />
              </div>
              <div style={{ fontFamily: F.mono, fontSize: 12, fontWeight: 800, width: 44, textAlign: "right", color: amount > 0 ? C.ink : C.faint }}>
                {amount}
              </div>
            </div>
          ))}

          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <div
              style={{
                flex: 1,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                padding: "7px 14px",
                borderRadius: 8,
                background: `linear-gradient(180deg, ${C.teal} 0%, #3a8094 100%)`,
                border: "1px solid rgba(255,255,255,0.18)",
                fontFamily: F.body,
                fontSize: 11,
                fontWeight: 700,
                color: "#0a1a1f",
                cursor: "pointer",
              }}
            >
              Craft pack
            </div>
            <div
              style={{
                flex: 1,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                padding: "7px 14px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                fontFamily: F.body,
                fontSize: 11,
                fontWeight: 700,
                color: C.ink,
                cursor: "pointer",
              }}
            >
              Convertir
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
