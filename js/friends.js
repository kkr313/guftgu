// js/friends.js — Chats screen: Friends list + Pending requests

const FRIENDS_KEY  = 'guftgu_friends';
const PENDING_KEY  = 'guftgu_pending';

let _friendReqListener = null;
let _friendAccListener = null;
let _friendAccRef      = null;

// ── Data helpers ──────────────────────────────────────────────────
function _getFriends() {
  try { return JSON.parse(localStorage.getItem(FRIENDS_KEY)) || []; } catch (_) { return []; }
}
function _saveFriends(list) {
  try { localStorage.setItem(FRIENDS_KEY, JSON.stringify(list)); } catch (_) {}
}
function _getPending() {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY)) || []; } catch (_) { return []; }
}
function _savePending(list) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(list)); } catch (_) {}
}

// ── Tab switching ─────────────────────────────────────────────────
function switchChatsTab(el) {
  const panel = el.dataset.panel;
  document.querySelectorAll('.chats-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  const fp = document.getElementById('panel-friends');
  const pp = document.getElementById('panel-pending');
  if (fp) fp.style.display = panel === 'friends' ? '' : 'none';
  if (pp) pp.style.display = panel === 'pending' ? '' : 'none';
}

// ── Render chats screen ───────────────────────────────────────────
function renderChatsScreen() {
  renderFriendsList();
  renderPendingList();
  _updatePendingBadge();
  _listenFriendRequests();
}

// ── Friends list ──────────────────────────────────────────────────
function renderFriendsList() {
  const container = document.getElementById('friendsList');
  const emptyEl   = document.getElementById('friendsEmpty');
  if (!container) return;

  const friends = _getFriends();
  container.innerHTML = '';

  if (friends.length === 0) {
    if (emptyEl) emptyEl.style.display = '';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  friends.forEach((f, i) => {
    const ago = _timeAgo(f.addedAt || f.timestamp || Date.now());
    const div = document.createElement('div');
    div.className = 'friend-item';

    div.innerHTML =
      '<div class="friend-avatar" id="friend-av-' + i + '"></div>' +
      '<div class="friend-info">' +
        '<div class="friend-name">' + _esc(f.name || 'Anonymous') + '</div>' +
        '<div class="friend-mood">' + (f.moodEmoji || '') + ' ' + (f.mood || 'Vibing') + '</div>' +
      '</div>' +
      '<div class="friend-meta">' +
        '<div class="friend-time">' + ago + '</div>' +
        '<button class="friend-block-btn" title="Block user">🚫</button>' +
      '</div>';

    div.onclick = () => _openFriendChat(f);

    const blockBtn = div.querySelector('.friend-block-btn');
    if (blockBtn) {
      blockBtn.onclick = e => {
        e.stopPropagation();
        _confirmBlockFriend(f.phone, f.name);
      };
    }

    container.appendChild(div);
    if (typeof setAvatarEl === 'function') setAvatarEl('friend-av-' + i, f.avatar || 'cat');
  });
}

// ── Pending list ──────────────────────────────────────────────────
function renderPendingList() {
  const container = document.getElementById('pendingList');
  const emptyEl   = document.getElementById('pendingEmpty');
  if (!container) return;

  const pending = _getPending();
  container.innerHTML = '';

  if (pending.length === 0) {
    if (emptyEl) emptyEl.style.display = '';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  pending.forEach((p, i) => {
    const isIncoming = p.direction === 'incoming';
    const div = document.createElement('div');
    div.className = 'pending-item';
    div.innerHTML =
      '<div class="pending-avatar" id="pending-av-' + i + '"></div>' +
      '<div class="pending-info">' +
        '<div class="pending-name">' + _esc(p.name || 'Anonymous') + '</div>' +
        '<div class="pending-type">' + (isIncoming ? 'Wants to be friends' : 'Request sent') + '</div>' +
      '</div>' +
      '<div class="pending-actions">' +
        (isIncoming
          ? '<button class="pending-btn accept" onclick="acceptFriendRequest(' + i + ')">Accept</button>' +
            '<button class="pending-btn decline" onclick="declineFriendRequest(' + i + ')">Decline</button>'
          : '<button class="pending-btn cancel" onclick="cancelFriendRequest(' + i + ')">Cancel</button>'
        ) +
      '</div>';

    container.appendChild(div);
    if (typeof setAvatarEl === 'function') setAvatarEl('pending-av-' + i, p.avatar || 'cat');
  });
}

// ── Badge ─────────────────────────────────────────────────────────
function _updatePendingBadge() {
  const badge    = document.getElementById('pendingBadge');
  if (!badge) return;
  const incoming = _getPending().filter(p => p.direction === 'incoming');
  badge.textContent  = incoming.length;
  badge.style.display = incoming.length > 0 ? '' : 'none';
}

// ── Send friend request ───────────────────────────────────────────
function sendFriendRequest(targetPhone, targetName, targetAvatar, targetMood, targetMoodEmoji) {
  if (!state.guftguPhone) { showToast('Set up your profile first'); return; }
  if (targetPhone === state.guftguPhone) { showToast("That's your own number!"); return; }
  if (_getFriends().some(f => f.phone === targetPhone)) { showToast('Already friends!'); return; }
  const pending = _getPending();
  if (pending.some(p => p.phone === targetPhone)) { showToast('Request already pending'); return; }

  pending.push({
    phone:     targetPhone,
    name:      targetName      || 'Anonymous',
    avatar:    targetAvatar    || 'cat',
    mood:      targetMood      || '',
    moodEmoji: targetMoodEmoji || '',
    direction: 'outgoing',
    timestamp: Date.now()
  });
  _savePending(pending);

  if (fbDb) {
    fbDb.ref('friendRequests/' + targetPhone + '/' + state.guftguPhone).set({
      from:      state.guftguPhone,
      name:      state.user.nickname  || 'Anonymous',
      avatar:    state.user.avatar    || 'cat',
      mood:      state.user.mood      || '',
      moodEmoji: state.user.moodEmoji || '',
      timestamp: Date.now()
    });
  }

  renderPendingList();
  _updatePendingBadge();
  showToast('Friend request sent!');
}

// ── Accept ────────────────────────────────────────────────────────
function acceptFriendRequest(index) {
  const pending = _getPending();
  const req     = pending[index];
  if (!req) return;

  const friends = _getFriends();
  friends.unshift({ phone:req.phone, name:req.name, avatar:req.avatar, mood:req.mood, moodEmoji:req.moodEmoji, addedAt:Date.now() });
  _saveFriends(friends);
  pending.splice(index, 1);
  _savePending(pending);

  if (fbDb && req.phone) {
    fbDb.ref('friendAccepted/' + req.phone + '/' + state.guftguPhone).set({
      from:      state.guftguPhone,
      name:      state.user.nickname  || 'Anonymous',
      avatar:    state.user.avatar    || 'cat',
      mood:      state.user.mood      || '',
      moodEmoji: state.user.moodEmoji || '',
      timestamp: Date.now()
    });
    fbDb.ref('friendRequests/' + state.guftguPhone + '/' + req.phone).remove();
  }

  renderFriendsList();
  renderPendingList();
  _updatePendingBadge();
  if (typeof _updateProfileStats === 'function') _updateProfileStats();
  showToast(req.name + ' is now your friend! 🎉');
}

// ── Decline ───────────────────────────────────────────────────────
function declineFriendRequest(index) {
  const pending = _getPending();
  const req     = pending[index];
  if (!req) return;
  pending.splice(index, 1);
  _savePending(pending);
  if (fbDb && req.phone) fbDb.ref('friendRequests/' + state.guftguPhone + '/' + req.phone).remove();
  renderPendingList();
  _updatePendingBadge();
}

// ── Cancel outgoing ───────────────────────────────────────────────
function cancelFriendRequest(index) {
  const pending = _getPending();
  const req     = pending[index];
  if (!req) return;
  pending.splice(index, 1);
  _savePending(pending);
  if (fbDb && req.phone) fbDb.ref('friendRequests/' + req.phone + '/' + state.guftguPhone).remove();
  renderPendingList();
  _updatePendingBadge();
}

// ── Remove friend ─────────────────────────────────────────────────
function removeFriend(phone) {
  _saveFriends(_getFriends().filter(f => f.phone !== phone));
  renderFriendsList();
  if (typeof _updateProfileStats === 'function') _updateProfileStats();
}

// ── Block friend — in-app confirm, no browser confirm() (Req 5) ──
function _confirmBlockFriend(phone, name) {
  if (!phone) { showToast('Cannot block — no phone number'); return; }
  // _showBlockConfirm is defined in matching.js (loaded before friends.js)
  if (typeof _showBlockConfirm === 'function') {
    _showBlockConfirm(name || 'this user', () => {
      if (typeof blockUser === 'function') blockUser(phone, name);
      else removeFriend(phone);
      renderFriendsList();
      if (typeof _updateProfileStats === 'function') _updateProfileStats();
    });
  } else {
    // Defensive fallback — should not be reached in normal operation
    if (typeof blockUser === 'function') blockUser(phone, name);
    else removeFriend(phone);
    renderFriendsList();
  }
}

// ── Add friend from call ──────────────────────────────────────────
function addFriendFromMatch(pal) {
  if (!pal) return;
  const phone   = pal.phone || pal.guftguPhone || '';
  const friends = _getFriends();
  if (phone && friends.some(f => f.phone === phone)) return;
  friends.unshift({ phone, name:pal.name||pal.nickname||'Anonymous', avatar:pal.avatar||'cat', mood:pal.mood||'', moodEmoji:pal.moodEmoji||'', addedAt:Date.now() });
  _saveFriends(friends);
  if (typeof _updateProfileStats === 'function') _updateProfileStats();
}

// ── Firebase listeners ────────────────────────────────────────────
function _listenFriendRequests() {
  if (!fbDb || !state.guftguPhone) return;
  const ref = fbDb.ref('friendRequests/' + state.guftguPhone);

  if (_friendReqListener) ref.off('value', _friendReqListener);
  if (_friendAccListener && _friendAccRef) _friendAccRef.off('value', _friendAccListener);

  _friendReqListener = ref.on('value', snap => {
    if (!snap.exists()) return;
    const pending = _getPending();
    let changed   = false;
    snap.forEach(child => {
      const req       = child.val();
      const fromPhone = req.from;
      // Silently drop requests from blocked users
      if (typeof _isBlocked === 'function' && _isBlocked(fromPhone)) { child.ref.remove(); return; }
      if (!pending.some(p => p.phone === fromPhone)) {
        pending.push({ phone:fromPhone, name:req.name||'Anonymous', avatar:req.avatar||'cat', mood:req.mood||'', moodEmoji:req.moodEmoji||'', direction:'incoming', timestamp:req.timestamp||Date.now() });
        changed = true;
      }
    });
    if (changed) { _savePending(pending); renderPendingList(); _updatePendingBadge(); }
  });

  _friendAccRef      = fbDb.ref('friendAccepted/' + state.guftguPhone);
  _friendAccListener = _friendAccRef.on('value', snap => {
    if (!snap.exists()) return;
    const friends = _getFriends();
    let pending   = _getPending();
    let changed   = false;
    snap.forEach(child => {
      const acc       = child.val();
      const fromPhone = acc.from;
      if (!friends.some(f => f.phone === fromPhone)) {
        friends.unshift({ phone:fromPhone, name:acc.name||'Anonymous', avatar:acc.avatar||'cat', mood:acc.mood||'', moodEmoji:acc.moodEmoji||'', addedAt:Date.now() });
        changed = true;
      }
      pending = pending.filter(p => p.phone !== fromPhone);
      child.ref.remove();
    });
    if (changed) {
      _saveFriends(friends); _savePending(pending);
      renderFriendsList(); renderPendingList(); _updatePendingBadge();
      if (typeof _updateProfileStats === 'function') _updateProfileStats();
    }
  });
}

// ── Open chat — friends always have access (Req 4) ────────────────
function _openFriendChat(friend) {
  state.currentPal = { name:friend.name, avatar:friend.avatar, mood:friend.mood, moodEmoji:friend.moodEmoji, phone:friend.phone };
  openChat(friend.avatar, friend.name, '', friend.mood);
}

// ── Helpers ───────────────────────────────────────────────────────
function _timeAgo(ts) {
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
function _esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}