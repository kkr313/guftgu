// js/matching.js — Match engine v2
// ═══════════════════════════════════════════════════════════════
// PRIORITY (Req 1 — language mandatory):
//   Score 3 = lang + mood + region  (fires immediately, best quality)
//   Score 2 = lang + mood           (unlocks after 8s)
//   Score 1 = lang only             (unlocks after 25s, broadest)
//   No same language = never matched. Higher score always wins.

const BLOCKED_KEY = 'guftgu_blocked';

// ── Block list ─────────────────────────────────────────────────────
// Storage format: array of { phone, name, avatar, blockedAt }
// (backwards-compatible: plain phone strings are tolerated on read)

function _getBlocked() {
  try { return JSON.parse(localStorage.getItem(BLOCKED_KEY)) || []; } catch (_) { return []; }
}
function _saveBlocked(list) {
  try { localStorage.setItem(BLOCKED_KEY, JSON.stringify(list)); } catch (_) {}
}
function _isBlocked(phone) {
  if (!phone) return false;
  return _getBlocked().some(entry =>
    typeof entry === 'string' ? entry === phone : entry.phone === phone
  );
}
function blockUser(phone, name, avatar) {
  if (!phone) { showToast('Cannot block — no phone number'); return; }
  const list = _getBlocked();
  // Remove any old entry (string or object) before adding fresh one
  const filtered = list.filter(e => (typeof e === 'string' ? e : e.phone) !== phone);
  filtered.push({
    phone,
    name:      name   || 'Unknown',
    avatar:    avatar || 'cat',
    blockedAt: Date.now()
  });
  _saveBlocked(filtered);
  // Remove from friends
  if (typeof removeFriend === 'function') removeFriend(phone);
  // Write to Firebase so the block persists across devices
  if (fbDb && state.guftguPhone) {
    fbDb.ref('blocked/' + state.guftguPhone + '/' + phone).set({
      name: name || 'Unknown', avatar: avatar || 'cat', blockedAt: Date.now()
    });
  }
  // Refresh blocked screen if open
  if (typeof renderBlockedScreen === 'function') renderBlockedScreen();
}
function unblockUser(phone) {
  const filtered = _getBlocked().filter(e => (typeof e === 'string' ? e : e.phone) !== phone);
  _saveBlocked(filtered);
  if (fbDb && state.guftguPhone) fbDb.ref('blocked/' + state.guftguPhone + '/' + phone).remove();
  showToast('User unblocked ✓');
  // Refresh blocked screen if open
  if (typeof renderBlockedScreen === 'function') renderBlockedScreen();
}
function reportUser(phone, name, reason) {
  if (fbDb && phone) {
    fbDb.ref('reports/' + phone).push({
      reportedBy: state.guftguPhone || 'anon',
      reason:     reason || 'inappropriate',
      name:       name || 'Unknown',
      matchId:    currentMatchId || null,
      timestamp:  Date.now()
    });
  }
  blockUser(phone, name); // always block after report
}

// ── In-app block confirmation modal (no browser confirm()) ────────
function _showBlockConfirm(name, onConfirm) {
  let overlay = document.getElementById('blockConfirmOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id        = 'blockConfirmOverlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML =
      '<div class="modal-sheet">' +
        '<div class="modal-handle"></div>' +
        '<div class="modal-header">' +
          '<div class="modal-title" style="color:var(--accent)">Block user?</div>' +
        '</div>' +
        '<div class="modal-body">' +
          '<p id="blockConfirmMsg" style="font-size:13px;color:var(--text2);line-height:1.7;margin-bottom:20px;"></p>' +
          '<div style="display:flex;gap:12px;">' +
            '<button class="btn btn-ghost" style="flex:1" id="blockConfirmCancel">Cancel</button>' +
            '<button class="btn" style="flex:1;background:var(--accent);color:#fff;border:none;" id="blockConfirmOk">Block</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    const app = document.getElementById('app') || document.body;
    app.appendChild(overlay);
  }

  const msg = overlay.querySelector('#blockConfirmMsg');
  if (msg) msg.textContent = 'Block ' + name + '? They\'ll be removed from your friends and won\'t appear in matches.';

  overlay.classList.add('show');

  // Clone to clear any previous listeners
  ['blockConfirmCancel', 'blockConfirmOk'].forEach(id => {
    const el = overlay.querySelector('#' + id);
    if (!el) return;
    const clone = el.cloneNode(true);
    el.parentNode.replaceChild(clone, el);
  });

  overlay.querySelector('#blockConfirmCancel').onclick = () => overlay.classList.remove('show');
  overlay.querySelector('#blockConfirmOk').onclick     = () => {
    overlay.classList.remove('show');
    onConfirm();
  };
}

