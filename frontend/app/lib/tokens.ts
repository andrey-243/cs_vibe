export const C = {
  bg0: "#0a0a0d",
  bg1: "#14141c",
  bg2: "#1c1c2a",
  panel: "rgba(255,255,255,0.045)",
  panelHi: "rgba(255,255,255,0.085)",
  border: "rgba(255,255,255,0.09)",
  borderHi: "rgba(255,255,255,0.18)",
  ink: "#f3f3f5",
  muted: "rgba(243,243,245,0.58)",
  faint: "rgba(243,243,245,0.34)",
  teal: "#6db5c4",
  tealDk: "#2c5c6c",
  gold: "#c9a565",
  goldDk: "#705028",
  crimson: "#b85060",
  green: "#7fb893",
  major: "#a83b50",
  majorDk: "#5c1828",
  majorGlow: "rgba(168,59,80,0.28)",
};

export const R = {
  BRONZE: { from: "#a06a3b", to: "#3e2510", glow: "rgba(160,106,59,0.22)", label: "#e0c6a3" },
  SILVER: { from: "#aab4c0", to: "#3e4654", glow: "rgba(170,180,192,0.20)", label: "#e6ebf2" },
  GOLD: { from: "#c9a565", to: "#6f4d1a", glow: "rgba(201,165,101,0.28)", label: "#f0dba8" },
  DIAMOND: { from: "#6da4c4", to: "#1f3a5a", glow: "rgba(109,164,196,0.28)", label: "#c4dff0" },
  ICON: { from: "#b89cd4", to: "#3f2860", glow: "rgba(184,156,212,0.32)", label: "#e0d2f0" },
  LEGACY: { from: "#8a8a92", to: "#2c2c34", glow: "rgba(138,138,146,0.18)", label: "#cccccd" },
} as const;

export type RarityTier = keyof typeof R;

export const GEM_COLORS: Record<string, [string, string]> = {
  TOP5: ["#b89cd4", "#3f2860"],
  TOP15: ["#6da4c4", "#1f3a5a"],
  TOP25: ["#7fb893", "#2a5e3c"],
  TOP50: ["#c9a565", "#705028"],
  TOP75: ["#aab4c0", "#3e4654"],
  TOP100: ["#a06a3b", "#3e2510"],
};

export function rarityChrome(tier: RarityTier) {
  const r = R[tier] ?? R.GOLD;
  return {
    bg: `linear-gradient(160deg, ${r.from} 0%, ${r.to} 100%)`,
    glow: r.glow,
    label: r.label,
  };
}

export const F = {
  body: '"Manrope", -apple-system, system-ui, sans-serif',
  mono: '"Space Mono", ui-monospace, monospace',
};
