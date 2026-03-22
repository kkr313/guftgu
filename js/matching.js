// js/matching.js — Match engine + WebRTC role coordination
// ═══════════════════════════════════════════════════════════════
//
// PRIORITY ORDER:
//   P1  mood + lang + region   (0s)
//   P2  mood + lang            (8s)
//   P3  mood only              (18s)
//   P4  lang only              (30s)
//
// CALLER/CALLEE ASSIGNMENT:
//   After both users accept the match, user1 (the proposer) becomes
//   the WebRTC CALLER and calls createRoom(). User2 (the acceptor)
//   watches matches/{matchId}/webrtcRoomId and joins when it appears.
//   This guarantees exactly one caller and one callee — no conflicts.
// ═══════════════════════════════════════════════════════════════

let _matchQueueRef    = null;
let _countListener    = null;
let _queueListener    = null;
let _proposalRef      = null;
let _proposalListener = null;
let _tipInterval      = null;
let _searchStart      = 0;
let _myMatchRole      = null; // 'caller' | 'callee'
let autoConnect       = false;
let currentMatchId    = null;

const P1_MS =  0;
const P2_MS =  8000;
const P3_MS = 18000;
const P4_MS = 30000;

// ── Tip rotator ──────────────────────────────────────────────────
function startSearchTips() {
  if (_tipInterval) clearInterval(_tipInterval);
  const tips = document.querySelectorAll('.search-tip');
  if (!tips.length) return;
  let idx = 0;
  tips[0].classList.add('active');
  _tipInterval = setInterval(() => {
    tips[idx].classList.remove('active');
    idx = (idx + 1) % tips.length;
    setTimeout(() => tips[idx].classList.add('active'), 300);
  }, 4000);
}

function stopSearchTips() {
  if (_tipInterval) { clearInterval(_tipInterval); _tipInterval = null; }
  document.querySelectorAll('.search-tip').forEach(t => t.classList.remove('active'));
}

// ── Entry point ──────────────────────────────────────────────────
function startMatching() {
  showScreen('screen-match');
  const mfo = document.getElementById('matchFoundOverlay');
  if (mfo) mfo.classList.remove('show');
  const rmo = document.getElementById('rematchOptions');
  if (rmo) rmo.classList.remove('show');

  const sme = document.getElementById('searchMoodEmoji');
  if (sme) sme.textContent = state.user.moodEmoji || '😄';

  const mfl = document.getElementById('matchFilterLabel');
  if (mfl) mfl.textContent =
    (state.user.language || 'Hindi') + ' · ' +
    (state.user.mood     || 'Happy') + ' · ' +
    (state.user.region   || 'All India');

  startSearchTips();
  _myMatchRole = null;
  currentMatchId = null;

  if (fbDb) {
    _enterQueue();
  } else {
    _simulateMatch();
  }
}

// ── Write entry into queue ───────────────────────────────────────
function _enterQueue() {
  const phone = state.guftguPhone || ('guest_' + Date.now());
  _searchStart = Date.now();

  const entry = {
    phone,
    name:      state.user.nickname  || 'Anonymous',
    avatar:    state.user.avatar    || 'cat',
    mood:      state.user.mood      || 'Happy',
    moodEmoji: state.user.moodEmoji || '😄',
    language:  state.user.language  || 'Hindi',
    region:    state.user.region    || 'North',
    intent:    state.user.intent    || 'Just chat',
    ts:        Date.now(),
    status:    'searching',
  };

  _matchQueueRef = fbDb.ref('matchQueue/' + phone);
  _matchQueueRef.set(entry).then(() => {
    _matchQueueRef.onDisconnect().remove();
    _watchQueue(phone, entry);
    _listenForProposals(phone);
    _watchQueueCount();
  });
}

