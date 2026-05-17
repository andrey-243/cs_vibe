"use client";

import { useState, useMemo, useRef, useLayoutEffect, useEffect } from "react";
import { getOwnedIds, getOwnedCounts, bulkRemoveOwned } from "../lib/owned";
import { addGems } from "../lib/gems";
import { onCardsDecrafted } from "../lib/challenges";
import { C, F, R, RarityTier, GEM_COLORS, GEM_PACK_NAMES } from "../lib/tokens";
import { CardDisplay } from "../lib/cards";
import MiniCard from "../components/MiniCard";
import CardDetailModal from "../components/CardDetailModal";

const RARITY_ORDER: RarityTier[] = ["ICON", "DIAMOND", "GOLD", "SILVER", "BRONZE", "LEGACY"];

const GEM_TIER_KEYS = ["TOP5", "TOP15", "TOP25", "TOP50", "TOP75", "TOP100"] as const;
type GemTierKey = typeof GEM_TIER_KEYS[number];

function cardGemTier(teamRank: number | undefined): GemTierKey {
  if (!teamRank || teamRank > 100) return "TOP100";
  if (teamRank <= 5) return "TOP5";
  if (teamRank <= 15) return "TOP15";
  if (teamRank <= 25) return "TOP25";
  if (teamRank <= 50) return "TOP50";
  if (teamRank <= 75) return "TOP75";
  return "TOP100";
}

const GEM_BY_RARITY: Record<RarityTier, number> = {
  BRONZE: 5, SILVER: 12, GOLD: 30, DIAMOND: 75, ICON: 400, LEGACY: 30,
};

type GemPreviewRow = { tier: string; gems: number; cardCount: number; label: string; from: string };

function computeGemPreview(items: { card: CardDisplay; removeCount: number }[]): GemPreviewRow[] {
  const byTier = new Map<string, { gems: number; cardCount: number }>();
  for (const { card, removeCount } of items) {
    const gTier = cardGemTier(card.teamRank);
    const gAmt = (GEM_BY_RARITY[card.tier] ?? 5) * removeCount;
    const prev = byTier.get(gTier) ?? { gems: 0, cardCount: 0 };
    byTier.set(gTier, { gems: prev.gems + gAmt, cardCount: prev.cardCount + removeCount });
  }
  return GEM_TIER_KEYS
    .filter((t) => byTier.has(t))
    .map((t) => {
      const { gems, cardCount } = byTier.get(t)!;
      const [from] = GEM_COLORS[t] ?? ["#c9a565"];
      return { tier: t, gems, cardCount, label: GEM_PACK_NAMES[t] ?? t, from };
    });
}

const TIER_OPTIONS = GEM_TIER_KEYS.map((key) => ({
  value: key,
  label: GEM_PACK_NAMES[key] ?? key,
  color: GEM_COLORS[key]?.[0] ?? "#aaa",
}));

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

// ── Bulk uncraft confirmation modal ──────────────────────────────────────────

