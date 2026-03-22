// js/onboarding.js - Onboarding 2-path flow (Quick Start + Full Setup)
// ═══════════════════════════════════════
const NAME_ADJECTIVES = [
  'Silent','Quiet','Bold','Bright','Dark','Swift','Calm','Wild',
  'Deep','Soft','Sharp','Hazy','Warm','Cool','Fierce','Gentle',
  'Lone','Blue','Golden','Mystic','Lazy','Brave','Witty','Proud'
];
const NAME_NOUNS = [
  'Tiger','River','Storm','Cloud','Falcon','Drifter','Wolf','Spark',
  'Comet','Ember','Pebble','Tide','Fox','Sage','Hawk','Breeze',
  'Shadow','Flame','Echo','Pilgrim','Crest','Nomad','Glimmer','Pulse'
];
const QS_AVATARS = ['cat','fox','wolf','panda','lion','frog','owl','penguin','wizard','robot','fairy','alien','ninja','knight','angel','samurai'];
const QS_MOODS   = ['Happy','Chill','Excited','Lonely','Curious','Bored'];
const QS_EMOJIS  = {Happy:'😄',Chill:'😎',Excited:'🤩',Lonely:'🥺',Curious:'🤔',Bored:'😑'};

// current ob step: 0=splash, 1-4=full steps, 'qs'=quick-start region
let _obStep = 0;
// quick-start temp state
let _qsState = { avatar:'cat', name:'SilentFox42', mood:'Happy', moodEmoji:'😄', language:'Hindi', region:'', intent:'Just chat' };

function genUniqueName() {
  const adj = NAME_ADJECTIVES[Math.floor(Math.random() * NAME_ADJECTIVES.length)];
  const noun = NAME_NOUNS[Math.floor(Math.random() * NAME_NOUNS.length)];
  return adj + noun + String(Math.floor(10 + Math.random() * 90));
}

// ═══════════════════════════════════════════════════════════════════
// RESET — called by confirmDeleteAccount() to fully restore fresh state
// ═══════════════════════════════════════════════════════════════════
function resetOnboarding() {
  // 1. Reset module-level step tracker
  _obStep = 0;

  // 2. Reset quick-start temp state
  _qsState = { avatar:'cat', name:genUniqueName(), mood:'Happy', moodEmoji:'😄', language:'Hindi', region:'', intent:'Just chat' };

  // 3. Reset progress bar UI
  const prog = document.getElementById('obProgress');
  if (prog) prog.classList.remove('visible');
  const back = document.getElementById('obBackBtn');
  if (back) back.classList.remove('visible');

  // 4. Hide ALL onboarding steps, show only step 0 (splash)
  document.querySelectorAll('.onboard-step').forEach(s => s.classList.remove('active'));
  const splash = document.getElementById('ob-step-0');
  if (splash) splash.classList.add('active');

  // 5. Reset progress dots to pristine state
  for (let i = 1; i <= 4; i++) {
    const dot = document.getElementById('pdot-' + i);
    if (dot) {
      dot.classList.remove('active', 'done');
      dot.textContent = i;
      if (i === 1) dot.classList.add('active');
    }
    const line = document.getElementById('pline-' + i);
    if (line) line.classList.remove('done');
  }
  const label = document.getElementById('obProgLabel');
  if (label) label.innerHTML = 'Step <span>1</span> of 4';

  // 6. Reset onboarding background tint
  const obBg = document.getElementById('obBg');
  if (obBg) obBg.style.background = '';

  // 7. Reset mood grid — Happy pre-selected
  document.querySelectorAll('#moodGrid .mood-card').forEach(c => {
    c.classList.toggle('selected', c.dataset.mood === 'Happy');
  });

  // 8. Reset intent chips — Just chat pre-selected
  document.querySelectorAll('#intentRow .intent-chip').forEach(c => {
    c.classList.toggle('selected', c.dataset.intent === 'Just chat');
  });

  // 9. Reset language grids from single source — Hindi pre-selected
  renderLangPills('langGrid',  'Hindi', 'selectLang');
  renderLangPills('qsLangRow', 'Hindi', 'qsSelectLang');

  // 10. Reset region grid — nothing selected
  document.querySelectorAll('#regionGrid .region-card').forEach(c => c.classList.remove('selected'));

  // 11. Reset avatar picker — Cat pre-selected in Animals tab
  document.querySelectorAll('.avatar-opt').forEach(a => {
    a.classList.toggle('selected', a.dataset.avatar === 'cat');
  });
  // Show animals tab, hide others
  document.querySelectorAll('.avatar-tab').forEach((t, i) => t.classList.toggle('active', i === 0));
  document.querySelectorAll('.avatar-panel').forEach((p, i) => p.classList.toggle('active', i === 0));

  // 12. Clear nickname input
  const nickInput = document.getElementById('nicknameInput');
  if (nickInput) nickInput.value = '';
  const nameHint = document.getElementById('nameHint');
  if (nameHint) {
    nameHint.textContent = '✓ No email or phone required · ✓ Fully anonymous';
    nameHint.style.color = 'var(--text3)';
  }

  // 13. Reset palcodeDisplay
  const pcd = document.getElementById('palcodeDisplay');
  if (pcd) pcd.textContent = '—';

  // 14. Re-sync state defaults
  state.user.mood = 'Happy';
  state.user.moodEmoji = '😄';
  state.user.avatar = 'cat';
  state.user.language = 'Hindi';

  // 15. Set avatar continue btn to default state
  const avatarBtn = document.getElementById('avatarContinueBtn');
  if (avatarBtn) { avatarBtn.disabled = false; avatarBtn.textContent = 'Continue →'; }
}

