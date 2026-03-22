// js/router.js - Screen transitions & navigation
// ═══════════════════════════════════════
const _mainTabs = ['screen-home','screen-chats','screen-notifs','screen-profile'];
const _tabMap = {'screen-home':'home','screen-chats':'chats','screen-notifs':'notifs','screen-profile':'profile'};

function showScreen(id, back=false) {
  const current = document.querySelector('.screen.active');
  const next = document.getElementById(id);
  if (!next || current === next) return;
  state.prevScreen = current ? current.id : null;

  const isMainSwitch = _mainTabs.includes(id) && current && _mainTabs.includes(current.id);

  if (current) {
    current.classList.remove('active');
    if (!isMainSwitch) {
      if (!back) current.classList.add('exit');
      setTimeout(() => current.classList.remove('exit'), 400);
    }
  }

  if (isMainSwitch) {
    // Instant swap for main tabs — no slide animation
    next.style.transition = 'none';
    next.style.transform = 'translateX(0)';
    next.classList.add('active');
    // Restore transition after paint
    requestAnimationFrame(() => { next.style.transition = ''; });
  } else {
    next.style.transform = back ? 'translateX(-100%)' : 'translateX(100%)';
    requestAnimationFrame(() => {
      next.classList.add('active');
      next.style.transform = '';
    });
  }

  state.screen = id;

  // ── FIX: Show/hide shared bottom nav ──────────────────────────────────
  // We use BOTH style.display AND a CSS class (.nav-visible) so the nav
  // stays visible even if one mechanism fails (JS error, browser quirk,
  // style attribute gets reset). The CSS class acts as a failsafe.
  const nav = document.getElementById('mainNav');
  if (nav) {
    const isMain = _mainTabs.includes(id);

    if (isMain) {
      nav.style.display = 'flex';
      nav.classList.add('nav-visible');
      // Update active tab highlight
      const tab = _tabMap[id] || 'home';
      nav.querySelectorAll('.nav-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
      });
    } else {
      nav.style.display = 'none';
      nav.classList.remove('nav-visible');
    }
  }

  // Render dynamic content for specific screens
  if (id === 'screen-history' && typeof renderCallHistory === 'function') renderCallHistory();
  if (id === 'screen-home' && typeof updateHomeUI === 'function') updateHomeUI();
  if (id === 'screen-chats' && typeof renderChatsScreen === 'function') renderChatsScreen();
}

function goBack() {
  if (state.prevScreen) showScreen(state.prevScreen, true);
  else showMainScreen('home');
}

function showMainScreen(tab) {
  const map = { home:'screen-home', chats:'screen-chats', notifs:'screen-notifs', profile:'screen-profile' };
  showScreen(map[tab] || 'screen-home');
}

// ═══════════════════════════════════════