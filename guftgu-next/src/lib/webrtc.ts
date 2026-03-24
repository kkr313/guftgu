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
  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 16000,
      channelCount: 1,
    },
  });
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
 */
function createPeerConnection(
  onConnected: () => void,
  onDisconnected: () => void
): RTCPeerConnection {
  const pc = new RTCPeerConnection(ICE_SERVERS);

  pc.ontrack = (event) => {
    const audio = ensureRemoteAudio();
    if (audio.srcObject !== event.streams[0]) {
      audio.srcObject = event.streams[0];
    }
  };

  pc.oniceconnectionstatechange = () => {
    const state = pc.iceConnectionState;
    if (state === 'connected' || state === 'completed') {
      onConnected();
    } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
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
  onError: (error: Error) => void
): Promise<void> {
  try {
    currentRoomId = roomId;
    isCaller = true;

    // Get microphone
    localStream = await getMicrophoneStream();

    // Create peer connection
    peerConnection = createPeerConnection(onConnected, onDisconnected);

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
  onError: (error: Error) => void
): Promise<void> {
  try {
    currentRoomId = roomId;
    isCaller = false;

    // Get microphone
    localStream = await getMicrophoneStream();

    // Create peer connection
    peerConnection = createPeerConnection(onConnected, onDisconnected);

    // Add local audio tracks
    localStream.getTracks().forEach((track) => {
      peerConnection!.addTrack(track, localStream!);
    });

    // Set up room references
    const callerCandidatesRef = ref(db, `rooms/${roomId}/callerCandidates`);
    const calleeCandidatesRef = ref(db, `rooms/${roomId}/calleeCandidates`);

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
 */
export function setMuted(muted: boolean): void {
  if (localStream) {
    localStream.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
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
  if (db && currentRoomId) {
    // Signal call ended
    await set(ref(db, `rooms/${currentRoomId}/callEnded`), true);
    if (blocked) {
      await set(ref(db, `rooms/${currentRoomId}/callBlocked`), true);
    }
  }

  cleanup();
}

/**
 * Clean up all WebRTC resources.
 */
export function cleanup(): void {
  // Remove all listeners
  callListeners.forEach((cleanup) => cleanup());
  callListeners = [];

  // Close peer connection
  if (peerConnection) {
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
