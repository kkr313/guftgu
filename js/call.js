// js/call.js — WebRTC voice call engine
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

const FIREBASE_CONFIG = {
  apiKey:            'AIzaSyDHPhw5HegUFJhFWlBp_km2-IJ-o1Xucy0',
  authDomain:        'guftgu-511b5.firebaseapp.com',
  databaseURL:       'https://guftgu-511b5-default-rtdb.firebaseio.com',
  projectId:         'guftgu-511b5',
  storageBucket:     'guftgu-511b5.firebasestorage.app',
  messagingSenderId: '1055502505262',
  appId:             '1:1055502505262:web:91b9a0aafdeaf7787c96bf',
  measurementId:     'G-3P31R9LSM9'
};

let rtcPc         = null;
let localStream   = null;
let remoteAudio   = null;
let currentRoomId = null;
let isCaller      = false;
let callListeners = [];

// ─────────────────────────────────────────────────────────────────
// DURATION HELPER
// ─────────────────────────────────────────────────────────────────
function _getCallDuration() {
  const el = document.getElementById('callTimer');
  if (el && el.textContent && el.textContent !== '00:00') return el.textContent;
  const secs = state.callSecs || 0;
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return m + ':' + s;
}

// ─────────────────────────────────────────────────────────────────
// PAL INFO HELPER
// ─────────────────────────────────────────────────────────────────
function _getCurrentPalInfo() {
  const pal        = state.currentPal;
  const callNameEl = document.getElementById('callName');
  return {
    avatar: (pal && pal.avatar) ? pal.avatar : 'cat',
    name:   (pal && pal.name)   ? pal.name   : (callNameEl ? callNameEl.textContent : 'Unknown'),
    mood:   (pal && pal.mood)   ? pal.mood   : '',
    phone:  (pal && pal.phone)  ? pal.phone  : null,
  };
}

// ─────────────────────────────────────────────────────────────────
// FIREBASE SETUP MODAL
// ─────────────────────────────────────────────────────────────────
function openFbSetup()  { _cls('fbSetupModal', 'add',    'show'); }
function closeFbSetup() { _cls('fbSetupModal', 'remove', 'show'); }

async function connectFirebase() {
  const fbCfgEl = document.getElementById('fbConfigInput');
  const raw = fbCfgEl ? fbCfgEl.value.trim() : '';
  if (!raw) { showToast('Paste your Firebase config first'); return; }
  let cfg;
  try {
    const cleaned = raw.replace(/(\w+):/g, '"$1":').replace(/'/g, '"').replace(/,\s*}/g, '}');
    cfg = JSON.parse(cleaned.startsWith('{') ? cleaned : '{' + cleaned + '}');
  } catch (_) {
    try { cfg = JSON.parse(raw); } catch (_2) {
      showToast('Invalid config — check JSON format'); return;
    }
  }
  if (!cfg.databaseURL) { showToast('Missing databaseURL in config ⚠️'); return; }
  try {
    if (firebase.apps.length > 0) firebase.app().delete();
    fbApp = firebase.initializeApp(cfg);
    fbDb  = firebase.database();
    await fbDb.ref('.info/connected').once('value');
    showToast('🔥 Firebase connected! Real calls enabled ✅');
    _show('fbStatusBadge', true);
    _txt('fbSettingDesc', '✅ Connected — real calls active');
    const fsb = document.getElementById('fbSettingBadge');
    if (fsb) fsb.innerHTML = '<span style="color:var(--accent2);font-size:11px;font-weight:700;">ON</span>';
    closeFbSetup();
  } catch (e) {
    showToast('Connection failed: ' + (e.message || 'Check config'));
  }
}

// ─────────────────────────────────────────────────────────────────
// MEDIA HELPERS
// ─────────────────────────────────────────────────────────────────
async function getMic() {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl:  true,
      sampleRate:       16000,
      channelCount:     1,
    }
  });
}

function ensureRemoteAudio() {
  if (!remoteAudio) {
    remoteAudio = document.createElement('audio');
    remoteAudio.autoplay    = true;
    remoteAudio.playsInline = true;
    document.body.appendChild(remoteAudio);
  }
  return remoteAudio;
}

function genRoomId() {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
}

