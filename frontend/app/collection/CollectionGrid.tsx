"use client";

import { useState, useMemo, useRef, useLayoutEffect, useEffect } from "react";
import { getOwnedIds } from "../lib/owned";
import { C, F, R, RarityTier } from "../lib/tokens";
import { CardDisplay } from "../lib/cards";
import MiniCard from "../components/MiniCard";
import CardDetailModal from "../components/CardDetailModal";

const RARITY_ORDER: RarityTier[] = ["ICON", "DIAMOND", "GOLD", "SILVER", "BRONZE", "LEGACY"];

const MAJOR_COUNTRIES = new Set([
  "RU","BR","DK","SE","UA","MN","PL","US","AR","CN",
  "AU","DE","FR","BY","RO","KZ","TR","GB","IL","PT",
  "BG","CA","ES","LV","CZ",
]);

const COUNTRY_NAMES: Record<string, string> = {
  RU: "Russie", BR: "Brésil", DK: "Danemark", SE: "Suède", UA: "Ukraine",
  MN: "Mongolie", PL: "Pologne", US: "États-Unis", AR: "Argentine", CN: "Chine",
  AU: "Australie", DE: "Allemagne", FR: "France", BY: "Biélorussie", RO: "Roumanie",
  KZ: "Kazakhstan", TR: "Turquie", GB: "Royaume-Uni", IL: "Israël", PT: "Portugal",
  BG: "Bulgarie", CA: "Canada", ES: "Espagne", LV: "Lettonie", CZ: "Tchéquie",
};

const REGIONS: Record<string, { label: string; countries: string[] }> = {
  EU_EST:       { label: "Europe Est",    countries: ["BA","EE","HR","HU","LT","ME","MK","RS","SK","XK"] },
  EU_NORD:      { label: "Europe Nord",   countries: ["FI","IS","NO"] },
  EU_OUEST:     { label: "Europe Ouest",  countries: ["BE","CH","NL"] },
  AMER_SUD:     { label: "Amér. du Sud",  countries: ["CL","GT","PE","UY"] },
  MOYEN_ORIENT: { label: "Moyen-Orient",  countries: ["IQ","JO","LB"] },
  OCEANIE:      { label: "Océanie",       countries: ["NZ"] },
  AFRIQUE:      { label: "Afrique",       countries: ["ZA"] },
  ASIE_CENT:    { label: "Asie Cent.",    countries: ["UZ"] },
};

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
  options: { value: string; label: string; color?: string; flag?: string }[];
  activeColor?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const ref = useRef<HTMLDivElement>(null);

  useState(() => {
    function onOutside(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("touchstart", onOutside);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("touchstart", onOutside);
    };
  });

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
        {selected?.flag && (
          <span className={`fi fi-${selected.flag}`} style={{ display: "inline-block", width: 14, height: 10, marginRight: 5, verticalAlign: "middle" }} />
        )}
        {selected?.label ?? placeholder}
      </button>
      <span style={{
        position: "absolute", right: 7, top: "50%", transform: `translateY(-50%) rotate(${open ? "180deg" : "0deg"})`,
        pointerEvents: "none", fontSize: 7, color: triggerColor, transition: "transform 0.15s",
      }}>▾</span>

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
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              {opt.flag && (
                <span className={`fi fi-${opt.flag}`} style={{ display: "inline-block", width: 16, height: 11, flexShrink: 0 }} />
              )}
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Section divider header ───────────────────────────────────────────────────

function SectionDivider({
  title,
  count,
  expanded,
  onToggle,
}: {
  title: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: "flex",
        alignItems: "center",
        width: "100%",
        padding: "11px 14px",
        background: "rgba(255,255,255,0.025)",
        border: "none",
        borderTop: `1px solid ${C.border}`,
        borderBottom: `1px solid ${C.border}`,
        cursor: "pointer",
        gap: 9,
        touchAction: "manipulation",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontSize: 7,
          color: C.teal,
          display: "inline-block",
          transition: "transform 0.18s",
          transform: expanded ? "rotate(0deg)" : "rotate(-90deg)",
          lineHeight: 1,
        }}
      >
        ▼
      </span>
      <span
        style={{
          fontFamily: F.body,
          fontSize: 12,
          fontWeight: 700,
          color: C.ink,
          flex: 1,
          textAlign: "left",
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </span>
      <span
        style={{
          fontFamily: F.mono,
          fontSize: 10,
          fontWeight: 800,
          color: C.teal,
          background: "rgba(47,212,178,0.1)",
          padding: "2px 8px",
          borderRadius: 20,
          letterSpacing: "0.04em",
        }}
      >
        {count}
      </span>
    </button>
  );
}

