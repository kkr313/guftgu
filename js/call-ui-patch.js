// js/call-ui-patch.js — load AFTER call.js
// Removes the "CONNECTING / RINGING / WAITING" status text elements
// from the call screen DOM so they never show.
//
// FIX: Previous version patched _txt() to silently swallow writes to
// 'callStatus', which also prevented startCallTimer() from working
// when triggered from createPC()'s oniceconnectionstatechange handler.
// We now remove the DOM element entirely instead — no function patching.

(function patchCallUI() {

  // ── Silence toast messages that reveal internal call plumbing ────
  function _patchToast() {
    if (typeof showToast !== 'function' || showToast._callPatch) return;
    const o = showToast;
    showToast = function(msg) {
      if (typeof msg === 'string') {
        if (msg.indexOf('📞 Calling ') !== -1) return;
        if (msg === 'Joining call...')          return;
      }
      o(msg);
    };
    showToast._callPatch = true;
  }

  // ── Remove the callStatus + callCodeSection DOM nodes ─────────────
  // Instead of patching _txt/_show (which had side-effects on timer start),
  // we just nuke the elements so nothing can accidentally render them.
  function patchDOM() {
    const st = document.getElementById('callStatus');
    if (st) st.remove();

    const cs = document.getElementById('callCodeSection');
    if (cs) cs.remove();

    // Inject Add Friend chip above controls if not already present
    const content = document.querySelector('#screen-call .call-content');
    if (content && !document.getElementById('callAddFriendBtn')) {
      const controls = content.querySelector('.call-controls');
      if (controls) {
        const btn = document.createElement('div');
        btn.id        = 'callAddFriendBtn';
        btn.className = 'call-add-friend';
        btn.setAttribute('onclick', 'addFriendFromCall()');
        btn.innerHTML =
          '<span class="call-add-friend-icon">🤝</span>' +
          '<span class="call-add-friend-text" id="callAddFriendText">+ Add Friend</span>';
        content.insertBefore(btn, controls);
      }
    }
  }

  // ── Re-run patchDOM whenever the call screen becomes active ──────
  function _watchCallScreen() {
    const obs = new MutationObserver(mutations => {
      for (const m of mutations) {
        if (m.target.id === 'screen-call' && m.target.classList.contains('active')) {
          setTimeout(patchDOM, 30);
          setTimeout(patchDOM, 200);
          return;
        }
      }
    });
    const body = document.body;
    if (body) obs.observe(body, { subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  // ── Init ──────────────────────────────────────────────────────────
  function init() {
    _patchToast();
    patchDOM();
    _watchCallScreen();
  }

  _patchToast(); // patch toast immediately even before DOM ready

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();