// CS Vibe — Pack & Wheel reveal animations · TypeScript
// No deps. All browser APIs called inside functions, safe to import in SSR.

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RevealCard {
  tier: string;
  ovr?: number;
  name?: string;
  player_id?: string;
  role?: string;
  team?: string;
  teamShort?: string;
  nationality?: string;
  image_offset?: string;
  categoryScores?: {
    firepower: number;
    opening: number;
    clutching: number;
    entrying: number;
    trading: number;
    impact: number;
  };
  /** true = first copy ever obtained */
  isNew?: boolean;
  /** copies owned before this pack opened */
  stockCount?: number;
  teamRank?: number;
}

export interface OpenPackOpts {
  container: HTMLElement;
  label?: string;
  variant?: "v1" | "case";
  topLeft?: string;
  topRight?: string;
  bottomLeft?: string;
  bottomRight?: string;
  previewCards?: RevealCard[];
  onComplete?: () => void;
}

export interface SpinWheelOpts {
  container: HTMLElement;
  pool?: RevealCard[];
  target: RevealCard;
  duration?: number;
  label?: string;
  onComplete?: (card: RevealCard) => void;
}

// ─── Audio ───────────────────────────────────────────────────────────────────

let _packBuffer: AudioBuffer | null = null;
let _packBufferPromise: Promise<AudioBuffer | null> | null = null;
let _cardBuffer: AudioBuffer | null = null;
let _cardBufferPromise: Promise<AudioBuffer | null> | null = null;
let _tickBufA: AudioBuffer | null = null;
let _tickBufAPromise: Promise<AudioBuffer | null> | null = null;
let _audioCtx: AudioContext | null = null;
let _soundEnabled = true;

function getAudio(): AudioContext | null {
  if (!_soundEnabled) return null;
  if (typeof window === "undefined") return null;
  if (!_audioCtx) {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    _audioCtx = new Ctx();
  }
  if (_audioCtx.state === "suspended") _audioCtx.resume();
  return _audioCtx;
}

function loadPackSample(): Promise<AudioBuffer | null> {
  if (_packBuffer) return Promise.resolve(_packBuffer);
  if (_packBufferPromise) return _packBufferPromise;
  const ctx = getAudio();
  if (!ctx) return Promise.resolve(null);
  _packBufferPromise = fetch("/sounds/pack-appear.wav")
    .then((r) => r.arrayBuffer())
    .then((ab) => new Promise<AudioBuffer>((res, rej) => ctx.decodeAudioData(ab, res, rej)))
    .then((buf) => { _packBuffer = buf; return buf; })
    .catch(() => null);
  return _packBufferPromise;
}

function loadCardSample(): Promise<AudioBuffer | null> {
  if (_cardBuffer) return Promise.resolve(_cardBuffer);
  if (_cardBufferPromise) return _cardBufferPromise;
  const ctx = getAudio();
  if (!ctx) return Promise.resolve(null);
  _cardBufferPromise = fetch("/sounds/card-appear.wav")
    .then((r) => r.arrayBuffer())
    .then((ab) => ctx.decodeAudioData(ab))
    .then((buf) => { _cardBuffer = buf; return buf; })
    .catch(() => null);
  return _cardBufferPromise;
}

function loadTickSample(): Promise<AudioBuffer | null> {
  if (_tickBufA) return Promise.resolve(_tickBufA);
  if (_tickBufAPromise) return _tickBufAPromise;
  const ctx = getAudio();
  if (!ctx) return Promise.resolve(null);
  _tickBufAPromise = fetch("/sounds/csgo-tick-a.wav")
    .then((r) => r.arrayBuffer())
    .then((ab) => ctx.decodeAudioData(ab))
    .then((buf) => { _tickBufA = buf; return buf; })
    .catch(() => null);
  return _tickBufAPromise;
}

/** Preload card landing sample (call on page mount where wheel is likely) */
export function preloadLanding(): Promise<AudioBuffer | null> {
  return loadCardSample();
}

/** Preloads all audio samples (pack, card, tick) */
export async function preloadTickBuffer(): Promise<void> {
  await Promise.all([loadPackSample(), loadCardSample(), loadTickSample()]);
}

