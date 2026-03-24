/**
 * Firebase Real-Time Service
 * Handles: user registration, presence, match queue, friend sync, block/report, online count
 *
 * ENABLE_FIREBASE flag in AppContext controls whether these services are active.
 * When disabled, the app falls back to localStorage-only + demo matching.
 */

import {
  Database,
  ref,
  set,
  get,
  remove,
  onValue,
  onChildAdded,
  off,
  push,
  onDisconnect,
  serverTimestamp,
} from 'firebase/database';
import { UserData, isBlocked, getBlocked, saveBlocked, BlockedRecord } from './storage';

// ══════════════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════════════

export interface QueueEntry {
  phone: string;
  name: string;
  avatar: string;
  mood: string;
  moodEmoji: string;
  language: string;
  region: string;
  intent: string;
  ts: number;
  status: 'searching' | 'matched';
  matchId?: string;
}

export interface MatchData {
  user1: QueueEntry;
  user2: QueueEntry;
  status: 'pending' | 'active' | 'ended';
  createdAt: number;
  priority: number;
  user1Response: 'accepted' | 'skipped' | null;
  user2Response: 'accepted' | 'skipped' | null;
  webrtcRoomId?: string;
}

export interface FriendRequest {
  from: string;
  name: string;
  avatar: string;
  mood: string;
  moodEmoji: string;
  timestamp: number;
}

