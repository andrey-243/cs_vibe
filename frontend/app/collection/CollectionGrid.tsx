"use client";

import { useState, useMemo, useRef, useEffect, useLayoutEffect } from "react";
import { C, F, R, RarityTier } from "../lib/tokens";
import { CardDisplay } from "../lib/cards";
import MiniCard from "../components/MiniCard";
import XPBar from "../components/XPBar";
import CardDetailModal from "../components/CardDetailModal";

const RARITY_ORDER: RarityTier[] = ["ICON", "DIAMOND", "GOLD", "SILVER", "BRONZE", "LEGACY"];

const ROLE_LABELS: Record<string, string> = {
  AWP: "AWPer",
  IGL: "IGL",
  RIF: "Rifler",
  ENT: "Entry Fragger",
  SUP: "Support",
  LRK: "Lurker",
};

// ── Custom dropdown ──────────────────────────────────────────────────────────

function FilterDropdown({
  value,
  onChange,
  placeholder,
  options,
  activeColor,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string; color?: string }[];
  activeColor?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOutside(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("touchstart", onOutside);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("touchstart", onOutside);
    };
  }, []);

  function handleToggle() {
    if (!open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    setOpen((v) => !v);
  }

  const selected = options.find((o) => o.value === value);
  const isActive = !!value;
  const triggerColor = isActive ? (selected?.color ?? activeColor ?? C.teal) : C.muted;

  return (
    <div ref={ref} style={{ flex: 1, position: "relative", minWidth: 0 }}>
      {/* trigger */}
      <button
        ref={triggerRef}
        onClick={handleToggle}
        style={{
          width: "100%",
          padding: "10px 20px 10px 9px",
          borderRadius: 8,
          background: isActive ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)",
          border: `1px solid ${isActive ? "rgba(255,255,255,0.22)" : C.border}`,
          fontFamily: F.mono,
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: "0.08em",
          color: triggerColor,
          textAlign: "left",
          cursor: "pointer",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          boxShadow: isActive ? `0 0 0 1px ${triggerColor}33` : "none",
          touchAction: "manipulation",
        }}
      >
        {selected?.label ?? placeholder}
      </button>
      <span style={{
        position: "absolute", right: 7, top: "50%", transform: `translateY(-50%) rotate(${open ? "180deg" : "0deg"})`,
        pointerEvents: "none", fontSize: 7, color: triggerColor, transition: "transform 0.15s",
      }}>▾</span>

      {/* dropdown list — position:fixed so it never extends the document */}
      {open && (
        <div className="filter-dd" style={{
          position: "fixed",
          top: pos.top,
          left: pos.left,
          width: pos.width,
          zIndex: 200,
          borderRadius: 8,
          border: `1px solid ${C.borderHi}`,
          boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
          background: C.bg2,
        }}>
          {/* clear option */}
          {isActive && (
            <button
              onClick={() => { onChange(""); setOpen(false); }}
              style={{
                width: "100%", padding: "8px 10px", background: "transparent",
                border: "none", borderBottom: `1px solid ${C.border}`,
                fontFamily: F.mono, fontSize: 8, fontWeight: 800, letterSpacing: "0.08em",
                color: C.faint, textAlign: "left", cursor: "pointer", touchAction: "manipulation",
              }}
            >
              — {placeholder}
            </button>
          )}
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              style={{
                width: "100%", padding: "12px 10px",
                background: value === opt.value ? "rgba(255,255,255,0.06)" : "transparent",
                border: "none", borderBottom: `1px solid ${C.border}`,
                fontFamily: F.mono, fontSize: 9, fontWeight: 800, letterSpacing: "0.08em",
                color: opt.color ?? C.ink, textAlign: "left", cursor: "pointer", touchAction: "manipulation",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── CollectionGrid ───────────────────────────────────────────────────────────

const PAGE_SIZE = 9;

const CARD_RATIO = 124 / 84; // height / width — matches grid design spec

export default function CollectionGrid({ cards }: { cards: CardDisplay[] }) {
  const [view, setView] = useState<"mine" | "all">("all");
  const [rarityFilter, setRarityFilter] = useState<RarityTier | "">("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [page, setPage] = useState(0);
  const [cardSize, setCardSize] = useState({ w: 84, h: 148 });
  const [selected, setSelected] = useState<CardDisplay | null>(null);
  const gridAreaRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = gridAreaRef.current;
    if (!el) return;
    const calc = () => {
      const GAP = 8;
      const COLS = 3;
      const ROWS = 3;
      const cellW = (el.offsetWidth - GAP * (COLS - 1)) / COLS;
      const cellH = (el.offsetHeight - GAP * (ROWS - 1)) / ROWS;
      const hFromW = cellW * CARD_RATIO;
      const w = hFromW <= cellH ? cellW : cellH / CARD_RATIO;
      const h = w * CARD_RATIO;
      setCardSize({ w: Math.floor(w), h: Math.floor(h) });
    };
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    return () => ro.disconnect();
  }, [view]);

  const rarityOptions = useMemo(
    () =>
      RARITY_ORDER.filter((r) => cards.some((c) => c.tier === r)).map((r) => ({
        value: r,
        label: r,
        color: R[r].from,
      })),
    [cards]
  );

  const categoryOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { value: string; label: string }[] = [];
    for (const c of cards) {
      if (!seen.has(c.role)) {
        seen.add(c.role);
        opts.push({ value: c.role, label: ROLE_LABELS[c.role] ?? c.role });
      }
    }
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, [cards]);

  const teamOptions = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of cards) {
      if (!map.has(c.team)) map.set(c.team, c.teamRank);
    }
    return [...map.entries()]
      .sort((a, b) => a[1] - b[1])
      .map(([team]) => ({ value: team, label: team }));
  }, [cards]);

  const filtered = useMemo(() => {
    if (view === "mine") return [];
    let list = cards;
    if (rarityFilter) list = list.filter((c) => c.tier === rarityFilter);
    if (categoryFilter) list = list.filter((c) => c.role === categoryFilter);
    if (teamFilter) list = list.filter((c) => c.team === teamFilter);
    return list;
  }, [view, cards, rarityFilter, categoryFilter, teamFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const displayed = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const hasActiveFilter = rarityFilter || categoryFilter || teamFilter;

  function applyFilter(fn: () => void) {
    fn();
    setPage(0);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
      {/* Header — barre de progression uniquement en mode "mine" */}
      {view === "mine" && (
        <div style={{ padding: "0 14px 8px" }}>
          <XPBar pct={0} color="teal" height={5} />
        </div>
      )}

      {/* Toggle */}
      <div style={{ display: "flex", gap: 6, padding: "0 14px 8px" }}>
        {(["all", "mine"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              flex: 1,
              textAlign: "center",
              padding: "12px 8px",
              borderRadius: 10,
              background: view === v ? "rgba(255,255,255,0.1)" : "transparent",
              border: `1px solid ${view === v ? C.borderHi : C.border}`,
              touchAction: "manipulation",
              fontFamily: F.body,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: view === v ? C.ink : C.muted,
              boxShadow: view === v ? `inset 0 1px 0 rgba(255,255,255,0.15), 0 0 10px ${C.teal}33` : "none",
              cursor: "pointer",
            }}
          >
            {v === "all" ? `Toutes · ${cards.length}` : "Mes cartes"}
          </button>
        ))}
      </div>

      {/* Filter dropdowns */}
      <div style={{ display: "flex", gap: 6, padding: "0 14px 10px", alignItems: "flex-start" }}>
        <FilterDropdown
          value={rarityFilter}
          onChange={(v) => applyFilter(() => setRarityFilter(v as RarityTier | ""))}
          placeholder="RARITY"
          options={rarityOptions}
        />
        <FilterDropdown
          value={categoryFilter}
          onChange={(v) => applyFilter(() => setCategoryFilter(v))}
          placeholder="ROLE"
          options={categoryOptions}
        />
        <FilterDropdown
          value={teamFilter}
          onChange={(v) => applyFilter(() => setTeamFilter(v))}
          placeholder="TEAM"
          options={teamOptions}
        />
        {hasActiveFilter && (
          <button
            onClick={() => { setRarityFilter(""); setCategoryFilter(""); setTeamFilter(""); setPage(0); }}
            style={{
              flexShrink: 0,
              padding: "7px 9px",
              borderRadius: 8,
              background: "rgba(184,80,96,0.15)",
              border: `1px solid ${C.crimson}`,
              fontFamily: F.mono,
              fontSize: 9,
              fontWeight: 800,
              color: C.crimson,
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Empty state — not logged in */}
      {view === "mine" && (
        <div style={{ padding: "48px 24px", textAlign: "center" }}>
          <div style={{ fontFamily: F.body, fontSize: 15, fontWeight: 700, color: C.muted, marginBottom: 8 }}>
            Connecte-toi pour voir ta collection
          </div>
          <div style={{ fontFamily: F.mono, fontSize: 10, color: C.faint, letterSpacing: "0.08em" }}>
            Auth à venir
          </div>
        </div>
      )}

      {/* Cards grid — remplit l'espace restant, cartes adaptatives */}
      {view === "all" && (
        <>
          <div
            ref={gridAreaRef}
            style={{
              flex: 1,
              minHeight: 0,
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gridTemplateRows: "repeat(3, 1fr)",
              gap: 8,
              padding: "4px 14px 0",
              alignItems: "center",
              justifyItems: "center",
            }}
          >
            {Array.from({ length: PAGE_SIZE }, (_, i) => {
              const c = displayed[i];
              return c ? (
                <MiniCard
                  key={c.player_id}
                  p={{ name: c.name, overall: c.overall, role: c.role, teamShort: c.teamShort, imageUrl: c.image_url, noPhoto: c.no_photo, nationality: c.nationality }}
                  tier={c.tier}
                  w={cardSize.w}
                  h={cardSize.h}
                  onClick={() => setSelected(c)}
                />
              ) : (
                <div key={i} style={{ width: cardSize.w, height: cardSize.h }} />
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 6,
                padding: "8px 14px 10px",
                flexShrink: 0,
              }}
            >
              <div style={{ fontFamily: F.mono, fontSize: 9, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", minWidth: 48 }}>
                {page + 1} / {totalPages}
              </div>
              <div style={{ display: "flex", gap: 5 }}>
                {([
                  { label: "−10", delta: -10, disabled: page < 10 },
                  { label: "Préc.", delta: -1,  disabled: page === 0 },
                  { label: "Suiv.", delta: +1,  disabled: page === totalPages - 1 },
                  { label: "+10", delta: +10, disabled: page >= totalPages - 10 },
                ] as { label: string; delta: number; disabled: boolean }[]).map(({ label, delta, disabled }) => (
                  <button
                    key={label}
                    onClick={() => setPage((p) => Math.min(totalPages - 1, Math.max(0, p + delta)))}
                    disabled={disabled}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      background: disabled ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.07)",
                      border: `1px solid ${disabled ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.15)"}`,
                      color: disabled ? "rgba(255,255,255,0.18)" : "#fff",
                      fontFamily: F.mono,
                      fontSize: 9,
                      fontWeight: 800,
                      letterSpacing: "0.06em",
                      cursor: disabled ? "default" : "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div style={{ minWidth: 48 }} />
            </div>
          )}
        </>
      )}

      {/* Detail modal — tap a card to expand into D · Portrait */}
      <CardDetailModal
        card={
          selected
            ? {
                name: selected.name,
                overall: selected.overall,
                role: selected.role,
                team: selected.team,
                teamShort: selected.teamShort,
                teamRank: selected.teamRank,
                imageUrl: selected.image_url,
                noPhoto: selected.no_photo,
                categoryScores: selected.category_scores,
                nationality: selected.nationality,
              }
            : null
        }
        tier={selected?.tier ?? "GOLD"}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
