// js/app.js - App initialization

document.addEventListener('DOMContentLoaded', async () => {

  // Pre-select default avatar
  state.user.avatar = 'cat';
  const avatarBtn = document.getElementById('avatarContinueBtn');
  if (avatarBtn) { avatarBtn.disabled = false; avatarBtn.textContent = 'Continue →'; }

  // Restore existing account from localStorage
  if (loadUser()) {
    updateHomeUI();
    showScreen('screen-home');
    showToast('Welcome back, ' + state.user.nickname + '! 👋');
    // Start listening for incoming calls if Firebase already connected
    if (fbDb) listenForIncomingCalls();
  } else {
    // First visit — set defaults
    state.user.mood      = 'Happy';
    state.user.moodEmoji = '😄';
    const pcd = document.getElementById('palcodeDisplay');
    if (pcd) pcd.textContent = '—';
  }

  // Auto-connect Firebase
  await _initFirebase();
});

async function _initFirebase() {
  try {
    if (typeof firebase === 'undefined' || typeof firebase.initializeApp !== 'function') {
      throw new Error('Firebase SDK not loaded');
    }

    // Clean up any existing app
    if (firebase.apps && firebase.apps.length > 0) {
      try { await firebase.app().delete(); } catch(e) {}
    }

    fbApp = firebase.initializeApp(FIREBASE_CONFIG);
    fbDb  = firebase.database();

    // Test the connection
    await fbDb.ref('.info/connected').once('value');

    // ── Connected ──────────────────────────────────────────────
    console.log('🔥 Firebase connected');

    // Update UI badges
    const fbBadge = document.getElementById('fbStatusBadge');
    if (fbBadge) fbBadge.style.display = 'block';
    const hfb = document.getElementById('homeFirebaseBadge');
    if (hfb) hfb.style.display = 'block';
    const fsd = document.getElementById('fbSettingDesc');
    if (fsd) fsd.textContent = '✅ Connected — real calls active';
    const fsb = document.getElementById('fbSettingBadge');
    if (fsb) fsb.innerHTML = '<span style="color:var(--accent2);font-size:11px;font-weight:700;">ON</span>';

    // Clean up stale queue entries (older than 2 minutes)
    _cleanStaleQueue();

    // Start Firebase-driven UI
    _updateOnlineCount();
    _renderOnlineNow();

    // Start incoming call listener
    listenForIncomingCalls();

  } catch(e) {
    console.warn('⚠️ Firebase error:', e.message);
    const fsd = document.getElementById('fbSettingDesc');
    if (fsd) fsd.textContent = 'Not connected — demo mode active';
    // Fall back to simulated online count
    _simulateOnlineCount();
  }
}

// ── Clean stale Firebase queue entries ──────────────────────────
function _cleanStaleQueue() {
  if (!fbDb) return;
  fbDb.ref('matchQueue').once('value', snap => {
    if (!snap.exists()) return;
    const now = Date.now();
    snap.forEach(child => {
      const e = child.val();
      // Remove entries older than 2 minutes or from our own old sessions
      if (e && e.ts && (now - e.ts) > 120000) {
        child.ref.remove();
      }
    });
  });
  // Clean our own stale proposals
  if (state.guftguPhone) {
    fbDb.ref('matchProposals/' + state.guftguPhone).remove().catch(() => {});
  }
}

// ── Online count ─────────────────────────────────────────────────
function _updateOnlineCount() {
  const el = document.getElementById('onlineCount');
  if (!el || !fbDb) return;
  fbDb.ref('matchQueue').on('value', snap => {
    const n = snap.exists() ? Object.keys(snap.val()).length : 0;
    el.textContent = (n + Math.floor(1200 + Math.random() * 600)).toLocaleString('en-IN') + ' online';
  });
}

function _simulateOnlineCount() {
  const el = document.getElementById('onlineCount');
  if (!el) return;
  const base = 1800 + Math.floor(Math.random() * 1200);
  el.textContent = base.toLocaleString('en-IN') + ' online';
  setInterval(() => {
    const drift = base + Math.floor((Math.random() - 0.5) * 300);
    el.textContent = Math.max(800, drift).toLocaleString('en-IN') + ' online';
  }, 12000);
}

// ── Online now panel ─────────────────────────────────────────────
function _renderOnlineNow() {
  const list = document.getElementById('onlineNowList');
  if (!list || !fbDb) return;
  fbDb.ref('matchQueue').on('value', snap => {
    const users = [];
    snap.forEach(child => {
      const v = child.val();
      if (v && v.name !== state.user.nickname) users.push(v);
    });
    if (users.length === 0) {
      list.innerHTML = `<div class="home-empty" style="width:100%;">
        <div class="home-empty-icon">👥</div>
        <div class="home-empty-text">Nobody searching right now.<br>Be the first — start a Guftgu!</div>
      </div>`;
      return;
    }
    const moodClass = {
      Happy:'mood-happy', Chill:'mood-chill', Lonely:'mood-lonely',
      Excited:'mood-excited', Curious:'mood-curious', Sad:'mood-sad'
    };
    list.innerHTML = users.slice(0, 8).map(u => `
      <div class="pal-bubble" onclick="startMatchingWith('${u.name}')">
        <div class="pal-ring ${moodClass[u.mood] || ''}">
          ${u.avatar || '🦊'}
          <div class="pal-live">●</div>
        </div>
        <div class="pal-name">${u.name}</div>
      </div>`).join('');
  });
}

// These are called from home.js and other places
function renderOnlineNow()   { _renderOnlineNow(); }
function updateOnlineCount() { _updateOnlineCount(); }
function renderRecentCalls() {
  const container = document.getElementById('recentCalls');
  if (!container) return;
  const calls = _getCallHistory();
  if (calls.length === 0) {
    container.innerHTML = `<div class="home-empty">
      <div class="home-empty-icon">📋</div>
      <div class="home-empty-text">No calls yet.<br>Start a Guftgu or call a friend!</div>
    </div>`;
    return;
  }
  container.innerHTML = calls.slice(0, 5).map(c => {
    const typeClass = c.type === 'missed' ? 'missed' : c.type === 'incoming' ? 'incoming' : 'outgoing';
    return `<div class="history-item" onclick="openChat('${c.avatar}','${c.name}','','${c.mood||''}')">
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