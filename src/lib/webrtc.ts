/**
 * WebRTC Voice Call Engine
 * Handles: peer connection, SDP offer/answer, ICE candidates, audio streams
 *
 * Firebase Realtime Database is used for signaling:
 * - rooms/{roomId}/offer — SDP offer from caller
 * - rooms/{roomId}/answer — SDP answer from callee
 * - rooms/{roomId}/callerCandidates — ICE candidates from caller
 * - rooms/{roomId}/calleeCandidates — ICE candidates from callee
 * - rooms/{roomId}/callEnded — Set to true when call ends
 * - rooms/{roomId}/callBlocked — Set to true if one party blocked the other
 */

import {
  Database,
  ref,
  set,
  get,
  remove,
  onValue,
  onChildAdded,
  off,
  push,
  onDisconnect,
} from 'firebase/database';

// ══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ══════════════════════════════════════════════════════════════════════════════

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
  ],
};

// ══════════════════════════════════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════════════════════════════════

let peerConnection: RTCPeerConnection | null = null;
let localStream: MediaStream | null = null;
let remoteAudio: HTMLAudioElement | null = null;
let currentRoomId: string | null = null;
let isCaller = false;
let callListeners: Array<() => void> = [];
let pendingMuteState: boolean | null = null; // Queued mute state if set before stream is ready
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
const RECONNECT_TIMEOUT_MS = 15000; // 15 seconds before giving up reconnection

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Generate a random room ID.
 */
export function generateRoomId(): string {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
}

/**
 * Get microphone access with echo cancellation and noise suppression.
 */
async function getMicrophoneStream(): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 16000,
      channelCount: 1,
    },
  });

  // Apply any pending mute state that was set before the stream was ready
  if (pendingMuteState !== null) {
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !pendingMuteState;
    });
    pendingMuteState = null;
  }

  return stream;
}

/**
 * Create or get the remote audio element.
 */
function ensureRemoteAudio(): HTMLAudioElement {
  if (!remoteAudio) {
    remoteAudio = document.createElement('audio');
    remoteAudio.autoplay = true;
    (remoteAudio as any).playsInline = true; // Safari compatibility
    document.body.appendChild(remoteAudio);
  }
  return remoteAudio;
}

/**
 * Create a new RTCPeerConnection with event handlers.
 * Handles ICE state transitions:
 *  - connected/completed → onConnected
 *  - disconnected → onReconnecting (temporary, 15s timeout before fail)
 *  - reconnected after disconnect → onReconnected
 *  - failed/closed → onDisconnected (permanent)
 */
function createPeerConnection(
  onConnected: () => void,
  onDisconnected: () => void,
  onReconnecting?: () => void,
  onReconnected?: () => void
): RTCPeerConnection {
  const pc = new RTCPeerConnection(ICE_SERVERS);
  let wasConnected = false;

  pc.ontrack = (event) => {
    const audio = ensureRemoteAudio();
    if (audio.srcObject !== event.streams[0]) {
      audio.srcObject = event.streams[0];
    }
  };

  pc.oniceconnectionstatechange = () => {
    const state = pc.iceConnectionState;
    console.log('[WebRTC] ICE connection state:', state);

    if (state === 'connected' || state === 'completed') {
      // Clear any pending reconnect timer
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }

      if (wasConnected) {
        // Was previously connected → this is a reconnection
        console.log('[WebRTC] Reconnected after temporary disconnect');
        onReconnected?.();
      } else {
        wasConnected = true;
        onConnected();
      }
    } else if (state === 'disconnected') {
      // Temporary disconnection — ICE will attempt to recover
      // Start a timeout; if it doesn't reconnect, treat as failed
      console.log('[WebRTC] ICE disconnected — waiting for reconnection...');
      onReconnecting?.();

      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        // Check if still disconnected after timeout
        if (peerConnection && peerConnection.iceConnectionState === 'disconnected') {
          console.log('[WebRTC] Reconnection timed out after', RECONNECT_TIMEOUT_MS, 'ms');
          onDisconnected();
        }
      }, RECONNECT_TIMEOUT_MS);
    } else if (state === 'failed' || state === 'closed') {
      // Permanent failure — end immediately
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      console.log('[WebRTC] ICE', state, '— call ended');
      onDisconnected();
    }
  };

  return pc;
}

// ══════════════════════════════════════════════════════════════════════════════
// CALLER — Create Room
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Create a WebRTC room as the caller.
 * 1. Get mic access
 * 2. Create peer connection
 * 3. Create and send SDP offer
 * 4. Listen for SDP answer
 * 5. Exchange ICE candidates
 */