// ─────────────────────────────────────────────────────────────────
// CREATE PEER CONNECTION
// ─────────────────────────────────────────────────────────────────
function createPC() {
  const pc = new RTCPeerConnection(ICE_SERVERS);

  pc.ontrack = e => {
    const audio = ensureRemoteAudio();
    if (audio.srcObject !== e.streams[0]) audio.srcObject = e.streams[0];
  };

  pc.oniceconnectionstatechange = () => {
    const s = pc.iceConnectionState;
    if (s === 'connected' || s === 'completed') {
      _txt('callStatus', 'Connected ✓');
      startCallTimer();
      _watchCallEnded();
    } else if (s === 'checking') {
      _txt('callStatus', 'Connecting...');
    } else if (s === 'disconnected' || s === 'failed' || s === 'closed') {
      if (state.screen === 'screen-call') {
        const p = _getCurrentPalInfo();
        if (typeof saveCallToHistory === 'function') {
          saveCallToHistory(p.avatar, p.name, p.mood, _getCallDuration(),
            isCaller ? 'Outgoing' : 'Incoming');
        }
        if (typeof updateProfileStats === 'function') updateProfileStats();
        showToast('Call ended 👋');
        _cleanupMatchDoc();
        endCallCleanup();
        goBack();
      }
    }
  };

  return pc;
}

// ─────────────────────────────────────────────────────────────────
// WATCH FOR REMOTE HANG-UP OR BLOCK
// ─────────────────────────────────────────────────────────────────
let _callEndedRef = null;
let _callEndedLsn = null;
let _iEnded       = false;

function _watchCallEnded() {
  if (!fbDb || !currentRoomId) return;
  if (_callEndedRef && _callEndedLsn) _callEndedRef.off('value', _callEndedLsn);

  _iEnded       = false;
  _callEndedRef = fbDb.ref('rooms/' + currentRoomId + '/callEnded');
  _callEndedLsn = _callEndedRef.on('value', snap => {
    if (!snap.exists() || !snap.val()) return;
    if (_iEnded) return;
    if (state.screen !== 'screen-call') return;

    _callEndedRef.off('value', _callEndedLsn);
    _callEndedRef = null;
    _callEndedLsn = null;

    const p        = _getCurrentPalInfo();
    const duration = _getCallDuration();

    const blockedCheck = fbDb
      ? fbDb.ref('rooms/' + currentRoomId + '/callBlocked').once('value')
      : Promise.resolve({ exists: () => false, val: () => false });

    blockedCheck.then(bSnap => {
      const wasBlocked = bSnap && bSnap.exists && bSnap.exists() && bSnap.val();
      const histType   = wasBlocked ? 'Blocked' : (isCaller ? 'Outgoing' : 'Incoming');

      if (typeof saveCallToHistory === 'function') {
        saveCallToHistory(p.avatar, p.name, p.mood, duration, histType);
      }
      if (typeof updateProfileStats === 'function') updateProfileStats();

      showToast(wasBlocked ? 'You have been blocked by this user 🚫' : 'Call ended 👋');
      _cleanupMatchDoc();
      endCallCleanup();
      goBack();
    }).catch(() => {
      if (typeof saveCallToHistory === 'function') {
        saveCallToHistory(p.avatar, p.name, p.mood, duration,
          isCaller ? 'Outgoing' : 'Incoming');
      }
      if (typeof updateProfileStats === 'function') updateProfileStats();
      showToast('Call ended 👋');
      _cleanupMatchDoc();
      endCallCleanup();
      goBack();
    });
  });
}

function addTracks(pc, stream) {
  stream.getTracks().forEach(t => pc.addTrack(t, stream));
}

function preferOpus(sdp) {
  return sdp.replace(
    /a=fmtp:111 /g,
    'a=fmtp:111 maxaveragebitrate=20000;stereo=0;sprop-stereo=0;useinbandfec=1;usedtx=1;'
  );
}

