// js/app-init.js - App boot: moves overlays outside #app, replaces mic icons

(function() {

  function boot() {
    var app = document.getElementById('app');

    // Move nav + toast outside #app so overflow:hidden doesn't clip them
    if (app) {
      ['mainNav', 'toast'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el && el.parentElement === app) {
          app.parentNode.insertBefore(el, app.nextSibling);
        }
      });
    }

    // Replace all SVG mic icons with 🎙️ emoji
    document.querySelectorAll('.logo-icon svg').forEach(function(svg) {
      svg.outerHTML = '<span style="font-size:26px;line-height:1;display:flex;align-items:center;justify-content:center;">🎙️</span>';
    });
    document.querySelectorAll('.find-btn-icon').forEach(function(el) {
      if (el.querySelector('svg')) el.innerHTML = '<span style="font-size:26px;line-height:1;">🎙️</span>';
    });
    document.querySelectorAll('.appinfo-logo').forEach(function(el) {
      if (el.querySelector('svg')) el.innerHTML = '🎙️';
    });
    var muteBtn = document.getElementById('muteBtn');
    if (muteBtn && muteBtn.querySelector('svg')) {
      muteBtn.querySelector('svg').outerHTML = '<span style="font-size:22px;line-height:1;">🎙️</span>';
    }

    // Welcome screen: guarantee CTA button visible after 500ms
    var cta = document.querySelector('#screen-welcome .welcome-ob-cta');
    if (cta) setTimeout(function() { cta.style.opacity = '1'; }, 500);

    // Clean up stale Firebase queue entries on load
    if (typeof fbDb !== 'undefined' && fbDb && state && state.guftguPhone) {
      fbDb.ref('matchProposals/' + state.guftguPhone).remove().catch(function(){});
      fbDb.ref('matchQueue').once('value', function(snap) {
        if (!snap.exists()) return;
        var now = Date.now();
        snap.forEach(function(child) {
          var e = child.val();
          if (e && e.ts && (now - e.ts) > 120000) child.ref.remove();
        });
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();