// ─── Audio primitives ────────────────────────────────────────────────────────

interface CardSampleOpts {
  rate?: number;
  gain?: number;
  offset?: number; // buffer start offset in seconds (skips silence/click intro)
  lowpass?: number | null;
  highpass?: number | null;
  brightness?: number; // highshelf gain in dB — negative = dull, positive = sparkle
}

function playCardSample(when: number, opts: CardSampleOpts = {}) {
  const ctx = getAudio();
  if (!ctx || !_cardBuffer) return;
  const { rate = 1, gain = 1, offset = 0, lowpass = null, highpass = null, brightness = 0 } = opts;
  const t = ctx.currentTime + when;

  const src = ctx.createBufferSource();
  src.buffer = _cardBuffer;
  src.playbackRate.value = rate;

  let node: AudioNode = src;
  if (highpass != null) {
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = highpass;
    node.connect(hp);
    node = hp;
  }
  if (lowpass != null) {
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = lowpass;
    node.connect(lp);
    node = lp;
  }
  if (brightness !== 0) {
    const sh = ctx.createBiquadFilter();
    sh.type = "highshelf";
    sh.frequency.value = 2500;
    sh.gain.value = brightness;
    node.connect(sh);
    node = sh;
  }

  const g = ctx.createGain();
  g.gain.value = gain;
  node.connect(g).connect(ctx.destination);
  src.start(t, offset);
}

// Noise shimmer tail — bandpassed noise sweep (no oscillators).
function _shimmer({ when, duration = 0.4, volume = 0.12 }: { when: number; duration?: number; volume?: number }) {
  const ctx = getAudio();
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const src = ctx.createBufferSource();
  const buf = ctx.createBuffer(1, Math.ceil(duration * ctx.sampleRate), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    const p = i / d.length;
    d[i] = (Math.random() * 2 - 1) * Math.pow(1 - p, 1.4);
  }
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = "highpass";
  bp.frequency.setValueAtTime(2800, t);
  bp.frequency.exponentialRampToValueAtTime(5500, t + duration);
  bp.Q.value = 0.5;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  src.connect(bp).connect(gain).connect(ctx.destination);
  src.start(t);
}

// ─── Tick sounds (wheel spin) ─────────────────────────────────────────────────
// drama: 0 = early fast tick (quiet/low pitch), 1 = last tick before landing (loud/high)

function scheduleTick(when: number, drama: number) {
  const ctx = getAudio();
  if (!ctx || !_tickBufA) return;
  const rateStart = 1.5 + drama * 0.286; // 1.5 → 1.786
  const rateEnd   = rateStart * 1.15;    // +15% chirp over 22ms
  const vol       = 0.14 + drama * 0.18; // 0.14 → 0.32
  const src = ctx.createBufferSource();
  src.buffer = _tickBufA;
  src.playbackRate.setValueAtTime(rateStart, when);
  src.playbackRate.linearRampToValueAtTime(rateEnd, when + 0.022);
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(g).connect(ctx.destination);
  src.start(when);
}

// Inverse of CSS cubic-bezier(0.05, 0.85, 0.08, 1):
// given a progress value (0–1), return the time fraction (0–1) at which it occurs.
function progressToTimeFrac(progress: number): number {
  const y1 = 0.85, y2 = 1.0, x1 = 0.05, x2 = 0.08;
  let lo = 0, hi = 1;
  for (let i = 0; i < 28; i++) {
    const t = (lo + hi) / 2;
    const y = 3*(1-t)*(1-t)*t*y1 + 3*(1-t)*t*t*y2 + t*t*t;
    y < progress ? (lo = t) : (hi = t);
  }
  const t = (lo + hi) / 2;
  return 3*(1-t)*(1-t)*t*x1 + 3*(1-t)*t*t*x2 + t*t*t;
}

