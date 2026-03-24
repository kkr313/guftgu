// Storage helpers for localStorage persistence

const STORAGE_KEY = 'guftgu_user_v1';
const CALL_HISTORY_KEY = 'guftgu_call_history';
const FRIENDS_KEY = 'guftgu_friends';
const PENDING_KEY = 'guftgu_pending';
const BLOCKED_KEY = 'guftgu_blocked';

export interface UserData {
  nickname: string;
  avatar: string;
  mood: string;
  moodEmoji: string;
  language: string;
  region: string;
  intent: string;
}

export interface StoredData {
  user: UserData;
  guftguPhone: string;
}

export interface CallRecord {
  avatar: string;
  name: string;
  mood: string;
  duration: string;
  type: string;
  time: string;
  timestamp: number;
}

export interface FriendRecord {
  phone: string;
  name: string;
  avatar: string;
  mood: string;
  moodEmoji: string;
  addedAt: number;
}

export interface PendingRecord {
  phone: string;
  name: string;
  avatar: string;
  mood: string;
  moodEmoji: string;
  direction: 'incoming' | 'outgoing';
  timestamp: number;
}

export interface BlockedRecord {
  phone: string;
  name: string;
  avatar: string;
  blockedAt: number;
}

// Collision-safe ID: timestamp + random suffix
export function genGuftguPhone(): string {
  const ts = Date.now().toString().slice(-5);
  const rand = Math.floor(10 + Math.random() * 90);
  return ts + '' + rand;
}

export function saveUser(user: UserData, guftguPhone: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, guftguPhone }));
  } catch (_) { /* ignore */ }
}

export function loadUser(): StoredData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as StoredData;
    if (!data.user || !data.user.nickname || !data.guftguPhone) return null;
    return data;
  } catch (_) { return null; }
}

// Call History
export function getCallHistory(): CallRecord[] {
  try { return JSON.parse(localStorage.getItem(CALL_HISTORY_KEY) || '[]'); } catch (_) { return []; }
}

export function saveCallToHistory(record: CallRecord): void {
  let calls = getCallHistory();
  calls.unshift(record);
  calls = calls.slice(0, 50);
  try { localStorage.setItem(CALL_HISTORY_KEY, JSON.stringify(calls)); } catch (_) { /* ignore */ }
}

// Friends
export function getFriends(): FriendRecord[] {
  try { return JSON.parse(localStorage.getItem(FRIENDS_KEY) || '[]'); } catch (_) { return []; }
}

export function saveFriends(list: FriendRecord[]): void {
  try { localStorage.setItem(FRIENDS_KEY, JSON.stringify(list)); } catch (_) { /* ignore */ }
}

// Pending
export function getPending(): PendingRecord[] {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]'); } catch (_) { return []; }
}

export function savePending(list: PendingRecord[]): void {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(list)); } catch (_) { /* ignore */ }
}

// Blocked
export function getBlocked(): BlockedRecord[] {
  try {
    const raw = JSON.parse(localStorage.getItem(BLOCKED_KEY) || '[]');
    return raw.map((e: string | BlockedRecord) =>
      typeof e === 'string' ? { phone: e, name: 'Unknown', avatar: 'cat', blockedAt: 0 } : e
    );
  } catch (_) { return []; }
}

export function saveBlocked(list: BlockedRecord[]): void {
  try { localStorage.setItem(BLOCKED_KEY, JSON.stringify(list)); } catch (_) { /* ignore */ }
}

export function isBlocked(phone: string): boolean {
  if (!phone) return false;
  return getBlocked().some(e => e.phone === phone);
}

export function clearAllData(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(CALL_HISTORY_KEY);
    localStorage.removeItem(FRIENDS_KEY);
    localStorage.removeItem(PENDING_KEY);
    localStorage.removeItem(BLOCKED_KEY);
    localStorage.removeItem('guftgu_welcomed');
  } catch (_) { /* ignore */ }
}