// ─────────────────────────────────────────────────────────────────
// CALLER: Create room + offer
// Returns roomId so matching.js can publish it to Firebase
// ─────────────────────────────────────────────────────────────────
async function createRoom(roomId) {
  const roomRef = fbDb.ref('rooms/' + roomId);
  currentRoomId = roomId;
  isCaller      = true;

  rtcPc       = createPC();
  localStream = await getMic();
  addTracks(rtcPc, localStream);

  rtcPc.onicecandidate = async e => {
    if (e.candidate) await roomRef.child('callerCandidates').push(e.candidate.toJSON());
  };

  const offer = await rtcPc.createOffer({ offerToReceiveAudio: true });
  offer.sdp   = preferOpus(offer.sdp);
  await rtcPc.setLocalDescription(offer);
  await roomRef.set({ offer: { type: offer.type, sdp: offer.sdp }, createdAt: Date.now() });

  if (state.guftguPhone) {
    await fbDb.ref('phoneRooms/' + state.guftguPhone).set({ roomId, createdAt: Date.now() });
  }

  const answerListener = roomRef.child('answer').on('value', async snap => {
    if (snap.exists() && rtcPc && rtcPc.currentRemoteDescription === null) {
      await rtcPc.setRemoteDescription(new RTCSessionDescription(snap.val()));
    }
  });
  callListeners.push({ ref: roomRef.child('answer'), listener: answerListener, event: 'value' });

  const calleeCandRef      = roomRef.child('calleeCandidates');
  const calleeCandListener = calleeCandRef.on('child_added', async snap => {
    if (rtcPc) await rtcPc.addIceCandidate(new RTCIceCandidate(snap.val())).catch(() => {});
  });
  callListeners.push({ ref: calleeCandRef, listener: calleeCandListener, event: 'child_added' });

  return roomId; // needed by matching.js _startCall caller path
}

// ─────────────────────────────────────────────────────────────────
// CALLEE: Join room
// ─────────────────────────────────────────────────────────────────
async function joinRoom(roomId) {
  const roomRef = fbDb.ref('rooms/' + roomId);
  const snap    = await roomRef.once('value');
  if (!snap.exists() || !snap.val().offer) { showToast('Room not found — check the code'); return; }

  currentRoomId = roomId;
  isCaller      = false;

  rtcPc       = createPC();
  localStream = await getMic();
  addTracks(rtcPc, localStream);

  rtcPc.onicecandidate = async e => {
    if (e.candidate) await roomRef.child('calleeCandidates').push(e.candidate.toJSON());
  };

  await rtcPc.setRemoteDescription(new RTCSessionDescription(snap.val().offer));
  const answer = await rtcPc.createAnswer();
  answer.sdp   = preferOpus(answer.sdp);
  await rtcPc.setLocalDescription(answer);
  await roomRef.child('answer').set({ type: answer.type, sdp: answer.sdp });

  const callerCandRef      = roomRef.child('callerCandidates');
  const callerCandListener = callerCandRef.on('child_added', async snap => {
    if (rtcPc) await rtcPc.addIceCandidate(new RTCIceCandidate(snap.val())).catch(() => {});
  });
  callListeners.push({ ref: callerCandRef, listener: callerCandListener, event: 'child_added' });
}

// ─────────────────────────────────────────────────────────────────
// JOIN FROM ALREADY-FETCHED SNAPSHOT (avoids second Firebase read)
// ─────────────────────────────────────────────────────────────────
async function _joinRoomFromSnap(roomId, snap) {
  const roomRef = fbDb.ref('rooms/' + roomId);
  currentRoomId = roomId;
  isCaller      = false;

  rtcPc       = createPC();
  localStream = await getMic();
  addTracks(rtcPc, localStream);

  rtcPc.onicecandidate = async e => {
    if (e.candidate) await roomRef.child('calleeCandidates').push(e.candidate.toJSON());
  };

  await rtcPc.setRemoteDescription(new RTCSessionDescription(snap.val().offer));
  const answer = await rtcPc.createAnswer();
  answer.sdp   = preferOpus(answer.sdp);
  await rtcPc.setLocalDescription(answer);
  await roomRef.child('answer').set({ type: answer.type, sdp: answer.sdp });

  const callerCandRef      = roomRef.child('callerCandidates');
  const callerCandListener = callerCandRef.on('child_added', async snap => {
    if (rtcPc) await rtcPc.addIceCandidate(new RTCIceCandidate(snap.val())).catch(() => {});
  });
  callListeners.push({ ref: callerCandRef, listener: callerCandListener, event: 'child_added' });
}

// ─────────────────────────────────────────────────────────────────
// MATCH DOC CLEANUP — delete matches/{matchId} after every call end
// so same two users can rematch cleanly without stale data blocking
// ─────────────────────────────────────────────────────────────────
function _cleanupMatchDoc() {
  if (!fbDb) return;
  if (typeof currentMatchId !== 'undefined' && currentMatchId) {
    fbDb.ref('matches/' + currentMatchId + '/webrtcRoomId').off();
    fbDb.ref('matches/' + currentMatchId).remove().catch(() => {});
    // currentMatchId is a global in matching.js — reset it here
    if (typeof window !== 'undefined') window.currentMatchId = null;
  }
}

