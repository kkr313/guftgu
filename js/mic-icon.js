// js/mic-icon.js
// Replace every SVG mic icon in the DOM with the 🎙️ emoji.
// Runs on DOMContentLoaded — no static HTML changes needed.

(function replaceMicIcons() {

  function run() {

    // 1. Logo icon in onboarding header
    document.querySelectorAll('.logo-icon svg').forEach(function(svg) {
      svg.outerHTML = '<span style="font-size:26px;line-height:1;display:flex;align-items:center;justify-content:center;">🎙️</span>';
    });

    // 2. Find My Vibe / Start Guftgu button icon
    document.querySelectorAll('.find-btn-icon svg, .find-btn-icon').forEach(function(el) {
      if (el.tagName === 'svg') {
        el.outerHTML = '<span style="font-size:26px;line-height:1;">🎙️</span>';
      } else if (el.tagName !== 'SPAN' && !el.querySelector('svg')) {
        // already has emoji text, skip
      }
    });
    // Also handle span that contains the svg
    document.querySelectorAll('.find-btn-icon').forEach(function(span) {
      if (span.querySelector('svg')) {
        span.innerHTML = '<span style="font-size:26px;line-height:1;">🎙️</span>';
      }
    });

    // 3. App info screen logo
    document.querySelectorAll('.appinfo-logo').forEach(function(el) {
      if (el.querySelector('svg')) {
        el.innerHTML = '🎙️';
      }
    });

    // 4. Mute button on call screen — replace SVG but keep it small
    var muteBtn = document.getElementById('muteBtn');
    if (muteBtn && muteBtn.querySelector('svg')) {
      muteBtn.querySelector('svg').outerHTML = '<span style="font-size:22px;line-height:1;">🎙️</span>';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }

})();