// Pack tear noise (synthesis fallback for pack opening).
function schedulePackTear(when: number, vol = 0.25) {
  const ctx = getAudio();
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const dur = 0.35;
  const src = ctx.createBufferSource();
  const buf = ctx.createBuffer(1, Math.ceil(dur * ctx.sampleRate), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    const p = i / d.length;
    d[i] = (Math.random() * 2 - 1) * Math.pow(1 - p, 2);
  }
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(800, t);
  bp.frequency.exponentialRampToValueAtTime(3500, t + dur);
  bp.Q.value = 1.4;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp).connect(gain).connect(ctx.destination);
  src.start(t);
}

// ─── playLanding — sample-based, escalating satisfaction by tier ─────────────
//
// All tiers use the SAME card-appear.wav processed differently:
//   BRONZE  — pitched normal, high-shelf cut −10dB → flat, disappointing
//   SILVER  — pitched normal, high-shelf cut −5dB  → between bronze and gold
//   GOLD    — pitched normal, highpass 80Hz, brut   → the reference feel
//   DIAMOND — pitched up ×1.06, highshelf +5dB + shimmer tail
//   ICON    — pitched up ×1.12, highshelf +8dB + sample cascade + double shimmer

export function playLanding(tier: string, when = 0) {
  const ctx = getAudio();
  if (!ctx) return;

  if (!_cardBuffer) {
    loadCardSample().then((buf) => { if (buf) playLanding(tier, 0); });
    return;
  }

  switch (tier) {
    case "BRONZE":
      playCardSample(when, { offset: 1.50, rate: 0.92, gain: 0.90, brightness: -10 });
      break;
    case "SILVER":
      playCardSample(when, { offset: 1.50, rate: 1.0,  gain: 0.95, brightness: -5 });
      break;
    case "GOLD":
      playCardSample(when, { offset: 1.50, rate: 1.0,  gain: 1.0,  highpass: 80 });
      break;
    case "DIAMOND":
      playCardSample(when, { offset: 1.45, rate: 1.06, gain: 1.0,  highpass: 120, brightness: 5 });
      _shimmer({ when: when + 0.06, duration: 0.55, volume: 0.08 });
      break;
    case "ICON":
      playCardSample(when, { offset: 1.35, rate: 1.12, gain: 1.0,  highpass: 140, brightness: 8 });
      [
        { dt: 0.11, rate: 1.50, gain: 0.45, highpass: 800,  brightness: 6 },
        { dt: 0.22, rate: 2.00, gain: 0.32, highpass: 1400, brightness: 6 },
        { dt: 0.34, rate: 2.50, gain: 0.22, highpass: 2000, brightness: 5 },
        { dt: 0.46, rate: 3.00, gain: 0.14, highpass: 2600, brightness: 4 },
      ].forEach((c) =>
        playCardSample(when + c.dt, { offset: 1.35, rate: c.rate, gain: c.gain, highpass: c.highpass, brightness: c.brightness })
      );
      _shimmer({ when: when + 0.06, duration: 1.2, volume: 0.13 });
      _shimmer({ when: when + 0.35, duration: 0.9, volume: 0.08 });
      break;
    default:
      playCardSample(when, { offset: 1.50, rate: 1.0, gain: 0.90, brightness: -10 });
  }
}

// ─── Rarity palette (aligned with frontend/app/lib/tokens.ts) ────────────────

export const RARITY: Record<string, { from: string; to: string; glow: string; label: string }> = {
  BRONZE:  { from: "#a06a3b", to: "#3e2510", glow: "rgba(160,106,59,0.22)",  label: "#e0c6a3" },
  SILVER:  { from: "#aab4c0", to: "#3e4654", glow: "rgba(170,180,192,0.20)", label: "#e6ebf2" },
  GOLD:    { from: "#c9a565", to: "#6f4d1a", glow: "rgba(201,165,101,0.28)", label: "#f0dba8" },
  DIAMOND: { from: "#6da4c4", to: "#1f3a5a", glow: "rgba(109,164,196,0.28)", label: "#c4dff0" },
  ICON:    { from: "#b89cd4", to: "#3f2860", glow: "rgba(184,156,212,0.32)", label: "#e0d2f0" },
  LEGACY:  { from: "#8a8a92", to: "#2c2c34", glow: "rgba(138,138,146,0.18)", label: "#cccccd" },
};

