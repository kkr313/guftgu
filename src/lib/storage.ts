// Storage helpers for localStorage persistence
import { playNotifSound } from './sounds';

const STORAGE_KEY = 'guftgu_user_v1';
const CALL_HISTORY_KEY = 'guftgu_call_history';
const FRIENDS_KEY = 'guftgu_friends';
const PENDING_KEY = 'guftgu_pending';
const BLOCKED_KEY = 'guftgu_blocked';
const CONVERSATIONS_KEY = 'guftgu_conversations';
const NOTIFS_KEY = 'guftgu_notifications';

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

export interface ChatConversation {
  phone: string;
  name: string;
  avatar: string;
  lastMessage: string;
  lastMessageTime: number;
  unreadCount: number;
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
const CALL_HISTORY_RETENTION_MS = 24 * 60 * 60 * 1000; // 24 hours

// Call History
export function getCallHistory(): CallRecord[] {
  try {
    const calls: CallRecord[] = JSON.parse(localStorage.getItem(CALL_HISTORY_KEY) || '[]');
    // Filter out calls older than 24 hours
    const cutoff = Date.now() - CALL_HISTORY_RETENTION_MS;
    return calls.filter(c => c.timestamp && c.timestamp > cutoff);
  } catch (_) { return []; }
}

export function saveCallToHistory(record: Omit<CallRecord, 'time'>): void {
  // Deduplication: skip if we already have ANY call from same phone within 10 seconds
  // This prevents multiple entries like Declined + Missed for the same call
  const existingCalls = getCallHistory();
  const now = Date.now();
  const recentCall = existingCalls.find(c => 
    c.phone === record.phone && 
    c.timestamp && 
    (now - c.timestamp) < 10000
  );
  if (recentCall) {
    console.log('[saveCallToHistory] Skipping - recent call exists:', recentCall.type, 'for', record.phone, 'new type:', record.type);
    return;
  }

  const fullRecord: CallRecord = {
    ...record,
    time: formatRelativeTime(record.callStartedAt || record.timestamp),
  };
  // Get fresh list and add
  let calls = getCallHistory();
  // Only add if within 24-hour window
  if (record.timestamp && record.timestamp > Date.now() - CALL_HISTORY_RETENTION_MS) {
    calls.unshift(fullRecord);
    console.log('[saveCallToHistory] Saved:', record.type, 'for', record.phone);
  }
  calls = calls.slice(0, 50);
  try {
    localStorage.setItem(CALL_HISTORY_KEY, JSON.stringify(calls));
    window.dispatchEvent(new Event('callHistoryUpdate'));
  } catch (_) { /* ignore */ }

  // Auto-create a notification for missed calls
  if (record.type === 'Missed') {
    addNotif({
      type: 'missed_call',
      icon: '📵',
      title: 'Missed Call',
      body: `<b>${record.name || 'Someone'}</b> tried to call you`,
      time: record.callStartedAt || record.timestamp,
      unread: true,
      meta: { phone: record.phone || '', avatar: record.avatar || 'cat' },
    });
  }
}

export function clearCallHistory(): void {
  try { 
    localStorage.removeItem(CALL_HISTORY_KEY);
    window.dispatchEvent(new Event('callHistoryUpdate'));
  } catch (_) { /* ignore */ }
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

// Chat Conversations
export function getChatConversations(): ChatConversation[] {
  try { return JSON.parse(localStorage.getItem(CONVERSATIONS_KEY) || '[]'); } catch (_) { return []; }
}

export function saveChatConversations(list: ChatConversation[]): void {
  try {
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event('conversationsUpdate'));
  } catch (_) { /* ignore */ }
}

export function deleteChatConversation(phone: string): void {
  const convos = getChatConversations().filter(c => c.phone !== phone);
  saveChatConversations(convos);
}

export function clearAllConversations(): void {
  try { localStorage.removeItem(CONVERSATIONS_KEY); } catch (_) { /* ignore */ }
}

/** Sum of unreadCount across all conversations */
export function getTotalUnreadMessages(): number {
  return getChatConversations().reduce((acc, c) => acc + (c.unreadCount || 0), 0);
}

/**
 * Increment unread count for a conversation.
 * Call this when a message arrives while the user is NOT inside that chat.
 */
export function bumpUnreadCount(phone: string): void {
  const convos = getChatConversations();
  const idx = convos.findIndex(c => c.phone === phone);
  if (idx >= 0) {
    convos[idx] = { ...convos[idx], unreadCount: (convos[idx].unreadCount || 0) + 1 };
    saveChatConversations(convos); // auto-dispatches conversationsUpdate
  }
}

/** Reset unread count to 0 for a conversation (call when user opens it) */
export function clearUnreadCount(phone: string): void {
  const convos = getChatConversations();
  const idx = convos.findIndex(c => c.phone === phone);
  if (idx >= 0 && convos[idx].unreadCount > 0) {
    convos[idx] = { ...convos[idx], unreadCount: 0 };
    saveChatConversations(convos);
  }
}

// ── Notifications ────────────────────────────────────────────

export type NotifType = 'welcome' | 'friend_request' | 'friend_accepted' | 'missed_call' | 'app_update';

export interface NotifRecord {
  id: string;
  type: NotifType;
  icon: string;
  title: string;
  body: string;
  time: number;
  unread: boolean;
  meta?: Record<string, string>; // extra data e.g. { phone, avatar }
}

export function getNotifs(): NotifRecord[] {
  try { return JSON.parse(localStorage.getItem(NOTIFS_KEY) || '[]'); } catch (_) { return []; }
}

export function saveNotifs(list: NotifRecord[]): void {
  try {
    localStorage.setItem(NOTIFS_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event('notifsUpdate'));
  } catch (_) { /* ignore */ }
}

export function addNotif(notif: Omit<NotifRecord, 'id'>): void {
  const list = getNotifs();
  // Prevent duplicates by id prefix
  const exists = list.some(n => n.type === notif.type &&
    notif.meta?.phone && n.meta?.phone === notif.meta?.phone &&
    Math.abs(n.time - notif.time) < 60_000);
  if (exists) return;
  const full: NotifRecord = { ...notif, id: `${notif.type}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` };
  list.unshift(full);
  saveNotifs(list.slice(0, 100)); // keep max 100
  // Play sound when a notification is successfully added
  if (notif.type !== 'welcome' && notif.type !== 'app_update') {
    playNotifSound();
  }
}

export function getUnreadNotifCount(): number {
  return getNotifs().filter(n => n.unread).length;
}

export function markAllNotifsRead(): void {
  const list = getNotifs().map(n => ({ ...n, unread: false }));
  saveNotifs(list);
}

export function clearAllNotifs(): void {
  try { localStorage.removeItem(NOTIFS_KEY); window.dispatchEvent(new Event('notifsUpdate')); } catch (_) { /* ignore */ }
}

/** Seed the one-time welcome notification (idempotent). */
export function seedWelcomeNotif(): void {
  const list = getNotifs();
  if (list.some(n => n.type === 'welcome')) return; // already seeded
  addNotif({
    type: 'welcome',
    icon: '🎉',
    title: 'Welcome to Guftgu!',
    body: 'Start matching to connect with people across India.',
    time: Date.now(),
    unread: true,
  });
}

export function clearAllData(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(CALL_HISTORY_KEY);
    localStorage.removeItem(FRIENDS_KEY);
    localStorage.removeItem(PENDING_KEY);
    localStorage.removeItem(BLOCKED_KEY);
    localStorage.removeItem(CONVERSATIONS_KEY);
    localStorage.removeItem(NOTIFS_KEY);
    localStorage.removeItem('guftgu_welcomed');
  } catch (_) { /* ignore */ }
}