// ── Card grid ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 9;
const CARD_RATIO = 124 / 84;

function CardGrid({
  cards,
  ownedIds,
  cardW,
  cardH,
  page,
  onSelect,
}: {
  cards: CardDisplay[];
  ownedIds: Set<string>;
  cardW: number;
  cardH: number;
  page: number;
  onSelect: (c: CardDisplay) => void;
}) {
  const displayed = cards.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div style={{ padding: "8px 14px 0" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 8,
          justifyItems: "center",
        }}
      >
        {Array.from({ length: PAGE_SIZE }, (_, i) => {
          const c = displayed[i];
          return c ? (
            <MiniCard
              key={c.player_id}
              p={{
                name: c.name,
                overall: c.overall,
                role: c.role,
                teamShort: c.teamShort,
                imageUrl: c.image_url,
                noPhoto: c.no_photo,
                nationality: c.nationality,
                imageOffset: c.image_offset,
              }}
              tier={c.tier}
              w={cardW}
              h={cardH}
              locked={!ownedIds.has(c.player_id)}
              onClick={() => onSelect(c)}
            />
          ) : (
            <div key={i} style={{ width: cardW, height: cardH }} />
          );
        })}
      </div>
    </div>
  );
}

// ── CollectionGrid ───────────────────────────────────────────────────────────