// ─── Tile factory (mirrors CardPortrait DNA) ─────────────────────────────────
// Layout: photo zone (top 58%) + dark stats band (bottom 42%)
// TL: OVR + tier · TR: role · BL: name + team short

function buildTile(card: RevealCard, isTarget: boolean): HTMLElement {
  const r = RARITY[card.tier] ?? RARITY.GOLD;
  const el = document.createElement("div");
  el.className = "csv-tile" + (isTarget ? " csv-tile--target" : "");
  el.style.cssText = `--from:${r.from};--to:${r.to};--glow:${r.glow};--label:${r.label}`;

  const ovr = card.ovr ?? 75;
  const fir = card.categoryScores ? Math.round(card.categoryScores.firepower) : Math.min(99, ovr + 4);
  const clu = card.categoryScores ? Math.round(card.categoryScores.clutching) : Math.max(40, ovr - 6);
  const imp = card.categoryScores ? Math.round(card.categoryScores.impact)    : Math.min(99, ovr + 1);
  const role = card.role ?? "";
  const team = (card.teamShort ?? card.team ?? "").toUpperCase();
  const imgUrl = card.player_id ? `/api/player-image/${card.player_id}` : null;

  el.innerHTML = `
    <div class="csv-tile-photo">
      <div class="csv-tile-stripes"></div>
      ${imgUrl ? `<img class="csv-tile-image" src="${imgUrl}" alt="" style="object-position:${card.image_offset ?? "top center"}" />` : ""}
      <div class="csv-tile-fade"></div>
      <div class="csv-tile-tl">
        <div class="csv-tile-ovr">${ovr}</div>
        <div class="csv-tile-tier">${card.tier}</div>
      </div>
      ${role ? `<div class="csv-tile-tr">${role}</div>` : ""}
      ${card.name
        ? `<div class="csv-tile-name">
             <div class="csv-tile-name-text">${card.name}</div>
             ${team ? `<div class="csv-tile-team">${team}</div>` : ""}
           </div>`
        : `<div class="csv-tile-tag">${(card.tier || "G")[0]}</div>`}
    </div>
    <div class="csv-tile-stats">
      <div><span class="csv-tile-stat-v">${fir}</span><span class="csv-tile-stat-l">FIR</span></div>
      <div><span class="csv-tile-stat-v">${clu}</span><span class="csv-tile-stat-l">CLU</span></div>
      <div><span class="csv-tile-stat-v">${imp}</span><span class="csv-tile-stat-l">IMP</span></div>
    </div>
    <div class="csv-tile-sheen"></div>
  `;
  return el;
}

// ─── openPack — CS:GO case variant (default) ─────────────────────────────────
//
// State machine (aligned with pack-appear.wav envelope):
//   0ms     → csv-pack--appearing → pack flies in from distance
//   540ms   → csv-pack--landed    → case settles, lock rattles
//   710ms   → csv-pack--opening   → lid hinges back, beam erupts, cards rise
//   1500ms  → resolve             → WAV tail fades, cards fan is visible

const DEFAULT_PREVIEW: RevealCard[] = [
  { tier: "SILVER",  ovr: 78 },
  { tier: "GOLD",    ovr: 84 },
  { tier: "ICON",    ovr: 99 },
  { tier: "DIAMOND", ovr: 91 },
  { tier: "GOLD",    ovr: 86 },
];

