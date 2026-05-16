// CS Vibe — Pack & Wheel reveal animations · TypeScript port of reveal.js
// No deps. All browser APIs called inside functions, safe to import in SSR.

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RevealCard {
  tier: string;
  ovr?: number;
  name?: string;
  player_id?: string;
  role?: string;
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
  /** true = first copy ever obtained (set at pack-open time, before addOwnedIds) */
  isNew?: boolean;
  /** copies owned before this pack opened */
  stockCount?: number;
}

export interface OpenPackOpts {
  container: HTMLElement;
  label?: string;
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

// ─── Audio ──────────────────────────────────────────────────────────────────

// Two alternating tick samples: A = low (heavy click), B = high (bright click)
let _tickBufA: AudioBuffer | null = null;
let _tickBufB: AudioBuffer | null = null;
let _packAppearBuf: AudioBuffer | null = null;
let _cardAppearBuf: AudioBuffer | null = null;
let _tickLoadPromise: Promise<void> | null = null;
let _tickToggle = false;

function preloadTickBuffer(): Promise<void> {
  // Reset if previous attempt loaded nothing (getAudio was null — no user gesture yet)
  if (_tickLoadPromise && !_tickBufA && !_packAppearBuf && !_cardAppearBuf) {
    _tickLoadPromise = null;
  }
  if (_tickLoadPromise) return _tickLoadPromise;
  _tickLoadPromise = (async () => {
    try {
      const ctx = getAudio();
      if (!ctx) return;
      const [respA, respB, respPack, respCard] = await Promise.all([
        fetch("/sounds/csgo-tick-a.wav"),
        fetch("/sounds/csgo-tick-b.wav"),
        fetch("/sounds/pack-appear.wav"),
        fetch("/sounds/card-appear.wav"),
      ]);
      if (respA.ok) _tickBufA = await ctx.decodeAudioData(await respA.arrayBuffer());
      if (respB.ok) _tickBufB = await ctx.decodeAudioData(await respB.arrayBuffer());
      if (respPack.ok) _packAppearBuf = await ctx.decodeAudioData(await respPack.arrayBuffer());
      if (respCard.ok) _cardAppearBuf = await ctx.decodeAudioData(await respCard.arrayBuffer());
    } catch {
      // silent fail → synthesis fallback
    }
  })();
  return _tickLoadPromise;
}

export { preloadTickBuffer };

let _audioCtx: AudioContext | null = null;
let _soundEnabled = true;

function getAudio(): AudioContext | null {
  if (!_soundEnabled) return null;
  if (typeof window === "undefined") return null;
  if (!_audioCtx) {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return null;
    _audioCtx = new Ctx();
  }
  if (_audioCtx.state === "suspended") _audioCtx.resume();
  return _audioCtx;
}

interface TickOpts {
  freq?: number;
  freqEnd?: number; // kept for API compat, ignored
  dur?: number;
  vol?: number;
}

// scheduleTick: sample-based (WAV) with synthesis fallback
function scheduleTick(when: number, opts?: TickOpts) {
  const ctx = getAudio();
  if (!ctx) return;
  const { freq = 1800, vol = 1.2 } = opts ?? {};
  const t = ctx.currentTime + when;

  if (_tickBufA || _tickBufB) {
    // ── Double-click ratchet: A = main impact, B = resonance 12ms later ──
    const t0 = (freq - 1700) / 700; // 0 at slow, 1 at fast
    const playBuf = (buf: AudioBuffer, when: number, rate: number, gain: number) => {
      const src = ctx!.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = Math.max(0.5, Math.min(5.0, rate));
      const g = ctx!.createGain();
      g.gain.setValueAtTime(gain, when);
      src.connect(g).connect(ctx!.destination);
      src.start(when);
    };
    // A only — pitch rises slightly over 20ms (metal resonance chirp)
    if (_tickBufA) {
      const src = ctx.createBufferSource();
      src.buffer = _tickBufA;
      const rateStart = 1.5 + t0 * 0.5;   // 1.5 fast → 2.0 slow/landing
      const rateEnd   = rateStart * 1.15; // +15% pitch chirp per tick
      src.playbackRate.setValueAtTime(rateStart, t);
      src.playbackRate.linearRampToValueAtTime(rateEnd, t + 0.022);
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      src.connect(g).connect(ctx.destination);
      src.start(t);
    }
    return;
  }

  // ── Synthesis fallback (if WAV not loaded) ────────────────────────────────
  const dur = 0.008;
  function noiseBuf(ms: number, decay: number) {
    const len = Math.ceil(ms * 0.001 * ctx!.sampleRate);
    const buf = ctx!.createBuffer(1, len, ctx!.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++)
      d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (d.length * decay));
    return buf;
  }
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = freq;
  const oscG = ctx.createGain();
  oscG.gain.setValueAtTime(vol * 0.6, t);
  oscG.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(oscG).connect(ctx.destination);
  osc.start(t); osc.stop(t + dur + 0.001);
  const clkSrc = ctx.createBufferSource();
  clkSrc.buffer = noiseBuf(4, 0.08);
  const clkBP = ctx.createBiquadFilter();
  clkBP.type = "bandpass"; clkBP.frequency.value = 4000; clkBP.Q.value = 3.5;
  const clkG = ctx.createGain();
  clkG.gain.setValueAtTime(vol * 0.8, t);
  clkG.gain.exponentialRampToValueAtTime(0.0001, t + 0.005);
  clkSrc.connect(clkBP).connect(clkG).connect(ctx.destination);
  clkSrc.start(t);
}

