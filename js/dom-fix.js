// js/dom-fix.js — Must be FIRST script tag
// ─────────────────────────────────────────────────────────────────
// WHAT THIS DOES:
//
// 1. Moves #mainNav and #toast OUTSIDE #app so they are not clipped
//    by overflow:hidden. These live in the body flex column.
//    (Fixes Samsung Internet, Android WebView, UC Browser)
//
// 2. Leaves modal overlays (#moodModal, #langModal, etc.) INSIDE #app.
//    They use position:absolute so #app's overflow:hidden clips them
//    to exactly the app width — no max-width juggling needed.
//
// 3. Upgrades incoming call overlay HTML to responsive structure.
//
// 4. Hard-forces .welcome-ob-cta visible after 500ms (animation fallback).
// ─────────────────────────────────────────────────────────────────
(function domFix() {

  function applyFixes() {
    var app = document.getElementById('app');

    // Fix 1: Move nav + toast outside #app (these are NOT overlays)
    if (app) {
      ['mainNav', 'toast'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el && el.parentElement === app) {
          app.parentNode.insertBefore(el, app.nextSibling);
        }
      });
    }

    // Fix 2: Ensure modal overlays are INSIDE #app (move back if needed)
    // They use position:absolute so they need to be inside the 420px container
    if (app) {
      ['moodModal','langModal','regionModal','avatarModal','deleteAccountModal',
       'fbSetupModal','incomingCallOverlay'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el && el.parentElement !== app) {
          app.appendChild(el);
        }
      });
    }

    // Fix 3: Upgrade incoming call overlay to responsive structure
    var inc = document.getElementById('incomingCallOverlay');
    if (inc && !inc.dataset.upgraded) {
      inc.dataset.upgraded = '1';
      inc.innerHTML = [
        '<div class="inc-label">Incoming Call \uD83D\uDCDE</div>',
        '<div class="inc-avatar" id="incAvatar"></div>',
        '<div class="inc-name" id="incName">Unknown</div>',
        '<div class="inc-mood" id="incMood">Calling...</div>',
        '<div class="inc-actions">',
          '<div class="inc-action-group">',
            '<button class="inc-btn decline" onclick="rejectIncomingCall()">\uD83D\uDCF5</button>',
            '<div class="inc-action-label">Decline</div>',
          '</div>',
          '<div class="inc-action-group">',
            '<button class="inc-btn answer" onclick="answerIncomingCall()">\uD83D\uDCDE</button>',
            '<div class="inc-action-label">Answer</div>',
          '</div>',
        '</div>',
      ].join('');
    }

    // Fix 4: Welcome CTA button hard-visible fallback
    var cta = document.querySelector('#screen-welcome .welcome-ob-cta');
    if (cta) { setTimeout(function() { cta.style.opacity = '1'; }, 500); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyFixes);
  } else {
    applyFixes();
  }

  // Re-run when welcome screen becomes active
  document.addEventListener('DOMContentLoaded', function() {
    var observer = new MutationObserver(function(mutations) {
      for (var i = 0; i < mutations.length; i++) {
        if (mutations[i].target.id === 'screen-welcome') { applyFixes(); return; }
      }
    });
    var body = document.body;
    if (body) observer.observe(body, { subtree: true, attributes: true, attributeFilter: ['class'] });
  });

})();