export interface PalInfo {
  phone: string;
  name: string;
  avatar: string;
  mood: string;
  moodEmoji: string;
  language?: string;
  region?: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// PRIORITY SCORING — Language is MANDATORY
// Score 3 = lang + mood + region (best) — immediate
// Score 2 = lang + mood — unlocks after 8s
// Score 1 = lang only — unlocks after 25s
// ══════════════════════════════════════════════════════════════════════════════

const P2_MS = 8000;  // 8 seconds for priority 2
const P3_MS = 25000; // 25 seconds for priority 1

function calculatePriority(
  me: QueueEntry,
  them: QueueEntry,
  elapsed: number
): number | null {
  // Language is always mandatory
  if (me.language !== them.language) return null;

  const sameMood = me.mood === them.mood;
  const sameRegion = me.region === them.region;

  // Best: all three match — available immediately
  if (sameMood && sameRegion) return 3;

  // Good: same lang + mood — unlocks after 8s
  if (sameMood && elapsed >= P2_MS) return 2;

  // Fallback: same lang only — unlocks after 25s
  if (elapsed >= P3_MS) return 1;

  return null;
}

// ══════════════════════════════════════════════════════════════════════════════
// USER REGISTRATION + PRESENCE
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Register user profile in Firebase and set up presence tracking.
 * Called when user finishes onboarding.
 */
export async function registerUser(
  db: Database,
  phone: string,
  user: UserData
): Promise<void> {
  const userRef = ref(db, `users/${phone}`);
  await set(userRef, {
    nickname: user.nickname,
    avatar: user.avatar,
    mood: user.mood,
    moodEmoji: user.moodEmoji,
    language: user.language,
    region: user.region,
    intent: user.intent,
    lastSeen: serverTimestamp(),
    online: true,
  });

  // Set up presence — mark offline when disconnected
  const presenceRef = ref(db, `users/${phone}/online`);
  const lastSeenRef = ref(db, `users/${phone}/lastSeen`);
  onDisconnect(presenceRef).set(false);
  onDisconnect(lastSeenRef).set(serverTimestamp());
}

/**
 * Update user's online status
 */
export async function setOnlineStatus(
  db: Database,
  phone: string,
  online: boolean
): Promise<void> {
  const presenceRef = ref(db, `users/${phone}/online`);
  const lastSeenRef = ref(db, `users/${phone}/lastSeen`);
  await set(presenceRef, online);
  if (!online) {
    await set(lastSeenRef, serverTimestamp());
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// MATCH QUEUE
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Enter the match queue and start searching for a match.
 * Returns cleanup function to call when done.
 */
export function enterMatchQueue(
  db: Database,
  phone: string,
  user: UserData,
  onMatchFound: (pal: PalInfo, matchId: string, role: 'caller' | 'callee') => void,
  onQueueCount: (count: number) => void
): () => void {
  const searchStart = Date.now();

  const entry: QueueEntry = {
    phone,
    name: user.nickname || 'Anonymous',
    avatar: user.avatar || 'cat',
    mood: user.mood || 'Happy',
    moodEmoji: user.moodEmoji || '😄',
    language: user.language || 'Hindi',
    region: user.region || 'North',
    intent: user.intent || 'Just chat',
    ts: Date.now(),
    status: 'searching',
  };

  const myQueueRef = ref(db, `matchQueue/${phone}`);
  const queueRef = ref(db, 'matchQueue');
  const proposalsRef = ref(db, `matchProposals/${phone}`);

  let queueListener: ReturnType<typeof onValue> | null = null;
  let proposalListener: ReturnType<typeof onChildAdded> | null = null;
  let myEntryListener: ReturnType<typeof onValue> | null = null;
  let currentMatchId: string | null = null;
  let cleaned = false;

  // Write my entry to queue
  set(myQueueRef, entry).then(() => {
    onDisconnect(myQueueRef).remove();
  });

  // Watch entire queue — look for best match
  queueListener = onValue(queueRef, (snap) => {
    if (cleaned || !snap.exists()) return;

    const elapsed = Date.now() - searchStart;
    const queue = snap.val() as Record<string, QueueEntry>;
    let best: (QueueEntry & { phone: string }) | null = null;
    let bestPri = -1;

    // Count matchable users for queue count display
    let matchable = 0;

    for (const [p, e] of Object.entries(queue)) {
      if (p === phone) continue;
      if (e.status !== 'searching') continue;
      if (isBlocked(p)) continue;

      matchable++;

      const pri = calculatePriority(entry, e, elapsed);
      if (pri === null) continue;

      // Higher score wins; on tie prefer earlier joiner
      if (pri > bestPri || (pri === bestPri && e.ts < (best?.ts ?? Infinity))) {
        best = { ...e, phone: p };
        bestPri = pri;
      }
    }

    onQueueCount(matchable);

    if (!best) return;
    // Only lower phone proposes (prevents duplicate proposals)
    if (phone >= best.phone) return;

    // Check if proposal already exists
    const proposalPath = `matchProposals/${best.phone}/${phone}`;
    const proposalRef = ref(db, proposalPath);
    get(proposalRef).then((ex) => {
      if (ex.exists()) return;
      set(proposalRef, {
        from: phone,
        fromEntry: entry,
        priority: bestPri,
        ts: Date.now(),
      });
    });
  });

  // Listen for incoming proposals
  proposalListener = onChildAdded(proposalsRef, (snap) => {
    if (cleaned || !snap.exists()) return;
    const proposal = snap.val();
    const theirPhone = proposal.from;
    const theirEntry = proposal.fromEntry as QueueEntry;

    if (isBlocked(theirPhone)) {
      remove(snap.ref);
      return;
    }

    // Verify they're still searching
    const theirQueueRef = ref(db, `matchQueue/${theirPhone}`);
    get(theirQueueRef).then((s) => {
      if (!s.exists() || s.val().status !== 'searching') {
        remove(snap.ref);
        return;
      }

      // Create match document
      const matchId = `match_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      currentMatchId = matchId;

      const matchData: MatchData = {
        user1: { ...theirEntry, phone: theirPhone },
        user2: { ...entry, phone },
        status: 'pending',
        createdAt: Date.now(),
        priority: proposal.priority,
        user1Response: null,
        user2Response: null,
      };

      set(ref(db, `matches/${matchId}`), matchData).then(() => {
        // Update both users' queue status
        set(ref(db, `matchQueue/${phone}/status`), 'matched');
        set(ref(db, `matchQueue/${phone}/matchId`), matchId);
        set(ref(db, `matchQueue/${theirPhone}/status`), 'matched');
        set(ref(db, `matchQueue/${theirPhone}/matchId`), matchId);
        remove(snap.ref);

        onMatchFound(
          {
            phone: theirPhone,
            name: theirEntry.name,
            avatar: theirEntry.avatar,
            mood: theirEntry.mood,
            moodEmoji: theirEntry.moodEmoji,
            language: theirEntry.language,
            region: theirEntry.region,
          },
          matchId,
          'callee'
        );
      });
    });
  });

  // Watch my own queue entry for matchId set by proposer
  myEntryListener = onValue(myQueueRef, (snap) => {
    if (cleaned || !snap.exists()) return;
    const data = snap.val() as QueueEntry;
    if (data.matchId && data.status === 'matched' && data.matchId !== currentMatchId) {
      currentMatchId = data.matchId;

      // I'm the caller — get match data
      get(ref(db, `matches/${data.matchId}`)).then((mSnap) => {
        if (!mSnap.exists()) return;
        const match = mSnap.val() as MatchData;
        const pal = match.user1.phone === phone ? match.user2 : match.user1;

        onMatchFound(
          {
            phone: pal.phone,
            name: pal.name,
            avatar: pal.avatar,
            mood: pal.mood,
            moodEmoji: pal.moodEmoji,
            language: pal.language,
            region: pal.region,
          },
          data.matchId!,
          'caller'
        );
      });
    }
  });

  // Cleanup function
  return () => {
    cleaned = true;
    if (queueListener) off(queueRef, 'value', queueListener);
    if (proposalListener) off(proposalsRef, 'child_added', proposalListener);
    if (myEntryListener) off(myQueueRef, 'value', myEntryListener);
    onDisconnect(myQueueRef).cancel();
    remove(myQueueRef);
    remove(proposalsRef);
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// MATCH RESPONSE HANDLING
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Write my response (accepted/skipped) to the match document.
 */
export async function writeMatchResponse(
  db: Database,
  matchId: string,
  myPhone: string,
  response: 'accepted' | 'skipped'
): Promise<void> {
  const matchSnap = await get(ref(db, `matches/${matchId}`));
  if (!matchSnap.exists()) return;

  const match = matchSnap.val() as MatchData;
  const field = match.user1.phone === myPhone ? 'user1Response' : 'user2Response';
  await set(ref(db, `matches/${matchId}/${field}`), response);
}

/**
 * Watch match state for both-accept or skip events.
 * Returns cleanup function.
 */
export function watchMatchState(
  db: Database,
  matchId: string,
  myPhone: string,
  onBothAccepted: () => void,
  onOtherSkipped: () => void
): () => void {
  const matchRef = ref(db, `matches/${matchId}`);
  let cleaned = false;

  const listener = onValue(matchRef, (snap) => {
    if (cleaned || !snap.exists()) return;
    const data = snap.val() as MatchData;

    const myField = data.user1.phone === myPhone ? 'user1Response' : 'user2Response';
    const otherField = myField === 'user1Response' ? 'user2Response' : 'user1Response';

    // Other side skipped
    if (data[otherField] === 'skipped') {
      onOtherSkipped();
      return;
    }

    // Both accepted — start call
    if (data[myField] === 'accepted' && data[otherField] === 'accepted') {
      onBothAccepted();
    }
  });

  return () => {
    cleaned = true;
    off(matchRef, 'value', listener);
  };
}

/**
 * Set WebRTC room ID in match document (caller does this).
 */
export async function setMatchRoomId(
  db: Database,
  matchId: string,
  roomId: string
): Promise<void> {
  await set(ref(db, `matches/${matchId}/webrtcRoomId`), roomId);
}

/**
 * Watch for room ID in match document (callee does this).
 * Returns cleanup function.
 */
export function watchMatchRoomId(
  db: Database,
  matchId: string,
  onRoomId: (roomId: string) => void
): () => void {
  const roomRef = ref(db, `matches/${matchId}/webrtcRoomId`);
  let cleaned = false;

  const listener = onValue(roomRef, (snap) => {
    if (cleaned || !snap.exists() || !snap.val()) return;
    onRoomId(snap.val());
  });

  return () => {
    cleaned = true;
    off(roomRef, 'value', listener);
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// FRIEND REQUESTS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Send a friend request to another user.
 */
export async function sendFriendRequest(
  db: Database,
  myPhone: string,
  myUser: UserData,
  targetPhone: string
): Promise<void> {
  await set(ref(db, `friendRequests/${targetPhone}/${myPhone}`), {
    from: myPhone,
    name: myUser.nickname || 'Anonymous',
    avatar: myUser.avatar || 'cat',
    mood: myUser.mood || '',
    moodEmoji: myUser.moodEmoji || '',
    timestamp: Date.now(),
  });
}

/**
 * Accept a friend request — write to friendAccepted and remove from friendRequests.
 */
export async function acceptFriendRequest(
  db: Database,
  myPhone: string,
  myUser: UserData,
  requesterPhone: string
): Promise<void> {
  // Notify the requester that we accepted
  await set(ref(db, `friendAccepted/${requesterPhone}/${myPhone}`), {
    from: myPhone,
    name: myUser.nickname || 'Anonymous',
    avatar: myUser.avatar || 'cat',
    mood: myUser.mood || '',
    moodEmoji: myUser.moodEmoji || '',
    timestamp: Date.now(),
  });
  // Remove from my incoming requests
  await remove(ref(db, `friendRequests/${myPhone}/${requesterPhone}`));
}

/**
 * Decline a friend request — just remove from friendRequests.
 */
export async function declineFriendRequest(
  db: Database,
  myPhone: string,
  requesterPhone: string
): Promise<void> {
  await remove(ref(db, `friendRequests/${myPhone}/${requesterPhone}`));
}

/**
 * Cancel an outgoing friend request.
 */
export async function cancelFriendRequest(
  db: Database,
  myPhone: string,
  targetPhone: string
): Promise<void> {
  await remove(ref(db, `friendRequests/${targetPhone}/${myPhone}`));
}

/**
 * Listen for incoming friend requests.
 * Returns cleanup function.
 */
export function listenFriendRequests(
  db: Database,
  myPhone: string,
  onRequest: (request: FriendRequest & { phone: string }) => void
): () => void {
  const reqRef = ref(db, `friendRequests/${myPhone}`);
  let cleaned = false;

  const listener = onValue(reqRef, (snap) => {
    if (cleaned || !snap.exists()) return;
    snap.forEach((child) => {
      const req = child.val() as FriendRequest;
      const fromPhone = req.from;
      // Silently drop requests from blocked users
      if (isBlocked(fromPhone)) {
        remove(child.ref);
        return;
      }
      onRequest({ ...req, phone: fromPhone });
    });
  });

  return () => {
    cleaned = true;
    off(reqRef, 'value', listener);
  };
}

/**
 * Listen for accepted friend notifications.
 * Returns cleanup function.
 */
export function listenFriendAccepted(
  db: Database,
  myPhone: string,
  onAccepted: (friend: FriendRequest & { phone: string }) => void
): () => void {
  const accRef = ref(db, `friendAccepted/${myPhone}`);
  let cleaned = false;

  const listener = onValue(accRef, (snap) => {
    if (cleaned || !snap.exists()) return;
    snap.forEach((child) => {
      const acc = child.val() as FriendRequest;
      onAccepted({ ...acc, phone: acc.from });
      // Remove after processing
      remove(child.ref);
    });
  });

  return () => {
    cleaned = true;
    off(accRef, 'value', listener);
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// BLOCK & REPORT
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Block a user — write to Firebase for cross-device sync.
 */
export async function blockUserFirebase(
  db: Database,
  myPhone: string,
  targetPhone: string,
  targetName: string,
  targetAvatar: string
): Promise<void> {
  // Save to Firebase
  await set(ref(db, `blocked/${myPhone}/${targetPhone}`), {
    name: targetName || 'Unknown',
    avatar: targetAvatar || 'cat',
    blockedAt: Date.now(),
  });

  // Also save to localStorage
  const list = getBlocked();
  const filtered = list.filter((e) => e.phone !== targetPhone);
  filtered.push({
    phone: targetPhone,
    name: targetName || 'Unknown',
    avatar: targetAvatar || 'cat',
    blockedAt: Date.now(),
  });
  saveBlocked(filtered);
}

/**
 * Unblock a user.
 */
export async function unblockUserFirebase(
  db: Database,
  myPhone: string,
  targetPhone: string
): Promise<void> {
  await remove(ref(db, `blocked/${myPhone}/${targetPhone}`));
  const filtered = getBlocked().filter((e) => e.phone !== targetPhone);
  saveBlocked(filtered);
}

/**
 * Report a user.
 */
export async function reportUserFirebase(
  db: Database,
  myPhone: string,
  targetPhone: string,
  targetName: string,
  reason: string,
  matchId?: string
): Promise<void> {
  await push(ref(db, `reports/${targetPhone}`), {
    reportedBy: myPhone,
    reason: reason || 'inappropriate',
    name: targetName || 'Unknown',
    matchId: matchId || null,
    timestamp: Date.now(),
  });
}

/**
 * Sync block list from Firebase on app start.
 */
export async function syncBlockList(
  db: Database,
  myPhone: string
): Promise<void> {
  const snap = await get(ref(db, `blocked/${myPhone}`));
  if (!snap.exists()) return;

  const localList = getBlocked();
  const firebaseBlocked = snap.val() as Record<string, { name: string; avatar: string; blockedAt: number }>;

  for (const [phone, data] of Object.entries(firebaseBlocked)) {
    if (!localList.some((e) => e.phone === phone)) {
      localList.push({
        phone,
        name: data.name,
        avatar: data.avatar,
        blockedAt: data.blockedAt,
      });
    }
  }
  saveBlocked(localList);
}

// ══════════════════════════════════════════════════════════════════════════════
// ONLINE COUNT
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Watch match queue to get real online count.
 * Returns cleanup function.
 */
export function watchOnlineCount(
  db: Database,
  myPhone: string,
  onCount: (count: number) => void
): () => void {
  const queueRef = ref(db, 'matchQueue');
  let cleaned = false;

  const listener = onValue(queueRef, (snap) => {
    if (cleaned) return;
    if (!snap.exists()) {
      onCount(0);
      return;
    }

    let matchable = 0;
    snap.forEach((child) => {
      const v = child.val() as QueueEntry;
      if (!v) return;
      if (v.phone === myPhone) return;
      if (isBlocked(v.phone)) return;
      matchable++;
    });

    onCount(matchable);
  });

  return () => {
    cleaned = true;
    off(queueRef, 'value', listener);
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// CLEANUP MATCH
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Clean up match document and queue entries after call ends.
 */
export async function cleanupMatch(
  db: Database,
  matchId: string,
  myPhone: string
): Promise<void> {
  // Remove from queue
  await remove(ref(db, `matchQueue/${myPhone}`));
  // Remove my proposals
  await remove(ref(db, `matchProposals/${myPhone}`));
  // Optionally mark match as ended (don't delete — useful for analytics)
  await set(ref(db, `matches/${matchId}/status`), 'ended');
}

// ══════════════════════════════════════════════════════════════════════════════
// DELETE USER ACCOUNT — Complete cleanup from Firebase
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Completely remove all user data from Firebase.
 * Called when user deletes their account.
 */
export async function deleteUserFromFirebase(
  db: Database,
  phone: string
): Promise<void> {
  if (!phone) return;

  try {
    // 1. Remove user profile
    await remove(ref(db, `users/${phone}`));

    // 2. Remove from match queue (if searching)
    await remove(ref(db, `matchQueue/${phone}`));

    // 3. Remove match proposals
    await remove(ref(db, `matchProposals/${phone}`));

    // 4. Remove friend requests sent TO this user
    await remove(ref(db, `friendRequests/${phone}`));

    // 5. Remove from online count tracking
    await remove(ref(db, `presence/${phone}`));

    // 6. Clean up any active rooms this user created
    // (rooms are ephemeral and will expire, but we can try to clean)
    const roomsSnap = await get(ref(db, 'rooms'));
    if (roomsSnap.exists()) {
      const rooms = roomsSnap.val();
      for (const roomId of Object.keys(rooms)) {
        const room = rooms[roomId];
        if (room.createdBy === phone) {
          await remove(ref(db, `rooms/${roomId}`));
        }
      }
    }

    // 7. Remove any blocked entries where this user is involved
    await remove(ref(db, `blocked/${phone}`));

    // 8. Remove any reports from this user
    await remove(ref(db, `reports/${phone}`));

    console.log('[Firebase] User data deleted:', phone);
  } catch (error) {
    console.error('[Firebase] Error deleting user:', error);
    // Don't throw — local cleanup should still proceed
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// DIRECT CALL — Check if user exists and is online
// ══════════════════════════════════════════════════════════════════════════════

export interface UserCheckResult {
  exists: boolean;
  online: boolean;
  user: PalInfo | null;
}

/**
 * Check if a user exists in Firebase and if they are online.
 * Used for direct calling feature.
 */
export async function checkUserForCall(
  db: Database,
  phone: string
): Promise<UserCheckResult> {
  try {
    const userRef = ref(db, `users/${phone}`);
    const snap = await get(userRef);

    if (!snap.exists()) {
      return { exists: false, online: false, user: null };
    }

    const data = snap.val();
    return {
      exists: true,
      online: data.online === true,
      user: {
        phone,
        name: data.nickname || 'Anonymous',
        avatar: data.avatar || 'cat',
        mood: data.mood || '',
        moodEmoji: data.moodEmoji || '',
        language: data.language,
        region: data.region,
      },
    };
  } catch (error) {
    console.error('[Firebase] Error checking user:', error);
    return { exists: false, online: false, user: null };
  }
}
