"use client";
import { useState, useEffect } from "react";
import { C, F, rarityChrome } from "./lib/tokens";
import type { RarityTier } from "./lib/tokens";
import TopBar from "./components/TopBar";
import XPBar from "./components/XPBar";
import Flag from "./components/Flag";
import PackOpenModal, { type RevealCard } from "./components/PackOpenModal";
import { addOwnedIds, getOwnedCounts } from "./lib/owned";
import { addXP, calcPackXP, PACK_MULTIPLIER } from "./lib/xp";
import {
  getChallengesWithState,
  onPackOpened,
  onCardsObtained,
  type ChallengeWithState,
} from "./lib/challenges";
import {
  getStreak,
  touchStreak,
  claimMilestonePack,
  getStreakTier,
  skipTimerCheckpoints,
  STREAK_TIERS,
  type StreakState,
} from "./lib/streak";

type PackType = "daily" | "ads" | "milestone";

interface QueuedPack {
  id: string;
  type: PackType;
  endsAt: number;
  initialDuration: number; // ms — used to look up skip checkpoints
  adsUsed: number;
  adsMax: number;          // total pubs needed to reach instant
  claimed: boolean;        // false = pack available to claim, true = timer running
}

const PACK_TIMER_MS = 60 * 60 * 1000; // 1h opening timer for standard packs

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

function makeDailyPack(idx: number): QueuedPack {
  const checkpoints = skipTimerCheckpoints(PACK_TIMER_MS);
  return {
    id: `daily-${idx}`,
    type: "daily",
    endsAt: 0,
    initialDuration: PACK_TIMER_MS,
    adsUsed: 0,
    adsMax: checkpoints.length,
    claimed: false, // must be claimed before timer starts
  };
}