// ── Scan queue and propose matches ───────────────────────────────
function _watchQueue(myPhone, myEntry) {
  const queueRef = fbDb.ref('matchQueue');

  _queueListener = queueRef.on('value', snap => {
    if (!snap.exists()) return;

    const elapsed = Date.now() - _searchStart;
    const queue   = snap.val();
    let   best    = null;
    let   bestPri = 999;

    for (const [phone, entry] of Object.entries(queue)) {
      if (phone === myPhone)             continue;
      if (entry.status !== 'searching')  continue;

      const pri = _priority(myEntry, entry, elapsed);
      if (pri === null) continue;

      if (pri < bestPri || (pri === bestPri && entry.ts < (best && best.ts))) {
        best    = { ...entry, phone };
        bestPri = pri;
      }
    }

    if (!best) return;

    // Only lower phone sends the proposal to prevent duplicates
    if (myPhone >= best.phone) return;

    const proposalPath = 'matchProposals/' + best.phone + '/' + myPhone;
    fbDb.ref(proposalPath).once('value').then(existing => {
      if (existing.exists()) return;
      fbDb.ref(proposalPath).set({
        from:      myPhone,
        fromEntry: myEntry,
        priority:  bestPri,
        ts:        Date.now(),
      });
    });
  });
}

// ── Listen for incoming proposals ────────────────────────────────
function _listenForProposals(myPhone) {
  _proposalRef = fbDb.ref('matchProposals/' + myPhone);

  _proposalListener = _proposalRef.on('child_added', snap => {
    if (!snap.exists()) return;
    const proposal   = snap.val();
    const theirPhone = proposal.from;
    const theirEntry = proposal.fromEntry;

    // Verify still searching
    fbDb.ref('matchQueue/' + theirPhone).once('value').then(s => {
      if (!s.exists() || s.val().status !== 'searching') {
        snap.ref.remove();
        return;
      }

      const matchId = 'match_' + Date.now() + '_' + Math.random().toString(36).substr(2,5);
      currentMatchId = matchId;

      // I am user2 (callee), proposer (theirPhone) is user1 (caller)
      _myMatchRole = 'callee';

      fbDb.ref('matches/' + matchId).set({
        user1:     { ...theirEntry, phone: theirPhone }, // caller
        user2:     { ...s.val(),    phone: myPhone    }, // callee (me)
        status:    'pending',
        createdAt: Date.now(),
        priority:  proposal.priority,
      }).then(() => {
        fbDb.ref('matchQueue/' + myPhone    + '/status').set('matched');
        fbDb.ref('matchQueue/' + theirPhone + '/status').set('matched');
        fbDb.ref('matchQueue/' + myPhone    + '/matchId').set(matchId);
        fbDb.ref('matchQueue/' + theirPhone + '/matchId').set(matchId);
        snap.ref.remove();
        _onMatchFound(theirEntry, theirPhone, matchId, 'callee');
      });
    });
  });

  // Watch our own queue entry for matchId set by the other side
  fbDb.ref('matchQueue/' + myPhone).on('value', snap => {
    if (!snap.exists()) return;
    const data = snap.val();
    if (data.matchId && data.status === 'matched' && data.matchId !== currentMatchId) {
      currentMatchId  = data.matchId;
      _myMatchRole    = 'caller'; // proposer side = caller
      fbDb.ref('matches/' + data.matchId).once('value').then(mSnap => {
        if (!mSnap.exists()) return;
        const match = mSnap.val();
        const pal   = match.user1.phone === myPhone ? match.user2 : match.user1;
        _onMatchFound(pal, pal.phone, data.matchId, 'caller');
      });
    }
  });
}

// ── Priority calculator ──────────────────────────────────────────
function _priority(me, them, elapsed) {
  const sameMood   = me.mood     === them.mood;
  const sameLang   = me.language === them.language;
  const sameRegion = me.region   === them.region;

  if (sameMood && sameLang && sameRegion)        return 1;
  if (elapsed >= P2_MS && sameMood && sameLang)  return 2;
  if (elapsed >= P3_MS && sameMood)              return 3;
  if (elapsed >= P4_MS && sameLang)              return 4;
  return null;
}

// ── Match found ──────────────────────────────────────────────────
function _onMatchFound(pal, palPhone, matchId, role) {
  _stopScan();
  _myMatchRole = role;

  state.currentPal = {
    avatar:    pal.avatar,
    name:      pal.name,
    mood:      pal.mood,
    moodEmoji: pal.moodEmoji,
    phone:     palPhone,
  };

  if (autoConnect) {
    cleanupQueue();
    _startCoordinatedCall(matchId, role);
  } else {
    _showMatchFound(pal, matchId, role);
  }
}