// ── Module state ──────────────────────────────────────────────────
let _matchQueueRef     = null;
let _countListener     = null;
let _queueListener     = null;
let _proposalRef       = null;
let _proposalListener  = null;
let _myQueueListener   = null;
let _matchResponseRef  = null;
let _matchResponseLsn  = null;
let _tipInterval       = null;
let _searchStart       = 0;
let _myMatchRole       = null;
let currentMatchId     = null;
let _waitingForOther   = false;

const P2_MS = 8000;
const P3_MS = 25000;

// ── Tip rotator ───────────────────────────────────────────────────
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

// ── Entry point ───────────────────────────────────────────────────
function startMatching() {
  showScreen('screen-match');
  _cls('matchFoundOverlay', 'remove', 'show');
  _cls('rematchOptions',    'remove', 'show');
  _waitingForOther = false;

  _txt('searchMoodEmoji', state.user.moodEmoji || '😄');
  const mfl = document.getElementById('matchFilterLabel');
  if (mfl) mfl.textContent =
    (state.user.language || 'Hindi') + ' · ' +
    (state.user.mood     || 'Happy') + ' · ' +
    (state.user.region   || 'All India');

  startSearchTips();
  _myMatchRole   = null;
  currentMatchId = null;

  if (fbDb) { _enterQueue(); } else { _simulateMatch(); }
}

