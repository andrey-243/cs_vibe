import { C } from "../lib/tokens";

type XPBarColor = "gold" | "teal" | "crimson";

const PALETTE: Record<XPBarColor, [string, string]> = {
  gold: [C.gold, C.goldDk],
  teal: [C.teal, C.tealDk],
  crimson: [C.crimson, C.majorDk],
};

export default function XPBar({
  pct = 64,
  color = "gold",
  height = 6,
}: {
  pct?: number;
  color?: XPBarColor;
  height?: number;
}) {
  const [a, b] = PALETTE[color];
  return (
    <div
      style={{
        height,
        background: "rgba(0,0,0,0.35)",
        borderRadius: height,
        position: "relative",
        overflow: "hidden",
        border: `1px solid ${C.border}`,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${a} 0%, ${b} 100%)`,
          borderRadius: height,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "40%",
            background: "linear-gradient(180deg, rgba(255,255,255,0.18), transparent)",
            borderRadius: height,
          }}
        />
      </div>
    </div>
  );
}
