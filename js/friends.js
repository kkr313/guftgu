// js/friends.js — Chats screen: Friends list + Pending requests
// ═══════════════════════════════════════════════════════════════

const FRIENDS_KEY   = 'guftgu_friends';
const PENDING_KEY   = 'guftgu_pending';
let _friendReqListener = null;

// ── Data helpers ─────────────────────────────────────────────
function _getFriends() {
  try { return JSON.parse(localStorage.getItem(FRIENDS_KEY)) || []; } catch(e){ return []; }
}
function _saveFriends(list) {
  try { localStorage.setItem(FRIENDS_KEY, JSON.stringify(list)); } catch(e){}
}
function _getPending() {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY)) || []; } catch(e){ return []; }
}
function _savePending(list) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(list)); } catch(e){}
}

// ── Tab switching ────────────────────────────────────────────
function switchChatsTab(el) {
  const panel = el.dataset.panel; // 'friends' | 'pending'
  // Update tab buttons
  document.querySelectorAll('.chats-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  // Toggle panels
  const fp = document.getElementById('panel-friends');
  const pp = document.getElementById('panel-pending');
  if (fp) fp.style.display = panel === 'friends' ? '' : 'none';
  if (pp) pp.style.display = panel === 'pending' ? '' : 'none';
}

// ── Render the whole chats screen ────────────────────────────
function renderChatsScreen() {
  renderFriendsList();
  renderPendingList();
  _updatePendingBadge();
  _listenFriendRequests();
}

// ── Friends list ─────────────────────────────────────────────
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
    const avatarHTML = f.avatar && f.avatar.startsWith('<svg')
      ? f.avatar
      : `<span style="font-size:24px">${f.avatar || '👤'}</span>`;

    const div = document.createElement('div');
    div.className = 'friend-item';
    div.innerHTML = `
      <div class="friend-avatar">${avatarHTML}</div>
      <div class="friend-info">
        <div class="friend-name">${_esc(f.name || 'Anonymous')}</div>
        <div class="friend-mood">${f.moodEmoji || ''} ${f.mood || 'Vibing'}</div>
      </div>
      <div class="friend-meta">
        <div class="friend-time">${ago}</div>
      </div>
    `;
    div.onclick = () => _openFriendChat(f);
    container.appendChild(div);
  });
}

// ── Pending list ─────────────────────────────────────────────
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
    const avatarHTML = p.avatar && p.avatar.startsWith('<svg')
      ? p.avatar
      : `<span style="font-size:22px">${p.avatar || '👤'}</span>`;

    const isIncoming = p.direction === 'incoming';
    const div = document.createElement('div');
    div.className = 'pending-item';
    div.innerHTML = `
      <div class="pending-avatar">${avatarHTML}</div>
      <div class="pending-info">
        <div class="pending-name">${_esc(p.name || 'Anonymous')}</div>
        <div class="pending-type">${isIncoming ? 'Wants to be friends' : 'Request sent'}</div>
      </div>
      <div class="pending-actions">
        ${isIncoming ? `
          <button class="pending-btn accept" onclick="acceptFriendRequest(${i})">Accept</button>
          <button class="pending-btn decline" onclick="declineFriendRequest(${i})">Decline</button>
        ` : `
          <button class="pending-btn cancel" onclick="cancelFriendRequest(${i})">Cancel</button>
        `}
      </div>
    `;
    container.appendChild(div);
  });
}

// ── Badge update ─────────────────────────────────────────────
function _updatePendingBadge() {
  const badge = document.getElementById('pendingBadge');
  if (!badge) return;
  const pending = _getPending();
  const incoming = pending.filter(p => p.direction === 'incoming');
  if (incoming.length > 0) {
    badge.textContent = incoming.length;
    badge.style.display = '';
  } else {
    badge.style.display = 'none';
  }
}

// ── Send friend request ──────────────────────────────────────
function sendFriendRequest(targetPhone, targetName, targetAvatar, targetMood, targetMoodEmoji) {
  if (!state.guftguPhone) { showToast('Set up your profile first'); return; }
  if (targetPhone === state.guftguPhone) { showToast("That's your own number!"); return; }

  // Check if already friends
  const friends = _getFriends();
  if (friends.some(f => f.phone === targetPhone)) {
    showToast('Already friends!');
    return;
  }
  // Check if already pending
  const pending = _getPending();
  if (pending.some(p => p.phone === targetPhone)) {
    showToast('Request already pending');
    return;
  }

  // Add to local pending as outgoing
  pending.push({
    phone: targetPhone,
    name: targetName || 'Anonymous',
    avatar: targetAvatar || '👤',
    mood: targetMood || '',
    moodEmoji: targetMoodEmoji || '',
    direction: 'outgoing',
    timestamp: Date.now()
  });
  _savePending(pending);

  // Push to Firebase so the other user sees it
  if (fbDb) {
    fbDb.ref('friendRequests/' + targetPhone + '/' + state.guftguPhone).set({
      from: state.guftguPhone,
      name: state.user.nickname || 'Anonymous',
      avatar: state.user.avatar || '👤',
      mood: state.user.mood || '',
      moodEmoji: state.user.moodEmoji || '',
      timestamp: Date.now()
    });
  }

  renderPendingList();
  _updatePendingBadge();
  showToast('Friend request sent!');
}

