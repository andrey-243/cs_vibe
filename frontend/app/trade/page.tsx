import { C, F } from "../lib/tokens";
import TopBar from "../components/TopBar";

export default function TradePage() {
  const pendingMatches: { id: string; cardA: string; cardB: string; expiresIn: string }[] = [];
  const wantList: string[] = [];
  const offerList: string[] = [];
  const slots = { used: 0, total: 6 };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", fontFamily: F.body, color: C.ink }}>
      <TopBar />

      {/* Header */}
      <div style={{ padding: "0 14px 6px" }}>
        <div style={{ fontFamily: F.body, fontSize: 28, fontWeight: 800, letterSpacing: "0.04em" }}>Trade</div>
        <div style={{ fontFamily: F.mono, fontSize: 9.5, color: C.muted, letterSpacing: "0.12em" }}>
          MARCHÉ PASSIF · {slots.used} SLOTS / {slots.total}
        </div>
      </div>

      {/* Match alert — only shown if there are pending matches */}
      {pendingMatches.map((m) => (
        <div
          key={m.id}
          style={{
            margin: "4px 14px 0",
            position: "relative",
            borderRadius: 14,
            padding: "12px 14px",
            background: `linear-gradient(135deg, ${C.crimson} 0%, #6b0a3d 100%)`,
            border: "1.5px solid rgba(255,255,255,0.3)",
            boxShadow: `0 6px 20px rgba(184,80,96,0.5), inset 0 1px 0 rgba(255,255,255,0.3)`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 6, height: 6, borderRadius: 3, background: "#fff", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: F.mono, fontSize: 8.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.9)" }}>
                ● 1 MATCH EN ATTENTE
              </div>
              <div style={{ fontFamily: F.body, fontSize: 14, fontWeight: 700, marginTop: 1 }}>
                {m.cardA} ↔ {m.cardB}
              </div>
              <div style={{ fontFamily: F.mono, fontSize: 9, opacity: 0.85, marginTop: 2 }}>Expire en {m.expiresIn}</div>
            </div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "7px 14px",
                borderRadius: 8,
                background: `linear-gradient(180deg, #d4b274 0%, #8a6128 100%)`,
                border: "1px solid rgba(255,255,255,0.18)",
                fontFamily: F.body,
                fontSize: 11,
                fontWeight: 700,
                color: "#1c1408",
                cursor: "pointer",
              }}
            >
              Voir
            </div>
          </div>
        </div>
      ))}

      {/* Slot status */}
      <div style={{ display: "flex", gap: 6, padding: "12px 14px 6px" }}>
        {([
          ["SLOTS", `${slots.used}/${slots.total}`, C.teal],
          ["PUBS", "2", C.gold],
          ["LEG/MOIS", "0/3", "#fff"],
        ] as const).map(([k, v, col]) => (
          <div
            key={k}
            style={{
              flex: 1,
              padding: "8px 10px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.05)",
              border: `1px solid ${C.border}`,
              textAlign: "center",
            }}
          >
            <div style={{ fontFamily: F.body, fontSize: 16, fontWeight: 700, color: col }}>{v}</div>
            <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: C.muted, marginTop: 1 }}>
              {k}
            </div>
          </div>
        ))}
      </div>

      {/* Want / Have split */}
      <div style={{ flex: 1, display: "flex", padding: "6px 14px 14px", gap: 8 }}>
        {/* Je veux */}
        <div
          style={{
            flex: 1,
            borderRadius: 12,
            padding: "10px 8px",
            background: "rgba(184,80,96,0.08)",
            border: `1px solid ${C.crimson}44`,
          }}
        >
          <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: C.crimson }}>
            ● JE VEUX · {wantList.length}/5
          </div>
          {wantList.length === 0 && (
            <div style={{ marginTop: 16, textAlign: "center" }}>
              <div style={{ fontFamily: F.body, fontSize: 12, color: C.faint, lineHeight: 1.4 }}>
                Tag une carte en wishlist depuis ta collection
              </div>
              <div
                style={{
                  marginTop: 12,
                  width: 62,
                  height: 92,
                  borderRadius: 8,
                  border: `1.5px dashed ${C.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: F.body,
                  fontSize: 22,
                  fontWeight: 700,
                  color: C.faint,
                  margin: "12px auto 0",
                }}
              >
                +
              </div>
            </div>
          )}
        </div>

        {/* J'offre */}
        <div
          style={{
            flex: 1,
            borderRadius: 12,
            padding: "10px 8px",
            background: "rgba(109,181,196,0.08)",
            border: `1px solid ${C.teal}44`,
          }}
        >
          <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: C.teal }}>
            ● J'OFFRE · {offerList.length}
          </div>
          {offerList.length === 0 && (
            <div style={{ marginTop: 16, textAlign: "center" }}>
              <div style={{ fontFamily: F.body, fontSize: 12, color: C.faint, lineHeight: 1.4 }}>
                Tag une carte "à trader" depuis ta collection
              </div>
              <div
                style={{
                  marginTop: 12,
                  width: 62,
                  height: 92,
                  borderRadius: 8,
                  border: `1.5px dashed ${C.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: F.body,
                  fontSize: 22,
                  fontWeight: 700,
                  color: C.faint,
                  margin: "12px auto 0",
                }}
              >
                +
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