// ─────────────────────────────────────────────────────────────────
// START VOICE CALL (from chat header)
// ─────────────────────────────────────────────────────────────────
async function startVoiceCall(palOverride) {
  const pal = palOverride || state.currentPal;

  setAvatarEl('callAvatar', pal ? pal.avatar : 'cat');
  _txt('callName',  pal ? pal.name  : 'Unknown');
  _txt('callMood',  pal ? ('Feeling ' + pal.mood + ' ' + (pal.moodEmoji || '')) : '');
  _txt('callTimer', '00:00');
  _txt('callStatus', 'Connecting...');
  state.callSecs = 0;
  showScreen('screen-call');

  if (!fbDb) {
    setTimeout(() => startCallTimer(), 1500);
    showToast('⚠️ Setup Firebase for real calls (Profile → Voice Calls)');
    return;
  }

  try {
    const roomId = genRoomId();
    await createRoom(roomId);
  } catch (err) {
    const msg = err.name === 'NotAllowedError'
      ? 'Please allow microphone access and try again'
      : 'Mic error: ' + (err.message || 'Check microphone permissions');
    showToast(msg);
    endCallCleanup();
    goBack();
  }
}

// ─────────────────────────────────────────────────────────────────
// DIRECT CALL BY PHONE NUMBER
// ─────────────────────────────────────────────────────────────────
async function directCallByPhone(phoneArg) {
  let phone = (typeof phoneArg === 'string' && /^\d{7}$/.test(phoneArg.trim()))
    ? phoneArg.trim() : null;

  if (!phone) {
    const inp = document.getElementById('dialPhoneInput');
    phone = inp ? inp.value.trim() : '';
  }
  if (!phone || !/^\d{7}$/.test(phone)) { showToast('Enter a valid 7-digit Guftgu number'); return; }
  if (phone === state.guftguPhone)       { showToast("That's your own number 😄"); return; }
  if (!fbDb)                             { showToast('Firebase not connected — enable it in Settings'); return; }

  try {
    const roomId    = genRoomId();
    const u         = state.user;
    const palName   = (state.currentPal && state.currentPal.phone === phone && state.currentPal.name)
      ? state.currentPal.name : ('Guftgu #' + phone);
    const palAvatar = (state.currentPal && state.currentPal.phone === phone && state.currentPal.avatar)
      ? state.currentPal.avatar : 'cat';

    state.currentPal = { avatar: palAvatar, name: palName, mood: '', moodEmoji: '', phone };

    setAvatarEl('callAvatar', palAvatar);
    _txt('callName',  palName);
    _txt('callMood',  '');
    _txt('callTimer', '00:00');
    _txt('callStatus', 'Ringing...');
    state.callSecs = 0;
    showScreen('screen-call');

    await createRoom(roomId);
    await fbDb.ref('rooms/' + roomId + '/callerProfile').set({
      name: u.nickname || 'Anonymous', avatar: u.avatar || 'cat',
      mood: u.mood || '', moodEmoji: u.moodEmoji || '', phone: state.guftguPhone || '',
    });

    // Watch callee profile so caller UI updates when answered
    const calleeProfileRef = fbDb.ref('rooms/' + roomId + '/calleeProfile');
    const calleeProfileLsn = calleeProfileRef.on('value', snap => {
      if (!snap.exists()) return;
      const p = snap.val();
      if (!p.name) return;
      setAvatarEl('callAvatar', p.avatar || 'cat');
      _txt('callName', p.name);
      _txt('callMood', p.mood ? ('Feeling ' + p.mood + ' ' + (p.moodEmoji || '')) : '');
      _txt('callStatus', 'Connecting...');
      state.currentPal = { avatar: p.avatar || 'cat', name: p.name, mood: p.mood || '', moodEmoji: p.moodEmoji || '', phone };
      calleeProfileRef.off('value', calleeProfileLsn);
    });
    callListeners.push({ ref: calleeProfileRef, listener: calleeProfileLsn, event: 'value' });

    await fbDb.ref('callRequests/' + phone).set({
      from: state.guftguPhone, fromName: u.nickname || 'Someone',
      fromAvatar: u.avatar || 'cat', fromMood: (u.mood || 'Happy') + ' ' + (u.moodEmoji || '😄'),
      roomId, timestamp: Date.now()
    });

    _watchCallDeclined(roomId, phone);

    const _callTimeout = setTimeout(async () => {
      try { await fbDb.ref('callRequests/' + phone).remove(); } catch (_) {}
      if (state.screen === 'screen-call') {
        const p = _getCurrentPalInfo();
        if (typeof saveCallToHistory === 'function') {
          saveCallToHistory(p.avatar, p.name, p.mood, '00:00', 'Missed');
        }
        if (typeof updateProfileStats === 'function') updateProfileStats();
        showToast('No answer — they may be offline');
        endCallCleanup();
        goBack();
      }
    }, 30000);

    state._directCallTimeout = _callTimeout;
    state._directCallTarget  = phone;

  } catch (err) {
    const msg = err.name === 'NotAllowedError'
      ? 'Please allow microphone access and try again'
      : 'Call failed: ' + (err.message || 'Try again');
    showToast(msg);
    endCallCleanup();
    goBack();
  }
}

