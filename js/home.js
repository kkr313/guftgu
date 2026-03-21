// js/home.js - Home screen logic
function updateHomeUI() {
  const u = state.user;

  // ── greeting ──
  const hr = new Date().getHours();
  const greet = hr < 5 ? 'Night owl 🦉' : hr < 12 ? 'Good morning 🌅' : hr < 17 ? 'Good afternoon ☀️' : 'Good evening 🌙';
  const greetEl = document.getElementById('homeGreeting');
  if (greetEl) greetEl.textContent = greet;

  // ── name + avatar ──
  const userEl = document.getElementById('homeUsername');
  if (userEl) userEl.textContent = 'Hey, ' + (u.nickname || 'Pal');
  setAvatarEl('homeAvatarBtn', u.avatar || 'cat');

  // ── mood + language pref cards ──
  const moodEmoji = document.getElementById('homeMoodEmoji');
  if (moodEmoji) moodEmoji.textContent = u.moodEmoji || '�';
  const moodName = document.getElementById('homeMoodName');
  if (moodName) moodName.textContent = u.mood || 'Happy';
  const langName = document.getElementById('homeLangName');
  if (langName) langName.textContent = u.language || 'Hindi';

  // ── find btn sub-label ──
  const sub = document.getElementById('findBtnSub');
  if (sub) {
    const lang = u.language || 'Hindi';
    const intent = u.intent || 'Just chat';
    sub.textContent = lang + ' · ' + (u.mood || 'Any mood') + ' · ' + intent;
  }

  // ── profile screen ──
  setAvatarEl('profileAvatar', u.avatar || 'cat');
  const pn = document.getElementById('profileName'); if (pn) pn.textContent = u.nickname || '—';
  const pme = document.getElementById('profileMoodEmoji'); if (pme) pme.textContent = u.moodEmoji || '😊';
  const pmn = document.getElementById('profileMoodName'); if (pmn) pmn.textContent = u.mood || '—';
  const smd = document.getElementById('settingMoodDesc'); if (smd) smd.textContent = (u.mood || '—') + ' ' + (u.moodEmoji || '');
  const ld = document.getElementById('settingLangDesc'); if (ld) ld.textContent = u.language || 'Hindi';
  const rd = document.getElementById('settingRegionDesc'); if (rd) rd.textContent = u.region || 'North';

  // ── guftgu phone ──
  const phone = state.guftguPhone || '—';
  const pd = document.getElementById('palcodeDisplay'); if (pd) pd.textContent = phone;
  const hp = document.getElementById('homeMyPhone'); if (hp) hp.textContent = phone;

  // ── match screen refs ──
  const sme = document.getElementById('searchMoodEmoji'); if (sme) sme.textContent = u.moodEmoji || '😄';
  setAvatarEl('myAvatarMF', u.avatar || 'cat');

  // ── online count ──
  updateOnlineCount();

  // ── render live home sections ──
  renderRecentCalls();
  renderOnlineNow();
}

function dismissWelcome() {
  const wb = document.getElementById('welcomeBanner'); if (wb) wb.style.display = 'none';
  localStorage.setItem('guftgu_welcomed', '1');
}

function updateOnlineCount() {
  const el = document.getElementById('onlineCount');
  if (!el) return;
  if (fbDb) {
    // Watch live queue count
    fbDb.ref('matchQueue').on('value', snap => {
      const n = snap.numChildren ? snap.numChildren() : (snap.val() ? Object.keys(snap.val()).length : 0);
      el.textContent = (n + Math.floor(800 + Math.random()*400)).toLocaleString('en-IN') + ' online';
    });
  } else {
    // Simulate a slowly drifting count
    const base = 1800 + Math.floor(Math.random()*1200);
    el.textContent = base.toLocaleString('en-IN') + ' online';
    setInterval(() => {
      const drift = base + Math.floor((Math.random()-0.5)*300);
      el.textContent = Math.max(800,drift).toLocaleString('en-IN') + ' online';
    }, 12000);
  }
}

// ── Recent Calls — read from localStorage ────────────────────
const CALL_HISTORY_KEY = 'guftgu_call_history';

function _getCallHistory() {
  try { return JSON.parse(localStorage.getItem(CALL_HISTORY_KEY) || '[]'); } catch(e){ return []; }
}