// ── Progress bar update ───────────────────────────
function _obUpdateProgress(step) {
  const prog = document.getElementById('obProgress');
  const back = document.getElementById('obBackBtn');
  const isNum = typeof step === 'number';
  if (step === 0) {
    prog.classList.remove('visible');
    back.classList.remove('visible');
    return;
  }
  if (step === 'qs') {
    prog.classList.remove('visible');
    back.classList.add('visible');
    return;
  }
  prog.classList.add('visible');
  back.classList.add('visible');
  _html('obProgLabel', `Step <span>${step}</span> of 4`);
  for (let i = 1; i <= 4; i++) {
    const dot = document.getElementById('pdot-'+i);
    const line = document.getElementById('pline-'+i);
    dot.classList.remove('active','done');
    if (i < step) { dot.classList.add('done'); dot.innerHTML='✓'; }
    else if (i === step) { dot.classList.add('active'); dot.textContent = i; }
    else { dot.textContent = i; }
    if (line) line.classList.toggle('done', i < step);
  }
  const tints = ['','rgba(255,107,107,0.18)','rgba(78,205,196,0.12)','rgba(78,205,196,0.1)','rgba(255,107,107,0.1)'];
  const obBgEl = document.getElementById('obBg');
  if (obBgEl) obBgEl.style.background = `radial-gradient(ellipse 80% 60% at 50% 0%, ${tints[step]||tints[1]} 0%, transparent 70%)`;
}

function _obShow(stepId) {
  document.querySelectorAll('.onboard-step').forEach(s => s.classList.remove('active'));
  document.getElementById('ob-step-'+stepId).classList.add('active');
  _obStep = stepId;
  _obUpdateProgress(stepId);
  document.getElementById('onboardContent').scrollTop = 0;
}

function obNextStep() {
  if (_obStep === 0) { _obShow(1); return; }
  if (_obStep === 1) {
    if (!state.user.mood) { showToast('Pick a mood first 😊'); return; }
    _obShow(2); return;
  }
  if (_obStep === 2) {
    if (!state.user.avatar) { showToast('Choose an avatar first'); return; }
    // Render lang pills from single source before showing step 3
    renderLangPills('langGrid', state.user.language || 'Hindi', 'selectLang');
    _obShow(3); return;
  }
  if (_obStep === 3) {
    if (!state.user.language) { showToast('Choose a language 🌍'); return; }
    populateNameSuggestions();
    _obShow(4); return;
  }
}

