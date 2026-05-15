import { C, F, RarityTier, rarityChrome } from "../lib/tokens";
import { CategoryScores } from "../lib/cards";

export interface CardData {
  name?: string;
  overall?: number;
  role?: string;
  teamShort?: string;
  imageUrl?: string | null;
  noPhoto?: boolean;
  categoryScores?: CategoryScores;
}

const STAT_LABELS: [keyof CategoryScores, string][] = [
  ["firepower", "FIR"],
  ["opening", "OPN"],
  ["clutching", "CLU"],
  ["entrying", "ENT"],
  ["trading", "TRD"],
  ["impact", "IMP"],
];

export default function MiniCard({
  p,
  tier = "GOLD",
  isNew = false,
  dim = false,
  w = 84 as number | string,
  h = 148 as number | string,
}: {
  p?: CardData;
  tier?: RarityTier;
  isNew?: boolean;
  dim?: boolean;
  w?: number | string;
  h?: number | string;
}) {
  const chrome = rarityChrome(tier);
  const showPhoto = p?.imageUrl && !p?.noPhoto;
  const hasStats = !!p?.categoryScores;

  return (
    <div style={{ position: "relative", width: w, height: h, opacity: dim ? 0.4 : 1, flexShrink: 0 }}>
      {/* glow halo */}
      <div
        style={{
          position: "absolute",
          inset: -4,
          background: `radial-gradient(ellipse, ${chrome.glow} 0%, transparent 65%)`,
          filter: "blur(6px)",
          opacity: 0.7,
        }}
      />

      {/* card body */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          borderRadius: 8,
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.16)",
          boxShadow: "0 6px 18px rgba(0,0,0,0.55)",
          background: chrome.bg,
          color: "#fff",
          fontFamily: F.body,
        }}
      >
        {/* full-bleed photo */}
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
              background: "repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0 4px, transparent 4px 10px)",
            }}
          />
        )}

        {/* dark gradient — transparent top, heavy bottom */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, transparent 22%, rgba(0,0,0,0.45) 58%, rgba(0,0,0,0.88) 100%)",
            pointerEvents: "none",
          }}
        />

        {/* subtle sheen */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(120deg, transparent 35%, rgba(255,255,255,0.07) 50%, transparent 65%)",
            pointerEvents: "none",
          }}
        />

        {/* TL — overall + tier */}
        <div style={{ position: "absolute", top: 7, left: 8 }}>
          <div
            style={{
              fontFamily: F.body,
              fontSize: 22,
              fontWeight: 800,
              lineHeight: 0.9,
              letterSpacing: "-0.03em",
              textShadow: "0 2px 6px rgba(0,0,0,0.7)",
            }}
          >
            {p?.overall ?? 84}
          </div>
          <div
            style={{
              fontFamily: F.body,
              fontSize: 6,
              fontWeight: 700,
              letterSpacing: "0.16em",
              color: chrome.label,
              marginTop: 2,
              textShadow: "0 1px 2px rgba(0,0,0,0.6)",
            }}
          >
            {tier}
          </div>
        </div>

        {/* TR — role */}
        <div style={{ position: "absolute", top: 9, right: 8, textAlign: "right" }}>
          <div
            style={{
              fontFamily: F.body,
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textShadow: "0 1px 3px rgba(0,0,0,0.7)",
            }}
          >
            {(p?.role ?? "RIF").slice(0, 3).toUpperCase()}
          </div>
        </div>

        {/* Bottom zone — name + team + stats */}
        <div
          style={{
            position: "absolute",
            left: 8,
            right: 8,
            bottom: 7,
          }}
        >
          <div
            style={{
              fontFamily: F.body,
              fontSize: 12,
              fontWeight: 800,
              lineHeight: 1,
              letterSpacing: "-0.01em",
              textShadow: "0 2px 4px rgba(0,0,0,0.8)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {p?.name ?? "donk"}
          </div>
          <div
            style={{
              fontFamily: F.mono,
              fontSize: 5.5,
              letterSpacing: "0.12em",
              opacity: 0.8,
              marginTop: 2,
              textShadow: "0 1px 2px rgba(0,0,0,0.7)",
            }}
          >
            {p?.teamShort ?? "SPI"}
          </div>

          {/* stats panel */}
          {hasStats && (
            <div
              style={{
                marginTop: 5,
                background: "rgba(0,0,0,0.52)",
                borderRadius: 4,
                border: "1px solid rgba(255,255,255,0.1)",
                padding: "4px 2px 4px",
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "3px 0",
              }}
            >
              {STAT_LABELS.map(([key, label]) => (
                <div key={key} style={{ textAlign: "center" }}>
                  <div
                    style={{
                      fontFamily: F.body,
                      fontSize: 10,
                      fontWeight: 800,
                      lineHeight: 1,
                      textShadow: "0 1px 2px rgba(0,0,0,0.6)",
                    }}
                  >
                    {p?.categoryScores?.[key] ?? 0}
                  </div>
                  <div
                    style={{
                      fontFamily: F.mono,
                      fontSize: 5,
                      letterSpacing: "0.1em",
                      opacity: 0.6,
                      marginTop: 1,
                    }}
                  >
                    {label}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* NEW badge */}
        {isNew && (
          <div
            style={{
              position: "absolute",
              top: 5,
              right: -1,
              zIndex: 3,
              background: C.crimson,
              color: "#fff",
              fontFamily: F.body,
              fontSize: 7.5,
              fontWeight: 800,
              letterSpacing: "0.12em",
              padding: "2px 5px",
              borderRadius: 2,
            }}
          >
            NEW
          </div>
        )}
      </div>
    </div>
  );
}
