"use client";
import { useState, useEffect } from "react";
import { C, F, rarityChrome } from "./lib/tokens";
import type { RarityTier } from "./lib/tokens";
import TopBar from "./components/TopBar";
import XPBar from "./components/XPBar";
import PackOpenModal, { type RevealCard } from "./components/PackOpenModal";
import { addOwnedIds } from "./lib/owned";
import { addXP, calcPackXP, PACK_MULTIPLIER } from "./lib/xp";

type PackType = "daily" | "bonus";

interface QueuedPack {
  id: string;
  type: PackType;
  endsAt: number;
  adsUsed: number;
  adsMax: number;
}

const FAN_RARITIES: RarityTier[] = ["SILVER", "GOLD", "DIAMOND", "ICON"];

function PackArt({ size = 52 }: { size?: number }) {
  const cardW = Math.round(size * 0.58);
  const cardH = Math.round(cardW * 1.476);
  return (
    <div style={{ position: "relative", width: size, height: cardH + 8, flexShrink: 0 }}>
      {FAN_RARITIES.map((rarity, i) => {
        const t = i - 1.5;
        const chrome = rarityChrome(rarity);
        return (
          <div
            key={rarity}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: cardW,
              height: cardH,
              marginLeft: -cardW / 2,
              marginTop: -cardH / 2,
              transform: `translateX(${t * 6}px) rotate(${t * 8}deg)`,
              borderRadius: 4,
              background: chrome.bg,
              border: "1px solid rgba(255,255,255,0.22)",
              boxShadow: `0 2px 6px rgba(0,0,0,0.45), 0 0 5px ${chrome.glow}`,
            }}
          />
        );
      })}
    </div>
  );
}

