import { F } from "../lib/tokens";

export default function Flag({
  code,
  width = 18,
  rounded = true,
  style,
}: {
  code?: string | null;
  width?: number;
  rounded?: boolean;
  style?: React.CSSProperties;
}) {
  if (!code) return null;
  const c = code.toLowerCase();
  const h = Math.round(width * 0.72);

  return (
    <span
      className={`fi fi-${c}`}
      aria-label={code.toUpperCase()}
      style={{
        display: "inline-block",
        width,
        height: h,
        borderRadius: rounded ? 2 : 0,
        boxShadow:
          "0 0 0 1px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(255,255,255,0.06)",
        verticalAlign: "middle",
        fontFamily: F.mono,
        backgroundSize: "cover",
        backgroundPosition: "center",
        ...style,
      }}
    />
  );
}