// ── Accept request ───────────────────────────────────────────
function acceptFriendRequest(index) {
  const pending = _getPending();
  const req = pending[index];
  if (!req) return;

  // Move to friends list
  const friends = _getFriends();
  friends.unshift({
    phone: req.phone,
    name: req.name,
    avatar: req.avatar,
    mood: req.mood,
    moodEmoji: req.moodEmoji,
    addedAt: Date.now()
  });
  _saveFriends(friends);

  // Remove from pending
  pending.splice(index, 1);
  _savePending(pending);

  // Notify the other user via Firebase
  if (fbDb && req.phone) {
    fbDb.ref('friendAccepted/' + req.phone + '/' + state.guftguPhone).set({
      from: state.guftguPhone,
      name: state.user.nickname || 'Anonymous',
      avatar: state.user.avatar || '👤',
      mood: state.user.mood || '',
      moodEmoji: state.user.moodEmoji || '',
      timestamp: Date.now()
    });
    // Clean up the request
    fbDb.ref('friendRequests/' + state.guftguPhone + '/' + req.phone).remove();
  }

  renderFriendsList();
  renderPendingList();
  _updatePendingBadge();
  showToast(`${req.name} is now your friend!`);
}

// ── Decline request ──────────────────────────────────────────
function declineFriendRequest(index) {
  const pending = _getPending();
  const req = pending[index];
  if (!req) return;

  pending.splice(index, 1);
  _savePending(pending);

  // Clean up Firebase
  if (fbDb && req.phone) {
    fbDb.ref('friendRequests/' + state.guftguPhone + '/' + req.phone).remove();
  }

  renderPendingList();
  _updatePendingBadge();
}

// ── Cancel outgoing request ──────────────────────────────────
function cancelFriendRequest(index) {
  const pending = _getPending();
  const req = pending[index];
  if (!req) return;

  pending.splice(index, 1);
  _savePending(pending);

  // Clean up Firebase
  if (fbDb && req.phone) {
    fbDb.ref('friendRequests/' + req.phone + '/' + state.guftguPhone).remove();
  }

  renderPendingList();
  _updatePendingBadge();
}

// ── Remove friend ────────────────────────────────────────────
function removeFriend(phone) {
  let friends = _getFriends();
  friends = friends.filter(f => f.phone !== phone);
  _saveFriends(friends);
  renderFriendsList();
  showToast('Friend removed');
}

// ── Add friend from chat match (auto-add after good call) ───
function addFriendFromMatch(pal) {
  if (!pal) return;
  const phone = pal.phone || pal.guftguPhone || '';
  const friends = _getFriends();
  if (phone && friends.some(f => f.phone === phone)) return; // already friends

  friends.unshift({
    phone: phone,
    name: pal.name || pal.nickname || 'Anonymous',
    avatar: pal.avatar || '👤',
    mood: pal.mood || '',
    moodEmoji: pal.moodEmoji || '',
    addedAt: Date.now()
  });
  _saveFriends(friends);
}

// ── Listen for incoming friend requests via Firebase ─────────
function _listenFriendRequests() {
  if (!fbDb || !state.guftguPhone) return;
  const ref = fbDb.ref('friendRequests/' + state.guftguPhone);

  // Clean up old listener
  if (_friendReqListener) ref.off('value', _friendReqListener);

  _friendReqListener = ref.on('value', snap => {
    if (!snap.exists()) return;
    const pending = _getPending();
    let changed = false;

    snap.forEach(child => {
      const req = child.val();
      const fromPhone = req.from;
      // Don't duplicate
      if (!pending.some(p => p.phone === fromPhone)) {
        pending.push({
          phone: fromPhone,
          name: req.name || 'Anonymous',
          avatar: req.avatar || '👤',
          mood: req.mood || '',
          moodEmoji: req.moodEmoji || '',
          direction: 'incoming',
          timestamp: req.timestamp || Date.now()
        });
        changed = true;
      }
    });

    if (changed) {
      _savePending(pending);
      renderPendingList();
      _updatePendingBadge();
    }
  });

  // Also listen for accepted requests
  const accRef = fbDb.ref('friendAccepted/' + state.guftguPhone);
  accRef.on('value', snap => {
    if (!snap.exists()) return;
    const friends = _getFriends();
    let pending = _getPending();
    let changed = false;

    snap.forEach(child => {
      const acc = child.val();
      const fromPhone = acc.from;
      if (!friends.some(f => f.phone === fromPhone)) {
        friends.unshift({
          phone: fromPhone,
          name: acc.name || 'Anonymous',
          avatar: acc.avatar || '👤',
          mood: acc.mood || '',
          moodEmoji: acc.moodEmoji || '',
          addedAt: Date.now()
        });
        changed = true;
      }
      // Remove from our pending outgoing
      pending = pending.filter(p => p.phone !== fromPhone);
      // Clean up Firebase node
      child.ref.remove();
    });

    if (changed) {
      _saveFriends(friends);
      _savePending(pending);
      renderFriendsList();
      renderPendingList();
      _updatePendingBadge();
    }
  });
}

// ── Open chat with friend ────────────────────────────────────
function _openFriendChat(friend) {
  // Set as current pal and open chat/call screen
  state.currentPal = {
    name: friend.name,
    avatar: friend.avatar,
    mood: friend.mood,
    moodEmoji: friend.moodEmoji,
    phone: friend.phone
  };

  // If we have their phone, offer direct call
  if (friend.phone && typeof directCallByPhone === 'function') {
    directCallByPhone(friend.phone);
  } else {
    // Fall back to chat screen
    if (typeof showScreen === 'function') showScreen('screen-chat');
  }
}

// ── Time ago helper ──────────────────────────────────────────
function _timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  const days = Math.floor(hrs / 24);
  if (days < 7) return days + 'd ago';
  return Math.floor(days / 7) + 'w ago';
}

// ── Escape HTML ──────────────────────────────────────────────
function _esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ═══════════════════════════════════════════════════════════════