export function openPack(opts: OpenPackOpts): Promise<void> {
  const {
    container,
    label = "DAILY",
    variant = "case",
    topLeft    = "CS·VIBE",
    topRight   = "№ 001",
    bottomLeft = "SEALED",
    bottomRight = "VOL · 005",
    previewCards = DEFAULT_PREVIEW,
    onComplete,
  } = opts;
  if (!container) throw new Error("openPack: container required");

  container.classList.add("csv-root");
  const fanRotations = [-32, -16, 0, 16, 32];

  const cardSlots = previewCards
    .map((_, i) => `<div class="csv-pack-card" style="--rot:${fanRotations[i] ?? 0}deg"></div>`)
    .join("");
  const particles = [0, 1, 2, 3, 4, 5]
    .map((i) => `<div class="csv-pack-particle csv-pack-particle-${i}"></div>`)
    .join("");

  let shellMarkup: string;
  let packClass: string;

  if (variant === "case") {
    const sparks = [
      { dx: "-70px", dy: "58px", ang: "-32deg" },
      { dx:  "70px", dy: "58px", ang:  "32deg" },
      { dx: "-30px", dy: "78px", ang: "-12deg" },
      { dx:  "30px", dy: "78px", ang:  "12deg" },
    ]
      .map(
        (s) =>
          `<div class="csv-packv2-case-spark" style="--sdx:${s.dx};--sdy:${s.dy};--sang:${s.ang}"></div>`
      )
      .join("");

    shellMarkup = `
      <div class="csv-packv2-body">
        <div class="csv-packv2-case-front">
          <div class="csv-packv2-case-marks"><span>${topLeft}</span><span>${topRight}</span></div>
          <div class="csv-packv2-case-stripe">
            <div class="csv-packv2-case-stripe-text">${label}</div>
          </div>
          <div class="csv-packv2-case-spec"><span>${bottomLeft}</span><span>${bottomRight}</span></div>
        </div>
        <div class="csv-packv2-case-innerglow"></div>
        <div class="csv-packv2-case-beam"></div>
        <div class="csv-packv2-case-mouth"></div>
        <div class="csv-packv2-case-lid">
          <div class="csv-packv2-case-lock"></div>
        </div>
        <div class="csv-packv2-case-flash"></div>
        ${sparks}
      </div>`;
    packClass = "csv-pack csv-packv2 csv-packv2--case";
  } else {
    // v1 legacy — original two-half tear
    shellMarkup = `
      <div class="csv-pack-top"><div class="csv-pack-top-label">${label}</div></div>
      <div class="csv-pack-bottom"></div>`;
    packClass = "csv-pack";
  }

  container.innerHTML = `
    <div class="${packClass}">
      ${variant === "v1" ? '<div class="csv-pack-rays"></div>' : ""}
      <div class="csv-pack-shell">${shellMarkup}</div>
      ${variant === "v1" ? '<div class="csv-pack-burst"></div>' : ""}
      ${cardSlots}
      ${particles}
    </div>
  `;

  const pack = container.querySelector<HTMLElement>(".csv-pack")!;
  const slots = pack.querySelectorAll<HTMLElement>(".csv-pack-card");
  previewCards.forEach((c, i) => {
    if (slots[i]) slots[i].appendChild(buildTile(c, i === 2));
  });

  return new Promise((resolve) => {
    const startAnimation = () => {
      if (variant === "case") {
        pack.classList.add("csv-pack--appearing");
        setTimeout(() => {
          pack.classList.remove("csv-pack--appearing");
          pack.classList.add("csv-pack--landed");
        }, 540);
        setTimeout(() => {
          pack.classList.remove("csv-pack--landed");
          pack.classList.add("csv-pack--opening");
        }, 710);
        setTimeout(() => {
          onComplete?.();
          resolve();
        }, 1500);
      } else {
        // v1 legacy timing
        pack.classList.add("csv-pack--shaking");
        setTimeout(() => {
          pack.classList.remove("csv-pack--shaking");
          pack.classList.add("csv-pack--opening");
        }, 400);
        setTimeout(() => {
          onComplete?.();
          resolve();
        }, 2400);
      }
    };

    loadPackSample().then((buf) => {
      if (buf) {
        const ctx = getAudio();
        if (ctx) {
          const src = ctx.createBufferSource();
          src.buffer = buf;
          const g = ctx.createGain();
          g.gain.value = 1.0;
          src.connect(g).connect(ctx.destination);
          src.start(ctx.currentTime); // play from start — WAV 300ms silence aligns with animation
        }
      } else {
        // synthesis fallback
        schedulePackTear(0.40, 0.28);
      }
      startAnimation();
    });
  });
}

// ─── spinWheel ───────────────────────────────────────────────────────────────
// No ticks during spin. Only landing sound fires at the very end.

