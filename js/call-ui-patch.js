// js/call-ui-patch.js — load AFTER call.js
// Removes ALL "Calling...", "CONNECTING", "RINGING" popups from call screen.

(function patchCallUI() {

  var CALL_STATUS_TEXTS = [
    'CONNECTING', 'CONNECTING...', 'WAITING...', 'RINGING...',
    'JOINING...', 'FAILED', 'CONNECTED', 'MIC ERROR',
    'Joining call...', 'Waiting for someone to join...',
    'Share this code'
  ];

  // ── Silence _txt for callStatus and code elements ────────────────
  function _patchTxt() {
    if (typeof _txt !== 'function' || _txt._cp) return;
    var o = _txt;
    _txt = function(id, val) {
      if (id === 'callStatus' || id === 'callCodeDisplay' || id === 'callCodeHint') return;
      o(id, val);
    };
    _txt._cp = true;
  }

  // ── Silence _show for callStatus and callCodeSection ─────────────
  function _patchShow() {
    if (typeof _show !== 'function' || _show._cp) return;
    var o = _show;
    _show = function(id, vis) {
      if (id === 'callStatus' || id === 'callCodeSection') return;
      o(id, vis);
    };
    _show._cp = true;
  }

  // ── Silence _val for callJoinInput ───────────────────────────────
  function _patchVal() {
    if (typeof _val !== 'function' || _val._cp) return;
    var o = _val;
    _val = function(id, val) {
      if (id === 'callJoinInput') return;
      o(id, val);
    };
    _val._cp = true;
  }

  // ── Silence showToast for call-related messages ──────────────────
  function _patchToast() {
    if (typeof showToast !== 'function' || showToast._cp) return;
    var o = showToast;
    showToast = function(msg) {
      if (typeof msg === 'string') {
        // Block "📞 Calling X..." and "Joining call..." toasts only
        if (msg.indexOf('Calling ') !== -1 && msg.indexOf('📞') !== -1) return;
        if (msg === 'Joining call...') return;
      }
      o(msg);
    };
    showToast._cp = true;
  }

  // ── Remove DOM elements + inject Add Friend ──────────────────────
  function patchDOM() {
    // Remove callStatus element fully
    var st = document.getElementById('callStatus');
    if (st) st.remove();

    // Remove callCodeSection fully
    var cs = document.getElementById('callCodeSection');
    if (cs) cs.remove();

    // Inject Add Friend chip above controls if missing
    var content = document.querySelector('#screen-call .call-content');
    if (content && !document.getElementById('callAddFriendBtn')) {
      var controls = content.querySelector('.call-controls');
      if (controls) {
        var btn = document.createElement('div');
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

  // ── Wrap call functions to re-run patchDOM after they execute ────
  function _wrapFn(name) {
    if (typeof window[name] !== 'function' || window[name]._cp) return;
    var o = window[name];
    window[name] = function() {
      var r = o.apply(this, arguments);
      setTimeout(patchDOM, 30);
      setTimeout(patchDOM, 200);
      return r;
    };
    window[name]._cp = true;
  }

  // ── Init ─────────────────────────────────────────────────────────
  function init() {
    _patchTxt();
    _patchShow();
    _patchVal();
    _patchToast();
    patchDOM();
    ['startVoiceCall', 'directCallByPhone', 'answerIncomingCall', 'joinCallByCode'].forEach(_wrapFn);
  }

  // Patch helpers immediately (before DOMContentLoaded)
  _patchTxt();
  _patchShow();
  _patchVal();
  _patchToast();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Watch for call screen becoming active
  document.addEventListener('DOMContentLoaded', function() {
    var obs = new MutationObserver(function(muts) {
      for (var i = 0; i < muts.length; i++) {
        var t = muts[i].target;
        if (t.id === 'screen-call' && t.classList.contains('active')) {
          setTimeout(patchDOM, 30);
          setTimeout(patchDOM, 200);
          return;
        }
      }
    });
    var body = document.body;
    if (body) obs.observe(body, { subtree: true, attributes: true, attributeFilter: ['class'] });
  });

})();