// ─────────────────────────────────────────────────────────────────
// LISTEN FOR INCOMING CALLS
// ─────────────────────────────────────────────────────────────────
let _incomingCallListener = null;
function listenForIncomingCalls() {
  if (!fbDb || !state.guftguPhone) return;
  const myPhone = state.guftguPhone;
  const ref     = fbDb.ref('callRequests/' + myPhone);

  if (_incomingCallListener) ref.off('value', _incomingCallListener);

  _incomingCallListener = ref.on('value', snap => {
    if (!snap.exists()) return;
    const req = snap.val();
    if (!req.roomId || !req.from) return;

    // Block check — silently decline if caller is blocked
    const blockedList = JSON.parse(localStorage.getItem('guftgu_blocked') || '[]');
    const isBlocked   = blockedList.includes(req.from);

    if (isBlocked) {
      if (fbDb && req.roomId) {
        fbDb.ref('rooms/' + req.roomId + '/callDeclined').set(true).catch(() => {});
      }
      if (typeof saveCallToHistory === 'function') {
        saveCallToHistory(req.fromAvatar || 'cat', req.fromName || 'Unknown',
          '', '00:00', 'Blocked');
      }
      ref.remove().catch(() => {});
      return;
    }

    if (state.screen === 'screen-call') return;

    showIncomingCall(
      req.fromAvatar || 'cat', req.fromName || 'Unknown',
      req.fromMood   || 'Happy 😄', req.roomId, req.from
    );
    state._incomingCallRef = ref;

    // Watch room for caller hang-up while ring overlay is showing
    if (fbDb && req.roomId) {
      const rRef = fbDb.ref('rooms/' + req.roomId);
      const rLsn = rRef.on('value', rSnap => {
        if (!rSnap.exists()) {
          rRef.off('value', rLsn);
          _cls('incomingCallOverlay', 'remove', 'show');
          if (state._pendingIncomingRoom === req.roomId) {
            state._pendingIncomingRoom = null;
            showToast('The caller hung up');
          }
          return;
        }
        const d = rSnap.val();
        if (d.callBlocked || d.callDeclined || d.callEnded) {
          rRef.off('value', rLsn);
          _cls('incomingCallOverlay', 'remove', 'show');
          if (state._pendingIncomingRoom === req.roomId) {
            state._pendingIncomingRoom = null;
            showToast(d.callBlocked ? 'Call cancelled' : 'The caller hung up');
          }
          if (typeof saveCallToHistory === 'function') {
            saveCallToHistory(req.fromAvatar || 'cat', req.fromName || 'Unknown',
              '', '00:00', 'Missed');
          }
        }
      });
    }
  });
}

// ─────────────────────────────────────────────────────────────────
// END CALL (user taps End button)
// ─────────────────────────────────────────────────────────────────
function endCall() {
  if (state.screen !== 'screen-call') return;

  const p        = _getCurrentPalInfo();
  const duration = _getCallDuration();
  const callType = isCaller ? 'Outgoing' : 'Incoming';

  if (typeof saveCallToHistory === 'function') {
    saveCallToHistory(p.avatar, p.name, p.mood, duration, callType);
  }
  if (typeof updateProfileStats === 'function') updateProfileStats();

  if (state._directCallTimeout) { clearTimeout(state._directCallTimeout); state._directCallTimeout = null; }
  if (fbDb && state._directCallTarget) {
    fbDb.ref('callRequests/' + state._directCallTarget).remove().catch(() => {});
    state._directCallTarget = null;
  }
  if (fbDb && state._incomingCallRef) {
    state._incomingCallRef.remove().catch(() => {});
    state._incomingCallRef = null;
  }

  _iEnded = true;

  if (fbDb && currentRoomId) {
    fbDb.ref('rooms/' + currentRoomId + '/callEnded').set(true).catch(() => {});
  }

  showToast('Call ended — ' + duration);
  _cleanupMatchDoc();
  endCallCleanup();
  goBack();
}