// ── Enter queue ───────────────────────────────────────────────────
function _enterQueue() {
  const phone  = state.guftguPhone || ('guest_' + Date.now());
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

// ── Scan queue — language mandatory, blocked users filtered ───────
function _watchQueue(myPhone, myEntry) {
  const queueRef = fbDb.ref('matchQueue');
  if (_queueListener) queueRef.off('value', _queueListener);

  _queueListener = queueRef.on('value', snap => {
    if (!snap.exists()) return;
    const elapsed = Date.now() - _searchStart;
    const queue   = snap.val();
    let best    = null;
    let bestPri = -1; // FIX: was 999 — with "higher wins", init must be below any valid score

    for (const [phone, entry] of Object.entries(queue)) {
      if (phone === myPhone)            continue;
      if (entry.status !== 'searching') continue;
      if (_isBlocked(phone))            continue;

      const pri = _priority(myEntry, entry, elapsed);
      if (pri === null) continue;

      // Higher score wins; on tie prefer earlier joiner (lower ts)
      if (pri > bestPri || (pri === bestPri && entry.ts < (best ? best.ts : Infinity))) {
        best    = { ...entry, phone };
        bestPri = pri;
      }
    }

    if (!best) return;
    if (myPhone >= best.phone) return; // only lower phone proposes (prevents duplicates)

    const path = 'matchProposals/' + best.phone + '/' + myPhone;
    fbDb.ref(path).once('value').then(ex => {
      if (ex.exists()) return;
      fbDb.ref(path).set({ from: myPhone, fromEntry: myEntry, priority: bestPri, ts: Date.now() });
    });
  });
}

// ── Priority — language is ALWAYS mandatory ───────────────────────
// Score 3 = lang+mood+region (best), 2 = lang+mood, 1 = lang only.
// Higher score wins. Time gates open broader matches over time.
function _priority(me, them, elapsed) {
  if (me.language !== them.language) return null; // hard gate

  const sameMood   = me.mood   === them.mood;
  const sameRegion = me.region === them.region;

  // Best: all three match — available immediately
  if (sameMood && sameRegion) return 3;

  // Good: same lang+mood, different region — unlocks after 8s
  if (sameMood && elapsed >= P2_MS) return 2;

  // Fallback: same lang only — unlocks after 25s
  // FIX: was `!sameMood && elapsed >= P3_MS` which excluded sameMood+diffRegion
  if (elapsed >= P3_MS) return 1;

  return null;
}

// ── Listen for incoming proposals ────────────────────────────────
function _listenForProposals(myPhone) {
  if (_proposalRef && _proposalListener) _proposalRef.off('child_added', _proposalListener);
  if (_myQueueListener) {
    fbDb.ref('matchQueue/' + myPhone).off('value', _myQueueListener);
    _myQueueListener = null;
  }

  _proposalRef      = fbDb.ref('matchProposals/' + myPhone);
  _proposalListener = _proposalRef.on('child_added', snap => {
    if (!snap.exists()) return;
    const proposal   = snap.val();
    const theirPhone = proposal.from;
    const theirEntry = proposal.fromEntry;

    if (_isBlocked(theirPhone)) { snap.ref.remove(); return; }

    fbDb.ref('matchQueue/' + theirPhone).once('value').then(s => {
      if (!s.exists() || s.val().status !== 'searching') { snap.ref.remove(); return; }

      const matchId  = 'match_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
      currentMatchId = matchId;
      _myMatchRole   = 'callee';

      fbDb.ref('matches/' + matchId).set({
        user1:         { ...theirEntry, phone: theirPhone },
        user2:         { ...s.val(),    phone: myPhone    },
        status:        'pending',
        createdAt:     Date.now(),
        priority:      proposal.priority,
        user1Response: null,
        user2Response: null,
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

  // Watch our own queue entry for matchId set by the proposer
  _myQueueListener = fbDb.ref('matchQueue/' + myPhone).on('value', snap => {
    if (!snap.exists()) return;
    const data = snap.val();
    if (data.matchId && data.status === 'matched' && data.matchId !== currentMatchId) {
      currentMatchId = data.matchId;
      _myMatchRole   = 'caller';
      fbDb.ref('matches/' + data.matchId).once('value').then(mSnap => {
        if (!mSnap.exists()) return;
        const match = mSnap.val();
        const pal   = match.user1.phone === myPhone ? match.user2 : match.user1;
        _onMatchFound(pal, pal.phone, data.matchId, 'caller');
      });
    }
  });
}

// ── Match found ───────────────────────────────────────────────────
function _onMatchFound(pal, palPhone, matchId, role) {
  _stopScan();
  _myMatchRole     = role;
  state.currentPal = {
    avatar:    pal.avatar,
    name:      pal.name,
    mood:      pal.mood,
    moodEmoji: pal.moodEmoji,
    phone:     palPhone,
  };

  if (autoConnect) {
    cleanupQueue();
    _writeMyResponse('accepted', matchId);
    _watchMatchState(matchId, role);
  } else {
    _showMatchFound(pal, matchId, role);
  }
}

// ── Render match overlay ──────────────────────────────────────────
function _showMatchFound(pal, matchId, role) {
  setAvatarEl('palAvatarMF', pal.avatar);
  _txt('palNameMF', pal.name);
  _txt('palMoodMF', 'Feeling: ' + pal.mood + ' ' + pal.moodEmoji);

  const pbmf = document.getElementById('palBadgesMF');
  if (pbmf) {
    const badges = [];
    if (pal.language) badges.push('🗣️ ' + pal.language);
    if (pal.region)   badges.push('📍 ' + pal.region);
    pbmf.innerHTML = badges.map(b => '<div class="mf-badge">' + b + '</div>').join('');
  }

  _setConnectBtnState('idle');
  _cls('matchFoundOverlay', 'add', 'show');

  // 15-second countdown; expiry = auto-skip
  let secs = 15;
  _txt('countdownEl', secs);
  _clearCountdown();
  state._matchCountdownTimer = setInterval(() => {
    secs--;
    _txt('countdownEl', secs);
    if (secs <= 0) { _clearCountdown(); skipMatch(); }
  }, 1000);

  state._pendingMatchRole = role;
  state._pendingMatchId   = matchId;

  _watchMatchState(matchId, role);
}

// ── Watch Firebase for skip or both-accept (Reqs 2, 3) ───────────
function _watchMatchState(matchId, role) {
  if (_matchResponseRef && _matchResponseLsn) {
    _matchResponseRef.off('value', _matchResponseLsn);
  }
  if (!fbDb || matchId === 'demo_match') return;

  const myPhone         = state.guftguPhone;
  _matchResponseRef     = fbDb.ref('matches/' + matchId);
  _matchResponseLsn     = _matchResponseRef.on('value', snap => {
    if (!snap.exists()) return;
    const data = snap.val();
    if (!data.user1 || !data.user2) return;

    const myField    = data.user1.phone === myPhone ? 'user1Response' : 'user2Response';
    const otherField = myField === 'user1Response'  ? 'user2Response' : 'user1Response';

    // Other side skipped → requeue this user too (Req 3)
    if (data[otherField] === 'skipped') {
      _stopMatchResponseWatch();
      _clearCountdown();
      _cls('matchFoundOverlay', 'remove', 'show');
      showToast('They skipped — finding another match...');
      cleanupQueue();
      setTimeout(() => startMatching(), 700);
      return;
    }

    // Both accepted → start call (Req 2)
    if (data[myField] === 'accepted' && data[otherField] === 'accepted') {
      _stopMatchResponseWatch();
      _clearCountdown();
      cleanupQueue();
      _setConnectBtnState('connecting');
      _startCoordinatedCall(matchId, _myMatchRole || role);
    }
  });
}

function _stopMatchResponseWatch() {
  if (_matchResponseRef && _matchResponseLsn) {
    _matchResponseRef.off('value', _matchResponseLsn);
    _matchResponseRef = null;
    _matchResponseLsn = null;
  }
}

function _clearCountdown() {
  if (state._matchCountdownTimer) {
    clearInterval(state._matchCountdownTimer);
    state._matchCountdownTimer = null;
  }
}

// ── Connect button states ─────────────────────────────────────────
function _setConnectBtnState(s) {
  const btn = document.querySelector('.mf-accept');
  if (!btn) return;
  if (s === 'idle') {
    btn.textContent   = 'Connect 🎙️';
    btn.disabled      = false;
    btn.style.opacity = '1';
  } else if (s === 'waiting') {
    btn.textContent   = 'Waiting... ⏳';
    btn.disabled      = true;
    btn.style.opacity = '0.7';
  } else if (s === 'connecting') {
    btn.textContent   = 'Connecting...';
    btn.disabled      = true;
    btn.style.opacity = '0.6';
  }
}

// ── Accept — write response, wait for Firebase handshake (Req 2) ─
function acceptMatch() {
  if (_waitingForOther) return;
  _waitingForOther = true;
  _clearCountdown();

  const matchId = currentMatchId || state._pendingMatchId;
  _writeMyResponse('accepted', matchId);
  _setConnectBtnState('waiting');
  showToast('Waiting for the other person...');

  // Demo: simulate other side after 1.5s
  if (matchId === 'demo_match') {
    setTimeout(() => {
      cleanupQueue();
      _startCoordinatedCall('demo_match', _myMatchRole || state._pendingMatchRole || 'caller');
    }, 1500);
  }
}

// ── Skip — bilateral via Firebase (Req 3) ────────────────────────
function declineMatch() { skipMatch(); }
function skipMatch() {
  _clearCountdown();
  _waitingForOther = false;
  _writeMyResponse('skipped', currentMatchId || state._pendingMatchId);
  _stopMatchResponseWatch();
  cleanupQueue();
  showRematchOptions();
}

// ── Block from match overlay — in-app confirm (Req 6) ────────────
function blockFromMatch() {
  const pal = state.currentPal;
  if (!pal) return;
  _showBlockConfirm(pal.name || 'this user', () => {
    _clearCountdown();
    _stopMatchResponseWatch();
    _writeMyResponse('skipped', currentMatchId || state._pendingMatchId);
    blockUser(pal.phone, pal.name);
    cleanupQueue();
    _cls('matchFoundOverlay', 'remove', 'show');
    showToast((pal.name || 'User') + ' blocked — won\'t appear again');
    showRematchOptions();
  });
}

// ── Report from match overlay (Req 6) ────────────────────────────
function reportFromMatch() {
  const pal = state.currentPal;
  if (!pal) return;
  _clearCountdown();
  _stopMatchResponseWatch();
  _writeMyResponse('skipped', currentMatchId || state._pendingMatchId);
  reportUser(pal.phone, pal.name, 'reported_from_match');
  cleanupQueue();
  _cls('matchFoundOverlay', 'remove', 'show');
  showToast('Reported & blocked');
  showRematchOptions();
}

// ── Write response field ──────────────────────────────────────────
function _writeMyResponse(response, matchId) {
  if (!fbDb || !matchId || matchId === 'demo_match') return;
  const myPhone = state.guftguPhone;
  fbDb.ref('matches/' + matchId).once('value').then(snap => {
    if (!snap.exists()) return;
    const match = snap.val();
    if (!match.user1 || !match.user2) return;
    const field = match.user1.phone === myPhone ? 'user1Response' : 'user2Response';
    fbDb.ref('matches/' + matchId + '/' + field).set(response);
  });
}

// ── Start coordinated WebRTC call ────────────────────────────────
function _startCoordinatedCall(matchId, role) {
  const pal = state.currentPal;
  setAvatarEl('callAvatar', pal ? pal.avatar : 'cat');
  _txt('callName',  pal ? pal.name  : 'Unknown');
  _txt('callMood',  pal ? (pal.mood + ' ' + (pal.moodEmoji || '')) : '');
  _txt('callTimer', '00:00');
  state.callSecs = 0;
  showScreen('screen-call');

  const afb = document.getElementById('callAddFriendBtn');
  const aft = document.getElementById('callAddFriendText');
  if (afb) afb.classList.remove('sent');
  if (aft) aft.textContent = '+ Add Friend';

  if (!fbDb || matchId === 'demo_match') {
    setTimeout(() => { if (typeof startCallTimer === 'function') startCallTimer(); }, 1000);
    return;
  }

  if (role === 'caller') {
    const roomId = typeof genRoomId === 'function'
      ? genRoomId()
      : Math.random().toString(36).substr(2, 6).toUpperCase();

    createRoom(roomId)
      .then(() => fbDb.ref('matches/' + matchId + '/webrtcRoomId').set(roomId))
      .catch(err => { showToast('Mic error: ' + (err.message || 'Check permissions')); endCallCleanup(); goBack(); });

  } else {
    const roomRef     = fbDb.ref('matches/' + matchId + '/webrtcRoomId');
    const joinTimeout = setTimeout(() => {
      roomRef.off('value', joinLsn);
      showToast('Connection timed out — try again');
      endCallCleanup();
      goBack();
    }, 20000);

    const joinLsn = roomRef.on('value', snap => {
      if (!snap.exists() || !snap.val()) return;
      roomRef.off('value', joinLsn);
      clearTimeout(joinTimeout);
      joinRoom(snap.val()).catch(err => {
        showToast('Join error: ' + (err.message || 'Try again'));
        endCallCleanup();
        goBack();
      });
    });
  }
}

// ── Misc ──────────────────────────────────────────────────────────
function showRematchOptions() {
  _cls('matchFoundOverlay', 'remove', 'show');
  _cls('rematchOptions',    'add',    'show');
}
function restartMatching() {
  _cls('rematchOptions', 'remove', 'show');
  startMatching();
}

function _watchQueueCount() {
  if (!fbDb) return;
  if (_countListener) { fbDb.ref('matchQueue').off('value', _countListener); _countListener = null; }
  _countListener = fbDb.ref('matchQueue').on('value', snap => {
    const el = document.getElementById('queueCountEl');
    if (!el) return;
    if (!snap.exists()) { el.textContent = "You're first — waiting for others..."; return; }

    // Count only users we could actually match with — exclude self + blocked
    let matchable = 0;
    snap.forEach(child => {
      const v = child.val();
      if (!v) return;
      if (v.phone === state.guftguPhone) return;                          // self
      if (typeof _isBlocked === 'function' && _isBlocked(v.phone)) return; // blocked
      matchable++;
    });

    el.textContent = matchable > 0
      ? matchable + ' other' + (matchable > 1 ? 's' : '') + ' searching right now'
      : "You're first — waiting for others...";
  });
}

function cancelMatch() {
  stopSearchTips();
  _stopScan();
  _stopMatchResponseWatch();
  cleanupQueue();
  _clearCountdown();
  currentMatchId   = null;
  _waitingForOther = false;
  if (state._demoTimers) { state._demoTimers.forEach(clearTimeout); state._demoTimers = []; }
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
    if (_countListener) { fbDb.ref('matchQueue').off('value', _countListener); _countListener = null; }
    if (_proposalRef && _proposalListener) {
      _proposalRef.off('child_added', _proposalListener);
      _proposalRef = null; _proposalListener = null;
    }
    if (phone) {
      if (_myQueueListener) {
        fbDb.ref('matchQueue/' + phone).off('value', _myQueueListener);
        _myQueueListener = null;
      }
      fbDb.ref('matchQueue/'     + phone).off();
      fbDb.ref('matchProposals/' + phone).remove();
    }
  }
}

// ── Demo ─────────────────────────────────────────────────────────
function _simulateMatch() {
  const myLang = state.user.language || 'Hindi';
  const myMood = state.user.mood     || 'Happy';
  const demos  = [
    { avatar:'cat',  name:'QuietTiger42', mood:myMood,  moodEmoji:'😄', language:myLang, region:'North', delay:1500 },
    { avatar:'fox',  name:'WildRiver88',  mood:myMood,  moodEmoji:'😄', language:myLang, region:'South', delay:4000 },
    { avatar:'wolf', name:'BoldSpark19',  mood:'Chill', moodEmoji:'😎', language:myLang, region:'East',  delay:10000 },
  ];
  let matched = false;
  state._demoTimers = demos.map(pal => setTimeout(() => {
    if (matched) return;
    matched        = true;
    currentMatchId = 'demo_match';
    _myMatchRole   = 'caller';
    state.currentPal = { avatar:pal.avatar, name:pal.name, mood:pal.mood, moodEmoji:pal.moodEmoji, phone:null };
    if (autoConnect) { _startCoordinatedCall('demo_match', 'caller'); }
    else             { _showMatchFound(pal, 'demo_match', 'caller');  }
  }, pal.delay));
}

// ── Switch to chat — friends only (Req 4) ────────────────────────
function switchToChat() {
  const pal = state.currentPal;
  if (!pal) return;
  const friends  = typeof _getFriends === 'function' ? _getFriends() : [];
  const isFriend = pal.phone && friends.some(f => f.phone === pal.phone);
  if (!isFriend) {
    showToast('Add ' + (pal.name || 'them') + ' as a friend first to chat 💬');
    return;
  }
  openChat(pal.avatar, pal.name, '', pal.mood);
}