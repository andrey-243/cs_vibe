import { GEM_COLORS } from "../lib/tokens";

export default function Gem({ tier = "TOP25", size = 12 }: { tier?: string; size?: number }) {
  const [a, b] = GEM_COLORS[tier] ?? GEM_COLORS.TOP25;
  return (
    <span
      style={{
        display: "inline-block",
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${a} 0%, ${b} 100%)`,
        transform: "rotate(45deg)",
        borderRadius: 2,
        boxShadow: "inset 0 0 0 0.5px rgba(255,255,255,0.3)",
        verticalAlign: "middle",
        flexShrink: 0,
      }}
    />
  );
}
