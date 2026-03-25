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
  phone?: string; // Added to identify caller
  mood: string;
  duration: string;
  type: 'Outgoing' | 'Incoming' | 'Missed' | 'Declined' | 'Blocked';
  time: string;
  timestamp: number;
  callStartedAt?: number; // When the call actually started (for relative time display)
}

export interface FriendRecord {
  phone: string;
  name: string;
  nickname?: string;  // Local-only alias set by user (e.g. real name)
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
  nickname?: string;  // Preserved from friend nickname when blocked
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

// Helper to format relative time
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  
  // Format as date
  const date = new Date(timestamp);
  return date.toLocaleDateString();
}

// Call History
export function getCallHistory(): CallRecord[] {
  try { return JSON.parse(localStorage.getItem(CALL_HISTORY_KEY) || '[]'); } catch (_) { return []; }
}

export function saveCallToHistory(record: Omit<CallRecord, 'time'>): void {
  const fullRecord: CallRecord = {
    ...record,
    time: formatRelativeTime(record.callStartedAt || record.timestamp),
  };
  let calls = getCallHistory();
  calls.unshift(fullRecord);
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

/** Look up a friend's nickname by phone. Returns nickname if set, otherwise the fallback name. */
export function getDisplayName(phone: string, fallbackName: string): string {
  const friends = getFriends();
  const friend = friends.find(f => f.phone === phone);
  if (friend?.nickname) return friend.nickname;
  return fallbackName;
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