const DEFAULT_POOL: RevealCard[] = [
  { tier: "SILVER",  ovr: 76 },
  { tier: "GOLD",    ovr: 84 },
  { tier: "GOLD",    ovr: 81 },
  { tier: "DIAMOND", ovr: 89 },
  { tier: "GOLD",    ovr: 86 },
  { tier: "SILVER",  ovr: 78 },
  { tier: "DIAMOND", ovr: 91 },
  { tier: "GOLD",    ovr: 83 },
  { tier: "BRONZE",  ovr: 65 },
];

export function spinWheel(opts: SpinWheelOpts): Promise<RevealCard> {
  const {
    container,
    pool = DEFAULT_POOL,
    target = { tier: "GOLD", ovr: 84 },
    duration = 5000,
    label = "RÉVÉLATION",
    onComplete,
  } = opts;
  if (!container) throw new Error("spinWheel: container required");

  const TARGET_INDEX = 70;
  const POST_TILES = 14;

  const randCard = () => pool[Math.floor(Math.random() * pool.length)];
  const tiles: RevealCard[] = [];
  for (let i = 0; i < TARGET_INDEX; i++) tiles.push(randCard());
  tiles.push(target);
  for (let i = 0; i < POST_TILES; i++) tiles.push(randCard());

  container.classList.add("csv-root");
  container.innerHTML = `
    <div class="csv-wheel">
      <div class="csv-wheel-label">${label}</div>
      <div class="csv-wheel-pointer"></div>
      <div class="csv-wheel-spotlight"></div>
      <div class="csv-wheel-mask"></div>
      <div class="csv-wheel-strip"></div>
    </div>
  `;

  const strip = container.querySelector<HTMLElement>(".csv-wheel-strip")!;

  // Target tile is visibly larger (csv-tile--target) throughout the spin
  tiles.forEach((t, i) => strip.appendChild(buildTile(t, i === TARGET_INDEX)));

  return new Promise((resolve) => {
    const startSpin = () => {
      requestAnimationFrame(() => {
        const wheel = container.querySelector<HTMLElement>(".csv-wheel")!;
        const containerW = wheel.clientWidth;
        const targetTile = strip.children[TARGET_INDEX] as HTMLElement;
        const tileCenter = targetTile.offsetLeft + targetTile.offsetWidth / 2;
        const jitter = (Math.random() - 0.5) * 24;
        const finalX = containerW / 2 - tileCenter + jitter;

        const easing = "cubic-bezier(0.05, 0.85, 0.08, 1)";
        const durSec = duration / 1000;

        // Schedule ticks + landing sound
        const audio = getAudio();
        if (audio) {
          const t0 = audio.currentTime;

          // Ticks: compute when each tile (0 to TARGET_INDEX-1) crosses the wheel center
          if (_tickBufA) {
            let lastTickSec = -1;
            for (let i = 0; i < TARGET_INDEX; i++) {
              const tile = strip.children[i] as HTMLElement;
              const tileCenterX = tile.offsetLeft + tile.offsetWidth / 2;
              const translationNeeded = containerW / 2 - tileCenterX;
              const progress = translationNeeded / finalX;
              if (progress <= 0 || progress >= 1) continue;
              const timeFrac = progressToTimeFrac(progress);
              const tickSec = timeFrac * durSec;
              if (tickSec - lastTickSec < 0.022) continue; // min 22ms gap
              lastTickSec = tickSec;
              const remaining = TARGET_INDEX - i;
              const drama = Math.max(0, 12 - remaining) / 12;
              scheduleTick(t0 + tickSec, drama);
            }
          }

          playLanding(target.tier ?? "BRONZE", durSec + 0.02);
        }

        requestAnimationFrame(() => {
          strip.style.transition = `transform ${duration}ms ${easing}`;
          strip.style.transform = `translateX(${finalX}px)`;
        });

        setTimeout(() => {
          targetTile.classList.add("csv-tile--landed");
          onComplete?.(target);
          resolve(target);
        }, duration);
      });
    };

    // Wait for card sample to decode before starting so the very first
    // landing sound fires without lag
    loadCardSample().then(startSpin);
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function reset(container: HTMLElement | null) {
  if (!container) return;
  container.innerHTML = "";
  container.className = "";
}

export function setSound(enabled: boolean) { _soundEnabled = !!enabled; }
export function isSoundEnabled() { return _soundEnabled; }
