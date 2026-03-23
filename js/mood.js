// js/mood.js - All modal open/close/populate logic
// ═══════════════════════════════════════

// ─────────────────────────────────────────
// SHARED: build header with handle + title + close btn
// ─────────────────────────────────────────
function _modalHTML(id, title, bodyHTML) {
  return `
    <div class="modal-handle"></div>
    <div class="modal-header">
      <div class="modal-title">${title}</div>
      <button class="modal-close" onclick="_cls('${id}','remove','show')">✕</button>
    </div>
    <div class="modal-body">${bodyHTML}</div>`;
}

// ─────────────────────────────────────────
// MOOD MODAL
// ─────────────────────────────────────────
const MOOD_DATA = [
  {mood:'Happy',  emoji:'😄'}, {mood:'Sad',     emoji:'😔'}, {mood:'Anxious', emoji:'😰'},
  {mood:'Bored',  emoji:'😑'}, {mood:'Lonely',  emoji:'🥺'}, {mood:'Excited', emoji:'🤩'},
  {mood:'Angry',  emoji:'😤'}, {mood:'Curious', emoji:'🤔'}, {mood:'Chill',   emoji:'😎'},
];

function showMoodModal() {
  const current = state.user.mood || 'Happy';
  const grid = MOOD_DATA.map(m => `
    <div class="mood-card${m.mood === current ? ' selected' : ''}"
         data-mood="${m.mood}" data-emoji="${m.emoji}"
         onclick="changeMood(this)">
      <div class="mood-emoji">${m.emoji}</div>
      <div class="mood-name">${m.mood}</div>
    </div>`).join('');

  const sheet = document.querySelector('#moodModal .modal-sheet');
  if (sheet) sheet.innerHTML = _modalHTML('moodModal', 'How are you feeling?',
    `<div class="mood-grid" id="modalMoodGrid">${grid}</div>`);
  _cls('moodModal', 'add', 'show');
}

function closeMoodModal(e) {
  if (e.target.id === 'moodModal') _cls('moodModal', 'remove', 'show');
}

function changeMood(card) {
  document.querySelectorAll('#modalMoodGrid .mood-card').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');
  state.user.mood      = card.dataset.mood;
  state.user.moodEmoji = card.dataset.emoji || moodEmojis[card.dataset.mood];
  saveUser();
  updateHomeUI();
  setTimeout(() => _cls('moodModal', 'remove', 'show'), 220);
  showToast(card.dataset.emoji + ' Mood set to ' + card.dataset.mood);
}

// ─────────────────────────────────────────
// LANGUAGE MODAL — uses LANG_DATA from lang-data.js
// ─────────────────────────────────────────
function showLangModal() {
  const current = state.user.language || 'Hindi';
  const sheet = document.querySelector('#langModal .modal-sheet');
  if (sheet) sheet.innerHTML = _modalHTML('langModal', 'Choose language',
    '<div class="lang-pill-row" id="modalLangGrid"></div>');
  // renderLangPills is defined in lang-data.js — single source of truth
  renderLangPills('modalLangGrid', current, 'changeLang');
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
  setTimeout(() => _cls('langModal', 'remove', 'show'), 220);
  showToast('Language set to ' + state.user.language);
}

// ─────────────────────────────────────────
// REGION MODAL
// ─────────────────────────────────────────
const REGION_DATA = [
  {region:'North',     icon:'🏔️', name:'North India',   states:'Delhi · UP · Punjab · HP'},
  {region:'South',     icon:'🌴', name:'South India',   states:'TN · Kerala · Karnataka'},
  {region:'East',      icon:'🌊', name:'East India',    states:'WB · Odisha · Bihar'},
  {region:'West',      icon:'🌅', name:'West India',    states:'MH · Gujarat · Goa'},
  {region:'Central',   icon:'🌾', name:'Central India', states:'MP · CG · Telangana'},
  {region:'Northeast', icon:'🏕️', name:'Northeast',     states:'Assam · Manipur · NE'},
];

function showRegionModal() {
  const current = state.user.region || '';
  const cards = REGION_DATA.map(r => `
    <div class="region-card-modal${r.region === current ? ' selected' : ''}"
         data-region="${r.region}" onclick="changeRegion(this)">
      <div class="r-icon">${r.icon}</div>
      <div class="r-name">${r.name}</div>
      <div class="r-states">${r.states}</div>
    </div>`).join('');

  const sheet = document.querySelector('#regionModal .modal-sheet');
  if (sheet) sheet.innerHTML = _modalHTML('regionModal', 'Your region',
    `<div class="region-modal-grid" id="modalRegionGrid">${cards}</div>`);
  _cls('regionModal', 'add', 'show');
}

