// js/home.js — Home screen logic
// NOTE: autoConnect is the single global declared here.
// matching.js reads it — do NOT re-declare it there.
let autoConnect = false;

function updateHomeUI() {
  const u = state.user;

  // ── Greeting ──
  const hr    = new Date().getHours();
  const greet = hr < 5 ? 'Night owl 🦉' : hr < 12 ? 'Good morning 🌅' : hr < 17 ? 'Good afternoon ☀️' : 'Good evening 🌙';
  const greetEl = document.getElementById('homeGreeting');
  if (greetEl) greetEl.textContent = greet;

  // ── Name ──
  const userEl = document.getElementById('homeUsername');
  if (userEl) userEl.textContent = 'Hey, ' + (u.nickname || 'Pal');

  // ── Avatar (top-right shortcut) ──
  setAvatarEl('homeAvatarBtn', u.avatar || 'cat');

  // ── Mood pref card ──
  // FIX: homeMoodEmoji is the icon container inside the pref card (an emoji span),
  // not the avatar circle — set textContent directly.
  const moodEmoji = document.getElementById('homeMoodEmoji');
  if (moodEmoji) moodEmoji.textContent = u.moodEmoji || '😊';
  const moodName = document.getElementById('homeMoodName');
  if (moodName) moodName.textContent = u.mood || 'Happy';

  // ── Language pref card ──
  const langName = document.getElementById('homeLangName');
  if (langName) langName.textContent = u.language || 'Hindi';

  // ── Find-btn sub-label ──
  const sub = document.getElementById('findBtnSub');
  if (sub) {
    sub.textContent = (u.language || 'Hindi') + ' · ' + (u.mood || 'Any mood') + ' · ' + (u.intent || 'Just chat');
  }

  // ── Auto-connect toggle visual ──
  const toggle = document.getElementById('autoConnectToggle');
  if (toggle) toggle.classList.toggle('on', autoConnect);

  // ── Profile screen ──
  setAvatarEl('profileAvatar', u.avatar || 'cat');
  const pn  = document.getElementById('profileName');   if (pn)  pn.textContent  = u.nickname   || '—';
  const pme = document.getElementById('profileMoodEmoji'); if (pme) pme.textContent = u.moodEmoji  || '😊';
  const pmn = document.getElementById('profileMoodName');  if (pmn) pmn.textContent = u.mood       || '—';
  const smd = document.getElementById('settingMoodDesc');  if (smd) smd.textContent = (u.mood || '—') + ' ' + (u.moodEmoji || '');
  const ld  = document.getElementById('settingLangDesc');  if (ld)  ld.textContent  = u.language   || 'Hindi';
  const rd  = document.getElementById('settingRegionDesc');if (rd)  rd.textContent  = u.region     || 'North';

  // ── Guftgu phone ──
  const phone = state.guftguPhone || '—';
  const pd    = document.getElementById('palcodeDisplay'); if (pd) pd.textContent = phone;
  const hp    = document.getElementById('homeMyPhone');    if (hp) hp.textContent = phone;

  // ── Match screen refs ──
  const sme = document.getElementById('searchMoodEmoji'); if (sme) sme.textContent = u.moodEmoji || '😄';
  setAvatarEl('myAvatarMF', u.avatar || 'cat');

  // ── Live sections ──
  updateOnlineCount();
  renderRecentCalls();
  renderOnlineNow();
}

function dismissWelcome() {
  const wb = document.getElementById('welcomeBanner');
  if (wb) wb.style.display = 'none';
  localStorage.setItem('guftgu_welcomed', '1');
}

// ── Online count (single authoritative definition) ────────────────
function updateOnlineCount() {
  const el = document.getElementById('onlineCount');
  if (!el) return;

  if (fbDb) {
    fbDb.ref('matchQueue').on('value', snap => {
      if (!snap.exists()) { el.textContent = Math.floor(800 + Math.random() * 400).toLocaleString('en-IN') + ' online'; return; }
      // Count only users we can actually match with (exclude self + blocked)
      let matchable = 0;
      snap.forEach(child => {
        const v = child.val();
        if (!v) return;
        if (v.phone === state.guftguPhone) return;       // self
        if (typeof _isBlocked === 'function' && _isBlocked(v.phone)) return; // blocked
        matchable++;
      });
      el.textContent = (matchable + Math.floor(800 + Math.random() * 400)).toLocaleString('en-IN') + ' online';
    });
  } else {
    const base = 1800 + Math.floor(Math.random() * 1200);
    el.textContent = base.toLocaleString('en-IN') + ' online';
    setInterval(() => {
      const drift = base + Math.floor((Math.random() - 0.5) * 300);
      el.textContent = Math.max(800, drift).toLocaleString('en-IN') + ' online';
    }, 12000);
  }
}