// ─────────────────────────────────────────────────────────────────
// BLOCK USER DURING ACTIVE CALL
// ─────────────────────────────────────────────────────────────────
function blockFromCall() {
  if (state.screen !== 'screen-call') return;

  const p        = _getCurrentPalInfo();
  const duration = _getCallDuration();

  if (typeof blockUser === 'function' && p.phone) {
    blockUser(p.phone, p.name, p.avatar);
  }

  if (typeof saveCallToHistory === 'function') {
    saveCallToHistory(p.avatar, p.name, p.mood, duration, 'Blocked');
  }
  if (typeof updateProfileStats === 'function') updateProfileStats();

  if (state._directCallTimeout) { clearTimeout(state._directCallTimeout); state._directCallTimeout = null; }
  if (fbDb && state._directCallTarget) {
    fbDb.ref('callRequests/' + state._directCallTarget).remove().catch(() => {});
    state._directCallTarget = null;
  }
  if (fbDb && state._incomingCallRef) {
    state._incomingCallRef.remove().catch(() => {});
    state._incomingCallRef = null;
  }

  _iEnded = true;
  if (fbDb && currentRoomId) {
    const roomRef = fbDb.ref('rooms/' + currentRoomId);
    roomRef.child('callBlocked').set(true).catch(() => {});
    roomRef.child('callEnded').set(true).catch(() => {});
  }

  showToast((p.name || 'User') + " blocked — they can't contact you again 🚫");
  _cleanupMatchDoc();
  endCallCleanup();
  goBack();
}

// ─────────────────────────────────────────────────────────────────
// WATCH FOR CALLEE DECLINING / BLOCKING (directCallByPhone)
// ─────────────────────────────────────────────────────────────────
let _declinedRef = null;
let _declinedLsn = null;

function _watchCallDeclined(roomId, calledPhone) {
  if (!fbDb || !roomId) return;
  if (_declinedRef && _declinedLsn) { _declinedRef.off('value', _declinedLsn); }

  _declinedRef = fbDb.ref('rooms/' + roomId + '/callDeclined');
  _declinedLsn = _declinedRef.on('value', snap => {
    if (!snap.exists() || !snap.val()) return;
    _declinedRef.off('value', _declinedLsn);
    _declinedRef = null; _declinedLsn = null;
    if (state.screen !== 'screen-call') return;

    if (state._directCallTimeout) { clearTimeout(state._directCallTimeout); state._directCallTimeout = null; }

    const p        = _getCurrentPalInfo();
    const duration = _getCallDuration();

    if (typeof saveCallToHistory === 'function') {
      saveCallToHistory(p.avatar, p.name, p.mood, duration, 'Missed');
    }
    if (typeof updateProfileStats === 'function') updateProfileStats();
    showToast('User not available 📵');
    endCallCleanup();
    goBack();
  });
}

// ─────────────────────────────────────────────────────────────────
// CLEANUP
// ─────────────────────────────────────────────────────────────────
function endCallCleanup() {
  clearInterval(state.callTimer);
  _iEnded = false;

  if (_callEndedRef && _callEndedLsn) {
    _callEndedRef.off('value', _callEndedLsn);
    _callEndedRef = null; _callEndedLsn = null;
  }
  if (_declinedRef && _declinedLsn) {
    _declinedRef.off('value', _declinedLsn);
    _declinedRef = null; _declinedLsn = null;
  }

  if (rtcPc)       { rtcPc.close(); rtcPc = null; }
  if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
  if (remoteAudio) { remoteAudio.srcObject = null; }

  callListeners.forEach(({ ref, listener, event }) => ref.off(event, listener));
  callListeners = [];

  // Always clean phoneRooms regardless of currentRoomId state
  if (fbDb && state.guftguPhone) {
    fbDb.ref('phoneRooms/' + state.guftguPhone).remove().catch(() => {});
  }

  if (fbDb && currentRoomId) {
    fbDb.ref('rooms/' + currentRoomId).remove().catch(() => {});
    currentRoomId = null;
  }

  // Reset call-level flags
  isCaller = false;

  const cs = document.getElementById('callCodeSection');
  if (cs) cs.style.display = 'none';
}