// ── Show match overlay ───────────────────────────────────────────
function _showMatchFound(pal, matchId, role) {
  setAvatarEl('palAvatarMF', pal.avatar);
  _txt('palNameMF', pal.name);
  _txt('palMoodMF', 'Feeling: ' + pal.mood + ' ' + pal.moodEmoji);

  const badges = [];
  if (pal.region)   badges.push('📍 ' + pal.region);
  if (pal.language) badges.push('🗣️ ' + pal.language);
  const pbmf = document.getElementById('palBadgesMF');
  if (pbmf) pbmf.innerHTML = badges.map(b => `<div class="mf-badge">${b}</div>`).join('');

  const mfo = document.getElementById('matchFoundOverlay');
  if (mfo) mfo.classList.add('show');

  let secs = 15;
  const cdEl = document.getElementById('countdownEl');
  if (cdEl) cdEl.textContent = secs;

  if (state._matchCountdownTimer) clearInterval(state._matchCountdownTimer);
  state._matchCountdownTimer = setInterval(() => {
    secs--;
    if (cdEl) cdEl.textContent = secs;
    if (secs <= 0) {
      clearInterval(state._matchCountdownTimer);
      state._matchCountdownTimer = null;
      markMatchResponse('declined', matchId);
      showRematchOptions();
    }
  }, 1000);

  // Store role for acceptMatch
  state._pendingMatchRole = role;
  state._pendingMatchId   = matchId;
}

// ── Accept / decline ─────────────────────────────────────────────
function acceptMatch() {
  if (state._matchCountdownTimer) {
    clearInterval(state._matchCountdownTimer);
    state._matchCountdownTimer = null;
  }
  markMatchResponse('accepted', currentMatchId);
  cleanupQueue();
  _startCoordinatedCall(currentMatchId, state._pendingMatchRole || _myMatchRole);
}

function declineMatch() {
  if (state._matchCountdownTimer) {
    clearInterval(state._matchCountdownTimer);
    state._matchCountdownTimer = null;
  }
  markMatchResponse('declined', currentMatchId);
  cleanupQueue();
  showRematchOptions();
}

// ── KEY FIX: Coordinated call start ─────────────────────────────
// caller  → createRoom() then writes roomId to Firebase
// callee  → watches Firebase for roomId then joinRoom()
function _startCoordinatedCall(matchId, role) {
  const pal = state.currentPal;

  // Set up call screen UI
  setAvatarEl('callAvatar', pal ? pal.avatar : 'cat');
  _txt('callName', pal ? pal.name   : 'Unknown');
  _txt('callMood', pal ? (pal.mood + ' ' + pal.moodEmoji) : '');
  _txt('callTimer', '00:00');
  state.callSecs = 0;
  showScreen('screen-call');
  if (typeof resetCallAddFriend === 'function') resetCallAddFriend();

  if (!fbDb) {
    // Demo mode — simulate connected
    setTimeout(() => {
      if (typeof startCallTimer === 'function') startCallTimer();
    }, 1000);
    return;
  }

  if (role === 'caller') {
    // CALLER: create WebRTC room, write roomId so callee can join
    const roomId = (typeof genRoomId === 'function')
      ? genRoomId()
      : Math.random().toString(36).substr(2, 6).toUpperCase();

    createRoom(roomId).then(() => {
      fbDb.ref('matches/' + matchId + '/webrtcRoomId').set(roomId);
    }).catch(err => {
      showToast('Mic error: ' + (err.message || 'Check microphone permissions'));
      endCallCleanup();
      goBack();
    });

    // Watch for callee declining — if so, end call and show rematch
    const declineRef = fbDb.ref('matches/' + matchId + '/user2Response');
    const declineListener = declineRef.on('value', snap => {
      if (!snap.exists()) return;
      if (snap.val() === 'declined') {
        declineRef.off('value', declineListener);
        showToast("Your match skipped — searching again");
        endCallCleanup();
        showRematchOptions();
        showScreen('screen-match');
      }
    });

  } else {
    // CALLEE: watch for caller's roomId, then join
    const roomRef = fbDb.ref('matches/' + matchId + '/webrtcRoomId');

    const joinTimeout = setTimeout(() => {
      roomRef.off('value', joinListener);
      showToast('Connection timed out — try again');
      endCallCleanup();
      goBack();
    }, 20000);

    const joinListener = roomRef.on('value', snap => {
      if (!snap.exists()) return;
      const roomId = snap.val();
      if (!roomId) return;
      roomRef.off('value', joinListener);
      clearTimeout(joinTimeout);

      joinRoom(roomId).catch(err => {
        showToast('Join error: ' + (err.message || 'Try again'));
        endCallCleanup();
        goBack();
      });
    });
  }
}

