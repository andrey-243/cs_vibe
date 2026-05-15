"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { C, F } from "../lib/tokens";

const tabs = [
  {
    href: "/",
    label: "Packs",
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18, color: active ? C.ink : C.faint }}>
        <rect x="5" y="3" width="14" height="18" rx="2" />
        <path d="M9 8h6M9 12h6M9 16h4" />
      </svg>
    ),
  },
  {
    href: "/collection",
    label: "Coll.",
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18, color: active ? C.ink : C.faint }}>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    href: "/trade",
    label: "Trade",
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18, color: active ? C.ink : C.faint }}>
        <path d="M3 8h14l-4-4M21 16H7l4 4" />
      </svg>
    ),
  },
  {
    href: "/profil",
    label: "Profil",
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18, color: active ? C.ink : C.faint }}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 22a8 8 0 0116 0" />
      </svg>
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px]"
      style={{
        zIndex: 300,
        padding: "8px 8px 14px",
        background: "linear-gradient(180deg, rgba(0,0,0,0.0) 0%, rgba(0,0,0,0.55) 100%)",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div style={{ display: "flex", gap: 4 }}>
        {tabs.map(({ href, label, icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              style={{
                flex: "1 1 0",
                minWidth: 0,
                position: "relative",
                textAlign: "center",
                padding: "6px 2px 4px",
                borderRadius: 8,
                background: active ? "rgba(255,255,255,0.06)" : "transparent",
                border: active ? "1px solid rgba(255,255,255,0.1)" : "1px solid transparent",
                textDecoration: "none",
              }}
            >
              {/* teal top indicator */}
              {active && (
                <div
                  style={{
                    position: "absolute",
                    top: -1,
                    left: "35%",
                    right: "35%",
                    height: 1.5,
                    background: C.teal,
                    borderRadius: 1,
                  }}
                />
              )}
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 2 }}>
                {icon(active)}
              </div>
              <div
                style={{
                  fontFamily: F.body,
                  fontSize: 9.5,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  color: active ? C.ink : C.faint,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