// ─────────────────────────────────────────────────────────────────
// CALL TIMER
// ─────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────
// MUTE TOGGLE
// ─────────────────────────────────────────────────────────────────
function toggleMute(ctrl) {
  const btn      = ctrl.querySelector('.call-ctrl-btn');
  const lbl      = ctrl.querySelector('.call-ctrl-label');
  const isActive = btn.classList.toggle('active');
  state.isMuted  = isActive;
  if (localStream) localStream.getAudioTracks().forEach(t => { t.enabled = !isActive; });
  if (lbl) lbl.textContent = isActive ? 'Muted' : 'Mute';
}

// ─────────────────────────────────────────────────────────────────
// INCOMING CALL UI
// ─────────────────────────────────────────────────────────────────
function showIncomingCall(avatar, name, mood, roomId, callerPhone) {
  setAvatarEl('incAvatar', avatar);
  _txt('incName', name);
  _txt('incMood', 'Feeling ' + mood);
  state._pendingIncomingRoom   = roomId;
  state._pendingIncomingName   = name;
  state._pendingIncomingAvatar = avatar;
  state._pendingIncomingMood   = mood;
  state._pendingIncomingPhone  = callerPhone || null;
  _cls('incomingCallOverlay', 'add', 'show');
}

function rejectIncomingCall() {
  _cls('incomingCallOverlay', 'remove', 'show');
  const roomId = state._pendingIncomingRoom;
  state._pendingIncomingRoom = null;

  const name   = state._pendingIncomingName   || 'Unknown';
  const avatar = state._pendingIncomingAvatar || 'cat';
  if (typeof saveCallToHistory === 'function') {
    saveCallToHistory(avatar, name, '', '00:00', 'Missed');
  }

  if (fbDb && roomId) fbDb.ref('rooms/' + roomId + '/callDeclined').set(true).catch(() => {});
  if (fbDb && state._incomingCallRef) {
    state._incomingCallRef.remove().catch(() => {});
    state._incomingCallRef = null;
  }
  showToast('Call declined');
}

// ─────────────────────────────────────────────────────────────────
// BLOCK FROM INCOMING OVERLAY (before answering)
// ─────────────────────────────────────────────────────────────────
function blockFromIncoming() {
  _cls('incomingCallOverlay', 'remove', 'show');

  const roomId      = state._pendingIncomingRoom;
  const callerPhone = state._pendingIncomingPhone;
  const callerName  = state._pendingIncomingName   || 'Unknown';
  const callerAvatar= state._pendingIncomingAvatar || 'cat';
  state._pendingIncomingRoom = null;

  if (fbDb && roomId) {
    fbDb.ref('rooms/' + roomId + '/callDeclined').set(true).catch(() => {});
    fbDb.ref('rooms/' + roomId + '/callBlocked').set(true).catch(() => {});
  }
  if (fbDb && state._incomingCallRef) {
    state._incomingCallRef.remove().catch(() => {});
    state._incomingCallRef = null;
  }

  if (typeof blockUser === 'function' && callerPhone) {
    blockUser(callerPhone, callerName, callerAvatar);
  }

  if (typeof saveCallToHistory === 'function') {
    saveCallToHistory(callerAvatar, callerName, '', '00:00', 'Blocked');
  }

  showToast((callerName !== 'Unknown' ? callerName : 'User') + " blocked — they can't call you anymore");
}

// ─────────────────────────────────────────────────────────────────
// ANSWER INCOMING CALL
// ─────────────────────────────────────────────────────────────────
async function answerIncomingCall() {
  const roomId = state._pendingIncomingRoom;

  _cls('incomingCallOverlay', 'remove', 'show');
  if (!roomId || !fbDb) return;

  if (state._incomingCallRef) {
    state._incomingCallRef.remove().catch(() => {});
    state._incomingCallRef = null;
  }

  const callerAvatar = state._pendingIncomingAvatar || 'cat';
  const callerName   = state._pendingIncomingName   || 'Unknown';
  const callerMood   = state._pendingIncomingMood   || '';
  const callerPhone  = state._pendingIncomingPhone  || null;

  // Pre-check: verify room still exists and caller hasn't hung up
  let roomSnap;
  try {
    roomSnap = await fbDb.ref('rooms/' + roomId).once('value');
  } catch (_) {
    showToast('Call ended before you could answer');
    return;
  }

  if (!roomSnap.exists()) {
    if (typeof saveCallToHistory === 'function') {
      saveCallToHistory(callerAvatar, callerName, callerMood, '00:00', 'Missed');
    }
    showToast('The caller already hung up');
    return;
  }

  const roomData = roomSnap.val();

  if (roomData.callBlocked) {
    if (typeof saveCallToHistory === 'function') {
      saveCallToHistory(callerAvatar, callerName, callerMood, '00:00', 'Blocked');
    }
    showToast('This call is no longer available');
    fbDb.ref('rooms/' + roomId).remove().catch(() => {});
    return;
  }

  if (roomData.callDeclined || roomData.callEnded) {
    if (typeof saveCallToHistory === 'function') {
      saveCallToHistory(callerAvatar, callerName, callerMood, '00:00', 'Missed');
    }
    showToast('The caller already hung up');
    return;
  }

  // Room valid — navigate to call screen
  setAvatarEl('callAvatar', callerAvatar);
  _txt('callName',  callerName);
  _txt('callMood',  callerMood ? 'Feeling ' + callerMood : '');
  _txt('callTimer', '00:00');
  _txt('callStatus', 'Connecting...');
  state.callSecs = 0;

  state.currentPal = {
    avatar: callerAvatar, name: callerName,
    mood: callerMood, moodEmoji: '', phone: callerPhone,
  };

  showScreen('screen-call');

  // Write callee profile so caller UI updates
  try {
    const u = state.user;
    await fbDb.ref('rooms/' + roomId + '/calleeProfile').set({
      name: u.nickname || 'Anonymous', avatar: u.avatar || 'cat',
      mood: u.mood || '', moodEmoji: u.moodEmoji || '', phone: state.guftguPhone || '',
    });
  } catch (_) {}

  await _joinRoomFromSnap(roomId, roomSnap);
}

