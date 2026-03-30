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