// ── Call history storage ──────────────────────────────────────────
const CALL_HISTORY_KEY = 'guftgu_call_history';

function _getCallHistory() {
  try { return JSON.parse(localStorage.getItem(CALL_HISTORY_KEY) || '[]'); } catch (_) { return []; }
}

// ── Avatar helper: resolve key → inline SVG or emoji fallback ─────
// Used by call-history rendering so "cat" → <svg>…</svg> not literal "cat"
function _avatarHTML(avatar, size) {
  size = size || 28;
  if (!avatar) return '<span style="font-size:' + (size * 0.7) + 'px">👤</span>';
  if (avatar.startsWith('<svg')) return avatar;           // already an SVG string
  const svg = (typeof AVATAR_SVGS !== 'undefined') && AVATAR_SVGS[avatar];
  if (svg) return svg;
  // Emoji / unknown key
  return '<span style="font-size:' + (size * 0.7) + 'px">' + avatar + '</span>';
}

// ── Call type → CSS class ─────────────────────────────────────────
// Handles both lowercase ('missed') and capitalised ('Missed') values,
// plus the new 'Blocked' type added in this session.
function _callTypeClass(type) {
  if (!type) return 'outgoing';
  const t = type.toLowerCase();
  if (t === 'missed')   return 'missed';
  if (t === 'incoming') return 'incoming';
  if (t === 'blocked')  return 'blocked';
  return 'outgoing'; // Outgoing / outgoing / default
}

// ── Recent Calls (home screen — last 5) ───────────────────────────
function renderRecentCalls() {
  const container = document.getElementById('recentCalls');
  if (!container) return;
  const calls = _getCallHistory();

  if (calls.length === 0) {
    container.innerHTML =
      '<div class="home-empty">' +
        '<div class="home-empty-icon">📋</div>' +
        '<div class="home-empty-text">No calls yet.<br>Start a Guftgu or call a friend!</div>' +
      '</div>';
    return;
  }

  container.innerHTML = calls.slice(0, 5).map(c => {
    const typeClass = _callTypeClass(c.type);
    const avHtml    = _avatarHTML(c.avatar, 28);
    // No onclick on the row itself — call history is read-only display
    return '<div class="history-item">' +
        '<div class="hist-avatar" style="display:flex;align-items:center;justify-content:center;overflow:hidden;">' + avHtml + '</div>' +
        '<div class="hist-info">' +
          '<div class="hist-name">' + _esc(c.name) + '</div>' +
          '<div class="hist-detail">' + (c.duration || 'Missed') + '</div>' +
        '</div>' +
        '<div class="hist-meta">' +
          '<span class="hist-time">' + (c.time || '') + '</span>' +
          '<span class="hist-type ' + typeClass + '">' + (c.type || 'Outgoing') + '</span>' +
        '</div>' +
      '</div>';
  }).join('');
}

// ── Full call history (history screen — last 15) ──────────────────
function renderCallHistory() {
  const container = document.getElementById('historyList');
  if (!container) return;
  const calls = _getCallHistory();

  if (calls.length === 0) {
    container.style.justifyContent = 'center';
    container.innerHTML =
      '<div class="home-empty">' +
        '<div class="home-empty-icon">📋</div>' +
        '<div class="home-empty-text">No call history yet.<br>Your calls will appear here.</div>' +
      '</div>';
    return;
  }

  container.style.justifyContent = 'flex-start';
  container.innerHTML = calls.slice(0, 15).map(c => {
    const typeClass = _callTypeClass(c.type);
    const avHtml    = _avatarHTML(c.avatar, 36);
    // No openChat() — history shows call details only (Req 4: chat requires friendship)
    return '<div class="history-item">' +
        '<div class="hist-avatar" style="display:flex;align-items:center;justify-content:center;overflow:hidden;">' + avHtml + '</div>' +
        '<div class="hist-info">' +
          '<div class="hist-name">' + _esc(c.name) + '</div>' +
          '<div class="hist-detail">' + (c.duration || 'Missed') + '</div>' +
        '</div>' +
        '<div class="hist-meta">' +
          '<span class="hist-time">' + (c.time || '') + '</span>' +
          '<span class="hist-type ' + typeClass + '">' + (c.type || 'Outgoing') + '</span>' +
        '</div>' +
      '</div>';
  }).join('');
}