function formatMs(ms: number): string {
  if (ms <= 0) return "PRÊT";
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, "0")}s`;
  return `${sec}s`;
}

const CHALLENGES = [
  { label: "Ouvrir 1 pack aujourd'hui", xp: "+10 XP", done: true, pct: 100 },
  { label: "1 carte Gold ou+", xp: "+20 XP", done: false, pct: 0 },
  { label: "Compléter 1 trade", xp: "+15 XP", done: false, pct: 0 },
];


export default function PackPage() {
  const [now, setNow] = useState(() => Date.now());
  const [queue, setQueue] = useState<QueuedPack[]>(() => [
    { id: "daily-1", type: "daily", endsAt: Date.now(), adsUsed: 0, adsMax: 1 },
  ]);
  const [bonusNextAt, setBonusNextAt] = useState(0);
  const [dailyNextAt, setDailyNextAt] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [activePack, setActivePack] = useState<QueuedPack | null>(null);
  const [packCards, setPackCards] = useState<RevealCard[]>([]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  function skipWithAd(id: string) {
    setQueue((q) =>
      q.map((p) =>
        p.id === id && p.adsUsed < p.adsMax ? { ...p, endsAt: now, adsUsed: p.adsUsed + 1 } : p
      )
    );
  }

  async function openPack(id: string) {
    const pack = queue.find((p) => p.id === id);
    if (!pack) return;
    setActivePack(pack);

    let cards: RevealCard[] = [];
    try {
      const res = await fetch("/api/pack-open");
      if (res.ok) {
        const data = await res.json();
        cards = data.map((c: { player_id: string; name: string; overall: number; tier: string; role: string; teamShort: string; nationality: string; image_offset?: string; category_scores?: { firepower: number; opening: number; clutching: number; entrying: number; trading: number; impact: number } }) => ({
          player_id: c.player_id,
          name: c.name,
          ovr: c.overall,
          tier: c.tier,
          role: c.role,
          teamShort: c.teamShort,
          nationality: c.nationality,
          image_offset: c.image_offset,
          categoryScores: c.category_scores,
        }));
      }
    } catch {
      // fallback to a simple placeholder if API fails
      cards = [
        { tier: "SILVER", ovr: 50, name: "?" },
        { tier: "SILVER", ovr: 50, name: "?" },
        { tier: "SILVER", ovr: 50, name: "?" },
        { tier: "SILVER", ovr: 50, name: "?" },
        { tier: "SILVER", ovr: 50, name: "?" },
      ];
    }

    setPackCards(cards);
    setModalOpen(true);
  }

  function handleModalClose() {
    if (activePack?.type === "daily") setDailyNextAt(now + 12 * 3600 * 1000);
    setQueue((q) => q.filter((p) => p.id !== activePack?.id));
    setModalOpen(false);
    setActivePack(null);
  }

  function addBonusPack() {
    setQueue((q) => [
      ...q,
      { id: `bonus-${Date.now()}`, type: "bonus", endsAt: now + 3600 * 1000, adsUsed: 0, adsMax: 1 },
    ]);
    setBonusNextAt(now + 6 * 3600 * 1000);
  }

  const hasDailyInQueue = queue.some((p) => p.type === "daily");
  const hasBonusInQueue = queue.some((p) => p.type === "bonus");
  const bonusReady = now >= bonusNextAt;
  const canAddBonus = queue.length < 2 && !hasBonusInQueue && bonusReady;
  const bonusCooldownMs = bonusNextAt - now;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflowY: "auto", fontFamily: F.body, color: C.ink }}>
      <PackOpenModal
        open={modalOpen}
        packLabel={activePack?.type === "daily" ? "DAILY" : "BONUS"}
        cards={packCards}
        onClose={handleModalClose}
        packMultiplier={PACK_MULTIPLIER[activePack?.type ?? "daily"]}
        onCardsRevealed={(revealed) => {
          const ids = revealed.map((c) => c.player_id).filter(Boolean) as string[];
          if (ids.length) addOwnedIds(ids);
          const mult = PACK_MULTIPLIER[activePack?.type ?? "daily"];
          const earned = calcPackXP(revealed.map((c) => c.tier), mult);
          if (earned > 0) addXP(earned);
        }}
      />

      <TopBar />

      {/* File d'attente */}
      <div style={{ padding: "8px 14px 0" }}>
        <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: C.muted, marginBottom: 8 }}>
          FILE D'ATTENTE · {queue.length}/2
        </div>

        {queue.length === 0 && (
          <div style={{ textAlign: "center", padding: "16px 0", color: C.faint, fontFamily: F.mono, fontSize: 9, letterSpacing: "0.12em" }}>
            AUCUN PACK EN ATTENTE
          </div>
        )}

        {queue.map((pack) => {
          const remaining = pack.endsAt - now;
          const isReady = remaining <= 0;
          const canSkip = !isReady && pack.adsUsed < pack.adsMax;

          return (
            <div
              key={pack.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "11px 12px",
                marginBottom: 8,
                borderRadius: 12,
                background: isReady ? "linear-gradient(135deg, rgba(109,181,196,0.10), rgba(109,181,196,0.03))" : C.panel,
                border: `1px solid ${isReady ? "rgba(109,181,196,0.32)" : C.border}`,
                boxShadow: isReady ? "0 0 18px rgba(109,181,196,0.10)" : "none",
              }}
            >
              <PackArt size={48} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: F.mono, fontSize: 8, letterSpacing: "0.14em", textTransform: "uppercase", color: pack.type === "daily" ? C.teal : C.gold, marginBottom: 2 }}>
                  {pack.type === "daily" ? "QUOTIDIEN" : "BONUS PUB"}
                </div>
                <div style={{ fontFamily: F.body, fontSize: 14, fontWeight: 700 }}>
                  Pack standard · 5 cartes
                </div>
                <div style={{ fontFamily: F.mono, fontSize: isReady ? 12 : 11, fontWeight: 700, color: isReady ? C.teal : C.muted, letterSpacing: "0.08em", marginTop: 3, textShadow: isReady ? `0 0 10px ${C.teal}66` : "none" }}>
                  {isReady ? "✦ PRÊT" : formatMs(remaining)}
                </div>
              </div>

              {isReady ? (
                <button
                  onClick={() => openPack(pack.id)}
                  style={{ padding: "10px 14px", borderRadius: 8, background: `linear-gradient(180deg, ${C.teal} 0%, ${C.tealDk} 100%)`, border: "1px solid rgba(255,255,255,0.18)", boxShadow: `inset 0 1px 0 rgba(255,255,255,0.14), 0 0 14px rgba(109,181,196,0.25)`, fontFamily: F.body, fontSize: 13, fontWeight: 700, color: "#071318", cursor: "pointer", letterSpacing: "0.04em", whiteSpace: "nowrap", flexShrink: 0 }}
                >
                  Ouvrir →
                </button>
              ) : canSkip ? (
                <button
                  onClick={() => skipWithAd(pack.id)}
                  style={{ padding: "8px 10px", borderRadius: 8, background: "linear-gradient(180deg, #d4b274 0%, #8a6128 100%)", border: "1px solid rgba(255,255,255,0.18)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)", fontFamily: F.body, fontSize: 10, fontWeight: 700, color: "#1c1408", cursor: "pointer", letterSpacing: "0.04em", textAlign: "center", whiteSpace: "nowrap", lineHeight: 1.3, flexShrink: 0 }}
                >
                  ▶ Skip<br />1 pub
                </button>
              ) : (
                <div style={{ width: 50, textAlign: "center", fontFamily: F.mono, fontSize: 7.5, color: C.faint, letterSpacing: "0.08em", flexShrink: 0 }}>
                  AUCUN<br />SKIP
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Disponibilité */}
      {(!hasDailyInQueue || canAddBonus || (!bonusReady && !hasBonusInQueue)) && (
        <div style={{ padding: "0 14px" }}>
          {!hasDailyInQueue && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", marginBottom: 6, borderRadius: 10, background: "rgba(109,181,196,0.04)", border: "1px dashed rgba(109,181,196,0.18)" }}>
              <div>
                <div style={{ fontFamily: F.mono, fontSize: 8, letterSpacing: "0.14em", textTransform: "uppercase", color: C.muted, marginBottom: 1 }}>
                  PROCHAIN PACK QUOTIDIEN
                </div>
                <div style={{ fontFamily: F.mono, fontSize: 12, fontWeight: 700, color: C.muted, letterSpacing: "0.08em" }}>
                  {formatMs(dailyNextAt - now)}
                </div>
              </div>
            </div>
          )}

          {canAddBonus && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", marginBottom: 6, borderRadius: 10, background: "rgba(201,165,101,0.06)", border: "1px dashed rgba(201,165,101,0.22)" }}>
              <div>
                <div style={{ fontFamily: F.mono, fontSize: 8, letterSpacing: "0.14em", textTransform: "uppercase", color: C.gold, marginBottom: 1 }}>
                  BONUS DISPONIBLE
                </div>
                <div style={{ fontFamily: F.body, fontSize: 13, fontWeight: 600, marginBottom: 1 }}>
                  Pack bonus pub
                </div>
                <div style={{ fontFamily: F.mono, fontSize: 7.5, color: C.muted, letterSpacing: "0.1em" }}>
                  1 PUB POUR AJOUTER À LA FILE
                </div>
              </div>
              <button
                onClick={addBonusPack}
                style={{ padding: "9px 13px", borderRadius: 8, background: "linear-gradient(180deg, #d4b274 0%, #8a6128 100%)", border: "1px solid rgba(255,255,255,0.18)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)", fontFamily: F.body, fontSize: 11, fontWeight: 700, color: "#1c1408", cursor: "pointer", flexShrink: 0 }}
              >
                ▶ Pub
              </button>
            </div>
          )}

          {!bonusReady && !hasBonusInQueue && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", marginBottom: 6, borderRadius: 10, background: "rgba(201,165,101,0.03)", border: "1px dashed rgba(201,165,101,0.12)" }}>
              <div>
                <div style={{ fontFamily: F.mono, fontSize: 8, letterSpacing: "0.14em", textTransform: "uppercase", color: C.muted, marginBottom: 1 }}>
                  PROCHAIN BONUS
                </div>
                <div style={{ fontFamily: F.mono, fontSize: 12, fontWeight: 700, color: C.muted, letterSpacing: "0.08em" }}>
                  {formatMs(bonusCooldownMs)}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Défis + Streak */}
      <div style={{ padding: "14px 14px 0", display: "flex", gap: 8 }}>
        <div style={{ flex: 1, borderRadius: 12, padding: "10px 12px", background: C.panel, border: `1px solid ${C.border}` }}>
          <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: C.muted }}>
            DÉFIS · 1/3
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 2 }}>
            <span style={{ fontFamily: F.body, fontSize: 22, fontWeight: 700 }}>33%</span>
          </div>
          <div style={{ marginTop: 4 }}>
            <XPBar pct={33} color="teal" height={5} />
          </div>
          <div style={{ fontFamily: F.mono, fontSize: 8.5, color: C.muted, marginTop: 8, letterSpacing: "0.1em" }}>
            RESET 5H 12M
          </div>
        </div>

        <div style={{ flex: 1, borderRadius: 12, padding: "10px 12px", background: C.panel, border: `1px solid ${C.border}` }}>
          <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: C.gold }}>
            STREAK · 12J
          </div>
          <div style={{ display: "flex", gap: 2, marginTop: 6 }}>
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div
                key={i}
                style={{ flex: 1, height: 22, borderRadius: 4, background: i <= 5 ? `linear-gradient(180deg, ${C.gold}, ${C.goldDk})` : "rgba(255,255,255,0.06)", border: `1px solid ${i <= 5 ? "rgba(255,255,255,0.3)" : C.border}`, boxShadow: i <= 5 ? "0 0 6px rgba(255,210,63,0.4)" : "none" }}
              />
            ))}
          </div>
          <div style={{ fontFamily: F.mono, fontSize: 8, color: C.muted, marginTop: 4, letterSpacing: "0.1em" }}>
            +2 JOURS = PACK BONUS
          </div>
        </div>
      </div>

      {/* Liste challenges */}
      <div style={{ padding: "14px 14px 0" }}>
        {CHALLENGES.map((c, i) => (
          <div
            key={i}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", marginBottom: 6, background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 10 }}
          >
            <div
              style={{ width: 22, height: 22, borderRadius: 6, background: c.done ? `linear-gradient(180deg, ${C.green}, #138a5b)` : "rgba(0,0,0,0.3)", border: `1px solid ${c.done ? "rgba(255,255,255,0.3)" : C.border}`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: F.body, fontSize: 14, fontWeight: 700, boxShadow: c.done ? `0 0 8px ${C.green}88` : "none", flexShrink: 0 }}
            >
              {c.done ? "✓" : ""}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: F.body, fontSize: 12, fontWeight: 700, color: c.done ? C.faint : "#fff", textDecoration: c.done ? "line-through" : "none" }}>
                {c.label}
              </div>
              <div style={{ marginTop: 3 }}>
                <XPBar pct={c.pct} color={c.done ? "teal" : "gold"} height={4} />
              </div>
            </div>
            <div style={{ fontFamily: F.body, fontSize: 11, fontWeight: 700, color: C.gold, letterSpacing: "0.06em", flexShrink: 0 }}>
              {c.xp}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