export async function createRoom(
  db: Database,
  roomId: string,
  onConnected: () => void,
  onDisconnected: () => void,
  onError: (error: Error) => void,
  onReconnecting?: () => void,
  onReconnected?: () => void
): Promise<void> {
  try {
    currentRoomId = roomId;
    isCaller = true;

    // Get microphone
    localStream = await getMicrophoneStream();

    // Create peer connection
    peerConnection = createPeerConnection(onConnected, onDisconnected, onReconnecting, onReconnected);

    // Add local audio tracks
    localStream.getTracks().forEach((track) => {
      peerConnection!.addTrack(track, localStream!);
    });

    // Set up room references
    const roomRef = ref(db, `rooms/${roomId}`);
    const callerCandidatesRef = ref(db, `rooms/${roomId}/callerCandidates`);
    const calleeCandidatesRef = ref(db, `rooms/${roomId}/calleeCandidates`);

    // Set up onDisconnect cleanup
    onDisconnect(roomRef).remove();

    // Collect ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        push(callerCandidatesRef, event.candidate.toJSON());
      }
    };

    // Create offer
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    // Write offer to Firebase
    await set(ref(db, `rooms/${roomId}/offer`), {
      type: offer.type,
      sdp: offer.sdp,
    });

    // Listen for answer
    const answerListener = onValue(ref(db, `rooms/${roomId}/answer`), async (snap) => {
      if (!snap.exists() || !peerConnection) return;
      const answer = snap.val() as RTCSessionDescriptionInit;
      if (!peerConnection.currentRemoteDescription) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });
    callListeners.push(() => off(ref(db, `rooms/${roomId}/answer`), 'value', answerListener));

    // Listen for callee's ICE candidates
    const calleeListener = onChildAdded(calleeCandidatesRef, async (snap) => {
      if (!peerConnection) return;
      const candidate = snap.val();
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    });
    callListeners.push(() => off(calleeCandidatesRef, 'child_added', calleeListener));

    // Listen for call ended signal
    const endedListener = onValue(ref(db, `rooms/${roomId}/callEnded`), (snap) => {
      if (snap.exists() && snap.val() === true) {
        onDisconnected();
      }
    });
    callListeners.push(() => off(ref(db, `rooms/${roomId}/callEnded`), 'value', endedListener));

  } catch (error) {
    onError(error instanceof Error ? error : new Error('Failed to create room'));
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// CALLEE — Join Room
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Join an existing WebRTC room as the callee.
 * 1. Get mic access
 * 2. Create peer connection
 * 3. Get SDP offer from Firebase
 * 4. Send SDP answer
 * 5. Exchange ICE candidates
 */
export async function joinRoom(
  db: Database,
  roomId: string,
  onConnected: () => void,
  onDisconnected: () => void,
  onError: (error: Error) => void,
  onReconnecting?: () => void,
  onReconnected?: () => void
): Promise<void> {
  try {
    currentRoomId = roomId;
    isCaller = false;

    // Get microphone
    localStream = await getMicrophoneStream();

    // Create peer connection
    peerConnection = createPeerConnection(onConnected, onDisconnected, onReconnecting, onReconnected);

    // Add local audio tracks
    localStream.getTracks().forEach((track) => {
      peerConnection!.addTrack(track, localStream!);
    });

    // Set up room references
    const roomRef = ref(db, `rooms/${roomId}`);
    const callerCandidatesRef = ref(db, `rooms/${roomId}/callerCandidates`);
    const calleeCandidatesRef = ref(db, `rooms/${roomId}/calleeCandidates`);

    // Set up onDisconnect cleanup for callee too (caller already sets this)
    onDisconnect(roomRef).remove();

    // Collect ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        push(calleeCandidatesRef, event.candidate.toJSON());
      }
    };

    // Get offer from Firebase
    const offerSnap = await get(ref(db, `rooms/${roomId}/offer`));
    if (!offerSnap.exists()) {
      throw new Error('No offer found in room');
    }
    const offer = offerSnap.val() as RTCSessionDescriptionInit;

    // Set remote description (offer)
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    // Create answer
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    // Write answer to Firebase
    await set(ref(db, `rooms/${roomId}/answer`), {
      type: answer.type,
      sdp: answer.sdp,
    });

    // Listen for caller's ICE candidates
    const callerListener = onChildAdded(callerCandidatesRef, async (snap) => {
      if (!peerConnection) return;
      const candidate = snap.val();
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    });
    callListeners.push(() => off(callerCandidatesRef, 'child_added', callerListener));

    // Listen for call ended signal
    const endedListener = onValue(ref(db, `rooms/${roomId}/callEnded`), (snap) => {
      if (snap.exists() && snap.val() === true) {
        onDisconnected();
      }
    });
    callListeners.push(() => off(ref(db, `rooms/${roomId}/callEnded`), 'value', endedListener));

  } catch (error) {
    onError(error instanceof Error ? error : new Error('Failed to join room'));
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// CALL CONTROLS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Mute/unmute local microphone.
 * If the stream isn't ready yet (async WebRTC setup), queues the state
 * so it's applied as soon as the microphone stream is obtained.
 */
export function setMuted(muted: boolean): void {
  if (localStream) {
    localStream.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
    pendingMuteState = null; // Clear any pending state
  } else {
    // Stream not ready yet — queue the mute state for when it arrives
    pendingMuteState = muted;
  }
}

/**
 * Check if currently muted.
 */
export function isMuted(): boolean {
  if (!localStream) return true;
  const tracks = localStream.getAudioTracks();
  return tracks.length === 0 || !tracks[0].enabled;
}

/**
 * End the call and signal to the other party.
 */
export async function endCall(db: Database | null, blocked = false): Promise<void> {
  const roomId = currentRoomId; // Save before cleanup nullifies it
  
  if (db && roomId) {
    // Signal call ended
    await set(ref(db, `rooms/${roomId}/callEnded`), true);
    if (blocked) {
      await set(ref(db, `rooms/${roomId}/callBlocked`), true);
    }
  }

  cleanup();

  // Clean up room data from Firebase after a short delay (let signal propagate first)
  if (db && roomId) {
    setTimeout(() => {
      remove(ref(db, `rooms/${roomId}`)).catch(() => {});
    }, 3000);
  }
}

/**
 * Clean up all WebRTC resources.
 */
export function cleanup(): void {
  // Clear reconnection timer
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }

  // Remove all listeners
  callListeners.forEach((cleanup) => cleanup());
  callListeners = [];

  // Close peer connection — nullify event handlers FIRST to prevent
  // oniceconnectionstatechange('closed') from firing stale callbacks
  if (peerConnection) {
    peerConnection.oniceconnectionstatechange = null;
    peerConnection.ontrack = null;
    peerConnection.onicecandidate = null;
    peerConnection.close();
    peerConnection = null;
  }

  // Stop local stream
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
    localStream = null;
  }

  // Clean up remote audio
  if (remoteAudio) {
    remoteAudio.srcObject = null;
    if (remoteAudio.parentNode) {
      remoteAudio.parentNode.removeChild(remoteAudio);
    }
    remoteAudio = null;
  }

  currentRoomId = null;
  isCaller = false;
  pendingMuteState = null;
}