function renderRecentCalls() {
  const container = document.getElementById('recentCalls');
  if (!container) return;
  const calls = _getCallHistory();

  if (calls.length === 0) {
    container.innerHTML = `
      <div class="home-empty">
        <div class="home-empty-icon">📋</div>
        <div class="home-empty-text">No calls yet.<br>Start a Guftgu or call a friend!</div>
      </div>`;
    return;
  }
  container.innerHTML = calls.slice(0, 5).map(c => {
    const typeClass = c.type === 'missed' ? 'missed' : c.type === 'incoming' ? 'incoming' : 'outgoing';
    return `
    <div class="history-item" onclick="openChat('${c.avatar}','${c.name}','','${c.mood || ''}')">
      <div class="hist-avatar">${c.avatar || '🦊'}</div>
      <div class="hist-info">
        <div class="hist-name">${c.name}</div>
        <div class="hist-detail">${c.duration || 'Missed'}</div>
      </div>
      <div class="hist-meta">
        <span class="hist-time">${c.time || ''}</span>
        <span class="hist-type ${typeClass}">${c.type || 'Outgoing'}</span>
      </div>
    </div>`;
  }).join('');
}

// Render full call history (last 15) on the history screen
function renderCallHistory() {
  const container = document.getElementById('historyList');
  if (!container) return;
  const calls = _getCallHistory();

  if (calls.length === 0) {
    container.style.justifyContent = 'center';
    container.innerHTML = `
      <div class="home-empty">
        <div class="home-empty-icon">📋</div>
        <div class="home-empty-text">No call history yet.<br>Your calls will appear here.</div>
      </div>`;
    return;
  }
  container.style.justifyContent = 'flex-start';
  container.innerHTML = calls.slice(0, 15).map(c => {
    const typeClass = c.type === 'missed' ? 'missed' : c.type === 'incoming' ? 'incoming' : 'outgoing';
    return `
    <div class="history-item" onclick="openChat('${c.avatar}','${c.name}','','${c.mood || ''}')">
      <div class="hist-avatar">${c.avatar || '🦊'}</div>
      <div class="hist-info">
        <div class="hist-name">${c.name}</div>
        <div class="hist-detail">${c.duration || 'Missed'}</div>
      </div>
      <div class="hist-meta">
        <span class="hist-time">${c.time || ''}</span>
        <span class="hist-type ${typeClass}">${c.type || 'Outgoing'}</span>
      </div>
    </div>`;
  }).join('');
}

// Save a call to history — called when a call ends
function saveCallToHistory(avatar, name, mood, duration, type) {
  let calls = _getCallHistory();
  calls.unshift({
    avatar: avatar || '🦊',
    name: name || 'Unknown',
    mood: mood || '',
    duration: duration || '0:00',
    type: type || 'outgoing',     // outgoing | incoming | missed
    time: 'just now',
    timestamp: Date.now()
  });
  // Keep max 50
  calls = calls.slice(0, 50);
  try { localStorage.setItem(CALL_HISTORY_KEY, JSON.stringify(calls)); } catch(e){}
}

// Keep old function name for backward compatibility
function renderRecentChats() { renderRecentCalls(); }
function saveRecentChat(avatar, name, preview, mood) {
  saveCallToHistory(avatar, name, mood, 'Chat', 'outgoing');
}

// ── Online Now — real Firebase queue OR empty state ──────────
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
        if (v && v.name !== state.user.nickname) users.push(v);
      });
      _drawOnlineNow(list, users);
    });
  } else {
    _drawOnlineNow(list, []);
  }
}

function _drawOnlineNow(list, users) {
  if (users.length === 0) {
    list.innerHTML = `<div class="home-empty" style="width:100%;"><div class="home-empty-icon">👥</div><div class="home-empty-text">Nobody in the queue right now.<br>Be the first — start a Guftgu!</div></div>`;
    return;
  }
  const moodClass = { Happy:'mood-happy', Chill:'mood-chill', Lonely:'mood-lonely', Excited:'mood-excited', Curious:'mood-curious', Sad:'mood-sad' };
  list.innerHTML = users.slice(0,8).map(u => `
    <div class="pal-bubble" onclick="startMatchingWith('${u.name}')">
      <div class="pal-ring ${moodClass[u.mood]||''}">
        ${u.avatar || '🦊'}
        <div class="pal-live">●</div>
      </div>
      <div class="pal-name">${u.name}</div>
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

// ── Auto connect toggle ──────────────────────────────────────
function toggleAutoConnect() {
  autoConnect = !autoConnect;
  const toggle = document.getElementById('autoConnectToggle');
  if (toggle) toggle.classList.toggle('on', autoConnect);
  showToast(autoConnect ? '⚡ Auto Connect on' : 'Auto Connect off');
}

// ── filterMood stub (kept for back-compat) ───────────────────
function filterMood(el, mood) {
  document.querySelectorAll('.mood-filter').forEach(f => f.classList.remove('active'));
  if (el) el.classList.add('active');
}
