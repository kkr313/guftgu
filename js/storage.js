// js/storage.js - LocalStorage persistence

const STORAGE_KEY = 'guftgu_user_v1';

// Collision-safe ID: timestamp + random suffix = guaranteed unique
function genGuftguPhone() {
  const ts   = Date.now().toString().slice(-5); // last 5 digits of timestamp
  const rand = Math.floor(10 + Math.random() * 90); // 2 random digits
  return ts + rand; // 7-digit number, time-based = no collision
}

function saveUser() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      user:        state.user,
      guftguPhone: state.guftguPhone,
    }));
  } catch(e) {}
}

function loadUser() {
  try {
    const raw  = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data.user || !data.user.nickname || !data.guftguPhone) return false;
    state.user       = { ...state.user, ...data.user };
    state.guftguPhone = data.guftguPhone;
    state.palcode    = data.guftguPhone;
    return true;
  } catch(e) { return false; }
}