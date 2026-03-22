// js/call.js - WebRTC voice call engine

// ═══════════════════════════════════════════════════════════════
// FIREBASE + WebRTC VOICE CALL ENGINE
// ═══════════════════════════════════════════════════════════════

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
  ]
};

let fbApp = null, fbDb = null;

// ── Auto-connect Firebase on load ────────────────────────────
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDHPhw5HegUFJhFWlBp_km2-IJ-o1Xucy0",
  authDomain: "guftgu-511b5.firebaseapp.com",
  databaseURL: "https://guftgu-511b5-default-rtdb.firebaseio.com",
  projectId: "guftgu-511b5",
  storageBucket: "guftgu-511b5.firebasestorage.app",
  messagingSenderId: "1055502505262",
  appId: "1:1055502505262:web:91b9a0aafdeaf7787c96bf",
  measurementId: "G-3P31R9LSM9"
};
let rtcPc = null;          // RTCPeerConnection
let localStream = null;    // mic stream
let remoteAudio = null;    // <audio> element for remote
let currentRoomId = null;  // Firebase room ID
let isCaller = false;      // true = we made the call
let callListeners = [];    // Firebase listeners to clean up

// ── Firebase Setup ───────────────────────────────────────────
function openFbSetup() {
  _cls('fbSetupModal', 'add', 'show');
}
function closeFbSetup() {
  _cls('fbSetupModal', 'remove', 'show');
}

async function connectFirebase() {
  const fbCfgEl = document.getElementById('fbConfigInput');
  const raw = fbCfgEl ? fbCfgEl.value.trim() : '';
  if (!raw) { showToast('Paste your Firebase config first'); return; }
  let cfg;
  try {
    // Accept both JS object and JSON formats
    const cleaned = raw.replace(/(\w+):/g, '"$1":').replace(/'/g, '"').replace(/,\s*}/g, '}');
    cfg = JSON.parse(cleaned.startsWith('{') ? cleaned : '{' + cleaned + '}');
  } catch(e) {
    try { cfg = JSON.parse(raw); } catch(e2) {
      showToast('Invalid config — check JSON format'); return;
    }
  }
  if (!cfg.databaseURL) { showToast('Missing databaseURL in config ⚠️'); return; }
  try {
    if (firebase.apps.length > 0) {
      firebase.app().delete();
    }
    fbApp = firebase.initializeApp(cfg);
    fbDb = firebase.database();
    // Test write
    await fbDb.ref('.info/connected').once('value');
    showToast('🔥 Firebase connected! Real calls enabled ✅');
    _show('fbStatusBadge', true);
    _txt('fbSettingDesc', '✅ Connected — real calls active');
    if (fsb) fsb.innerHTML = '<span style="color:var(--accent2);font-size:11px;font-weight:700;">ON</span>';
    closeFbSetup();
  } catch(e) {
    showToast('Connection failed: ' + (e.message || 'Check config'));
  }
}

// ── Media helpers ────────────────────────────────────────────
async function getMic() {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 16000,      // low bandwidth
      channelCount: 1,        // mono
    }
  });
  return stream;
}

function ensureRemoteAudio() {
  if (!remoteAudio) {
    remoteAudio = document.createElement('audio');
    remoteAudio.autoplay = true;
    remoteAudio.playsInline = true;
    document.body.appendChild(remoteAudio);
  }
  return remoteAudio;
}

// ── Room code generator ──────────────────────────────────────
function genRoomId() {
  return Math.random().toString(36).substr(2,6).toUpperCase();
}

// ── Create RTCPeerConnection ─────────────────────────────────
function createPC() {
  const pc = new RTCPeerConnection(ICE_SERVERS);
  pc.ontrack = (e) => {
    const audio = ensureRemoteAudio();
    if (audio.srcObject !== e.streams[0]) {
      audio.srcObject = e.streams[0];
    }
  };
  pc.oniceconnectionstatechange = () => {
    const s = pc.iceConnectionState;
    if (s === 'connected' || s === 'completed') {
      _txt('callStatus', 'CONNECTED');
      startCallTimer();
      _show('callCodeSection', 'none' !== 'none');
    } else if (s === 'disconnected' || s === 'failed' || s === 'closed') {
      if (state.screen === 'screen-call') {
        showToast('Call ended 👋');
        endCallCleanup();
        goBack();
      }
    }
  };
  return pc;
}

// ── Add local tracks to PC ───────────────────────────────────
function addTracks(pc, stream) {
  stream.getTracks().forEach(t => pc.addTrack(t, stream));
}

// ── Prefer Opus for low bandwidth ───────────────────────────
function preferOpus(sdp) {
  return sdp.replace(/a=fmtp:111 /g, 'a=fmtp:111 maxaveragebitrate=20000;stereo=0;sprop-stereo=0;useinbandfec=1;usedtx=1;');
}