function obPrevStep() {
  if (_obStep === 'qs') { _obShow(0); return; }
  if (typeof _obStep === 'number' && _obStep > 0) { _obShow(_obStep - 1); return; }
}

function obJumpTo(n) {
  if (typeof _obStep === 'number' && n < _obStep) _obShow(n);
}

// ── QUICK START path ──────────────────────────────
function quickStart() {
  reshuffleQS(); // reshuffleQS calls renderLangPills('qsLangRow',...)
  _obShow('qs');
}

function reshuffleQS() {
  _qsState.avatar = QS_AVATARS[Math.floor(Math.random()*QS_AVATARS.length)];
  _qsState.name   = genUniqueName();
  const moodKey   = QS_MOODS[Math.floor(Math.random()*QS_MOODS.length)];
  _qsState.mood   = moodKey;
  _qsState.moodEmoji = QS_EMOJIS[moodKey] || '😊';
  setAvatarEl('qsPreviewAvatar', _qsState.avatar);
  _txt('qsPreviewName', _qsState.name);
  _txt('qsPreviewMeta', 'Feeling ' + _qsState.mood + ' ' + _qsState.moodEmoji + ' · ' + (_qsState.intent || 'Just chat'));
  // Rebuild lang pills from single source of truth
  renderLangPills('qsLangRow', 'Hindi', 'qsSelectLang');
  document.querySelectorAll('#qsRegionGrid .region-card').forEach(c => c.classList.remove('selected'));
  _qsState.language = 'Hindi';
  _qsState.region   = '';
}

// ── Show welcome/completion screen ───────────────
function showWelcomeScreen() {
  const u = state.user;

  // Set avatar — prefer the large welcome avatar, fall back to wcAvatar
  const avatarId = document.getElementById('welcomeAvatarBig') ? 'welcomeAvatarBig' : 'wcAvatar';
  setAvatarEl(avatarId, u.avatar || 'cat');

  // Set name
  const nameId = document.getElementById('welcomeNameBig') ? 'welcomeNameBig' : 'wcName';
  _txt(nameId, u.nickname || 'Pal');

  // Set phone
  const wpn = document.getElementById('welcomePhoneNum') || document.getElementById('wcPhone');
  if (wpn) wpn.textContent = state.guftguPhone || '-';

  // Set tagline
  const wcTagline = document.getElementById('wcTagline');
  if (wcTagline) wcTagline.textContent = 'Feeling ' + (u.mood || 'Happy') + ' ' + (u.moodEmoji || '😊') + ' · ' + (u.intent || 'Just chat');

  _launchConfetti();
  showScreen('screen-welcome');
}

function _launchConfetti() {
  const container = document.getElementById('welcomeConfetti');
  if (!container) return;
  container.innerHTML = '';
  const colors = ['#FF6B6B','#4ECDC4','#FFE66D','#FF8E53','#26A69A','#fff'];
  for (let i = 0; i < 45; i++) {
    const dot = document.createElement('div');
    dot.className = 'confetti-dot';
    dot.style.left             = Math.random()*100 + '%';
    dot.style.top              = '-10px';
    dot.style.background       = colors[Math.floor(Math.random()*colors.length)];
    dot.style.animationDuration= (2.5 + Math.random()*3) + 's';
    dot.style.animationDelay   = (Math.random()*2) + 's';
    dot.style.width            = (4 + Math.random()*8) + 'px';
    dot.style.height           = (4 + Math.random()*8) + 'px';
    container.appendChild(dot);
  }
}

function enterHomeFromWelcome() {
  localStorage.setItem('guftgu_welcomed','1');
  updateHomeUI();
  showScreen('screen-home');
}

// alias kept for safety
function enterAppFromWelcome() { enterHomeFromWelcome(); }

function finishQS() {
  if (!_qsState.language) { showToast('Pick a language 🌍'); return; }
  state.user.mood      = _qsState.mood;
  state.user.moodEmoji = _qsState.moodEmoji;
  state.user.avatar    = _qsState.avatar;
  state.user.nickname  = _qsState.name;
  state.user.language  = _qsState.language;
  state.user.region    = _qsState.region;
  state.user.intent    = 'Just chat';
  state.guftguPhone    = genGuftguPhone();
  state.palcode        = state.guftguPhone;
  saveUser();
  showWelcomeScreen();
}

