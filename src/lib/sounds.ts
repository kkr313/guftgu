/**
 * sounds.ts — Synthesized notification sounds via Web Audio API.
 * No audio files needed. Works on any modern browser.
 * Sounds are soft and non-intrusive.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (!ctx || ctx.state === 'closed') {
      ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    return ctx;
  } catch {
    return null;
  }
}

/** Resume context if suspended (browsers require user gesture first) */
async function resume(): Promise<AudioContext | null> {
  const c = getCtx();
  if (!c) return null;
  if (c.state === 'suspended') {
    try { await c.resume(); } catch { return null; }
  }
  return c;
}

function playTone(
  freq: number,
  duration: number,
  type: OscillatorType = 'sine',
  gainPeak = 0.18,
  startDelay = 0,
): void {
  resume().then(c => {
    if (!c) return;
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
    osc.stop(t + duration + 0.01);
  });
}

/** 🔔 Message received — two ascending soft chimes */
export function playMessageSound(): void {
  playTone(880, 0.18, 'sine', 0.15, 0);
  playTone(1100, 0.2, 'sine', 0.12, 0.12);
}

/** 🔔 Notification received — single warm bell */
export function playNotifSound(): void {
  playTone(660, 0.28, 'sine', 0.14, 0);
  playTone(990, 0.22, 'sine', 0.08, 0.08);
}

/** 🟢 Friend came online — two quick rising tones */
export function playFriendOnlineSound(): void {
  playTone(520, 0.12, 'sine', 0.1, 0);
  playTone(780, 0.15, 'sine', 0.09, 0.1);
}
