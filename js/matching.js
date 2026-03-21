// js/matching.js - Match engine (Firebase queue + demo mode)

// ═══════════════════════════════════════
// MATCHING ENGINE — Firebase Queue
// ═══════════════════════════════════════
let matchSearchTimeout, countdownInterval;
let matchQueueRef = null;      // our entry in the queue
let matchListener = null;      // listener watching for a match
let queueCountListener = null; // listener for queue size
let autoConnect = false;
let currentMatchId = null;

// ── Auto-connect toggle (defined in home.js) ────────────────

// ── Start searching for a match ──────────────────────────────
let _tipInterval = null;
function startMatching() {
  showScreen('screen-match');
  const _mfo = document.getElementById('matchFoundOverlay'); if (_mfo) _mfo.classList.remove('show');
  const _rmo = document.getElementById('rematchOptions'); if (_rmo) _rmo.classList.remove('show');
  const _sme = document.getElementById('searchMoodEmoji'); if (_sme) _sme.textContent = state.user.moodEmoji || '😄';
  const _mfl = document.getElementById('matchFilterLabel');
  if (_mfl) _mfl.textContent = (state.user.language || 'Hindi') + ' · ' + (state.user.mood || 'Happy') + ' · ' + (state.user.region || 'All India');

  // Rotate search tips
  startSearchTips();

  if (fbDb) {
    enterMatchQueue();
  } else {
    // No Firebase — show informative message and simulate
    _txt('matchSearchTitle', 'Searching nearby...');
    simulateMatch();
  }
}

function startSearchTips() {
  if (_tipInterval) clearInterval(_tipInterval);
  const tips = document.querySelectorAll('.search-tip');
  if (!tips.length) return;
  let idx = 0;
  // Show first tip immediately
  tips[0].classList.add('active');
  _tipInterval = setInterval(() => {
    tips[idx].classList.remove('active');
    idx = (idx + 1) % tips.length;
    // Small delay before showing next tip for clean fade-out → fade-in
    setTimeout(() => tips[idx].classList.add('active'), 400);
  }, 5000);
}

function stopSearchTips() {
  if (_tipInterval) { clearInterval(_tipInterval); _tipInterval = null; }
}

// ── Write ourselves into the Firebase match queue ────────────
function enterMatchQueue() {
  const u = state.user;
  const myPhone = state.guftguPhone || ('guest_' + Date.now());
  matchQueueRef = fbDb.ref('matchQueue/' + myPhone);

  const myEntry = {
    avatar: u.avatar,
    name: u.nickname,
    mood: u.mood,
    moodEmoji: u.moodEmoji,
    language: u.language || 'Hindi',
    region: u.region || 'North',
    intent: u.intent || 'Just chat',
    phone: myPhone,
    timestamp: Date.now(),
    status: 'searching',   // searching | matched | accepted | declined
  };

  matchQueueRef.set(myEntry).then(() => {
    // Clean up our entry when we disconnect
    matchQueueRef.onDisconnect().remove();
    // Now scan for a match
    scanForMatch(myPhone, myEntry);
    // Listen to queue count
    watchQueueCount();
  });
}

// ── Scan the queue for a compatible match ────────────────────
function scanForMatch(myPhone, myEntry) {
  const queueRef = fbDb.ref('matchQueue');

  matchListener = queueRef.on('value', (snap) => {
    if (!snap.exists()) return;
    const queue = snap.val();

    // Find someone else who is still searching with matching language/mood
    for (const [phone, entry] of Object.entries(queue)) {
      if (phone === myPhone) continue;                          // skip ourselves
      if (entry.status !== 'searching') continue;               // skip busy users
      if (entry.language !== myEntry.language) continue;        // must match language

      // Mood match — prefer same mood, relax after 15s
      const elapsed = Date.now() - myEntry.timestamp;
      const strictMood = elapsed < 15000;
      if (strictMood && entry.mood !== myEntry.mood) continue;

      // Region match optional — prefer same, fall back to any after 10s
      const strictRegion = elapsed < 10000;
      if (strictRegion && entry.region !== myEntry.region) continue;

      // Found a match — only the user with the LOWER phone number creates the match
      // to avoid both users creating duplicate match rooms
      const iAmInitiator = myPhone < phone;
      if (!iAmInitiator) continue;  // wait for the other side to create it

      // Create match room
      const matchId = 'match_' + myPhone + '_' + phone;
      currentMatchId = matchId;
      const matchRef = fbDb.ref('matches/' + matchId);

      matchRef.set({
        user1: { ...myEntry, phone: myPhone },
        user2: { ...entry, phone },
        status: 'pending',
        createdAt: Date.now(),
      }).then(() => {
        // Mark both queue entries as matched
        fbDb.ref('matchQueue/' + myPhone + '/status').set('matched');
        fbDb.ref('matchQueue/' + phone + '/status').set('matched');
        fbDb.ref('matchQueue/' + myPhone + '/matchId').set(matchId);
        fbDb.ref('matchQueue/' + phone + '/matchId').set(matchId);
      });
      break;
    }
  });

  // Also listen to our OWN queue entry for a matchId (set by the other side)
  fbDb.ref('matchQueue/' + myPhone).on('value', (snap) => {
    if (!snap.exists()) return;
    const data = snap.val();
    if (data.matchId && data.status === 'matched') {
      // Stop scanning
      queueRef.off('value', matchListener);
      currentMatchId = data.matchId;
      // Load match details and show the overlay
      fbDb.ref('matches/' + data.matchId).once('value').then((mSnap) => {
        if (!mSnap.exists()) return;
        const match = mSnap.val();
        const myPhone2 = state.guftguPhone || '';
        const pal = match.user1.phone === myPhone2 ? match.user2 : match.user1;
        state.currentPal = { avatar: pal.avatar, name: pal.name, mood: pal.mood, moodEmoji: pal.moodEmoji };

        if (autoConnect) {
          // Auto-accept — go straight to call
          cleanupQueue();
          startVoiceCall(state.currentPal);
        } else {
          showMatchFound(pal);
        }
      });
    }
  });
}

