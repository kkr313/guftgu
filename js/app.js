// js/app.js - Initialization

// ═══════════════════════════════════════
// INIT
// ═══════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  // ── Pre-select default avatar ──────────────────
  state.user.avatar = 'cat';
  const avatarBtn = document.getElementById('avatarContinueBtn');
  if (avatarBtn) { avatarBtn.disabled = false; avatarBtn.textContent = 'Continue →'; }

  // ── Restore existing account from localStorage ─────────────
  if (loadUser()) {
    updateHomeUI();
    showScreen('screen-home');
    showToast('Welcome back, ' + state.user.nickname + '! 👋');
  } else {
    // First time — Happy pre-selected in HTML, set state to match
    state.user.mood = 'Happy';
    state.user.moodEmoji = '😄';
    const pcd = document.getElementById('palcodeDisplay'); if (pcd) pcd.textContent = '—';
  }

  // ── Auto-connect Firebase ──────────────────────────────────
  try {
    if (typeof firebase === 'undefined' || typeof firebase.initializeApp !== 'function') {
      throw new Error('Firebase SDK not loaded');
    }
    if (firebase.apps && firebase.apps.length > 0) firebase.app().delete();
    fbApp = firebase.initializeApp(FIREBASE_CONFIG);
    fbDb = firebase.database();
    await fbDb.ref('.info/connected').once('value');
    const fbBadge = document.getElementById('fbStatusBadge');
    if (fbBadge) fbBadge.style.display = 'block';
    const hfb = document.getElementById('homeFirebaseBadge');
    if (hfb) hfb.style.display = 'block';
    const fsd = document.getElementById('fbSettingDesc');
    if (fsd) fsd.textContent = '✅ Connected — real calls active';
    const fsb = document.getElementById('fbSettingBadge');
    if (fsb) fsb.innerHTML = '<span style="color:var(--accent2);font-size:11px;font-weight:700;">ON</span>';
    renderOnlineNow();
    updateOnlineCount();
    // Start listening for incoming calls
    listenForIncomingCalls();
    console.log('🔥 Guftgu Firebase connected!');
  } catch(e) {
    const fsd = document.getElementById('fbSettingDesc');
    if (fsd) fsd.textContent = 'Not connected — demo mode active';
    console.log('⚠️ Firebase error:', e.message);
  }
});