// ── CALLER: Create room + offer ──────────────────────────────
async function createRoom(roomId) {
  const roomRef = fbDb.ref('rooms/' + roomId);
  currentRoomId = roomId;
  isCaller = true;

  rtcPc = createPC();
  localStream = await getMic();
  addTracks(rtcPc, localStream);

  const iceCands = [];
  rtcPc.onicecandidate = async (e) => {
    if (e.candidate) {
      await roomRef.child('callerCandidates').push(e.candidate.toJSON());
    }
  };

  const offer = await rtcPc.createOffer({ offerToReceiveAudio: true });
  offer.sdp = preferOpus(offer.sdp);
  await rtcPc.setLocalDescription(offer);

  await roomRef.set({
    offer: { type: offer.type, sdp: offer.sdp },
    createdAt: Date.now(),
  });

  // Register guftguPhone → roomId so others can call by phone number
  if (state.guftguPhone) {
    await fbDb.ref('phoneRooms/' + state.guftguPhone).set({
      roomId, createdAt: Date.now()
    });
  }

  // Listen for callee answer
  const answerListener = roomRef.child('answer').on('value', async (snap) => {
    if (snap.exists() && rtcPc.currentRemoteDescription === null) {
      const answer = snap.val();
      await rtcPc.setRemoteDescription(new RTCSessionDescription(answer));
    }
  });
  callListeners.push({ ref: roomRef.child('answer'), listener: answerListener, event: 'value' });

  // Listen for callee ICE candidates
  const calleeCandRef = roomRef.child('calleeCandidates');
  const calleeCandListener = calleeCandRef.on('child_added', async (snap) => {
    const c = snap.val();
    await rtcPc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
  });
  callListeners.push({ ref: calleeCandRef, listener: calleeCandListener, event: 'child_added' });
}

// ── CALLEE: Join room with code ──────────────────────────────
async function joinRoom(roomId) {
  const roomRef = fbDb.ref('rooms/' + roomId);
  const snap = await roomRef.once('value');
  if (!snap.exists() || !snap.val().offer) {
    showToast('Room not found — check the code'); return;
  }
  currentRoomId = roomId;
  isCaller = false;

  rtcPc = createPC();
  localStream = await getMic();
  addTracks(rtcPc, localStream);

  rtcPc.onicecandidate = async (e) => {
    if (e.candidate) {
      await roomRef.child('calleeCandidates').push(e.candidate.toJSON());
    }
  };

  const offer = snap.val().offer;
  await rtcPc.setRemoteDescription(new RTCSessionDescription(offer));

  const answer = await rtcPc.createAnswer();
  answer.sdp = preferOpus(answer.sdp);
  await rtcPc.setLocalDescription(answer);

  await roomRef.child('answer').set({ type: answer.type, sdp: answer.sdp });

  // Listen for caller ICE candidates
  const callerCandRef = roomRef.child('callerCandidates');
  const callerCandListener = callerCandRef.on('child_added', async (snap) => {
    const c = snap.val();
    await rtcPc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
  });
  callListeners.push({ ref: callerCandRef, listener: callerCandListener, event: 'child_added' });

  // Update call UI
  _txt('callStatus', 'CONNECTING...');
  _show('callCodeSection', 'none' !== 'none');
}

// ── Start voice call (called from chat header) ────────────────
async function startVoiceCall(palOverride) {
  const pal = palOverride || state.currentPal;
  setAvatarEl('callAvatar', pal ? pal.avatar : 'cat');
  _txt('callName', pal ? pal.name : 'Unknown');
  _txt('callMood', pal ? ('Feeling ' + pal.mood + ' ' + pal.moodEmoji) : '');
  _txt('callStatus', 'CONNECTING...');
  _txt('callTimer', '00:00');
  state.callSecs = 0;
  showScreen('screen-call');

  if (!fbDb) {
    // No Firebase — fallback to UI-only mode
    _show('callCodeSection', 'none' !== 'none');
    setTimeout(() => {
      _txt('callStatus', 'CONNECTED (Demo)');
      startCallTimer();
    }, 1500);
    showToast('⚠️ Setup Firebase for real calls (Profile → Voice Calls)');
    return;
  }

  try {
    const roomId = genRoomId();
    _txt('callCodeDisplay', roomId);
    _txt('callCodeHint', 'Share this code — other person enters it below');
    _show('callCodeSection', 'block' !== 'none');
    _val('callJoinInput', '');
    _txt('callStatus', 'WAITING...');
    await createRoom(roomId);
  } catch(err) {
    showToast('Mic error: ' + (err.message || 'Check microphone permissions'));
    _txt('callStatus', 'MIC ERROR');
  }
}