// ── Helpers ──────────────────────────────────────────────────────
function showRematchOptions() {
  _cls('matchFoundOverlay', 'remove', 'show');
  _cls('rematchOptions',    'add',    'show');
}

function restartMatching() {
  _cls('rematchOptions', 'remove', 'show');
  startMatching();
}

function markMatchResponse(response, matchId) {
  if (!fbDb || !matchId) return;
  const myPhone = state.guftguPhone;
  fbDb.ref('matches/' + matchId).once('value').then(snap => {
    if (!snap.exists()) return;
    const match = snap.val();
    const field = match.user1.phone === myPhone ? 'user1Response' : 'user2Response';
    fbDb.ref('matches/' + matchId + '/' + field).set(response);
  });
}

function _watchQueueCount() {
  _countListener = fbDb.ref('matchQueue').on('value', snap => {
    const count = snap.exists() ? Object.keys(snap.val()).length : 0;
    const el = document.getElementById('queueCountEl');
    if (!el) return;
    el.textContent = count > 1
      ? (count - 1) + ' other' + (count > 2 ? 's' : '') + ' searching right now'
      : "You're first — waiting for others...";
  });
}

function cancelMatch() {
  stopSearchTips();
  _stopScan();
  cleanupQueue();
  currentMatchId = null;
  if (state._matchCountdownTimer) {
    clearInterval(state._matchCountdownTimer);
    state._matchCountdownTimer = null;
  }
  showScreen('screen-home', true);
}

function _stopScan() {
  if (fbDb && _queueListener) {
    fbDb.ref('matchQueue').off('value', _queueListener);
    _queueListener = null;
  }
}

function cleanupQueue() {
  _stopScan();
  const phone = state.guftguPhone;
  if (_matchQueueRef) {
    _matchQueueRef.onDisconnect().cancel();
    _matchQueueRef.remove();
    _matchQueueRef = null;
  }
  if (fbDb) {
    if (_countListener) {
      fbDb.ref('matchQueue').off('value', _countListener);
      _countListener = null;
    }
    if (_proposalRef && _proposalListener) {
      _proposalRef.off('child_added', _proposalListener);
      _proposalRef = null;
    }
    if (phone) {
      fbDb.ref('matchQueue/'     + phone).off();
      fbDb.ref('matchProposals/' + phone).remove();
    }
  }
}

// ── Demo mode ────────────────────────────────────────────────────
function _simulateMatch() {
  const myMood = state.user.mood     || 'Happy';
  const myLang = state.user.language || 'Hindi';

  const demos = [
    { avatar:'cat',  name:'QuietTiger42', mood:myMood,  moodEmoji:'😄', language:myLang,    region:'North', pri:1, delay:1200 },
    { avatar:'fox',  name:'WildRiver88',  mood:myMood,  moodEmoji:'😄', language:myLang,    region:'South', pri:2, delay:3000 },
    { avatar:'wolf', name:'BoldSpark19',  mood:'Chill', moodEmoji:'😎', language:myLang,    region:'East',  pri:4, delay:9000 },
    { avatar:'owl',  name:'DeepComet33',  mood:myMood,  moodEmoji:'😄', language:'English', region:'West',  pri:3, delay:6000 },
  ];

  let matched = false;
  demos.forEach(pal => {
    setTimeout(() => {
      if (matched) return;
      matched = true;
      state.currentPal = { avatar:pal.avatar, name:pal.name, mood:pal.mood, moodEmoji:pal.moodEmoji };
      if (autoConnect) {
        _startCoordinatedCall('demo_match', 'caller');
      } else {
        _showMatchFound(pal, 'demo_match', 'caller');
      }
    }, pal.delay);
  });
}

function toggleAutoConnect() {
  autoConnect = !autoConnect;
  const t = document.getElementById('autoConnectToggle');
  if (t) t.classList.toggle('on', autoConnect);
  showToast(autoConnect ? '⚡ Auto Connect on' : 'Auto Connect off');
}

function switchToChat() {
  const pal = state.currentPal;
  if (pal) openChat(pal.avatar, pal.name, '', pal.mood);
}