// ── Watch queue size and display it ──────────────────────────
function watchQueueCount() {
  queueCountListener = fbDb.ref('matchQueue').on('value', (snap) => {
    const count = snap.exists() ? Object.keys(snap.val()).length : 0;
    const el = document.getElementById('queueCountEl');
    if (el) el.textContent = count > 1
      ? (count - 1) + ' other' + (count > 2 ? 's' : '') + ' searching right now'
      : 'You\'re first in queue — waiting for others...';
  });
}

// ── Show the match found overlay ─────────────────────────────
function showMatchFound(pal) {
  setAvatarEl('palAvatarMF', pal.avatar);
  _txt('palNameMF', pal.name);
  _txt('palMoodMF', 'Feeling: ' + pal.mood + ' ' + pal.moodEmoji);

  // Region + language badges
  const badges = [];
  if (pal.region) badges.push('📍 ' + pal.region + ' India');
  if (pal.language) badges.push('🗣️ ' + pal.language);
  const pbmf = document.getElementById('palBadgesMF'); if (pbmf) pbmf.innerHTML =
    badges.map(b => `<div class="mf-badge">${b}</div>`).join('');

  const mfo = document.getElementById('matchFoundOverlay'); if (mfo) mfo.classList.add('show');

  let secs = 15;
  const cdEl = document.getElementById('countdownEl'); if (cdEl) cdEl.textContent = secs;
  clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    secs--;
    if (cdEl) cdEl.textContent = secs;
    if (secs <= 0) {
      clearInterval(countdownInterval);
      // Time expired — mark as declined and show rematch options
      markMatchResponse('declined');
      showRematchOptions();
    }
  }, 1000);
}

// ── Accept match ─────────────────────────────────────────────
function acceptMatch() {
  clearInterval(countdownInterval);
  markMatchResponse('accepted');
  cleanupQueue();
  startVoiceCall(state.currentPal);
}

// ── Decline / skip match ─────────────────────────────────────
function declineMatch() {
  clearInterval(countdownInterval);
  markMatchResponse('declined');
  cleanupQueue();
  showRematchOptions();
}

function showRematchOptions() {
  _cls('matchFoundOverlay', 'remove', 'show');
  _cls('rematchOptions', 'add', 'show');
}

function restartMatching() {
  _cls('rematchOptions', 'remove', 'show');
  startMatching();
}

// ── Mark our response in Firebase ────────────────────────────
function markMatchResponse(response) {
  if (!fbDb || !currentMatchId) return;
  const myPhone = state.guftguPhone;
  fbDb.ref('matches/' + currentMatchId).once('value').then((snap) => {
    if (!snap.exists()) return;
    const match = snap.val();
    const field = match.user1.phone === myPhone ? 'user1Response' : 'user2Response';
    fbDb.ref('matches/' + currentMatchId + '/' + field).set(response);
  });
}

// ── Cleanup queue entry ──────────────────────────────────────
function cleanupQueue() {
  if (matchQueueRef) {
    matchQueueRef.onDisconnect().cancel();
    matchQueueRef.remove();
    matchQueueRef = null;
  }
  if (fbDb) {
    fbDb.ref('matchQueue').off('value', matchListener);
    fbDb.ref('matchQueue').off('value', queueCountListener);
  }
  if (state.guftguPhone) {
    fbDb && fbDb.ref('matchQueue/' + state.guftguPhone).off();
  }
}

// ── Cancel and go home ───────────────────────────────────────
function cancelMatch() {
  clearTimeout(matchSearchTimeout);
  clearInterval(countdownInterval);
  stopSearchTips();
  cleanupQueue();
  currentMatchId = null;
  showScreen('screen-home', true);
}

// ── Demo mode (no Firebase) ──────────────────────────────────
function simulateMatch() {
  const delay = 3000 + Math.random() * 2000;
  matchSearchTimeout = setTimeout(() => {
    const demoUsers = [
      { avatar:'🦊', name:'NightFox72', mood:'Happy', moodEmoji:'😄', region:'North', language:'Hindi' },
      { avatar:'👨‍💻', name:'QuietStorm44', mood:'Chill', moodEmoji:'😎', region:'West', language:'English' },
      { avatar:'🐼', name:'BoldRiver19', mood:'Lonely', moodEmoji:'🥺', region:'East', language:'Hindi' },
    ];
    const pal = demoUsers[Math.floor(Math.random() * demoUsers.length)];
    state.currentPal = { avatar: pal.avatar, name: pal.name, mood: pal.mood, moodEmoji: pal.moodEmoji };
    if (autoConnect) {
      startVoiceCall(state.currentPal);
    } else {
      showMatchFound(pal);
    }
  }, delay);
}

function switchToChat() {
  const pal = state.currentPal;
  if (pal) openChat(pal.avatar, pal.name, '', pal.mood);
}