// ── Join a call by entering code ──────────────────────────────
async function joinCallByCode() {
  const joinEl = document.getElementById('callJoinInput');
  const raw = joinEl ? joinEl.value.trim().toUpperCase() : '';
  if (!raw || raw.length < 4) { showToast('Enter a code or phone number'); return; }
  if (!fbDb) { showToast('Setup Firebase first'); return; }
  // If it's a 7-digit number → treat as GuftguPhone lookup
  // Otherwise treat as call room code
  const isPhone = /^\d{7}$/.test(raw);
  const roomCode = isPhone ? await lookupPhoneRoom(raw) : raw;
  if (!roomCode) { showToast('This number is not online right now'); return; }
  _txt('callStatus', 'JOINING...');
  try {
    await joinRoom(roomCode);
    showToast('Joining call...');
  } catch(err) {
    showToast('Error: ' + (err.message || 'Check the code and try again'));
    _txt('callStatus', 'FAILED');
  }
}

// Look up if a guftguPhone number has an active room
async function lookupPhoneRoom(phone) {
  try {
    const snap = await fbDb.ref('phoneRooms/' + phone).once('value');
    if (snap.exists()) return snap.val().roomId;
    return null;
  } catch(e) { return null; }
}

// ── Direct call by Guftgu Phone number (from home screen) ────
async function directCallByPhone() {
  const inp = document.getElementById('dialPhoneInput');
  const phone = inp ? inp.value.trim() : '';
  if (!phone || !/^\d{7}$/.test(phone)) {
    showToast('Enter a valid 7-digit Guftgu number');
    return;
  }
  if (phone === state.guftguPhone) {
    showToast("That's your own number 😄");
    return;
  }
  if (!fbDb) {
    showToast('Firebase not connected — enable it in Settings');
    return;
  }

  showToast('📞 Calling ' + phone + '...');

  try {
    // 1. Create a WebRTC room
    const roomId = genRoomId();
    const u = state.user;

    // 2. Set up call UI
    setAvatarEl('callAvatar', 'cat');
    _txt('callName', 'Guftgu #' + phone);
    _txt('callMood', '');
    _txt('callStatus', 'RINGING...');
    _txt('callTimer', '00:00');
    state.callSecs = 0;
    showScreen('screen-call');

    // 3. Create the room (registers our phone too)
    await createRoom(roomId);

    // 4. Send call request to the target phone
    await fbDb.ref('callRequests/' + phone).set({
      from: state.guftguPhone,
      fromName: u.nickname || 'Someone',
      fromAvatar: u.avatar || 'cat',
      fromMood: (u.mood || 'Happy') + ' ' + (u.moodEmoji || '😄'),
      roomId: roomId,
      timestamp: Date.now()
    });

    // 5. Auto-cancel after 30s if no answer
    const _callTimeout = setTimeout(async () => {
      try { await fbDb.ref('callRequests/' + phone).remove(); } catch(e){}
      if (state.screen === 'screen-call') {
        const status = document.getElementById('callStatus');
        if (status && status.textContent === 'RINGING...') {
          showToast('No answer — they may be offline');
          endCallCleanup();
          goBack();
        }
      }
    }, 30000);

    // 6. Watch for answer (ICE connection will change status automatically)
    //    Store timeout so endCallCleanup can clear it
    state._directCallTimeout = _callTimeout;
    state._directCallTarget = phone;

  } catch(err) {
    showToast('Call failed: ' + (err.message || 'Try again'));
    endCallCleanup();
    goBack();
  }
}

// ── Listen for incoming calls on our Guftgu Phone ─────────────
let _incomingCallListener = null;
function listenForIncomingCalls() {
  if (!fbDb || !state.guftguPhone) return;
  const myPhone = state.guftguPhone;
  const ref = fbDb.ref('callRequests/' + myPhone);

  // Remove previous listener if any
  if (_incomingCallListener) ref.off('value', _incomingCallListener);

  _incomingCallListener = ref.on('value', (snap) => {
    if (!snap.exists()) return;
    const req = snap.val();
    if (!req.roomId || !req.from) return;
    // Don't show if we're already in a call
    if (state.screen === 'screen-call') return;

    // Show incoming call overlay
    showIncomingCall(req.fromAvatar || 'cat', req.fromName || 'Unknown', req.fromMood || 'Happy 😄', req.roomId);

    // Clean up the request after showing
    // (will be removed when answered/declined)
    state._incomingCallRef = ref;
  });
}