function finishOnboard() {
  const nickEl = document.getElementById('nicknameInput');
  const nick = nickEl ? nickEl.value.trim() : '';
  if (!nick || nick.length < 2) { showToast('Enter a nickname (2+ chars) 👤'); return; }
  if (!state.user.mood)   { state.user.mood='Happy'; state.user.moodEmoji='😄'; }
  if (!state.user.avatar) { state.user.avatar='cat'; }
  if (!state.user.intent) { state.user.intent='Just chat'; }
  state.user.nickname  = nick;
  state.guftguPhone    = genGuftguPhone();
  state.palcode        = state.guftguPhone;
  saveUser();
  showWelcomeScreen();
}

// ── FULL SETUP path ───────────────────────────────
function selectMood(card) {
  document.querySelectorAll('#moodGrid .mood-card').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');
  state.user.mood = card.dataset.mood;
  state.user.moodEmoji = moodEmojis[state.user.mood] || '😊';
}

function selectIntent(chip) {
  document.querySelectorAll('#intentRow .intent-chip').forEach(c => c.classList.remove('selected'));
  chip.classList.add('selected');
  state.user.intent = chip.dataset.intent;
}

function selectAvatar(opt) {
  document.querySelectorAll('.avatar-opt').forEach(a => a.classList.remove('selected'));
  opt.classList.add('selected');
  state.user.avatar = opt.dataset.avatar;
}

function switchAvatarTab(tab, el) {
  document.querySelectorAll('.avatar-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.querySelectorAll('.avatar-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-' + tab).classList.add('active');
  const firstOpt = document.querySelector('#panel-' + tab + ' .avatar-opt');
  if (firstOpt) selectAvatar(firstOpt);
}

function selectLang(pill) {
  document.querySelectorAll('#langGrid .lang-pill').forEach(p => p.classList.remove('selected'));
  pill.classList.add('selected');
  state.user.language = pill.dataset.lang;
}

function selectRegion(card) {
  document.querySelectorAll('#regionGrid .region-card').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');
  state.user.region = card.dataset.region;
}

function qsSelectLang(pill) {
  document.querySelectorAll('#qsLangRow .lang-pill').forEach(p => p.classList.remove('selected'));
  pill.classList.add('selected');
  _qsState.language = pill.dataset.lang;
}

function qsSelectRegion(card) {
  document.querySelectorAll('#qsRegionGrid .region-card').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');
  _qsState.region = card.dataset.region;
}

function nextStep(step) { obNextStep(); }

function populateNameSuggestions() { renderNameChips(); }

function renderNameChips() {
  const container = document.getElementById('nameSuggestions');
  const names = Array.from({length: 6}, genUniqueName);
  container.innerHTML = names.map(n =>
    `<div class="name-chip" onclick="pickName(this,'${n}')">${n}</div>`
  ).join('') +
  `<div class="name-chip" onclick="renderNameChips()" style="border-style:dashed;color:var(--text3);">🔀 More</div>`;
  const first = container.querySelector('.name-chip');
  if (first) pickName(first, names[0]);
}

function pickName(chip, name) {
  document.querySelectorAll('.name-chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
  _val('nicknameInput', name);
}

function onNameInput(val) {
  document.querySelectorAll('.name-chip').forEach(c => c.classList.remove('active'));
  const hint = document.getElementById('nameHint');
  if (hint) {
    if (val.length > 0 && val.trim().length < 2) {
      hint.textContent = '⚠ At least 2 characters needed';
      hint.style.color = 'var(--accent)';
    } else if (val.trim().length >= 2) {
      hint.textContent = '✓ Looking good!';
      hint.style.color = 'var(--accent2)';
    } else {
      hint.textContent = '✓ No email or phone required · ✓ Fully anonymous';
      hint.style.color = 'var(--text3)';
    }
  }
}

function updateNicknamePreview(v) {}