function BulkUncraftModal({
  title,
  cardCount,
  preview,
  onConfirm,
  onCancel,
}: {
  title: string;
  cardCount: number;
  preview: GemPreviewRow[];
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0, zIndex: 600,
        background: "rgba(3,3,8,0.88)",
        backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "32px 24px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 340,
          background: C.bg2, border: `1px solid ${C.borderHi}`,
          borderRadius: 16, padding: "24px 20px",
          display: "flex", flexDirection: "column", gap: 16,
        }}
      >
        {/* Title */}
        <div>
          <div style={{ fontFamily: F.body, fontSize: 15, fontWeight: 800, color: C.ink }}>
            {title}
          </div>
          <div style={{ fontFamily: F.mono, fontSize: 9, color: C.faint, marginTop: 4, letterSpacing: "0.08em" }}>
            {cardCount} carte{cardCount > 1 ? "s" : ""} à décraft
          </div>
        </div>

        {/* Gem preview */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontFamily: F.mono, fontSize: 8, color: C.faint, letterSpacing: "0.1em", marginBottom: 2 }}>
            GEMS OBTENUS
          </div>
          {preview.length > 0 ? preview.map(({ tier, gems, cardCount: cc, label, from }) => (
            <div key={tier} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 12px", borderRadius: 8,
              background: `${from}18`, border: `1px solid ${from}44`,
            }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: from, flexShrink: 0 }} />
              <div style={{ flex: 1, fontFamily: F.mono, fontSize: 9, fontWeight: 800, color: from, letterSpacing: "0.06em" }}>
                {label}
              </div>
              <div style={{ fontFamily: F.mono, fontSize: 8, color: C.faint, marginRight: 4 }}>
                ×{cc}
              </div>
              <div style={{ fontFamily: F.mono, fontSize: 11, fontWeight: 800, color: from }}>
                {gems} 💎
              </div>
            </div>
          )) : (
            <div style={{ fontFamily: F.mono, fontSize: 9, color: C.faint, textAlign: "center", padding: "8px 0" }}>
              Aucune gemme
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: "12px 0", borderRadius: 10,
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
              color: C.muted, fontFamily: F.body, fontSize: 12, fontWeight: 700,
              cursor: "pointer", touchAction: "manipulation",
            }}
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1, padding: "12px 0", borderRadius: 10,
              background: "rgba(184,80,96,0.2)", border: `1px solid ${C.crimson}`,
              color: "#ff8090", fontFamily: F.body, fontSize: 12, fontWeight: 700,
              cursor: "pointer", touchAction: "manipulation",
            }}
          >
            Confirmer
          </button>
        </div>
      </div>
    </div>
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
                team: c.team,
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
  const [mineExpanded, setMineExpanded] = useState(false);
  const [allExpanded, setAllExpanded] = useState(false);
  const [rarityFilter, setRarityFilter] = useState<RarityTier | "">("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [tierFilter, setTierFilter] = useState<GemTierKey | "">("");
  const [countryFilter, setCountryFilter] = useState("");
  const [page, setPage] = useState(0);
  const [cardW, setCardW] = useState(84);
  const [selected, setSelected] = useState<CardDisplay | null>(null);

  // Bulk uncraft state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState<"dupes" | "selection" | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set());
  const [ownedCounts, setOwnedCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const load = () => {
      setOwnedCounts(getOwnedCounts());
      setOwnedIds(getOwnedIds());
    };
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

  // All owned cards (unfiltered) — for dupes computation
  const allMineCards = useMemo(
    () => cards.filter((c) => (ownedCounts[c.player_id] ?? 0) > 0),
    [cards, ownedCounts]
  );

  // Filtered mine cards (respects active filters)
  const mineCards = useMemo(() => {
    let list = allMineCards;
    if (rarityFilter) list = list.filter((c) => c.tier === rarityFilter);
    if (categoryFilter) list = list.filter((c) => c.role === categoryFilter);
    if (tierFilter) list = list.filter((c) => cardGemTier(c.teamRank) === tierFilter);
    if (countryFilter) {
      if (MAJOR_COUNTRIES.has(countryFilter)) {
        list = list.filter((c) => c.nationality === countryFilter);
      } else if (countryFilter in REGIONS) {
        const regionSet = new Set(REGIONS[countryFilter].countries);
        list = list.filter((c) => regionSet.has(c.nationality));
      }
    }
    return list;
  }, [allMineCards, rarityFilter, categoryFilter, tierFilter, countryFilter]);

  const filteredAll = useMemo(() => {
    let list = cards;
    if (rarityFilter) list = list.filter((c) => c.tier === rarityFilter);
    if (categoryFilter) list = list.filter((c) => c.role === categoryFilter);
    if (tierFilter) list = list.filter((c) => cardGemTier(c.teamRank) === tierFilter);
    if (countryFilter) {
      if (MAJOR_COUNTRIES.has(countryFilter)) {
        list = list.filter((c) => c.nationality === countryFilter);
      } else if (countryFilter in REGIONS) {
        const regionSet = new Set(REGIONS[countryFilter].countries);
        list = list.filter((c) => regionSet.has(c.nationality));
      }
    }
    return list;
  }, [cards, rarityFilter, categoryFilter, tierFilter, countryFilter]);

  // Dupes: all owned cards with count > 1 (ignores filters — global cleanup)
  const dupesItems = useMemo(
    () => allMineCards
      .filter((c) => (ownedCounts[c.player_id] ?? 0) > 1)
      .map((c) => ({ card: c, removeCount: (ownedCounts[c.player_id] ?? 0) - 1 })),
    [allMineCards, ownedCounts]
  );
  const dupesCount = dupesItems.reduce((sum, { removeCount }) => sum + removeCount, 0);
  const dupesPreview = useMemo(() => computeGemPreview(dupesItems), [dupesItems]);

  // Selection: one copy per selected card
  const selectionItems = useMemo(
    () => Array.from(selectedIds)
      .map((id) => cards.find((c) => c.player_id === id))
      .filter((c): c is CardDisplay => !!c)
      .map((c) => ({ card: c, removeCount: 1 })),
    [selectedIds, cards]
  );
  const selectionPreview = useMemo(() => computeGemPreview(selectionItems), [selectionItems]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  function handleDupesConfirm() {
    const entries = dupesItems.map(({ card, removeCount }) => ({ id: card.player_id, count: removeCount }));
    bulkRemoveOwned(entries);
    for (const row of dupesPreview) addGems(row.tier, row.gems);
    onCardsDecrafted(dupesCount);
    setBulkConfirm(null);
  }

  function handleSelectionConfirm() {
    const entries = selectionItems.map(({ card }) => ({ id: card.player_id, count: 1 }));
    bulkRemoveOwned(entries);
    for (const row of selectionPreview) addGems(row.tier, row.gems);
    onCardsDecrafted(selectionItems.length);
    setBulkConfirm(null);
    exitSelectMode();
  }

  const hasActiveFilter = !!(rarityFilter || categoryFilter || tierFilter || countryFilter);
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
          value={tierFilter}
          onChange={(v) => applyFilter(() => setTierFilter(v as GemTierKey | ""))}
          placeholder="TIER"
          options={TIER_OPTIONS}
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
            onClick={() => { setRarityFilter(""); setCategoryFilter(""); setTierFilter(""); setCountryFilter(""); }}
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
        onToggle={() => { setMineExpanded((v) => !v); if (selectMode) exitSelectMode(); }}
      />

      {/* Action row — bulk tools */}
      {mineExpanded && allMineCards.length > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 14px",
          background: "rgba(255,255,255,0.02)",
          borderBottom: `1px solid ${C.border}`,
          flexShrink: 0,
        }}>
          {selectMode ? (
            <>
              <span style={{ flex: 1, fontFamily: F.mono, fontSize: 9, fontWeight: 800, color: C.teal, letterSpacing: "0.06em" }}>
                {selectedIds.size} sélectionnée{selectedIds.size > 1 ? "s" : ""}
              </span>
              <button
                onClick={exitSelectMode}
                style={{
                  padding: "5px 11px", borderRadius: 7,
                  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)",
                  fontFamily: F.mono, fontSize: 8, fontWeight: 800, color: C.muted,
                  cursor: "pointer", touchAction: "manipulation", letterSpacing: "0.06em",
                }}
              >
                ✕ ANNULER
              </button>
            </>
          ) : (
            <>
              {dupesCount > 0 && (
                <button
                  onClick={() => setBulkConfirm("dupes")}
                  style={{
                    padding: "5px 11px", borderRadius: 7,
                    background: "rgba(184,80,96,0.12)", border: `1px solid ${C.crimson}66`,
                    fontFamily: F.mono, fontSize: 8, fontWeight: 800, color: C.crimson,
                    cursor: "pointer", touchAction: "manipulation", letterSpacing: "0.06em",
                  }}
                >
                  DOUBLONS ×{dupesCount}
                </button>
              )}
              <button
                onClick={() => setSelectMode(true)}
                style={{
                  padding: "5px 11px", borderRadius: 7,
                  background: "rgba(109,181,196,0.1)", border: `1px solid ${C.teal}55`,
                  fontFamily: F.mono, fontSize: 8, fontWeight: 800, color: C.teal,
                  cursor: "pointer", touchAction: "manipulation", letterSpacing: "0.06em",
                }}
              >
                SÉLECTIONNER
              </button>
            </>
          )}
        </div>
      )}

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
            {mineCards.map((c) => {
              const isSelected = selectedIds.has(c.player_id);
              return (
                <div
                  key={c.player_id}
                  style={{ position: "relative", cursor: "pointer" }}
                  onClick={() => selectMode ? toggleSelect(c.player_id) : setSelected(c)}
                >
                  <MiniCard
                    p={{ name: c.name, overall: c.overall, role: c.role, team: c.team, teamShort: c.teamShort, imageUrl: c.image_url, noPhoto: c.no_photo, nationality: c.nationality, imageOffset: c.image_offset }}
                    tier={c.tier}
                    count={ownedCounts[c.player_id]}
                    w={cardW}
                    h={cardH}
                    onClick={undefined}
                  />
                  {selectMode && (
                    <div style={{
                      position: "absolute", inset: 0, borderRadius: 8, pointerEvents: "none",
                      border: isSelected ? `2px solid ${C.teal}` : `2px solid rgba(255,255,255,0.14)`,
                      background: isSelected ? `rgba(109,181,196,0.15)` : "rgba(0,0,0,0.18)",
                      transition: "all 0.1s",
                    }}>
                      <div style={{
                        position: "absolute", top: 5, right: 5,
                        width: 18, height: 18, borderRadius: "50%",
                        background: isSelected ? C.teal : "rgba(255,255,255,0.12)",
                        border: isSelected ? "none" : "1px solid rgba(255,255,255,0.3)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10, color: isSelected ? "#000" : "transparent",
                        fontWeight: 800, transition: "all 0.1s",
                      }}>
                        ✓
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
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

      {/* Floating selection action bar */}
      {selectMode && selectedIds.size > 0 && (
        <div style={{
          position: "fixed", bottom: 72, left: "50%", transform: "translateX(-50%)",
          zIndex: 310, width: "calc(100% - 32px)", maxWidth: 398,
          padding: "0 16px",
        }}>
          <button
            onClick={() => setBulkConfirm("selection")}
            style={{
              width: "100%", padding: "14px 0", borderRadius: 12,
              background: `linear-gradient(135deg, rgba(184,80,96,0.45), rgba(184,80,96,0.25))`,
              border: `1px solid ${C.crimson}`,
              color: "#ff8090", fontFamily: F.body, fontSize: 13, fontWeight: 800,
              letterSpacing: "0.05em", cursor: "pointer", touchAction: "manipulation",
              boxShadow: "0 4px 24px rgba(0,0,0,0.6)",
            }}
          >
            DÉCRAFT · {selectedIds.size} carte{selectedIds.size > 1 ? "s" : ""}
          </button>
        </div>
      )}

      {/* Detail modal */}
      <CardDetailModal
        card={
          selected
            ? {
                player_id: selected.player_id,
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
        ownedCount={selected ? (ownedCounts[selected.player_id] ?? 0) : 0}
        onClose={() => setSelected(null)}
      />

      {/* Bulk uncraft modals */}
      {bulkConfirm === "dupes" && (
        <BulkUncraftModal
          title="Décraft doublons"
          cardCount={dupesCount}
          preview={dupesPreview}
          onConfirm={handleDupesConfirm}
          onCancel={() => setBulkConfirm(null)}
        />
      )}
      {bulkConfirm === "selection" && (
        <BulkUncraftModal
          title="Décraft sélection"
          cardCount={selectedIds.size}
          preview={selectionPreview}
          onConfirm={handleSelectionConfirm}
          onCancel={() => setBulkConfirm(null)}
        />
      )}
    </div>
  );
}