function scheduleThud(when: number, vol = 0.4) {
  const ctx = getAudio();
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(180, t);
  osc.frequency.exponentialRampToValueAtTime(50, t + 0.25);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.4);
}

interface ToneOpts {
  when: number;
  type?: OscillatorType;
  freqStart: number;
  freqEnd?: number;
  duration: number;
  volume: number;
}

function _tone({ when, type = "sine", freqStart, freqEnd, duration, volume }: ToneOpts) {
  const ctx = getAudio();
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freqStart, t);
  if (freqEnd != null && freqEnd !== freqStart)
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + duration);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + duration + 0.05);
}

function _shimmer({ when, duration = 0.4, volume = 0.12 }: { when: number; duration?: number; volume?: number }) {
  const ctx = getAudio();
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const src = ctx.createBufferSource();
  const buf = ctx.createBuffer(1, duration * ctx.sampleRate, ctx.sampleRate);
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

export function playLanding(tier: string, when = 0) {
  const ctx = getAudio();
  if (!ctx) return;

  if (_cardAppearBuf) {
    // WAV-based — per-rarity: offset into WAV + rate + vol
    // WAV structure: small click at ~420ms, main impact at ~1550ms, long tail
    const profiles: Record<string, { offset: number; rate: number; vol: number; shimmer?: boolean }> = {
      BRONZE:  { offset: 0.38, rate: 0.75, vol: 0.50 },              // small click, dark/dull
      SILVER:  { offset: 0.38, rate: 0.90, vol: 0.65 },              // small click, brighter
      GOLD:    { offset: 1.50, rate: 1.00, vol: 0.80, shimmer: true },// full impact
      DIAMOND: { offset: 1.45, rate: 1.10, vol: 1.00, shimmer: true },// more buildup + brighter
      ICON:    { offset: 1.35, rate: 1.25, vol: 1.15, shimmer: true },// max buildup + highest pitch
    };
    const p = profiles[tier] ?? profiles.BRONZE;
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = _cardAppearBuf;
    src.playbackRate.value = p.rate;
    const g = ctx.createGain();
    g.gain.setValueAtTime(p.vol, t);
    src.connect(g).connect(ctx.destination);
    src.start(t, p.offset);
    // keep shimmer layer on top for premium rarities
    if (p.shimmer) {
      const shimmerDur = tier === "ICON" ? 0.85 : 0.5;
      _shimmer({ when: when + 0.05, duration: shimmerDur, volume: tier === "ICON" ? 0.16 : 0.08 });
    }
    return;
  }

  // ── Synthesis fallback ────────────────────────────────────────────────────
  const profiles: Record<string, () => void> = {
    BRONZE() {
      _tone({ when, type: "sine", freqStart: 150, freqEnd: 45, duration: 0.28, volume: 0.28 });
      _tone({ when: when + 0.01, type: "triangle", freqStart: 500, freqEnd: 300, duration: 0.08, volume: 0.08 });
    },
    SILVER() {
      _tone({ when, type: "sine", freqStart: 180, freqEnd: 55, duration: 0.3, volume: 0.32 });
      _tone({ when: when + 0.02, type: "triangle", freqStart: 880, freqEnd: 660, duration: 0.14, volume: 0.11 });
    },
    GOLD() {
      _tone({ when, type: "sine", freqStart: 210, freqEnd: 65, duration: 0.35, volume: 0.36 });
      _tone({ when: when + 0.02, type: "triangle", freqStart: 1175, freqEnd: 880, duration: 0.18, volume: 0.18 });
      _tone({ when: when + 0.08, type: "sine", freqStart: 1568, freqEnd: 1320, duration: 0.3, volume: 0.13 });
      _shimmer({ when: when + 0.04, duration: 0.25, volume: 0.05 });
    },
    DIAMOND() {
      _tone({ when, type: "sine", freqStart: 240, freqEnd: 70, duration: 0.42, volume: 0.4 });
      [1318.5, 1760.0, 2349.3].forEach((f, i) => {
        _tone({ when: when + 0.06 + i * 0.07, type: "sine", freqStart: f, freqEnd: f * 0.95, duration: 0.32, volume: 0.16 });
      });
      _shimmer({ when: when + 0.05, duration: 0.5, volume: 0.1 });
    },
    ICON() {
      _tone({ when, type: "sine", freqStart: 75, freqEnd: 22, duration: 0.7, volume: 0.55 });
      _tone({ when, type: "sine", freqStart: 160, freqEnd: 50, duration: 0.55, volume: 0.32 });
      [261.6, 329.6, 392.0, 587.3].forEach((f) => {
        _tone({ when: when + 0.05, type: "sine", freqStart: f, freqEnd: f, duration: 0.75, volume: 0.16 });
        _tone({ when: when + 0.05, type: "triangle", freqStart: f * 2, freqEnd: f * 2, duration: 0.5, volume: 0.07 });
      });
      [2637, 2349, 2093, 1864, 1568].forEach((f, i) => {
        _tone({ when: when + 0.2 + i * 0.07, type: "sine", freqStart: f, freqEnd: f * 0.95, duration: 0.42, volume: 0.13 });
      });
      _shimmer({ when: when + 0.05, duration: 0.85, volume: 0.16 });
    },
  };
  (profiles[tier] ?? profiles.BRONZE)();
}

function schedulePackTear(when: number, vol = 0.25) {
  const ctx = getAudio();
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const dur = 0.35;
  const src = ctx.createBufferSource();
  const buf = ctx.createBuffer(1, dur * ctx.sampleRate, ctx.sampleRate);
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

// ─── Cubic-bezier inverse (Newton's method) ─────────────────────────────────

function cubicBezierY(x1: number, y1: number, x2: number, y2: number) {
  return function (xTarget: number) {
    let t = xTarget;
    for (let i = 0; i < 10; i++) {
      const bx = 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
      const dx =
        3 * (1 - t) * (1 - t) * x1 +
        6 * (1 - t) * t * (x2 - x1) +
        3 * t * t * (1 - x2);
      if (Math.abs(dx) < 1e-6) break;
      t -= (bx - xTarget) / dx;
      t = Math.max(0, Math.min(1, t));
    }
    return (
      3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t
    );
  };
}

// ─── Rarity palette (must match reveal CSS classes) ─────────────────────────

const RARITY: Record<string, { from: string; to: string; glow: string; label: string }> = {
  BRONZE:  { from: "#a06a3b", to: "#3e2510", glow: "rgba(160,106,59,0.4)",   label: "#e0c6a3" },
  SILVER:  { from: "#aab4c0", to: "#3e4654", glow: "rgba(170,180,192,0.45)", label: "#e6ebf2" },
  GOLD:    { from: "#e8b94a", to: "#7a5b1a", glow: "rgba(232,185,74,0.5)",   label: "#fff3d2" },
  DIAMOND: { from: "#8ec5d8", to: "#2a5b6f", glow: "rgba(142,197,216,0.55)", label: "#dff0f7" },
  ICON:    { from: "#d9b5ff", to: "#3f2860", glow: "rgba(217,181,255,0.65)", label: "#f0e2ff" },
  LEGACY:  { from: "#8a8a92", to: "#2c2c34", glow: "rgba(138,138,146,0.22)", label: "#cccccd" },
};

export { RARITY };

// ─── Tile factory ────────────────────────────────────────────────────────────

function buildTile(card: RevealCard, isTarget: boolean): HTMLElement {
  const r = RARITY[card.tier] ?? RARITY.GOLD;
  const el = document.createElement("div");
  el.className = "csv-tile" + (isTarget ? " csv-tile--target" : "");
  el.style.cssText = `--from:${r.from};--to:${r.to};--glow:${r.glow};--label:${r.label}`;
  el.innerHTML = `
    <div class="csv-tile-sheen"></div>
    <div>
      <div class="csv-tile-ovr">${card.ovr != null ? card.ovr : "?"}</div>
      <div class="csv-tile-tier">${card.tier || "?"}</div>
    </div>
    ${card.name ? `<div class="csv-tile-name">${card.name}</div>` : ""}
  `;
  return el;
}

// ─── openPack ────────────────────────────────────────────────────────────────

const DEFAULT_PREVIEW: RevealCard[] = [
  { tier: "SILVER",  ovr: 78 },
  { tier: "GOLD",    ovr: 84 },
  { tier: "ICON",    ovr: 99 },
  { tier: "DIAMOND", ovr: 91 },
  { tier: "GOLD",    ovr: 86 },
];

export function openPack(opts: OpenPackOpts): Promise<void> {
  const { container, label = "DAILY", previewCards = DEFAULT_PREVIEW, onComplete } = opts;
  if (!container) throw new Error("openPack: container required");

  container.classList.add("csv-root");
  const fanRotations = [-32, -16, 0, 16, 32];

  container.innerHTML = `
    <div class="csv-pack">
      <div class="csv-pack-rays"></div>
      <div class="csv-pack-top"><div class="csv-pack-top-label">${label}</div></div>
      <div class="csv-pack-bottom"></div>
      <div class="csv-pack-burst"></div>
      ${previewCards.map((_, i) => `<div class="csv-pack-card" style="--rot:${fanRotations[i] ?? 0}deg"></div>`).join("")}
      ${[0, 1, 2, 3, 4, 5].map((i) => `<div class="csv-pack-particle csv-pack-particle-${i}"></div>`).join("")}
    </div>
  `;

  const pack = container.querySelector(".csv-pack")!;
  const slots = pack.querySelectorAll<HTMLElement>(".csv-pack-card");
  previewCards.forEach((c, i) => {
    if (slots[i]) slots[i].appendChild(buildTile(c, i === 2));
  });

  return new Promise((resolve) => {
    const audio = getAudio();
    if (audio) {
      preloadTickBuffer(); // kick off WAV load during pack animation (2.4s to finish)
      if (_packAppearBuf) {
        const src = audio.createBufferSource();
        src.buffer = _packAppearBuf;
        const g = audio.createGain();
        g.gain.setValueAtTime(1.0, audio.currentTime);
        src.connect(g).connect(audio.destination);
        // skip 300ms of silence — aligns WAV peak (~750ms) with visual tear (400ms)
        src.start(audio.currentTime, 0.30);
      } else {
        // synthesis fallback if WAV not yet loaded
        scheduleTick(0,    { freq: 1200, vol: 0.1 });
        scheduleTick(0.15, { freq: 1200, vol: 0.1 });
        scheduleTick(0.30, { freq: 1200, vol: 0.1 });
        schedulePackTear(0.40, 0.3);
        scheduleThud(0.60, 0.3);
      }
    }

    pack.classList.add("csv-pack--shaking");
    setTimeout(() => {
      pack.classList.remove("csv-pack--shaking");
      pack.classList.add("csv-pack--opening");
    }, 400);
    setTimeout(() => {
      onComplete?.();
      resolve();
    }, 2400);
  });
}

// ─── spinWheel ───────────────────────────────────────────────────────────────

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
    duration = 4500,
    label = "RÉVÉLATION",
    onComplete,
  } = opts;
  if (!container) throw new Error("spinWheel: container required");

  const TARGET_INDEX = 70;
  const POST_TILES = 14;

  const tiles: RevealCard[] = [];
  for (let i = 0; i < TARGET_INDEX; i++) tiles.push(pool[i % pool.length]);
  tiles.push(target);
  for (let i = 0; i < POST_TILES; i++) tiles.push(pool[(i + 3) % pool.length]);

  container.classList.add("csv-root");
  container.innerHTML = `
    <div class="csv-wheel">
      <div class="csv-wheel-label">${label}</div>
      <div class="csv-wheel-pointer"></div>
      <div class="csv-wheel-spotlight"></div>
      <div class="csv-wheel-mask"></div>
      <div class="csv-wheel-strip"></div>
      <div class="csv-wheel-meter"><div class="csv-wheel-meter-fill"></div></div>
    </div>
  `;

  const strip = container.querySelector<HTMLElement>(".csv-wheel-strip")!;
  const meter = container.querySelector<HTMLElement>(".csv-wheel-meter-fill")!;
  // All tiles look identical during spin — target has no name and no special size yet
  tiles.forEach((t, i) => {
    const card = i === TARGET_INDEX ? { tier: t.tier, ovr: t.ovr } : t;
    strip.appendChild(buildTile(card, false));
  });

  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      const wheel = container.querySelector<HTMLElement>(".csv-wheel")!;
      const containerW = wheel.clientWidth;
      const targetTile = strip.children[TARGET_INDEX] as HTMLElement;
      const tileCenter = targetTile.offsetLeft + targetTile.offsetWidth / 2;
      const jitter = (Math.random() - 0.5) * 24;
      const finalX = containerW / 2 - tileCenter + jitter;

      const easing = "cubic-bezier(0.05, 0.85, 0.08, 1)";
      const invEase = cubicBezierY(0.85, 0.05, 1, 0.08);

      const audio = getAudio();
      if (audio) {
        const tickTimes: number[] = [];
        for (let i = 1; i <= TARGET_INDEX; i++) {
          const tileEl = strip.children[i] as HTMLElement;
          const tileC = tileEl.offsetLeft + tileEl.offsetWidth / 2;
          const txAt_i = containerW / 2 - tileC;
          const progress = finalX === 0 ? 1 : txAt_i / finalX;
          if (progress < 0.001 || progress > 1) continue;
          const tProg = invEase(progress);
          tickTimes.push(tProg * duration);
        }
        const filtered: number[] = [];
        let last = -Infinity;
        tickTimes.forEach((t) => {
          if (t - last >= 22) { filtered.push(t); last = t; }
        });
        filtered.forEach((tMs, idx) => {
          const remaining = filtered.length - idx;
          const drama = Math.max(0, 8 - remaining) / 8;
          const freq = 1700 + drama * 400;  // subtle pitch rise toward landing
          const volBase = 0.14 + drama * 0.18;  // global réduit → 0.32 max
          const vol = remaining === 1 ? volBase * 0.65 : volBase;  // dernier tick -35%
          scheduleTick(tMs / 1000, { freq, vol });
        });
        playLanding(target.tier ?? "BRONZE", duration / 1000 + 0.35);
      }

      requestAnimationFrame(() => {
        strip.style.transition = `transform ${duration}ms ${easing}`;
        strip.style.transform = `translateX(${finalX}px)`;
        meter.style.transition = `width ${duration}ms ${easing}`;
        meter.style.width = "100%";
      });

      setTimeout(() => {
        // Reveal: winner glow + name appear, landing flash plays
        targetTile.classList.add("csv-tile--winner", "csv-tile--landed");
        if (target.name) {
          const nameEl = document.createElement("div");
          nameEl.className = "csv-tile-name";
          nameEl.textContent = target.name;
          targetTile.appendChild(nameEl);
        }
        onComplete?.(target);
        resolve(target);
      }, duration);
    });
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
