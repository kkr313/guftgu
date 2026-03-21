// js/chat.js - Chat screen logic

// ═══════════════════════════════════════
// CHAT
// ═══════════════════════════════════════
let typingTimeout;

function openChat(avatar, name, preview, mood) {
  state.currentPal = { avatar, name, mood, moodEmoji: moodEmojis[mood] || '😊' };
  setAvatarEl('chatHeaderAvatar', avatar);
  _txt('chatHeaderName', name);

  // Save to recent chats
  saveRecentChat(avatar, name, preview || 'Tap to continue chatting', mood);

  // Clear and init messages
  const msgs = document.getElementById('chatMessages');
  msgs.innerHTML = '<div class="msg-system">🔒 Anonymous chat — no personal info is shared</div>';

  // Add initial greeting from pal
  setTimeout(() => {
    const greets = ['Hey there! 👋','Hello! How are you?','Hi! Happy to chat 😊','Hey! What\'s on your mind?'];
    addMessage(greets[Math.floor(Math.random()*greets.length)], false, avatar);
  }, 800);

  showScreen('screen-chat');
}

function addMessage(text, isMine, avatar) {
  const msgs = document.getElementById('chatMessages');
  const row = document.createElement('div');
  row.className = 'msg-row' + (isMine ? ' mine' : '');

  const now = new Date();
  const time = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');

  if (!isMine) {
    const av = document.createElement('div');
    av.className = 'msg-avatar-sm';
    av.textContent = avatar || (state.currentPal && state.currentPal.avatar) || '?';
    row.appendChild(av);
  }

  const wrap = document.createElement('div');
  wrap.className = 'msg-bubble-wrap';
  wrap.innerHTML = `<div class="msg-bubble">${escHtml(text)}</div><div class="msg-time">${time}</div>`;
  row.appendChild(wrap);

  msgs.appendChild(row);
  msgs.scrollTop = msgs.scrollHeight;
}

function showTyping() {
  const msgs = document.getElementById('chatMessages');
  const ty = document.createElement('div');
  ty.className = 'msg-row';
  ty.id = 'typingRow';
  ty.innerHTML = `<div class="msg-avatar-sm">${(state.currentPal && state.currentPal.avatar) || '?'}</div>
    <div class="typing-indicator">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>`;
  msgs.appendChild(ty);
  msgs.scrollTop = msgs.scrollHeight;
}

function removeTyping() {
  const ty = document.getElementById('typingRow');
  if (ty) ty.remove();
}

function sendMessage() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;
  addMessage(text, true);
  input.value = '';
  input.style.height = '';

  // Bot reply
  const mood = (state.currentPal && state.currentPal.mood) || 'Chill';
  const replies = botReplies[mood] || botReplies.Chill;
  const reply = replies[Math.floor(Math.random() * replies.length)];

  setTimeout(() => {
    showTyping();
    setTimeout(() => {
      removeTyping();
      addMessage(reply, false);
    }, 1200 + Math.random() * 800);
  }, 400);
}

function handleChatKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 80) + 'px';
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