function closeRegionModal(e) {
  if (e.target.id === 'regionModal') _cls('regionModal', 'remove', 'show');
}

function changeRegion(card) {
  document.querySelectorAll('#modalRegionGrid .region-card-modal').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');
  state.user.region = card.dataset.region;
  saveUser();
  updateHomeUI();
  setTimeout(() => _cls('regionModal', 'remove', 'show'), 220);
  showToast('📍 Region set to ' + state.user.region);
}

// ─────────────────────────────────────────
// AVATAR PICKER MODAL — tabbed
// ─────────────────────────────────────────
const AVATAR_TABS_DATA = [
  { label: '🐾 Animals', keys: ['cat','fox','wolf','panda','lion','frog','owl','bear','rabbit','tiger','deer','penguin'] },
  { label: '👥 People',  keys: ['coder','artist','doctor','chef','musician','astronaut','teacher','student','pilot','scientist','farmer','engineer'] },
  { label: '✨ Fantasy', keys: ['wizard','fairy','vampire','genie','elf','robot','alien','ninja','knight','witch','angel','samurai'] },
];

let _avatarActiveTab = 0;

function showAvatarModal() {
  _avatarActiveTab = 0;
  const current = state.user.avatar || 'cat';

  // Find which tab the current avatar is in
  AVATAR_TABS_DATA.forEach((tab, i) => {
    if (tab.keys.includes(current)) _avatarActiveTab = i;
  });

  const sheet = document.querySelector('#avatarModal .modal-sheet');
  if (sheet) {
    sheet.innerHTML = `
      <div class="modal-handle"></div>
      <div class="modal-header">
        <div class="modal-title">Choose your avatar</div>
        <button class="modal-close" onclick="_cls('avatarModal','remove','show')">✕</button>
      </div>
      <div class="avatar-picker-tabs" id="avatarPickerTabs">
        ${AVATAR_TABS_DATA.map((t, i) => `
          <div class="avatar-picker-tab${i === _avatarActiveTab ? ' active' : ''}"
               onclick="_switchAvatarTab(${i})">${t.label}</div>
        `).join('')}
      </div>
      <div class="avatar-picker-scroll">
        <div class="avatar-picker-grid" id="avatarPickerGrid"></div>
      </div>`;
  }
  _renderAvatarTab(current);
  _cls('avatarModal', 'add', 'show');
}

function _switchAvatarTab(idx) {
  _avatarActiveTab = idx;
  document.querySelectorAll('.avatar-picker-tab').forEach((t, i) => {
    t.classList.toggle('active', i === idx);
  });
  _renderAvatarTab(state.user.avatar || 'cat');
}

function _renderAvatarTab(current) {
  const grid = document.getElementById('avatarPickerGrid');
  if (!grid) return;
  const tab = AVATAR_TABS_DATA[_avatarActiveTab];
  grid.innerHTML = tab.keys.map(key => {
    const svg = AVATAR_SVGS[key] || '';
    const name = key.charAt(0).toUpperCase() + key.slice(1);
    return `
      <div class="avatar-picker-item${key === current ? ' selected' : ''}"
           data-avatar="${key}" onclick="pickAvatar('${key}')">
        ${svg}
        <div class="avatar-picker-item-name">${name}</div>
      </div>`;
  }).join('');
}

function closeAvatarModal(e) {
  if (e.target.id === 'avatarModal') _cls('avatarModal', 'remove', 'show');
}

function pickAvatar(key) {
  state.user.avatar = key;
  saveUser();
  updateHomeUI();
  // Update selection highlight without closing
  document.querySelectorAll('.avatar-picker-item').forEach(el => {
    el.classList.toggle('selected', el.dataset.avatar === key);
  });
  setTimeout(() => _cls('avatarModal', 'remove', 'show'), 280);
  showToast('Avatar updated 🎨');
}

// ─────────────────────────────────────────
// DELETE ACCOUNT MODAL
// ─────────────────────────────────────────
function closeDeleteModal(e) {
  if (e && e.target && e.target.id === 'deleteAccountModal')
    _cls('deleteAccountModal', 'remove', 'show');
}

function cancelDeleteAccount() {
  _cls('deleteAccountModal', 'remove', 'show');
}