function toggleCallCtrl(ctrl, activeLabel, defaultLabel) {
  const btn      = ctrl.querySelector('.call-ctrl-btn');
  const lbl      = ctrl.querySelector('.call-ctrl-label');
  const isActive = btn.classList.toggle('active');
  if (lbl) lbl.textContent = isActive ? activeLabel : defaultLabel;
}

// ─────────────────────────────────────────────────────────────────
// JOIN BY CODE (manual entry on call screen)
// ─────────────────────────────────────────────────────────────────
async function joinCallByCode() {
  const joinEl = document.getElementById('callJoinInput');
  const raw    = joinEl ? joinEl.value.trim().toUpperCase() : '';
  if (!raw || raw.length < 4) { showToast('Enter a code or phone number'); return; }
  if (!fbDb) { showToast('Setup Firebase first'); return; }

  const isPhone  = /^\d{7}$/.test(raw);
  const roomCode = isPhone ? await lookupPhoneRoom(raw) : raw;
  if (!roomCode) { showToast('This number is not online right now'); return; }

  try {
    await joinRoom(roomCode);
  } catch (err) {
    showToast('Error: ' + (err.message || 'Check the code and try again'));
  }
}

async function lookupPhoneRoom(phone) {
  try {
    const snap = await fbDb.ref('phoneRooms/' + phone).once('value');
    return snap.exists() ? snap.val().roomId : null;
  } catch (_) { return null; }
}

// ─────────────────────────────────────────────────────────────────
// ADD FRIEND FROM ACTIVE CALL
// ─────────────────────────────────────────────────────────────────
function addFriendFromCall() {
  const btn  = document.getElementById('callAddFriendBtn');
  const text = document.getElementById('callAddFriendText');
  const pal  = state.currentPal;

  if (!pal) { showToast('No active call'); return; }
  if (btn && btn.classList.contains('sent')) { showToast('Friend request already sent!'); return; }

  const palPhone = pal.phone || null;

  if (typeof sendFriendRequest === 'function') {
    sendFriendRequest(palPhone || ('call_' + Date.now()),
      pal.name || 'Unknown', pal.avatar || 'cat', pal.mood || 'Happy', pal.moodEmoji || '😊');
  }

  if (btn)  btn.classList.add('sent');
  if (text) text.textContent = '✓ Request Sent!';
  showToast('👋 Friend request sent to ' + (pal.name || 'your pal') + '!');

  if (fbDb && palPhone && state.guftguPhone) {
    fbDb.ref('friendRequests/' + palPhone + '/' + state.guftguPhone).set({
      from: state.guftguPhone, name: state.user.nickname || 'Anonymous',
      avatar: state.user.avatar || 'cat', mood: state.user.mood || 'Happy',
      moodEmoji: state.user.moodEmoji || '😊', timestamp: Date.now(), source: 'call'
    });
  }
}

function resetCallAddFriend() {
  const btn  = document.getElementById('callAddFriendBtn');
  const text = document.getElementById('callAddFriendText');
  if (btn)  btn.classList.remove('sent');
  if (text) text.textContent = '+ Add Friend';
}