/**
 * Get current room ID.
 */
export function getCurrentRoomId(): string | null {
  return currentRoomId;
}

/**
 * Check if we are the caller.
 */
export function getIsCaller(): boolean {
  return isCaller;
}

/**
 * Get current ICE connection state.
 */
export function getConnectionState(): RTCIceConnectionState | null {
  return peerConnection ? peerConnection.iceConnectionState : null;
}

// ══════════════════════════════════════════════════════════════════════════════
// DEMO MODE (No Firebase)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Start a demo call without Firebase — just simulates connection.
 */
export async function startDemoCall(
  onConnected: () => void,
  onError: (error: Error) => void
): Promise<void> {
  try {
    // Try to get mic access (validates permissions)
    localStream = await getMicrophoneStream();

    // Simulate connection delay
    setTimeout(() => {
      onConnected();
    }, 1500);
  } catch (error) {
    onError(error instanceof Error ? error : new Error('Mic access denied'));
  }
}

/**
 * End a demo call.
 */
export function endDemoCall(): void {
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
    localStream = null;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// MUTE STATE SIGNALING
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Write my mute state to Firebase so the other party can see it.
 * Path: rooms/{roomId}/muted/{myPhone}
 */
export function signalMuteState(db: Database, myPhone: string, muted: boolean): void {
  if (!currentRoomId) return;
  const mutedRef = ref(db, `rooms/${currentRoomId}/muted/${myPhone}`);
  if (muted) {
    set(mutedRef, true).catch(() => {});
  } else {
    remove(mutedRef).catch(() => {});
  }
}

/**
 * Listen for the other party's mute state.
 * Returns cleanup function.
 */
export function listenPeerMuteState(
  db: Database,
  peerPhone: string,
  onMuteChange: (muted: boolean) => void
): () => void {
  if (!currentRoomId) return () => {};
  const mutedRef = ref(db, `rooms/${currentRoomId}/muted/${peerPhone}`);
  let cleaned = false;

  const listener = onValue(mutedRef, (snap) => {
    if (cleaned) return;
    onMuteChange(snap.exists() && snap.val() === true);
  });

  return () => {
    cleaned = true;
    off(mutedRef, 'value', listener);
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// AUDIO FEEDBACK
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Play a short "call ended" tone for audio feedback.
 * Two descending beeps: boop-boop (like a real phone call ending).
 */
export function playCallEndedTone(): void {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

    const beep = (freq: number, startAt: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.25, ctx.currentTime + startAt);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + startAt + dur);
      osc.start(ctx.currentTime + startAt);
      osc.stop(ctx.currentTime + startAt + dur);
    };

    // Descending two-tone: 480Hz → 380Hz (classic call-ended sound)
    beep(480, 0, 0.2);
    beep(380, 0.25, 0.3);

    // Auto-close audio context after tones finish
    setTimeout(() => ctx.close().catch(() => {}), 800);
  } catch (_) {
    // Web Audio API not available — silent fallback
  }
}
