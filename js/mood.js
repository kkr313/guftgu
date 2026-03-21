// js/mood.js - Mood modal & notifications
// ═══════════════════════════════════════
function showMoodModal() {
  // highlight the currently selected mood
  const current = state.user.mood || 'Happy';
  document.querySelectorAll('#modalMoodGrid .mood-card').forEach(c => {
    c.classList.toggle('selected', c.dataset.mood === current);
  });
  _cls('moodModal', 'add', 'show');
}

function closeMoodModal(e) {
  if (e.target.id === 'moodModal') _cls('moodModal', 'remove', 'show');
}

function changeMood(card) {
  document.querySelectorAll('#modalMoodGrid .mood-card').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');
  state.user.mood = card.dataset.mood;
  state.user.moodEmoji = card.dataset.emoji || moodEmojis[card.dataset.mood];
  saveUser();
  updateHomeUI();
  _cls('moodModal', 'remove', 'show');
  showToast('Mood updated to ' + state.user.mood + ' ' + state.user.moodEmoji);
}

// ═══════════════════════════════════════
// LANGUAGE MODAL
// ═══════════════════════════════════════
function showLangModal() {
  // highlight the currently selected language
  const current = state.user.language || 'Hindi';
  document.querySelectorAll('#modalLangGrid .lang-pill').forEach(p => {
    p.classList.toggle('selected', p.dataset.lang === current);
  });
  _cls('langModal', 'add', 'show');
}

function closeLangModal(e) {
  if (e.target.id === 'langModal') _cls('langModal', 'remove', 'show');
}

function changeLang(pill) {
  document.querySelectorAll('#modalLangGrid .lang-pill').forEach(p => p.classList.remove('selected'));
  pill.classList.add('selected');
  state.user.language = pill.dataset.lang;
  saveUser();
  updateHomeUI();
  _cls('langModal', 'remove', 'show');
  showToast('Language changed to ' + state.user.language);
}

function filterMood(el, mood) {
  document.querySelectorAll('.mood-filter').forEach(f => f.classList.remove('active'));
  el.classList.add('active');
}

// ═══════════════════════════════════════
// AVATAR PICKER MODAL
// ═══════════════════════════════════════
function showAvatarModal() {
  const grid = document.getElementById('avatarPickerGrid');
  if (!grid) return;
  grid.innerHTML = '';
  const current = state.user.avatar || 'cat';
  for (const key of Object.keys(AVATAR_SVGS)) {
    const item = document.createElement('div');
    item.className = 'avatar-picker-item' + (key === current ? ' selected' : '');
    item.innerHTML = AVATAR_SVGS[key];
    item.onclick = function() { pickAvatar(key); };
    grid.appendChild(item);
  }
  _cls('avatarModal', 'add', 'show');
}

function closeAvatarModal(e) {
  if (e.target.id === 'avatarModal') _cls('avatarModal', 'remove', 'show');
}

function pickAvatar(key) {
  state.user.avatar = key;
  saveUser();
  updateHomeUI();
  _cls('avatarModal', 'remove', 'show');
  showToast('Avatar updated! 🎨');
}

// ═══════════════════════════════════════
// REGION MODAL
// ═══════════════════════════════════════
function showRegionModal() {
  const current = state.user.region || 'North';
  document.querySelectorAll('#modalRegionGrid .region-pill').forEach(p => {
    p.classList.toggle('selected', p.dataset.region === current);
  });
  _cls('regionModal', 'add', 'show');
}

function closeRegionModal(e) {
  if (e.target.id === 'regionModal') _cls('regionModal', 'remove', 'show');
}

function changeRegion(pill) {
  document.querySelectorAll('#modalRegionGrid .region-pill').forEach(p => p.classList.remove('selected'));
  pill.classList.add('selected');
  state.user.region = pill.dataset.region;
  saveUser();
  updateHomeUI();
  _cls('regionModal', 'remove', 'show');
  showToast('Region changed to ' + state.user.region + ' 📍');
}

// ═══════════════════════════════════════
// DELETE ACCOUNT
// ═══════════════════════════════════════
function closeDeleteModal(e) {
  if (e.target.id === 'deleteAccountModal') _cls('deleteAccountModal', 'remove', 'show');
}

function confirmDeleteAccount() {
  const phone = state.guftguPhone;

  // 1) Mark deletion in Firebase with 30-day retention (server-side cleanup later)
  if (typeof fbDb !== 'undefined' && fbDb && phone) {
    const now = new Date().toISOString();
    const purgeDate = new Date();
    purgeDate.setDate(purgeDate.getDate() + 30);
    // Move user data to a "deletedAccounts" node for 30-day retention
    fbDb.ref('users/' + phone).once('value').then(snap => {
      if (snap.exists()) {
        fbDb.ref('deletedAccounts/' + phone).set({
          data: snap.val(),
          deletedAt: now,
          purgeAfter: purgeDate.toISOString()
        });
      }
      // Remove live user data
      fbDb.ref('users/' + phone).remove();
      fbDb.ref('matchQueue/' + phone).remove();
      fbDb.ref('callRequests/' + phone).remove();
    }).catch(() => {});
  }

  // 2) Wipe ALL local storage, session storage, and cookies
  localStorage.clear();
  sessionStorage.clear();
  // Clear all cookies
  document.cookie.split(';').forEach(c => {
    const name = c.split('=')[0].trim();
    document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
  });
  // Clear caches if available
  if ('caches' in window) {
    caches.keys().then(names => names.forEach(n => caches.delete(n)));
  }
  // Unregister service workers
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
  }

  // 3) Reset state
  state.user = { nickname:'', avatar:'👨‍💻', mood:'Happy', moodEmoji:'😄', language:'Hindi', region:'North', intent:'Just chat' };
  state.guftguPhone = '';
  state.palcode = '';

  _cls('deleteAccountModal', 'remove', 'show');
  showToast('Account deleted. All local data wiped. 🧹');

  // Go back to onboarding
  setTimeout(() => { showScreen('screen-onboard'); }, 800);
}

// ═══════════════════════════════════════
// APP INFO
// ═══════════════════════════════════════
function showAppInfo() {
  const el = document.getElementById('screen-appinfo');
  if (el) el.classList.add('show');
}
function closeAppInfo() {
  const el = document.getElementById('screen-appinfo');
  if (el) el.classList.remove('show');
}

// ═══════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════
function acceptFriend(btn) {
  btn.closest('.notif-actions').innerHTML = '<span style="font-size:12px;color:var(--accent2);font-weight:600;">✓ Friends now!</span>';
  btn.closest('.notif-item').classList.remove('unread');
  const badge = document.getElementById('notifBadge');
  const cur = parseInt(badge.textContent);
  if (cur > 1) badge.textContent = cur-1;
  else badge.style.display = 'none';
  showToast('Friend request accepted! 🎉');
  const sf = document.getElementById('statFriends'); if (sf) sf.textContent = parseInt(sf.textContent||'0')+1;
}

function declineFriend(btn) {
  btn.closest('.notif-item').style.opacity = '0.4';
  btn.closest('.notif-actions').innerHTML = '<span style="font-size:12px;color:var(--text3);">Declined</span>';
}

// ═══════════════════════════════════════
// PALCODE
// ═══════════════════════════════════════
function copyPalcode() {
  const code = state.palcode;
  if (navigator.clipboard) navigator.clipboard.writeText(code).catch(()=>{});
  showToast('GuftguPhone number copied! 📱');
}

// ═══════════════════════════════════════
// TOAST
// ═══════════════════════════════════════