// ── End call ──────────────────────────────────────────────────
function endCall() {
  clearInterval(state.callTimer);
  const timerEl = document.getElementById('callTimer');
  const duration = timerEl ? timerEl.textContent : '00:00';
  showToast('Call ended — ' + duration);
  // Save to call history
  const pal = state.currentPal;
  const callNameEl = document.getElementById('callName');
  const palName = pal ? pal.name : (callNameEl ? callNameEl.textContent : 'Unknown');
  const palAvatar = pal ? pal.avatar : '🦊';
  const palMood = pal ? pal.mood : '';
  const callType = isCaller ? 'Outgoing' : 'Incoming';
  if (typeof saveCallToHistory === 'function') {
    saveCallToHistory(palAvatar, palName, palMood, duration, callType);
  }
  // Clean up direct call request if any
  if (state._directCallTimeout) { clearTimeout(state._directCallTimeout); state._directCallTimeout = null; }
  if (fbDb && state._directCallTarget) {
    fbDb.ref('callRequests/' + state._directCallTarget).remove().catch(()=>{});
    state._directCallTarget = null;
  }
  if (fbDb && state._incomingCallRef) {
    state._incomingCallRef.remove().catch(()=>{});
    state._incomingCallRef = null;
  }
  endCallCleanup();
  goBack();
}

function endCallCleanup() {
  clearInterval(state.callTimer);
  // Close peer connection
  if (rtcPc) { rtcPc.close(); rtcPc = null; }
  // Stop mic
  if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
  // Remove remote audio
  if (remoteAudio) { remoteAudio.srcObject = null; }
  // Clean up Firebase listeners
  callListeners.forEach(({ ref, listener, event }) => ref.off(event, listener));
  callListeners = [];
  // Delete Firebase room
  if (fbDb && currentRoomId) {
    fbDb.ref('rooms/' + currentRoomId).remove().catch(() => {});
    if (state.guftguPhone) {
      fbDb.ref('phoneRooms/' + state.guftguPhone).remove().catch(() => {});
    }
    currentRoomId = null;
  }
  // Reset UI
  _show('callCodeSection', 'none' !== 'none');
}

// ── Call timer ────────────────────────────────────────────────
function startCallTimer() {
  state.callSecs = 0;
  clearInterval(state.callTimer);
  state.callTimer = setInterval(() => {
    state.callSecs++;
    const m = Math.floor(state.callSecs/60).toString().padStart(2,'0');
    const s = (state.callSecs%60).toString().padStart(2,'0');
    _txt('callTimer', m+':'+s);
  }, 1000);
}

// ── Real mute ────────────────────────────────────────────────
function toggleMute(ctrl) {
  const btn = ctrl.querySelector('.call-ctrl-btn');
  const lbl = ctrl.querySelector('.call-ctrl-label');
  const isActive = btn.classList.toggle('active');
  state.isMuted = isActive;
  if (localStream) {
    localStream.getAudioTracks().forEach(t => { t.enabled = !isActive; });
  }
  lbl.textContent = isActive ? 'Muted' : 'Mute';
}

// ── Incoming call handler (for future push support) ───────────
function showIncomingCall(avatar, name, mood, roomId) {
  setAvatarEl('incAvatar', avatar);
  _txt('incName', name);
  _txt('incMood', 'Feeling ' + mood);
  state._pendingIncomingRoom = roomId;
  _cls('incomingCallOverlay', 'add', 'show');
}

function rejectIncomingCall() {
  _cls('incomingCallOverlay', 'remove', 'show');
  state._pendingIncomingRoom = null;
  // Clean up call request in Firebase
  if (fbDb && state._incomingCallRef) {
    state._incomingCallRef.remove().catch(()=>{});
    state._incomingCallRef = null;
  }
  showToast('Call declined');
}

async function answerIncomingCall() {
  const roomId = state._pendingIncomingRoom;
  _cls('incomingCallOverlay', 'remove', 'show');
  if (!roomId || !fbDb) return;
  // Clean up call request
  if (state._incomingCallRef) {
    state._incomingCallRef.remove().catch(()=>{});
    state._incomingCallRef = null;
  }
  // Set up call UI
  setAvatarEl('callAvatar', _qsState && _qsState.avatar ? _qsState.avatar : (state.user.avatar || 'cat'));
  _txt('callName', _el('incName') ? _el('incName').textContent : '?');
  _txt('callMood', _el('incMood') ? _el('incMood').textContent : '');
  _txt('callStatus', 'CONNECTING...');
  _txt('callTimer', '00:00');
  state.callSecs = 0;
  showScreen('screen-call');
  await joinRoom(roomId);
}

function toggleCallCtrl(ctrl, activeLabel, defaultLabel) {
  const btn = ctrl.querySelector('.call-ctrl-btn');
  const lbl = ctrl.querySelector('.call-ctrl-label');
  const isActive = btn.classList.toggle('active');
  if (lbl) lbl.textContent = isActive ? activeLabel : defaultLabel;
}

// ═══════════════════════════════════════
// MOOD
