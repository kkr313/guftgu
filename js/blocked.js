// js/blocked.js — Blocked Users screen logic
// ═══════════════════════════════════════════

// ── Open the blocked users screen ────────────────────────────────
function showBlockedScreen() {
  renderBlockedScreen();
  showScreen('screen-blocked');
}

// ── Render the blocked list ───────────────────────────────────────
function renderBlockedScreen() {
  const container = document.getElementById('blockedList');
  const emptyEl   = document.getElementById('blockedEmpty');
  const countEl   = document.getElementById('blockedCount');
  if (!container) return;

  // _getBlocked is defined in matching.js
  const raw     = (typeof _getBlocked === 'function') ? _getBlocked() : [];
  // Normalise: handle both old plain-string entries and new object entries
  const blocked = raw.map(e =>
    typeof e === 'string'
      ? { phone: e, name: 'Unknown', avatar: 'cat', blockedAt: 0 }
      : e
  );

  // Update count in the profile settings row
  if (countEl) countEl.textContent = blocked.length + ' blocked';

  // Update the profile setting-desc too
  const descEl = document.getElementById('settingBlockedDesc');
  if (descEl) descEl.textContent = blocked.length === 0
    ? 'No blocked users'
    : blocked.length + ' user' + (blocked.length === 1 ? '' : 's') + ' blocked';

  container.innerHTML = '';

  if (blocked.length === 0) {
    if (emptyEl) emptyEl.style.display = '';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  blocked.sort((a, b) => (b.blockedAt || 0) - (a.blockedAt || 0)).forEach(u => {
    const avatarHTML = (u.avatar && typeof AVATAR_SVGS !== 'undefined' && AVATAR_SVGS[u.avatar])
      ? AVATAR_SVGS[u.avatar]
      : '<span style="font-size:22px">👤</span>';

    const when = u.blockedAt ? _blockedAgo(u.blockedAt) : '';

    const div = document.createElement('div');
    div.className = 'blocked-item';
    div.innerHTML = `
      <div class="blocked-avatar">${avatarHTML}</div>
      <div class="blocked-info">
        <div class="blocked-name">${_escB(u.name || 'Unknown')}</div>
        ${u.phone ? '<div class="blocked-phone">#' + _escB(u.phone) + '</div>' : ''}
        ${when ? '<div class="blocked-when">Blocked ' + when + '</div>' : ''}
      </div>
      <button class="blocked-unblock-btn" onclick="confirmUnblock('${_escB(u.phone)}','${_escB(u.name || 'Unknown')}')">
        Unblock
      </button>
    `;
    container.appendChild(div);
  });
}

// ── Confirm unblock (in-app, no browser confirm()) ───────────────
function confirmUnblock(phone, name) {
  // Reuse the same _showBlockConfirm pattern but for unblock
  let overlay = document.getElementById('unblockConfirmOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id        = 'unblockConfirmOverlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML =
      '<div class="modal-sheet">' +
        '<div class="modal-handle"></div>' +
        '<div class="modal-header">' +
          '<div class="modal-title" style="color:var(--accent2)">Unblock user?</div>' +
        '</div>' +
        '<div class="modal-body">' +
          '<p id="unblockMsg" style="font-size:13px;color:var(--text2);line-height:1.7;margin-bottom:20px;"></p>' +
          '<div style="display:flex;gap:12px;">' +
            '<button class="btn btn-ghost" style="flex:1" id="unblockCancel">Cancel</button>' +
            '<button class="btn" style="flex:1;background:var(--accent2);color:#fff;border:none;" id="unblockOk">Unblock</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    const app = document.getElementById('app') || document.body;
    app.appendChild(overlay);
  }

  const msg = overlay.querySelector('#unblockMsg');
  if (msg) msg.textContent =
    'Unblock ' + name + '? They will be able to call you and appear in matches again.';

  overlay.classList.add('show');

  // Clone buttons to clear stale handlers
  ['unblockCancel', 'unblockOk'].forEach(id => {
    const el = overlay.querySelector('#' + id);
    if (!el) return;
    const clone = el.cloneNode(true);
    el.parentNode.replaceChild(clone, el);
  });

  overlay.querySelector('#unblockCancel').onclick = () => overlay.classList.remove('show');
  overlay.querySelector('#unblockOk').onclick     = () => {
    overlay.classList.remove('show');
    if (typeof unblockUser === 'function') unblockUser(phone);
    // renderBlockedScreen is called inside unblockUser already
  };
}

// ── Time helper ───────────────────────────────────────────────────
function _blockedAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return hrs + 'h ago';
  const days = Math.floor(hrs / 24);
  if (days < 7)  return days + 'd ago';
  return Math.floor(days / 7) + 'w ago';
}

function _escB(str) {
  const d = document.createElement('div');
  d.textContent = String(str || '');
  return d.innerHTML;
}