function confirmDeleteAccount() {
  const phone = String(state.guftguPhone || '');

  // Show deleting state on button
  const btn = document.getElementById('deleteConfirmBtn');
  if (btn) { btn.textContent = 'Deleting...'; btn.disabled = true; }

  // 1. If user is currently in a call — end it cleanly first
  if (state.screen === 'screen-call' && typeof endCallCleanup === 'function') {
    endCallCleanup();
  }

  // 2. If user is currently searching — remove from queue
  if (typeof cleanupQueue === 'function') cleanupQueue();

  // 3. Firebase — delete every path that belongs to this user
  if (typeof fbDb !== 'undefined' && fbDb && phone) {
    const paths = [
      'matchQueue/'      + phone,   // remove from search queue
      'matchProposals/'  + phone,   // remove pending proposals
      'phoneRooms/'      + phone,   // remove call routing entry
      'callRequests/'    + phone,   // remove pending incoming calls
      'friendRequests/'  + phone,   // remove friend requests received
      'friendAccepted/'  + phone,   // remove pending accept notifications
    ];

    // Delete all known personal paths
    paths.forEach(p => fbDb.ref(p).remove().catch(() => {}));

    // Also clean active match if there is one
    if (typeof currentMatchId !== 'undefined' && currentMatchId) {
      fbDb.ref('matches/' + currentMatchId).remove().catch(() => {});
    }

    // Clean active room if there is one
    if (typeof currentRoomId !== 'undefined' && currentRoomId) {
      fbDb.ref('rooms/' + currentRoomId).remove().catch(() => {});
    }
  }

  // 4. Wipe everything local
  localStorage.clear();
  sessionStorage.clear();
  document.cookie.split(';').forEach(ck => {
    const name = ck.split('=')[0].trim();
    document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
  });
  if ('caches' in window) {
    caches.keys().then(names => names.forEach(n => caches.delete(n)));
  }

  // 5. Reset all in-memory state
  state.user = { nickname:'', avatar:'cat', mood:'Happy', moodEmoji:'😄',
    language:'Hindi', region:'North', intent:'Just chat' };
  state.guftguPhone = '';
  state.palcode     = '';
  state.currentPal  = null;
  state.screen      = 'screen-onboard';
  state.prevScreen  = null;

  // 6. Close modal + hide nav
  _cls('deleteAccountModal', 'remove', 'show');
  const nav = document.getElementById('mainNav');
  if (nav) { nav.style.display = 'none'; nav.classList.remove('nav-visible'); }

  // 7. Navigate back to onboarding
  setTimeout(() => {
    if (typeof resetOnboarding === 'function') resetOnboarding();
    document.querySelectorAll('.screen').forEach(s => {
      s.classList.remove('active', 'exit');
      s.style.transform  = '';
      s.style.transition = '';
    });
    const ob = document.getElementById('screen-onboard');
    if (ob) {
      ob.style.transition = 'none';
      ob.style.transform  = 'translateX(0)';
      ob.classList.add('active');
      requestAnimationFrame(() => { ob.style.transition = ''; });
    }
  }, 400);
}

// ─────────────────────────────────────────
// MISC
// ─────────────────────────────────────────
function filterMood(el, mood) {
  document.querySelectorAll('.mood-filter').forEach(f => f.classList.remove('active'));
  if (el) el.classList.add('active');
}

function showAppInfo() { showScreen('screen-appinfo'); }
function closeAppInfo() { goBack(); }

function copyPalcode() {
  const code = state.palcode || state.guftguPhone;
  if (navigator.clipboard) navigator.clipboard.writeText(code).catch(() => {});
  showToast('GuftguPhone number copied! 📱');
}

function acceptFriend(btn) {
  btn.closest('.notif-actions').innerHTML =
    '<span style="font-size:12px;color:var(--accent2);font-weight:600;">✓ Friends now!</span>';
  btn.closest('.notif-item').classList.remove('unread');
  const badge = document.getElementById('notifBadge');
  if (badge) {
    const cur = parseInt(badge.textContent) || 0;
    if (cur > 1) badge.textContent = cur - 1;
    else badge.style.display = 'none';
  }
  showToast('Friend request accepted! 🎉');
  if (typeof updateProfileStats === 'function') updateProfileStats();
}

function declineFriend(btn) {
  btn.closest('.notif-item').style.opacity = '0.4';
  btn.closest('.notif-actions').innerHTML =
    '<span style="font-size:12px;color:var(--text3);">Declined</span>';
}