// Safe HTML escape for inline onclick strings
function _esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Save call to history ──────────────────────────────────────────
function saveCallToHistory(avatar, name, mood, duration, type) {
  let calls = _getCallHistory();
  calls.unshift({
    avatar:    avatar   || '🦊',
    name:      name     || 'Unknown',
    mood:      mood     || '',
    duration:  duration || '0:00',
    type:      type     || 'outgoing',
    time:      'just now',
    timestamp: Date.now()
  });
  calls = calls.slice(0, 50);
  try { localStorage.setItem(CALL_HISTORY_KEY, JSON.stringify(calls)); } catch (_) {}
}

// Back-compat aliases
function renderRecentChats() { renderRecentCalls(); }
function saveRecentChat(avatar, name, preview, mood) {
  saveCallToHistory(avatar, name, mood, 'Chat', 'outgoing');
}

// ── Online Now (single authoritative definition) ──────────────────
let _onlineNowListener = null;

function renderOnlineNow() {
  const list = document.getElementById('onlineNowList');
  if (!list) return;

  if (fbDb) {
    if (_onlineNowListener) fbDb.ref('matchQueue').off('value', _onlineNowListener);
    _onlineNowListener = fbDb.ref('matchQueue').on('value', snap => {
      const users = [];
      snap.forEach(child => {
        const v = child.val();
        if (!v) return;
        if (v.phone === state.guftguPhone) return;                                    // self (by phone, not nickname)
        if (typeof _isBlocked === 'function' && _isBlocked(v.phone)) return;          // blocked
        users.push(v);
      });
      _drawOnlineNow(list, users);
    });
  } else {
    _drawOnlineNow(list, []);
  }
}

function _drawOnlineNow(list, users) {
  if (users.length === 0) {
    list.innerHTML = `
      <div class="home-empty" style="width:100%;">
        <div class="home-empty-icon">👥</div>
        <div class="home-empty-text">Nobody in the queue right now.<br>Be the first — start a Guftgu!</div>
      </div>`;
    return;
  }

  const moodClass = {
    Happy:   'mood-happy',
    Chill:   'mood-chill',
    Lonely:  'mood-lonely',
    Excited: 'mood-excited',
    Curious: 'mood-curious',
    Sad:     'mood-sad'
  };

  list.innerHTML = users.slice(0, 8).map(u => `
    <div class="pal-bubble" onclick="startMatchingWith('${_esc(u.name)}')">
      <div class="pal-ring ${moodClass[u.mood] || ''}">
        ${_avatarHTML(u.avatar, 32)}
        <div class="pal-live">●</div>
      </div>
      <div class="pal-name">${_esc(u.name)}</div>
    </div>`).join('');
}

function refreshOnlineNow() {
  renderOnlineNow();
  showToast('Refreshed 👀');
}

function startMatchingWith(name) {
  showToast('Finding ' + name + '…');
  startMatching();
}

// ── Auto-connect toggle ───────────────────────────────────────────
function toggleAutoConnect() {
  autoConnect = !autoConnect;
  const toggle = document.getElementById('autoConnectToggle');
  if (toggle) toggle.classList.toggle('on', autoConnect);
  showToast(autoConnect ? '⚡ Auto Connect on' : 'Auto Connect off');
}

// ── Mood filter stub (kept for back-compat) ───────────────────────
function filterMood(el, mood) {
  document.querySelectorAll('.mood-filter').forEach(f => f.classList.remove('active'));
  if (el) el.classList.add('active');
}