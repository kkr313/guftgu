// js/utils.js - Safe DOM helpers & utilities
// ── Safe DOM helpers — never throw on missing elements ──────
function _el(id)          { return document.getElementById(id); }
function _txt(id, val)    { var e=_el(id); if(e) e.textContent=val; }
function _html(id, val)   { var e=_el(id); if(e) e.innerHTML=val; }
function _val(id, val)    { var e=_el(id); if(e) e.value=val; }
function _show(id, vis)   { var e=_el(id); if(e) e.style.display=vis?'block':'none'; }
function _cls(id,m,...a)  { var e=_el(id); if(e) e.classList[m](...a); }
// ──────────────────────────────────────────────────────────────

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

let toastTimeout;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => t.classList.remove('show'), 2500);
}
