// js/storage.js - LocalStorage persistence
// LOCALSTORAGE — 1 Browser = 1 Account
// ═══════════════════════════════════════
const STORAGE_KEY = 'guftgu_user_v1';

function genGuftguPhone() {
  return String(Math.floor(1000000 + Math.random() * 9000000));
}

function saveUser() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      user: state.user,
      guftguPhone: state.guftguPhone,
    }));
  } catch(e) {}
}

function loadUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data.user || !data.user.nickname || !data.guftguPhone) return false;
    state.user = { ...state.user, ...data.user };
    state.guftguPhone = data.guftguPhone;
    state.palcode = data.guftguPhone;
    return true;
  } catch(e) { return false; }
}

