import { F, RarityTier, rarityChrome } from "../lib/tokens";
import { CategoryScores } from "../lib/cards";

export interface CardPortraitData {
  name?: string;
  overall?: number;
  role?: string;
  team?: string;
  teamShort?: string;
  teamRank?: number;
  imageUrl?: string | null;
  noPhoto?: boolean;
  categoryScores?: CategoryScores;
  nationality?: string;
}

const STAT_LABELS: [keyof CategoryScores, string][] = [
  ["firepower", "FIR"],
  ["opening", "OPN"],
  ["clutching", "CLU"],
  ["entrying", "ENT"],
  ["trading", "TRD"],
  ["impact", "IMP"],
];

function flagEmoji(code?: string): string {
  if (!code || code.length !== 2) return "";
  return Array.from(code.toUpperCase())
    .map((c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
    .join("");
}

export default function CardPortrait({
  p,
  tier = "GOLD",
  w = 260,
  h = 380,
}: {
  p?: CardPortraitData;
  tier?: RarityTier;
  w?: number | string;
  h?: number | string;
}) {
  const chrome = rarityChrome(tier);
  const showPhoto = p?.imageUrl && !p?.noPhoto;

  return (
    <div style={{ position: "relative", width: w, height: h }}>
      {/* glow halo */}
      <div
        style={{
          position: "absolute",
          inset: -8,
          background: `radial-gradient(ellipse, ${chrome.glow} 0%, transparent 70%)`,
          filter: "blur(10px)",
          opacity: 0.9,
        }}
      />

      {/* card body */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          background: chrome.bg,
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.18)",
          boxShadow: "0 16px 40px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.2)",
          overflow: "hidden",
          color: "#fff",
          fontFamily: F.body,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* sheen */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.09) 50%, transparent 70%)",
            pointerEvents: "none",
            zIndex: 3,
          }}
        />

        {/* PHOTO ZONE */}
        <div style={{ position: "relative", flex: "0 0 58%", overflow: "hidden" }}>
          {showPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p!.imageUrl!}
              alt={p?.name ?? ""}
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
                background: "repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0 6px, transparent 6px 12px)",
              }}
            />
          )}

          {/* bottom fade */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(0deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.15) 35%, transparent 60%)",
              pointerEvents: "none",
            }}
          />

          {/* TL — overall + tier */}
          <div style={{ position: "absolute", top: 10, left: 14, zIndex: 2 }}>
            <div
              style={{
                fontFamily: F.body,
                fontSize: 50,
                fontWeight: 800,
                lineHeight: 0.85,
                letterSpacing: "-0.04em",
                textShadow: "0 2px 8px rgba(0,0,0,0.75)",
              }}
            >
              {p?.overall ?? 84}
            </div>
            <div
              style={{
                fontFamily: F.body,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.18em",
                color: chrome.label,
                marginTop: 3,
                textShadow: "0 1px 3px rgba(0,0,0,0.7)",
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
              zIndex: 2,
            }}
          >
            {p?.nationality && (
              <div style={{ fontSize: 22, lineHeight: 1, marginBottom: 4 }}>
                {flagEmoji(p.nationality)}
              </div>
            )}
            <div
              style={{
                fontFamily: F.body,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.16em",
                textShadow: "0 1px 3px rgba(0,0,0,0.7)",
              }}
            >
              {(p?.role ?? "RIF").slice(0, 3).toUpperCase()}
            </div>
          </div>

          {/* BL — name + team · rank */}
          <div
            style={{
              position: "absolute",
              left: 14,
              right: 14,
              bottom: 10,
              zIndex: 2,
            }}
          >
            <div
              style={{
                fontFamily: F.body,
                fontSize: 26,
                fontWeight: 800,
                lineHeight: 1,
                letterSpacing: "-0.01em",
                textShadow: "0 2px 6px rgba(0,0,0,0.8)",
              }}
            >
              {p?.name ?? "donk"}
            </div>
            <div
              style={{
                fontFamily: F.mono,
                fontSize: 9.5,
                letterSpacing: "0.14em",
                opacity: 0.85,
                marginTop: 4,
                textShadow: "0 1px 2px rgba(0,0,0,0.7)",
              }}
            >
              {(p?.team ?? p?.teamShort ?? "SPI").toUpperCase()}
              {typeof p?.teamRank === "number" && p.teamRank < 999 && ` · #${p.teamRank}`}
            </div>
          </div>
        </div>

        {/* STATS ZONE — 3 × 2 grid */}
        <div
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "4px 0",
            padding: "14px 10px 16px",
            background: "rgba(0,0,0,0.3)",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            alignContent: "center",
          }}
        >
          {STAT_LABELS.map(([key, label]) => (
            <div key={key} style={{ textAlign: "center" }}>
              <div
                style={{
                  fontFamily: F.body,
                  fontSize: 18,
                  fontWeight: 800,
                  lineHeight: 1,
                  textShadow: "0 1px 3px rgba(0,0,0,0.6)",
                }}
              >
                {p?.categoryScores?.[key] ?? 0}
              </div>
              <div
                style={{
                  fontFamily: F.mono,
                  fontSize: 7.5,
                  letterSpacing: "0.14em",
                  opacity: 0.68,
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
  );
}