export default function CollectionGrid({ cards, lootPoolCountries }: { cards: CardDisplay[]; lootPoolCountries: string[] }) {
  const [mineExpanded, setMineExpanded] = useState(true);
  const [allExpanded, setAllExpanded] = useState(true);
  const [rarityFilter, setRarityFilter] = useState<RarityTier | "">("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [page, setPage] = useState(0);
  const [cardW, setCardW] = useState(84);
  const [selected, setSelected] = useState<CardDisplay | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = () => setOwnedIds(getOwnedIds());
    load();
    window.addEventListener("csv-owned-updated", load);
    return () => window.removeEventListener("csv-owned-updated", load);
  }, []);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const calc = () => {
      const w = Math.floor((el.offsetWidth - 14 * 2 - 8 * 2) / 3);
      setCardW(w);
    };
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cardH = Math.floor(cardW * CARD_RATIO);

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

  const lootPoolSet = useMemo(() => new Set(lootPoolCountries), [lootPoolCountries]);

  const countryOptions = useMemo(() => {
    const countByNat = new Map<string, number>();
    for (const c of cards) {
      if (c.nationality) countByNat.set(c.nationality, (countByNat.get(c.nationality) ?? 0) + 1);
    }

    const individuals: { value: string; label: string; flag: string; _n: number }[] = [];
    for (const code of MAJOR_COUNTRIES) {
      if (lootPoolSet.has(code)) {
        individuals.push({ value: code, label: COUNTRY_NAMES[code] ?? code, flag: code.toLowerCase(), _n: countByNat.get(code) ?? 0 });
      }
    }
    individuals.sort((a, b) => b._n - a._n);

    const regions: { value: string; label: string; _n: number }[] = [];
    for (const [key, region] of Object.entries(REGIONS)) {
      const n = region.countries.reduce((sum, c) => sum + (countByNat.get(c) ?? 0), 0);
      if (region.countries.some((c) => lootPoolSet.has(c))) {
        regions.push({ value: key, label: region.label, _n: n });
      }
    }
    regions.sort((a, b) => b._n - a._n);

    return [
      ...individuals.map(({ _n: _, ...o }) => o),
      ...regions.map(({ _n: _, ...o }) => o),
    ];
  }, [lootPoolSet, cards]);

  const mineCards = useMemo(() => {
    let list = cards.filter((c) => ownedIds.has(c.player_id));
    if (rarityFilter) list = list.filter((c) => c.tier === rarityFilter);
    if (categoryFilter) list = list.filter((c) => c.role === categoryFilter);
    if (teamFilter) list = list.filter((c) => c.team === teamFilter);
    if (countryFilter) {
      if (MAJOR_COUNTRIES.has(countryFilter)) {
        list = list.filter((c) => c.nationality === countryFilter);
      } else if (countryFilter in REGIONS) {
        const regionSet = new Set(REGIONS[countryFilter].countries);
        list = list.filter((c) => regionSet.has(c.nationality));
      }
    }
    return list;
  }, [cards, ownedIds, rarityFilter, categoryFilter, teamFilter, countryFilter]);

  const filteredAll = useMemo(() => {
    let list = cards;
    if (rarityFilter) list = list.filter((c) => c.tier === rarityFilter);
    if (categoryFilter) list = list.filter((c) => c.role === categoryFilter);
    if (teamFilter) list = list.filter((c) => c.team === teamFilter);
    if (countryFilter) {
      if (MAJOR_COUNTRIES.has(countryFilter)) {
        list = list.filter((c) => c.nationality === countryFilter);
      } else if (countryFilter in REGIONS) {
        const regionSet = new Set(REGIONS[countryFilter].countries);
        list = list.filter((c) => regionSet.has(c.nationality));
      }
    }
    return list;
  }, [cards, rarityFilter, categoryFilter, teamFilter, countryFilter]);

  const hasActiveFilter = !!(rarityFilter || categoryFilter || teamFilter || countryFilter);

  const totalPages = Math.ceil(filteredAll.length / PAGE_SIZE);

  function applyFilter(fn: () => void) { fn(); setPage(0); }

  return (
    <div
      ref={containerRef}
      style={{ display: "flex", flexDirection: "column", flex: 1, overflowY: "auto" }}
    >
      {/* Filters */}
      <div style={{ display: "flex", gap: 6, padding: "6px 14px 10px", alignItems: "flex-start" }}>
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
        {countryOptions.length > 0 && (
          <FilterDropdown
            value={countryFilter}
            onChange={(v) => applyFilter(() => setCountryFilter(v))}
            placeholder="PAYS"
            options={countryOptions}
          />
        )}
        {hasActiveFilter && (
          <button
            onClick={() => { setRarityFilter(""); setCategoryFilter(""); setTeamFilter(""); setCountryFilter(""); }}
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

      {/* Section: Mes cartes */}
      <SectionDivider
        title="Mes cartes"
        count={mineCards.length}
        expanded={mineExpanded}
        onToggle={() => setMineExpanded((v) => !v)}
      />
      {mineExpanded && (
        mineCards.length === 0 ? (
          <div style={{ padding: "32px 24px", textAlign: "center" }}>
            <div style={{ fontFamily: F.body, fontSize: 13, fontWeight: 700, color: C.muted, marginBottom: 6 }}>
              Connecte-toi pour voir ta collection
            </div>
            <div style={{ fontFamily: F.mono, fontSize: 9, color: C.faint, letterSpacing: "0.08em" }}>
              Auth à venir
            </div>
          </div>
        ) : (
          <div style={{ padding: "8px 14px 0", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, justifyItems: "center" }}>
            {mineCards.map((c) => (
              <MiniCard
                key={c.player_id}
                p={{ name: c.name, overall: c.overall, role: c.role, teamShort: c.teamShort, imageUrl: c.image_url, noPhoto: c.no_photo, nationality: c.nationality, imageOffset: c.image_offset }}
                tier={c.tier}
                w={cardW}
                h={cardH}
                onClick={() => setSelected(c)}
              />
            ))}
          </div>
        )
      )}

      {/* Section: Toutes */}
      <SectionDivider
        title="Toutes"
        count={filteredAll.length}
        expanded={allExpanded}
        onToggle={() => setAllExpanded((v) => !v)}
      />
      {allExpanded && (
        <CardGrid
          cards={filteredAll}
          ownedIds={ownedIds}
          cardW={cardW}
          cardH={cardH}
          page={page}
          onSelect={setSelected}
        />
      )}

      {/* Pagination unique — commune aux deux sections */}
      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 6,
            padding: "12px 14px 6px",
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

      {/* Bottom spacer */}
      <div style={{ height: 16, flexShrink: 0 }} />

      {/* Detail modal */}
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
                imageOffset: selected.image_offset,
              }
            : null
        }
        tier={selected?.tier ?? "GOLD"}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
