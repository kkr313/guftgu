// js/call.js - WebRTC voice call engine

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ]
};

let fbApp = null, fbDb = null;

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDHPhw5HegUFJhFWlBp_km2-IJ-o1Xucy0",
  authDomain: "guftgu-511b5.firebaseapp.com",
  databaseURL: "https://guftgu-511b5-default-rtdb.firebaseio.com",
  projectId: "guftgu-511b5",
  storageBucket: "guftgu-511b5.firebasestorage.app",
  messagingSenderId: "1055502505262",
  appId: "1:1055502505262:web:91b9a0aafdeaf7787c96bf",
};

let rtcPc       = null;
let localStream = null;
let remoteAudio = null;
let currentRoomId    = null;
let isCaller         = false;
let callListeners    = [];
let _incomingCallListener = null;

// ── Firebase Setup ───────────────────────────────────────────────
function openFbSetup()  { _cls('fbSetupModal', 'add',    'show'); }
function closeFbSetup() { _cls('fbSetupModal', 'remove', 'show'); }

async function connectFirebase() {
  const raw = (_el('fbConfigInput') || {}).value || '';
  if (!raw.trim()) { showToast('Paste your Firebase config first'); return; }
  let cfg;
  try { cfg = JSON.parse(raw); } catch(e) {
    try {
      const cleaned = raw.replace(/(\w+):/g, '"$1":').replace(/'/g, '"').replace(/,\s*}/g, '}');
      cfg = JSON.parse(cleaned.startsWith('{') ? cleaned : '{' + cleaned + '}');
    } catch(e2) { showToast('Invalid config — check JSON format'); return; }
  }
  if (!cfg.databaseURL) { showToast('Missing databaseURL ⚠️'); return; }
  try {
    if (firebase.apps.length) firebase.app().delete();
    fbApp = firebase.initializeApp(cfg);
    fbDb  = firebase.database();
    await fbDb.ref('.info/connected').once('value');
    showToast('🔥 Firebase connected! Real calls active ✅');
    _show('fbStatusBadge', true);
    _txt('fbSettingDesc', '✅ Connected — real calls active');
    closeFbSetup();
    listenForIncomingCalls();
  } catch(e) { showToast('Connection failed: ' + (e.message || 'Check config')); }
}

// ── Media ────────────────────────────────────────────────────────
async function getMic() {
  return navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation:true, noiseSuppression:true, autoGainControl:true, channelCount:1 }
  });
}

function ensureRemoteAudio() {
  if (!remoteAudio) {
    remoteAudio = document.createElement('audio');
    remoteAudio.autoplay   = true;
    remoteAudio.playsInline = true;
    document.body.appendChild(remoteAudio);
  }
  return remoteAudio;
}

function genRoomId() {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
}

