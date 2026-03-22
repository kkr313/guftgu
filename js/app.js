// js/app.js — App initialization
// NOTE: renderRecentCalls / updateOnlineCount / renderOnlineNow
// are defined ONLY in home.js — do NOT duplicate them here.

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
  } else {
    state.user.mood      = 'Happy';
    state.user.moodEmoji = '😄';
    const pcd = document.getElementById('palcodeDisplay');
    if (pcd) pcd.textContent = '—';
  }

  // Auto-connect Firebase (always attempt — even if user not yet set up)
  await _initFirebase();
});

async function _initFirebase() {
  try {
    if (typeof firebase === 'undefined' || typeof firebase.initializeApp !== 'function') {
      throw new Error('Firebase SDK not loaded');
    }

    // Tear down any leftover app instance
    if (firebase.apps && firebase.apps.length > 0) {
      try { await firebase.app().delete(); } catch (_) {}
    }

    fbApp = firebase.initializeApp(FIREBASE_CONFIG);
    fbDb  = firebase.database();

    // Verify real connectivity (throws on network error)
    await fbDb.ref('.info/connected').once('value');

    console.log('🔥 Firebase connected');

    // Update status badges
    const fbBadge = document.getElementById('fbStatusBadge');
    if (fbBadge) fbBadge.style.display = 'block';
    const hfb = document.getElementById('homeFirebaseBadge');
    if (hfb) hfb.style.display = 'block';
    const fsd = document.getElementById('fbSettingDesc');
    if (fsd) fsd.textContent = '✅ Connected — real calls active';
    const fsb = document.getElementById('fbSettingBadge');
    if (fsb) fsb.innerHTML = '<span style="color:var(--accent2);font-size:11px;font-weight:700;">ON</span>';

    // Housekeeping
    _cleanStaleQueue();

    // Start listening for direct calls to our number
    if (state.guftguPhone) listenForIncomingCalls();

    // Refresh home UI so online-count + online-now use live Firebase data
    if (state.screen === 'screen-home' && typeof updateHomeUI === 'function') {
      updateHomeUI();
    }

  } catch (e) {
    console.warn('⚠️ Firebase init failed:', e.message);
    const fsd = document.getElementById('fbSettingDesc');
    if (fsd) fsd.textContent = 'Not connected — demo mode active';
  }
}

// ── Remove queue entries older than 2 min (browser-close stragglers) ─────
function _cleanStaleQueue() {
  if (!fbDb) return;
  fbDb.ref('matchQueue').once('value', snap => {
    if (!snap.exists()) return;
    const cutoff = Date.now() - 120000;
    snap.forEach(child => {
      const e = child.val();
      if (e && e.ts && e.ts < cutoff) child.ref.remove();
    });
  });
  // Remove any stale proposal leftover from a previous session
  if (state.guftguPhone) {
    fbDb.ref('matchProposals/' + state.guftguPhone).remove().catch(() => {});
  }
}