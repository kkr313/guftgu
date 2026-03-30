/**
 * sounds.ts — Synthesized notification sounds via Web Audio API.
 * Each sound creates its own short-lived AudioContext to avoid shared-state
 * suspension issues (browsers suspend AudioContext without a recent gesture).
 * A global click/touch listener pre-warms audio on first user interaction.
 */

// Pre-warm: create and immediately close a short ctx on first gesture so
// subsequent sounds play instantly without waiting for resumption.
let audioUnlocked = false;
function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  try {
    const c = new (window.AudioContext || (window as any).webkitAudioContext)();
    // Resume and immediately suspend — this satisfies browsers' "user gesture" requirement
    c.resume().then(() => c.close()).catch(() => {});
  } catch {/* ignore */}
}

// Attach unlock to first user gesture (runs once)
if (typeof window !== 'undefined') {
  ['click', 'touchstart', 'keydown', 'pointerdown'].forEach(evt => {
    window.addEventListener(evt, unlockAudio, { once: true, passive: true });
  });
}

// Cooldown map to debounce sounds (prevents burst duplicates)
const lastPlayed: Record<string, number> = {};
function canPlay(key: string, cooldownMs = 300): boolean {
  const now = Date.now();
  if (now - (lastPlayed[key] || 0) < cooldownMs) return false;
  lastPlayed[key] = now;
  return true;
}

/**
 * Core: play a sequence of tones using a fresh AudioContext.
 * Each call is fully self-contained — no shared state to go stale.
 */
function playTones(tones: { freq: number; duration: number; gainPeak?: number; startDelay?: number; type?: OscillatorType }[]): void {
  try {
    const c = new (window.AudioContext || (window as any).webkitAudioContext)();
    const scheduleAll = () => {
      tones.forEach(({ freq, duration, gainPeak = 0.18, startDelay = 0, type = 'sine' }) => {
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.connect(gain);
        gain.connect(c.destination);

        osc.type = type;
        osc.frequency.value = freq;

        const t = c.currentTime + startDelay;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(gainPeak, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

        osc.start(t);
        osc.stop(t + duration + 0.05);
      });

      // Auto-close context after tones finish (last tone's end + buffer)
      const maxEnd = Math.max(...tones.map(t => (t.startDelay || 0) + t.duration)) + 0.2;
      setTimeout(() => c.close().catch(() => {}), maxEnd * 1000);
    };

    if (c.state === 'suspended') {
      c.resume().then(scheduleAll).catch(() => c.close().catch(() => {}));
    } else {
      scheduleAll();
    }
  } catch {
    /* AudioContext not supported or blocked — fail silently */
  }
}

/** 💬 Message received — two ascending soft chimes */
export function playMessageSound(): void {
  if (!canPlay('msg', 300)) return;
  playTones([
    { freq: 880, duration: 0.18, gainPeak: 0.16, startDelay: 0 },
    { freq: 1100, duration: 0.20, gainPeak: 0.12, startDelay: 0.12 },
  ]);
}

/** 🔔 Notification received — single warm bell */
export function playNotifSound(): void {
  if (!canPlay('notif', 500)) return;
  playTones([
    { freq: 660, duration: 0.28, gainPeak: 0.14, startDelay: 0 },
    { freq: 990, duration: 0.22, gainPeak: 0.08, startDelay: 0.10 },
  ]);
}

/** 🟢 Friend came online — two quick rising tones */
export function playFriendOnlineSound(): void {
  if (!canPlay('friendOnline', 1000)) return;
  playTones([
    { freq: 520, duration: 0.12, gainPeak: 0.10, startDelay: 0 },
    { freq: 780, duration: 0.15, gainPeak: 0.09, startDelay: 0.10 },
  ]);
}

// ──────────────────────────────────────────────────────────────────────────────
// RINGTONE & RINGBACK — looping sounds with stop handles
// ──────────────────────────────────────────────────────────────────────────────

interface LoopHandle {
  stop: () => void;
}

/**
 * 📞 Incoming call ringtone — loud, musical phone-ring pattern.
 * Produces a two-tone arpeggio that repeats every 2 seconds.
 * Returns a handle with a `stop()` method.
 */
export function playIncomingRingtone(): LoopHandle {
  let stopped = false;
  let ctx: AudioContext | null = null;
  let intervalId: ReturnType<typeof setInterval> | null = null;

  try {
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

    const ringCycle = () => {
      if (stopped || !ctx || ctx.state === 'closed') return;

      // Musical ring: quick ascending triads (like a phone ringing)
      const notes = [
        // First ring burst — rising 3-note arpeggio
        { freq: 784, delay: 0, dur: 0.12 },    // G5
        { freq: 988, delay: 0.13, dur: 0.12 },  // B5
        { freq: 1175, delay: 0.26, dur: 0.14 }, // D6
        // Second ring burst — same but slightly higher
        { freq: 784, delay: 0.50, dur: 0.12 },
        { freq: 988, delay: 0.63, dur: 0.12 },
        { freq: 1175, delay: 0.76, dur: 0.14 },
      ];

      notes.forEach(({ freq, delay, dur }) => {
        if (!ctx || ctx.state === 'closed') return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;

        const t = ctx.currentTime + delay;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.45, t + 0.02);  // Loud!
        gain.gain.setValueAtTime(0.45, t + dur * 0.6);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

        osc.start(t);
        osc.stop(t + dur + 0.05);
      });
    };

    const startRinging = () => {
      ringCycle();
      intervalId = setInterval(ringCycle, 2000); // Ring every 2 seconds
    };

    if (ctx.state === 'suspended') {
      ctx.resume().then(startRinging).catch(() => {});
    } else {
      startRinging();
    }
  } catch (_) {
    /* AudioContext not supported */
  }

  return {
    stop: () => {
      stopped = true;
      if (intervalId) { clearInterval(intervalId); intervalId = null; }
      if (ctx) { ctx.close().catch(() => {}); ctx = null; }
    },
  };
}

/**
 * 📱 Outgoing call ringback — standard "ring-ring...pause" tone.
 * Sounds like a traditional phone ringback (comfort tone).
 * Returns a handle with a `stop()` method.
 */
export function playOutgoingRingback(): LoopHandle {
  let stopped = false;
  let ctx: AudioContext | null = null;
  let intervalId: ReturnType<typeof setInterval> | null = null;

  try {
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

    const ringbackCycle = () => {
      if (stopped || !ctx || ctx.state === 'closed') return;

      // Standard US ringback: 440Hz + 480Hz dual-tone, 2s on / 4s off
      // We play a 1.5s burst every 4 seconds
      [440, 480].forEach((freq) => {
        if (!ctx || ctx.state === 'closed') return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;

        const t = ctx.currentTime;
        // Each tone at half volume so combined is reasonable
        gain.gain.setValueAtTime(0.18, t);
        gain.gain.setValueAtTime(0.18, t + 1.4);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 1.5);

        osc.start(t);
        osc.stop(t + 1.55);
      });
    };

    const startRingback = () => {
      ringbackCycle();
      intervalId = setInterval(ringbackCycle, 4000); // 1.5s tone + 2.5s silence
    };

    if (ctx.state === 'suspended') {
      ctx.resume().then(startRingback).catch(() => {});
    } else {
      startRingback();
    }
  } catch (_) {
    /* AudioContext not supported */
  }

  return {
    stop: () => {
      stopped = true;
      if (intervalId) { clearInterval(intervalId); intervalId = null; }
      if (ctx) { ctx.close().catch(() => {}); ctx = null; }
    },
  };
}