// ── RTCPeerConnection ────────────────────────────────────────────
function createPC() {
  const pc = new RTCPeerConnection(ICE_SERVERS);
  pc.ontrack = (e) => {
    const audio = ensureRemoteAudio();
    if (audio.srcObject !== e.streams[0]) audio.srcObject = e.streams[0];
  };
  pc.oniceconnectionstatechange = () => {
    const s = pc.iceConnectionState;
    if (s === 'connected' || s === 'completed') {
      startCallTimer();
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

function addTracks(pc, stream) {
  stream.getTracks().forEach(t => pc.addTrack(t, stream));
}

function preferOpus(sdp) {
  return sdp.replace(/a=fmtp:111 /g,
    'a=fmtp:111 maxaveragebitrate=20000;stereo=0;useinbandfec=1;usedtx=1;');
}

// ── CALLER: create room + offer ──────────────────────────────────
async function createRoom(roomId) {
  const roomRef = fbDb.ref('rooms/' + roomId);
  currentRoomId = roomId;
  isCaller = true;

  rtcPc       = createPC();
  localStream = await getMic();
  addTracks(rtcPc, localStream);

  rtcPc.onicecandidate = async (e) => {
    if (e.candidate)
      await roomRef.child('callerCandidates').push(e.candidate.toJSON());
  };

  const offer = await rtcPc.createOffer({ offerToReceiveAudio: true });
  offer.sdp   = preferOpus(offer.sdp);
  await rtcPc.setLocalDescription(offer);
  await roomRef.set({ offer: { type: offer.type, sdp: offer.sdp }, createdAt: Date.now() });

  if (state.guftguPhone)
    await fbDb.ref('phoneRooms/' + state.guftguPhone).set({ roomId, createdAt: Date.now() });

  const answerListener = roomRef.child('answer').on('value', async (snap) => {
    if (snap.exists() && !rtcPc.currentRemoteDescription)
      await rtcPc.setRemoteDescription(new RTCSessionDescription(snap.val()));
  });
  callListeners.push({ ref: roomRef.child('answer'), listener: answerListener, event: 'value' });

  const calleeCandRef = roomRef.child('calleeCandidates');
  const calleeCandListener = calleeCandRef.on('child_added', async (snap) => {
    await rtcPc.addIceCandidate(new RTCIceCandidate(snap.val())).catch(()=>{});
  });
  callListeners.push({ ref: calleeCandRef, listener: calleeCandListener, event: 'child_added' });
}

// ── CALLEE: join room with code ──────────────────────────────────
async function joinRoom(roomId) {
  const roomRef = fbDb.ref('rooms/' + roomId);
  const snap    = await roomRef.once('value');
  if (!snap.exists() || !snap.val().offer) {
    showToast('Room not found — check the code'); return;
  }
  currentRoomId = roomId;
  isCaller = false;

  rtcPc       = createPC();
  localStream = await getMic();
  addTracks(rtcPc, localStream);

  rtcPc.onicecandidate = async (e) => {
    if (e.candidate)
      await roomRef.child('calleeCandidates').push(e.candidate.toJSON());
  };

  await rtcPc.setRemoteDescription(new RTCSessionDescription(snap.val().offer));
  const answer = await rtcPc.createAnswer();
  answer.sdp   = preferOpus(answer.sdp);
  await rtcPc.setLocalDescription(answer);
  await roomRef.child('answer').set({ type: answer.type, sdp: answer.sdp });

  const callerCandRef = roomRef.child('callerCandidates');
  const callerCandListener = callerCandRef.on('child_added', async (snap) => {
    await rtcPc.addIceCandidate(new RTCIceCandidate(snap.val())).catch(()=>{});
  });
  callListeners.push({ ref: callerCandRef, listener: callerCandListener, event: 'child_added' });
}

// ── Start voice call (from chat header or direct dial) ───────────
// For match-initiated calls use _startCoordinatedCall() in matching.js
async function startVoiceCall(palOverride) {
  const pal = palOverride || state.currentPal;
  setAvatarEl('callAvatar', pal ? pal.avatar : 'cat');
  _txt('callName', pal ? pal.name  : 'Unknown');
  _txt('callMood', pal ? (pal.mood + ' ' + (pal.moodEmoji || '')) : '');
  _txt('callTimer', '00:00');
  state.callSecs = 0;
  showScreen('screen-call');

  if (!fbDb) {
    setTimeout(startCallTimer, 1000);
    showToast('⚠️ Setup Firebase for real calls (Profile → Voice Calls)');
    return;
  }

  try {
    const roomId = genRoomId();
    await createRoom(roomId);
    if (state.guftguPhone && pal && pal.phone) {
      await fbDb.ref('callRequests/' + pal.phone).set({
        from:      state.guftguPhone,
        fromName:  state.user.nickname  || 'Someone',
        fromAvatar:state.user.avatar    || 'cat',
        fromMood:  (state.user.mood||'Happy') + ' ' + (state.user.moodEmoji||'😄'),
        roomId,
        timestamp: Date.now()
      });
    }
  } catch(err) {
    showToast('Mic error: ' + (err.message || 'Check microphone permissions'));
  }
}

// ── Direct call by Guftgu phone number (from home dial card) ─────
async function directCallByPhone() {
  const inp   = _el('dialPhoneInput');
  const phone = inp ? inp.value.trim() : '';
  if (!phone || !/^\d{7}$/.test(phone)) { showToast('Enter a valid 7-digit number'); return; }
  if (phone === state.guftguPhone)       { showToast("That's your own number 😄"); return; }
  if (!fbDb) { showToast('Firebase not connected — enable it in Settings'); return; }

  const pal = { avatar:'cat', name:'Guftgu #' + phone, mood:'', moodEmoji:'', phone };
  state.currentPal = pal;

  setAvatarEl('callAvatar', 'cat');
  _txt('callName',  'Guftgu #' + phone);
  _txt('callMood',  '');
  _txt('callTimer', '00:00');
  state.callSecs = 0;
  showScreen('screen-call');

  try {
    const roomId = genRoomId();
    await createRoom(roomId);

    await fbDb.ref('callRequests/' + phone).set({
      from:      state.guftguPhone,
      fromName:  state.user.nickname  || 'Someone',
      fromAvatar:state.user.avatar    || 'cat',
      fromMood:  (state.user.mood||'Happy') + ' ' + (state.user.moodEmoji||'😄'),
      roomId,
      timestamp: Date.now()
    });

    state._directCallTarget  = phone;
    state._directCallTimeout = setTimeout(async () => {
      try { await fbDb.ref('callRequests/' + phone).remove(); } catch(e){}
      if (state.screen === 'screen-call') {
        showToast('No answer — they may be offline');
        endCallCleanup();
        goBack();
      }
    }, 30000);
  } catch(err) {
    showToast('Call failed: ' + (err.message || 'Try again'));
    endCallCleanup();
    goBack();
  }
}

// ── Incoming call listener ───────────────────────────────────────
function listenForIncomingCalls() {
  if (!fbDb || !state.guftguPhone) return;
  const ref = fbDb.ref('callRequests/' + state.guftguPhone);
  if (_incomingCallListener) ref.off('value', _incomingCallListener);

  _incomingCallListener = ref.on('value', (snap) => {
    if (!snap.exists()) return;
    const req = snap.val();
    if (!req.roomId || !req.from) return;
    if (state.screen === 'screen-call') return;
    showIncomingCall(req.fromAvatar || 'cat', req.fromName || 'Unknown',
                     req.fromMood  || 'Happy 😄', req.roomId);
    state._incomingCallRef = ref;
  });
}

// ── End call ────────────────────────────────────────────────────
function endCall() {
  clearInterval(state.callTimer);
  const timerEl = _el('callTimer');
  const duration = timerEl ? timerEl.textContent : '00:00';
  showToast('Call ended — ' + duration);

  const callNameEl = _el('callName');
  const pal    = state.currentPal;
  const name   = pal ? pal.name  : (callNameEl ? callNameEl.textContent : 'Unknown');
  const avatar = pal ? pal.avatar : '🦊';
  const mood   = pal ? pal.mood   : '';
  saveCallToHistory(avatar, name, mood, duration, isCaller ? 'outgoing' : 'incoming');

  if (state._directCallTimeout) { clearTimeout(state._directCallTimeout); state._directCallTimeout = null; }
  if (fbDb && state._directCallTarget) {
    fbDb.ref('callRequests/' + state._directCallTarget).remove().catch(()=>{});
    state._directCallTarget = null;
  }
  if (fbDb && state._incomingCallRef) {
    state._incomingCallRef.remove().catch(()=>{});
    state._incomingCallRef = null;
  }
  // Clean up match webrtcRoomId watcher if call came from match flow
  if (fbDb && currentMatchId) {
    fbDb.ref('matches/' + currentMatchId + '/webrtcRoomId').off();
  }
  endCallCleanup();
  goBack();
}

function endCallCleanup() {
  clearInterval(state.callTimer);
  if (rtcPc)       { rtcPc.close(); rtcPc = null; }
  if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
  if (remoteAudio) { remoteAudio.srcObject = null; }
  callListeners.forEach(({ ref, listener, event }) => ref.off(event, listener));
  callListeners = [];
  if (fbDb && currentRoomId) {
    fbDb.ref('rooms/' + currentRoomId).remove().catch(()=>{});
    if (state.guftguPhone)
      fbDb.ref('phoneRooms/' + state.guftguPhone).remove().catch(()=>{});
    currentRoomId = null;
  }
}

// ── Call timer ───────────────────────────────────────────────────
function startCallTimer() {
  state.callSecs = 0;
  clearInterval(state.callTimer);
  state.callTimer = setInterval(() => {
    state.callSecs++;
    const m = Math.floor(state.callSecs / 60).toString().padStart(2, '0');
    const s = (state.callSecs % 60).toString().padStart(2, '0');
    _txt('callTimer', m + ':' + s);
  }, 1000);
}

// ── Mute ────────────────────────────────────────────────────────
function toggleMute(ctrl) {
  const btn = ctrl.querySelector('.call-ctrl-btn');
  const lbl = ctrl.querySelector('.call-ctrl-label');
  const active = btn.classList.toggle('active');
  state.isMuted = active;
  if (localStream) localStream.getAudioTracks().forEach(t => { t.enabled = !active; });
  if (lbl) lbl.textContent = active ? 'Unmute' : 'Mute';
}

function toggleCallCtrl(ctrl, activeLabel, defaultLabel) {
  const btn = ctrl.querySelector('.call-ctrl-btn');
  const lbl = ctrl.querySelector('.call-ctrl-label');
  const active = btn.classList.toggle('active');
  if (lbl) lbl.textContent = active ? activeLabel : defaultLabel;
}

// ── Incoming call overlay ────────────────────────────────────────
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
  if (state._incomingCallRef) {
    state._incomingCallRef.remove().catch(()=>{});
    state._incomingCallRef = null;
  }
  const incName = (_el('incName') || {}).textContent || '?';
  const incMood = (_el('incMood') || {}).textContent || '';
  setAvatarEl('callAvatar', state.user.avatar || 'cat');
  _txt('callName',  incName);
  _txt('callMood',  incMood);
  _txt('callTimer', '00:00');
  state.callSecs = 0;
  showScreen('screen-call');
  try {
    await joinRoom(roomId);
  } catch(err) {
    showToast('Error: ' + (err.message || 'Try again'));
    goBack();
  }
}

// ── Add Friend from active call ──────────────────────────────────
function addFriendFromCall() {
  const btn  = _el('callAddFriendBtn');
  const text = _el('callAddFriendText');
  const pal  = state.currentPal;

  if (!pal) { showToast('No active call'); return; }
  if (btn && btn.classList.contains('sent')) { showToast('Friend request already sent!'); return; }

  const palPhone = pal.phone || null;

  if (typeof sendFriendRequest === 'function') {
    sendFriendRequest(palPhone || ('call_' + Date.now()),
      pal.name || 'Unknown', pal.avatar || 'cat', pal.mood || 'Happy', pal.moodEmoji || '😊');
  } else if (typeof addFriendFromMatch === 'function') {
    addFriendFromMatch(pal);
  }

  if (btn)  btn.classList.add('sent');
  if (text) text.textContent = '✓ Request Sent!';
  showToast('👋 Friend request sent to ' + (pal.name || 'your pal') + '!');

  if (fbDb && palPhone && state.guftguPhone) {
    fbDb.ref('friendRequests/' + palPhone + '/' + state.guftguPhone).set({
      from:      state.guftguPhone,
      name:      state.user.nickname  || 'Anonymous',
      avatar:    state.user.avatar    || 'cat',
      mood:      state.user.mood      || 'Happy',
      moodEmoji: state.user.moodEmoji || '😊',
      timestamp: Date.now(),
      source:    'call'
    });
  }
}

// ── Reset Add Friend button when a new call starts ───────────────
function resetCallAddFriend() {
  const btn  = _el('callAddFriendBtn');
  const text = _el('callAddFriendText');
  if (btn)  btn.classList.remove('sent');
  if (text) text.textContent = '+ Add Friend';
}