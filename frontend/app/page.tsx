import { C, F, R } from "./lib/tokens";
import TopBar from "./components/TopBar";
import XPBar from "./components/XPBar";

const CARD_STACK = [
  { rarity: R.SILVER, z: 0 },
  { rarity: R.ICON, z: 1 },
  { rarity: R.GOLD, z: 2 },
  { rarity: R.DIAMOND, z: 3 },
];

const CHALLENGES = [
  { label: "Ouvrir 1 pack aujourd'hui", xp: "+10 XP", done: true, pct: 100 },
  { label: "1 carte Gold ou+", xp: "+20 XP", done: false, pct: 0 },
  { label: "Compléter 1 trade", xp: "+15 XP", done: false, pct: 0 },
];

export default function PackPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflowY: "auto", fontFamily: F.body, color: C.ink }}>
      <TopBar />

      {/* Hero pack section */}
      <div style={{ padding: "4px 14px 0", textAlign: "center", position: "relative" }}>
        {/* Eyebrow */}
        <div
          style={{
            fontFamily: F.mono,
            fontSize: 9,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: C.teal,
            textShadow: `0 0 6px ${C.teal}`,
          }}
        >
          ● PACK QUOTIDIEN PRÊT
        </div>

        {/* Card stack */}
        <div style={{ position: "relative", height: 180, marginTop: 8 }}>
          {/* glow */}
          <div
            style={{
              position: "absolute",
              inset: "50% auto auto 50%",
              width: 240,
              height: 240,
              transform: "translate(-50%, -50%)",
              background: "radial-gradient(circle, rgba(109,181,196,0.45) 0%, transparent 65%)",
              pointerEvents: "none",
            }}
          />
          {/* cards */}
          <div style={{ position: "absolute", inset: 0, display: "flex", justifyContent: "center", alignItems: "center" }}>
            {[3, 2, 1, 0].map((i) => {
              const rotate = (i - 1.5) * 6;
              const offX = (i - 1.5) * 22;
              const rarity = [R.SILVER, R.DIAMOND, R.ICON, R.GOLD][i];
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    transform: `translateX(${offX}px) rotate(${rotate}deg)`,
                    width: 96,
                    height: 144,
                    borderRadius: 10,
                    background: `linear-gradient(160deg, ${rarity.from}, ${rarity.to})`,
                    border: "1.5px solid rgba(255,255,255,0.3)",
                    boxShadow: `0 8px 20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.3), 0 0 18px ${rarity.glow}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: F.body,
                    fontSize: 50,
                    color: "#fff",
                    textShadow: "0 2px 6px rgba(0,0,0,0.5)",
                  }}
                >
                  ?
                </div>
              );
            })}
          </div>
        </div>

        {/* Pack info */}
        <div style={{ marginTop: 6 }}>
          <div style={{ fontFamily: F.body, fontSize: 22, fontWeight: 700, letterSpacing: "0.04em" }}>
            Pack standard · 5 cartes
          </div>
          <div style={{ fontFamily: F.mono, fontSize: 9, color: C.muted, marginTop: 2, letterSpacing: "0.1em" }}>
            DROP RATES · BRONZE 21% / SILV 38% / GOLD 31% / DIA 10% / ICON &lt;1%
          </div>
        </div>

        {/* CTA */}
        <div style={{ marginTop: 12 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              padding: "14px 22px",
              borderRadius: 8,
              background: `linear-gradient(180deg, ${C.teal} 0%, #3a8094 100%)`,
              border: "1px solid rgba(255,255,255,0.18)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12), 0 1px 2px rgba(0,0,0,0.4)",
              fontFamily: F.body,
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: "0.04em",
              color: "#0a1a1f",
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            Ouvrir
          </div>
        </div>
      </div>

      {/* Bonus pack + daily challenges */}
      <div style={{ padding: "14px 14px 0", display: "flex", gap: 8 }}>
        {/* Bonus pack */}
        <div
          style={{
            flex: 1,
            position: "relative",
            borderRadius: 12,
            padding: "10px 12px",
            background: C.panel,
            border: `1px solid ${C.border}`,
          }}
        >
          <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: C.gold }}>
            BONUS · PUB
          </div>
          <div style={{ fontFamily: F.body, fontSize: 18, fontWeight: 700, marginTop: 2 }}>02:47</div>
          <div style={{ fontFamily: F.mono, fontSize: 8.5, color: C.muted, letterSpacing: "0.1em" }}>RESTANT</div>
          <div style={{ marginTop: 8 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                padding: "7px 14px",
                borderRadius: 8,
                background: `linear-gradient(180deg, #d4b274 0%, #8a6128 100%)`,
                border: "1px solid rgba(255,255,255,0.18)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12), 0 1px 2px rgba(0,0,0,0.4)",
                fontFamily: F.body,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.04em",
                color: "#1c1408",
                cursor: "pointer",
              }}
            >
              + Pub
            </div>
          </div>
        </div>

        {/* Daily challenges */}
        <div
          style={{
            flex: 1,
            position: "relative",
            borderRadius: 12,
            padding: "10px 12px",
            background: C.panel,
            border: `1px solid ${C.border}`,
          }}
        >
          <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: C.muted }}>
            DÉFIS · 1/3
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 2 }}>
            <span style={{ fontFamily: F.body, fontSize: 22, fontWeight: 700 }}>33%</span>
          </div>
          <div style={{ marginTop: 4 }}>
            <XPBar pct={33} color="teal" height={5} />
          </div>
          <div style={{ fontFamily: F.mono, fontSize: 8.5, color: C.muted, marginTop: 8, letterSpacing: "0.1em" }}>
            RESET 5H 12M
          </div>
        </div>
      </div>

      {/* Streak */}
      <div style={{ padding: "14px 14px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: C.gold }}>
            STREAK · 12 JOURS
          </div>
          <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: C.muted }}>
            +2 = PACK BONUS
          </div>
        </div>
        <div style={{ display: "flex", gap: 3 }}>
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 28,
                borderRadius: 6,
                position: "relative",
                background: i <= 5 ? `linear-gradient(180deg, ${C.gold}, ${C.goldDk})` : "rgba(255,255,255,0.06)",
                border: `1px solid ${i <= 5 ? "rgba(255,255,255,0.3)" : C.border}`,
                boxShadow: i <= 5 ? "0 0 8px rgba(255,210,63,0.5), inset 0 1px 0 rgba(255,255,255,0.4)" : "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: F.body,
                fontSize: 11,
                fontWeight: 700,
                color: i <= 5 ? "#000" : C.faint,
              }}
            >
              {i}
              {i === 7 && (
                <span style={{ position: "absolute", top: -10, right: -4, fontSize: 12 }}>★</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Challenge list */}
      <div style={{ padding: "14px 14px 0" }}>
        {CHALLENGES.map((c, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 10px",
              marginBottom: 6,
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${C.border}`,
              borderRadius: 10,
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                background: c.done ? `linear-gradient(180deg, ${C.green}, #138a5b)` : "rgba(0,0,0,0.3)",
                border: `1px solid ${c.done ? "rgba(255,255,255,0.3)" : C.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontFamily: F.body,
                fontSize: 14,
                fontWeight: 700,
                boxShadow: c.done ? `0 0 8px ${C.green}88` : "none",
                flexShrink: 0,
              }}
            >
              {c.done ? "✓" : ""}
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontFamily: F.body,
                  fontSize: 12,
                  fontWeight: 700,
                  color: c.done ? C.faint : "#fff",
                  textDecoration: c.done ? "line-through" : "none",
                }}
              >
                {c.label}
              </div>
              <div style={{ marginTop: 3 }}>
                <XPBar pct={c.pct} color={c.done ? "teal" : "gold"} height={4} />
              </div>
            </div>
            <div
              style={{
                fontFamily: F.body,
                fontSize: 11,
                fontWeight: 700,
                color: C.gold,
                letterSpacing: "0.06em",
                flexShrink: 0,
              }}
            >
              {c.xp}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