export default function PackPage() {
  const [now, setNow] = useState(() => Date.now());
  const [streakState, setStreakState] = useState<StreakState>({ streak: 0, lastLoginDate: "", milestonePacks: 0 });
  // Daily queue: grows with streak tier
  const [dailyQueue, setDailyQueue] = useState<QueuedPack[]>([]);
  // Ads queue: always 1 fixed slot
  const [adsQueue, setAdsQueue] = useState<QueuedPack[]>([]);
  const [adsNextAt, setAdsNextAt] = useState(0);
  const [dailyNextAt, setDailyNextAt] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [activePack, setActivePack] = useState<{ pack: QueuedPack; isAds: boolean } | null>(null);
  const [packCards, setPackCards] = useState<RevealCard[]>([]);
  const [challenges, setChallenges] = useState<ChallengeWithState[]>(() =>
    typeof window !== "undefined" ? getChallengesWithState() : []
  );

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Touch streak once on mount, init queues based on resulting streak tier
  useEffect(() => {
    touchStreak();
    const state = getStreak();
    setStreakState(state);
    const tier = getStreakTier(state.streak);
    setDailyQueue(Array.from({ length: tier.dailySlots }, (_, i) => makeDailyPack(i + 1)));
  }, []);

  useEffect(() => {
    const refresh = () => setChallenges(getChallengesWithState());
    refresh();
    window.addEventListener("csv-challenges-updated", refresh);
    return () => window.removeEventListener("csv-challenges-updated", refresh);
  }, []);

  function claimPack(pack: QueuedPack, isAds: boolean) {
    const updated = { ...pack, claimed: true, endsAt: now + PACK_TIMER_MS };
    if (isAds) {
      setAdsQueue((q) => q.map((p) => (p.id === pack.id ? updated : p)));
    } else {
      setDailyQueue((q) => q.map((p) => (p.id === pack.id ? updated : p)));
    }
  }

  // Skip timer: incremental — each pub reduces to next checkpoint
  function skipWithAd(pack: QueuedPack, isAds: boolean) {
    const checkpoints = skipTimerCheckpoints(pack.initialDuration);
    const nextMs = checkpoints[pack.adsUsed] ?? 0;
    const updated: QueuedPack = {
      ...pack,
      endsAt: nextMs === 0 ? now : now + nextMs,
      adsUsed: pack.adsUsed + 1,
    };
    if (isAds) {
      setAdsQueue((q) => q.map((p) => (p.id === pack.id ? updated : p)));
    } else {
      setDailyQueue((q) => q.map((p) => (p.id === pack.id ? updated : p)));
    }
  }

  async function openPack(pack: QueuedPack, isAds: boolean) {
    setActivePack({ pack, isAds });
    const existingCounts = getOwnedCounts();
    let cards: RevealCard[] = [];
    try {
      const typeParam = isAds ? "&type=ads" : "";
      const res = await fetch(`/api/pack-open?streakDays=${streakState.streak}${typeParam}`);
      if (res.ok) {
        const data = await res.json();
        cards = data.map((c: {
          player_id: string; name: string; overall: number; tier: string;
          role: string; teamShort: string; nationality: string;
          image_offset?: string; teamRank?: number;
          category_scores?: { firepower: number; opening: number; clutching: number; entrying: number; trading: number; impact: number };
        }) => {
          const stock = c.player_id ? (existingCounts[c.player_id] ?? 0) : 0;
          return {
            player_id: c.player_id,
            name: c.name,
            ovr: c.overall,
            tier: c.tier,
            role: c.role,
            teamShort: c.teamShort,
            nationality: c.nationality,
            image_offset: c.image_offset,
            teamRank: c.teamRank,
            categoryScores: c.category_scores,
            isNew: stock === 0,
            stockCount: stock,
          };
        });
      }
    } catch {
      cards = Array(5).fill({ tier: "SILVER", ovr: 50, name: "?" });
    }
    setPackCards(cards);
    setModalOpen(true);
  }

  function handleModalClose() {
    if (!activePack) return;
    const { pack, isAds } = activePack;
    if (isAds) {
      setAdsQueue((q) => q.filter((p) => p.id !== pack.id));
    } else {
      setDailyQueue((q) => {
        const next = q.filter((p) => p.id !== pack.id);
        if (!next.some((p) => p.type === "daily")) {
          setDailyNextAt(now + getStreakTier(streakState.streak).spawnIntervalH * 3600 * 1000);
        }
        return next;
      });
    }
    setModalOpen(false);
    setActivePack(null);
  }

  function addAdsPack() {
    const checkpoints = skipTimerCheckpoints(PACK_TIMER_MS);
    setAdsQueue([{
      id: `ads-${Date.now()}`,
      type: "ads",
      endsAt: now + PACK_TIMER_MS,
      initialDuration: PACK_TIMER_MS,
      adsUsed: 0,
      adsMax: checkpoints.length,
      claimed: true, // ads timer starts immediately on add
    }]);
    setAdsNextAt(now + 6 * 3600 * 1000);
  }

  // Derived state
  const tier = getStreakTier(streakState.streak);
  const dailyQueueMax = tier.dailySlots;
  const dailiesInQueue = dailyQueue.filter((p) => p.type === "daily" || p.type === "milestone").length;
  const hasAdsPack = adsQueue.length > 0;
  const adsReady = now >= adsNextAt;
  const canAddAds = !hasAdsPack && adsReady;
  const adsCooldownMs = adsNextAt - now;

  // Next streak tier info
  const currentTierIdx = STREAK_TIERS.findIndex((t) => streakState.streak >= t.minDay);
  const nextTier = currentTierIdx > 0 ? STREAK_TIERS[currentTierIdx - 1] : null;
  const daysToNext = nextTier ? nextTier.minDay - streakState.streak : 0;

  function renderPackRow(pack: QueuedPack, isAds: boolean) {
    const remaining = pack.claimed ? pack.endsAt - now : PACK_TIMER_MS;
    const isReady = pack.claimed && pack.endsAt - now <= 0;
    const isWaiting = pack.claimed && !isReady;
    const canSkip = isWaiting && pack.adsUsed < pack.adsMax;
    const nextCheckpoint = skipTimerCheckpoints(pack.initialDuration)[pack.adsUsed];
    const isLastPub = canSkip && nextCheckpoint === 0;
    const typeColor = isAds ? C.gold : pack.type === "milestone" ? C.gold : C.teal;
    const typeLabel = isAds ? "BONUS · XP ×1.2 · DROPS+" : pack.type === "milestone" ? "★ STREAK MILESTONE" : "QUOTIDIEN";
    const glowColor = isReady ? (isAds ? "rgba(201,165,101,0.32)" : "rgba(109,181,196,0.32)") : C.border;
    const bgColor = isReady
      ? (isAds ? "linear-gradient(135deg, rgba(201,165,101,0.10), rgba(201,165,101,0.03))" : "linear-gradient(135deg, rgba(109,181,196,0.10), rgba(109,181,196,0.03))")
      : C.panel;

    return (
      <div
        key={pack.id}
        style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", marginBottom: 8, borderRadius: 12, background: bgColor, border: `1px solid ${glowColor}`, boxShadow: isReady ? `0 0 18px ${isAds ? "rgba(201,165,101,0.10)" : "rgba(109,181,196,0.10)"}` : "none" }}
      >
        <PackArt size={48} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: F.mono, fontSize: 8, letterSpacing: "0.14em", textTransform: "uppercase", color: typeColor, marginBottom: 2 }}>
            {typeLabel}
          </div>
          <div style={{ fontFamily: F.body, fontSize: 14, fontWeight: 700 }}>Pack standard · 5 cartes</div>
          <div style={{ fontFamily: F.mono, fontSize: isReady ? 12 : 11, fontWeight: 700, color: isReady ? typeColor : C.muted, letterSpacing: "0.08em", marginTop: 3, textShadow: isReady ? `0 0 10px ${typeColor}66` : "none" }}>
            {!pack.claimed ? "À CLAIM" : isReady ? "✦ PRÊT" : formatMs(remaining)}
          </div>
        </div>
        {!pack.claimed ? (
          <button
            onClick={() => claimPack(pack, isAds)}
            style={{ padding: "10px 14px", borderRadius: 8, background: isAds ? `linear-gradient(180deg, ${C.gold} 0%, ${C.goldDk} 100%)` : `linear-gradient(180deg, ${C.teal} 0%, ${C.tealDk} 100%)`, border: "1px solid rgba(255,255,255,0.18)", boxShadow: `inset 0 1px 0 rgba(255,255,255,0.14)`, fontFamily: F.body, fontSize: 13, fontWeight: 700, color: isAds ? "#1c1408" : "#071318", cursor: "pointer", letterSpacing: "0.04em", whiteSpace: "nowrap", flexShrink: 0 }}
          >
            Claim →
          </button>
        ) : isReady ? (
          <button
            onClick={() => openPack(pack, isAds)}
            style={{ padding: "10px 14px", borderRadius: 8, background: isAds ? `linear-gradient(180deg, ${C.gold} 0%, ${C.goldDk} 100%)` : `linear-gradient(180deg, ${C.teal} 0%, ${C.tealDk} 100%)`, border: "1px solid rgba(255,255,255,0.18)", boxShadow: `inset 0 1px 0 rgba(255,255,255,0.14)`, fontFamily: F.body, fontSize: 13, fontWeight: 700, color: isAds ? "#1c1408" : "#071318", cursor: "pointer", letterSpacing: "0.04em", whiteSpace: "nowrap", flexShrink: 0 }}
          >
            Ouvrir →
          </button>
        ) : canSkip ? (
          <button
            onClick={() => {
              if (isLastPub) {
                const updated = { ...pack, claimed: true, endsAt: now, adsUsed: pack.adsUsed + 1 };
                openPack(updated, isAds);
              } else {
                skipWithAd(pack, isAds);
              }
            }}
            style={{ padding: "10px 14px", borderRadius: 8, background: isLastPub ? (isAds ? `linear-gradient(180deg, ${C.gold} 0%, ${C.goldDk} 100%)` : `linear-gradient(180deg, ${C.teal} 0%, ${C.tealDk} 100%)`) : "linear-gradient(180deg, #d4b274 0%, #8a6128 100%)", border: "1px solid rgba(255,255,255,0.18)", boxShadow: isLastPub ? "inset 0 1px 0 rgba(255,255,255,0.14)" : "none", fontFamily: F.body, fontSize: 12, fontWeight: 700, color: isLastPub ? (isAds ? "#1c1408" : "#071318") : "#1c1408", cursor: "pointer", letterSpacing: "0.04em", whiteSpace: "nowrap", flexShrink: 0 }}
          >
            {isLastPub ? "▶ Ouvrir" : `▶ Accélérer ${pack.adsUsed + 1}/${pack.adsMax}`}
          </button>
        ) : (
          <div style={{ width: 50, textAlign: "center", fontFamily: F.mono, fontSize: 7.5, color: C.faint, letterSpacing: "0.08em", flexShrink: 0 }}>
            AUCUN<br />SKIP
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflowY: "auto", fontFamily: F.body, color: C.ink }}>
      <PackOpenModal
        open={modalOpen}
        packLabel={activePack?.isAds ? "ADS" : activePack?.pack.type === "milestone" ? "MILESTONE" : "DAILY"}
        cards={packCards}
        onClose={handleModalClose}
        packMultiplier={PACK_MULTIPLIER[activePack?.pack.type ?? "daily"]}
        onCardsRevealed={(revealed) => {
          const ids = revealed.map((c) => c.player_id).filter(Boolean) as string[];
          if (ids.length) addOwnedIds(ids);
          const mult = PACK_MULTIPLIER[activePack?.pack.type ?? "daily"];
          const earned = calcPackXP(revealed.map((c) => c.tier), mult);
          if (earned > 0) addXP(earned);
          onPackOpened();
          onCardsObtained(
            revealed.map((c) => c.tier),
            revealed.map((c) => c.nationality).filter(Boolean) as string[]
          );
        }}
      />

      <TopBar />

      {/* Daily queue */}
      <div style={{ padding: "8px 14px 0" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: C.muted }}>
            PACKS QUOTIDIENS
          </div>
          <div style={{ fontFamily: F.mono, fontSize: 7.5, letterSpacing: "0.1em", color: C.faint }}>
            /{tier.spawnIntervalH}H · MAX {dailyQueueMax}
          </div>
        </div>

        {dailyQueue.length === 0 && (
          <div style={{ textAlign: "center", padding: "12px 0", color: C.faint, fontFamily: F.mono, fontSize: 9, letterSpacing: "0.12em" }}>
            AUCUN PACK EN ATTENTE
          </div>
        )}

        {dailyQueue.map((pack) => renderPackRow(pack, false))}

        {dailiesInQueue < dailyQueueMax && now > 0 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", marginBottom: 8, borderRadius: 10, background: "rgba(109,181,196,0.04)", border: "1px dashed rgba(109,181,196,0.18)" }}>
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
      </div>

      {/* Milestone pack claim */}
      {streakState.milestonePacks > 0 && (
        <div style={{ padding: "0 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", marginBottom: 8, borderRadius: 12, background: "linear-gradient(135deg, rgba(255,210,63,0.10), rgba(255,210,63,0.03))", border: "1px solid rgba(255,210,63,0.32)", boxShadow: "0 0 18px rgba(255,210,63,0.08)" }}>
            <PackArt size={48} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: F.mono, fontSize: 8, letterSpacing: "0.14em", textTransform: "uppercase", color: C.gold, marginBottom: 2 }}>
                ★ PACK MILESTONE · STREAK {Math.floor(streakState.streak / 7) * 7}J
              </div>
              <div style={{ fontFamily: F.body, fontSize: 14, fontWeight: 700 }}>Pack bonus · 5 cartes</div>
              <div style={{ fontFamily: F.mono, fontSize: 8.5, color: C.muted, marginTop: 2, letterSpacing: "0.08em" }}>
                {streakState.milestonePacks} DISPONIBLE{streakState.milestonePacks > 1 ? "S" : ""}
              </div>
            </div>
            <button
              onClick={() => {
                if (dailiesInQueue >= dailyQueueMax) return;
                if (claimMilestonePack()) {
                  setStreakState(getStreak());
                  const checkpoints = skipTimerCheckpoints(PACK_TIMER_MS);
                  setDailyQueue((q) => [...q, {
                    id: `milestone-${Date.now()}`,
                    type: "milestone",
                    endsAt: 0,
                    initialDuration: PACK_TIMER_MS,
                    adsUsed: 0,
                    adsMax: checkpoints.length,
                    claimed: false,
                  }]);
                }
              }}
              disabled={dailiesInQueue >= dailyQueueMax}
              style={{ padding: "10px 14px", borderRadius: 8, background: dailiesInQueue >= dailyQueueMax ? "rgba(255,255,255,0.06)" : `linear-gradient(180deg, ${C.gold} 0%, ${C.goldDk} 100%)`, border: "1px solid rgba(255,255,255,0.18)", fontFamily: F.body, fontSize: 13, fontWeight: 700, color: dailiesInQueue >= dailyQueueMax ? C.faint : "#1c1408", cursor: dailiesInQueue >= dailyQueueMax ? "default" : "pointer", letterSpacing: "0.04em", whiteSpace: "nowrap", flexShrink: 0 }}
            >
              Claim
            </button>
          </div>
        </div>
      )}

      {/* Bonus (ads) queue */}
      <div style={{ padding: "0 14px" }}>
        <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: C.gold, marginBottom: 8 }}>
          PACK BONUS · XP ×1.2 · DROPS+
        </div>

        {adsQueue.map((pack) => renderPackRow(pack, true))}

        {canAddAds && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", marginBottom: 8, borderRadius: 10, background: "rgba(201,165,101,0.06)", border: "1px dashed rgba(201,165,101,0.22)" }}>
            <div>
              <div style={{ fontFamily: F.mono, fontSize: 8, letterSpacing: "0.14em", textTransform: "uppercase", color: C.gold, marginBottom: 1 }}>
                PACK BONUS DISPONIBLE
              </div>
              <div style={{ fontFamily: F.body, fontSize: 13, fontWeight: 600, marginBottom: 1 }}>XP ×1.2 · Drops boostés</div>
              <div style={{ fontFamily: F.mono, fontSize: 7.5, color: C.muted, letterSpacing: "0.1em" }}>1 PUB POUR DÉBLOQUER</div>
            </div>
            <button onClick={addAdsPack} style={{ padding: "10px 14px", borderRadius: 8, background: "linear-gradient(180deg, #d4b274 0%, #8a6128 100%)", border: "1px solid rgba(255,255,255,0.18)", fontFamily: F.body, fontSize: 12, fontWeight: 700, color: "#1c1408", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
              ▶ Obtenir
            </button>
          </div>
        )}

        {!adsReady && !hasAdsPack && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", marginBottom: 8, borderRadius: 10, background: "rgba(201,165,101,0.03)", border: "1px dashed rgba(201,165,101,0.12)" }}>
            <div>
              <div style={{ fontFamily: F.mono, fontSize: 8, letterSpacing: "0.14em", textTransform: "uppercase", color: C.muted, marginBottom: 1 }}>PROCHAIN BONUS</div>
              <div style={{ fontFamily: F.mono, fontSize: 12, fontWeight: 700, color: C.muted, letterSpacing: "0.08em" }}>{formatMs(adsCooldownMs)}</div>
            </div>
          </div>
        )}
      </div>

      {/* Streak — full width */}
      {(() => {
        const streak = streakState.streak;
        const filled = streak > 0 ? (streak % 7 || 7) : 0;
        const xpMult = tier.xpMult;
        const isMaxTier = !nextTier;
        return (
          <div style={{ margin: "8px 14px 0", borderRadius: 14, padding: "12px 14px", background: "linear-gradient(135deg, rgba(255,210,63,0.07), rgba(255,210,63,0.02))", border: "1px solid rgba(255,210,63,0.22)" }}>
            {/* Top row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div>
                <div style={{ fontFamily: F.mono, fontSize: 8, letterSpacing: "0.14em", textTransform: "uppercase", color: C.gold, marginBottom: 2 }}>
                  STREAK DE CONNEXION
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ fontFamily: F.body, fontSize: 28, fontWeight: 800, lineHeight: 1, color: "#fff" }}>{streak}</span>
                  <span style={{ fontFamily: F.mono, fontSize: 10, color: C.gold, fontWeight: 700 }}>JOURS</span>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                <div style={{ fontFamily: F.mono, fontSize: 13, fontWeight: 800, color: "#1c1408", background: `linear-gradient(180deg, ${C.gold}, ${C.goldDk})`, borderRadius: 6, padding: "3px 8px", letterSpacing: "0.04em" }}>
                  ×{xpMult.toFixed(2)} XP
                </div>
                <div style={{ fontFamily: F.mono, fontSize: 8, color: C.gold, letterSpacing: "0.1em" }}>
                  {tier.dailySlots} PACK{tier.dailySlots > 1 ? "S" : ""}/JOUR
                </div>
              </div>
            </div>
            {/* 7-case bar */}
            <div style={{ display: "flex", gap: 3, marginBottom: 8 }}>
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div key={i} style={{ flex: 1, height: 8, borderRadius: 4, background: i <= filled ? `linear-gradient(90deg, ${C.gold}, ${C.goldDk})` : "rgba(255,255,255,0.07)", border: `1px solid ${i <= filled ? "rgba(255,255,255,0.3)" : C.border}`, boxShadow: i <= filled ? "0 0 5px rgba(255,210,63,0.35)" : "none" }} />
              ))}
            </div>
            {/* Next tier hint */}
            <div style={{ fontFamily: F.mono, fontSize: 7.5, color: isMaxTier ? C.gold : C.muted, letterSpacing: "0.1em" }}>
              {isMaxTier
                ? "★ PALIER MAXIMUM ATTEINT"
                : `+${daysToNext}J → ×${nextTier!.xpMult.toFixed(2)} XP · ${nextTier!.dailySlots} PACK${nextTier!.dailySlots > 1 ? "S" : ""}/JOUR`}
            </div>
          </div>
        );
      })()}

      {/* Défis */}
      <div style={{ padding: "8px 14px 0" }}>
        <div style={{ borderRadius: 12, padding: "10px 12px", background: C.panel, border: `1px solid ${C.border}` }}>
          {(() => {
            const doneCount = challenges.filter((c) => c.done).length;
            const pct = challenges.length ? Math.round((doneCount / challenges.length) * 100) : 0;
            const midnight = new Date(now); midnight.setHours(24, 0, 0, 0);
            const resetMs = Math.max(0, midnight.getTime() - now);
            const rh = Math.floor(resetMs / 3600000);
            const rm = Math.floor((resetMs % 3600000) / 60000);
            const rs = Math.floor((resetMs % 60000) / 1000);
            return (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: C.muted }}>
                    DÉFIS DU JOUR · {doneCount}/{challenges.length}
                  </div>
                  <div style={{ fontFamily: F.mono, fontSize: 8.5, color: C.muted, letterSpacing: "0.1em" }}>
                    RESET {rh}H {String(rm).padStart(2, "0")}M {String(rs).padStart(2, "0")}S
                  </div>
                </div>
                <div style={{ marginTop: 6 }}>
                  <XPBar pct={pct} color="teal" height={5} />
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* Liste challenges */}
      <div style={{ padding: "14px 14px 0" }}>
        {challenges.map((c) => (
          <div
            key={c.id}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", marginBottom: 6, background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 10 }}
          >
            <div
              style={{ width: 22, height: 22, borderRadius: 6, background: c.done ? `linear-gradient(180deg, ${C.green}, #138a5b)` : "rgba(0,0,0,0.3)", border: `1px solid ${c.done ? "rgba(255,255,255,0.3)" : C.border}`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: F.body, fontSize: 14, fontWeight: 700, boxShadow: c.done ? `0 0 8px ${C.green}88` : "none", flexShrink: 0 }}
            >
              {c.done ? "✓" : ""}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: F.body, fontSize: 12, fontWeight: 700, color: c.done ? C.faint : "#fff", textDecoration: c.done ? "line-through" : "none", display: "flex", alignItems: "center", gap: 5 }}>
                {c.kind === "obtain_nation" && c.nationIso && <Flag code={c.nationIso} width={14} />}
                {c.label}
              </div>
              {c.target > 1 && !c.done && (
                <div style={{ fontFamily: F.mono, fontSize: 8, color: C.muted, letterSpacing: "0.1em", marginBottom: 2 }}>
                  {c.progress}/{c.target}
                </div>
              )}
              <div style={{ marginTop: 3 }}>
                <XPBar pct={c.pct} color={c.done ? "teal" : "gold"} height={4} />
              </div>
            </div>
            <div style={{ fontFamily: F.body, fontSize: 11, fontWeight: 700, color: C.gold, letterSpacing: "0.06em", flexShrink: 0 }}>
              +{c.xp} XP
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
