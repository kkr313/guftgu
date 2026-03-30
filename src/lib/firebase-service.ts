import {
  Database,
  ref,
  set,
  get,
  remove,
  onValue,
  onChildAdded,
  onChildRemoved,
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
// Priority: Language + Region (best) > Language only > Region only
// Score 3 = lang + region (best) — immediate
// Score 2 = lang only — unlocks after 8s
// Score 1 = lang + (no region yet) — unlocks after 25s
// ══════════════════════════════════════════════════════════════════════════════

const P2_MS = 8000;  // 8 seconds for language-only match
const P3_MS = 25000; // 25 seconds for fallback

function calculatePriority(
  me: QueueEntry,
  them: QueueEntry,
  _elapsed: number
): number | null {
  // Check language first (mandatory for any connection)
  const sameLanguage = me.language === them.language;
  const sameRegion = me.region === them.region;

  // Best: Language + Region match
  if (sameLanguage && sameRegion) return 3;

  // Good: Language only match
  if (sameLanguage) return 2;

  // Fallback: Region only match
  if (sameRegion) return 1;

  // No match
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
 * Update user's online status and set up disconnect handler
 */
export async function setOnlineStatus(
  db: Database,
  phone: string,
  online: boolean
): Promise<void> {
  const presenceRef = ref(db, `users/${phone}/online`);
  const lastSeenRef = ref(db, `users/${phone}/lastSeen`);
  
  if (online) {
    // Set online and set up disconnect handlers
    await set(presenceRef, true);
    // Re-register disconnect handlers in case they were lost
    onDisconnect(presenceRef).set(false);
    onDisconnect(lastSeenRef).set(serverTimestamp());
  } else {
    // Set offline and update last seen
    await set(presenceRef, false);
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

  let proposedTo: string | null = null;

  let matchAccepted = false;

  // Write my entry to queue
  set(myQueueRef, entry).then(() => {
    onDisconnect(myQueueRef).remove();
  });

  // Watch entire queue — look for best match
  queueListener = onValue(queueRef, (snap) => {
    // FIX 1: Stop proposing once we have been matched
    if (cleaned || currentMatchId || !snap.exists()) return;

    const elapsed = Date.now() - searchStart;
    const queue = snap.val() as Record<string, QueueEntry>;
    let best: (QueueEntry & { phone: string }) | null = null;
    let bestPri = -1;
    let matchable = 0;

    for (const [p, e] of Object.entries(queue)) {
      if (p === phone) continue;
      if (e.status !== 'searching') continue;
      if (isBlocked(p)) continue;

      matchable++;

      const pri = calculatePriority(entry, e, elapsed);
      if (pri === null) continue;

      if (pri > bestPri || (pri === bestPri && e.ts < (best?.ts ?? Infinity))) {
        best = { ...e, phone: p };
        bestPri = pri;
      }
    }

    onQueueCount(matchable);

    if (!best) return;
    // Only lower phone proposes (prevents duplicate proposals)
    if (phone >= best.phone) return;

    // FIX 1: If we already proposed to this exact person, skip
    if (proposedTo === best.phone) return;

    // FIX 1: Cancel the old proposal before sending a new one
    if (proposedTo) {
      remove(ref(db, `matchProposals/${proposedTo}/${phone}`)).catch(() => {});
    }

    proposedTo = best.phone;

    // Check if proposal already exists (extra safety), then send
    const proposalRef = ref(db, `matchProposals/${best.phone}/${phone}`);
    get(proposalRef).then((ex) => {
      if (ex.exists() || currentMatchId) return; // already matched or proposal exists
      set(proposalRef, {
        from: phone,
        fromEntry: entry,
        priority: bestPri,
        ts: Date.now(),
      });
    });
  });

  // Listen for incoming proposals (callee role)
  proposalListener = onChildAdded(proposalsRef, (snap) => {
    // FIX 2: Guard against multiple simultaneous proposals
    if (cleaned || currentMatchId || matchAccepted || !snap.exists()) return;

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
      // FIX 2: Re-check guards after async gap (race condition window)
      if (!s.exists() || s.val().status !== 'searching') {
        remove(snap.ref);
        return;
      }

      // FIX 2: Another proposal may have been processed while we awaited
      if (currentMatchId || matchAccepted) {
        remove(snap.ref);
        return;
      }

      // Lock immediately before any async work
      matchAccepted = true;

      const matchId = `match_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      currentMatchId = matchId;

      // FIX 3: Cancel our own outgoing proposal now that we're matched
      if (proposedTo) {
        remove(ref(db, `matchProposals/${proposedTo}/${phone}`)).catch(() => {});
        proposedTo = null;
      }

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
        set(ref(db, `matchQueue/${phone}/status`), 'matched');
        set(ref(db, `matchQueue/${phone}/matchId`), matchId);
        set(ref(db, `matchQueue/${theirPhone}/status`), 'matched');
        set(ref(db, `matchQueue/${theirPhone}/matchId`), matchId);
        remove(snap.ref);

        // FIX 3: Remove all remaining incoming proposals (we're taken)
        get(proposalsRef).then((allSnap) => {
          if (allSnap.exists()) {
            allSnap.forEach((child) => { remove(child.ref); });
          }
        });

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
      }).catch(() => {
        // If match creation fails, unlock so we can try again
        matchAccepted = false;
        currentMatchId = null;
      });
    });
  });

  // Watch my own queue entry for matchId set by the proposer (caller role)
  myEntryListener = onValue(myQueueRef, (snap) => {
    if (cleaned || !snap.exists()) return;
    const data = snap.val() as QueueEntry;

    if (data.matchId && data.status === 'matched' && data.matchId !== currentMatchId) {
      // FIX 2: Guard against firing after we already have a match
      if (matchAccepted) return;
      matchAccepted = true;
      currentMatchId = data.matchId;

      // FIX 3: Cancel our outgoing proposal (we're now the one being matched)
      if (proposedTo) {
        remove(ref(db, `matchProposals/${proposedTo}/${phone}`)).catch(() => {});
        proposedTo = null;
      }

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

  // Cleanup function — now also removes our outgoing proposal
  return () => {
    cleaned = true;
    if (queueListener) off(queueRef, 'value', queueListener);
    if (proposalListener) off(proposalsRef, 'child_added', proposalListener);
    if (myEntryListener) off(myQueueRef, 'value', myEntryListener);
    onDisconnect(myQueueRef).cancel();
    remove(myQueueRef);
    remove(proposalsRef); // proposals TO me

    // FIX 3: Also remove proposal I sent to someone else
    if (proposedTo) {
      remove(ref(db, `matchProposals/${proposedTo}/${phone}`)).catch(() => {});
      proposedTo = null;
    }
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
 * Also ends any active calls with that user.
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
  
  // End any active/pending calls with this user
  await remove(ref(db, `calls/${myPhone}/incoming/${targetPhone}`));
  await remove(ref(db, `calls/${myPhone}/outgoing/${targetPhone}`));
  await remove(ref(db, `calls/${targetPhone}/incoming/${myPhone}`));
  await remove(ref(db, `calls/${targetPhone}/outgoing/${myPhone}`));
  
  console.log('[blockUserFirebase] Blocked:', targetPhone, 'and cleaned up calls');
}

/**
 * Unblock a user.
 */
export async function unblockUserFirebase(
  db: Database,
  myPhone: string,
  targetPhone: string
): Promise<void> {
  console.log('[unblockUserFirebase] Unblocking:', targetPhone, 'by:', myPhone);
  console.log('[unblockUserFirebase] Before - blocked list:', getBlocked());
  
  await remove(ref(db, `blocked/${myPhone}/${targetPhone}`));
  const filtered = getBlocked().filter((e) => e.phone !== targetPhone);
  saveBlocked(filtered);
  
  console.log('[unblockUserFirebase] After - blocked list:', getBlocked());
}

/**
 * Remove a friend relationship from Firebase (both sides).
 * Called when a user unfriends someone.
 */
export async function removeFriendFirebase(
  db: Database,
  myPhone: string,
  targetPhone: string
): Promise<void> {
  // Remove from both sides of the friends list in Firebase
  await remove(ref(db, `friends/${myPhone}/${targetPhone}`)).catch(() => {});
  await remove(ref(db, `friends/${targetPhone}/${myPhone}`)).catch(() => {});
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
  blockedByTarget: boolean; // Target user has blocked me
  user: PalInfo | null;
}

/**
 * Check if a user exists in Firebase and if they are online.
 * Also checks if target has blocked the caller.
 * Used for direct calling feature.
 */
export async function checkUserForCall(
  db: Database,
  targetPhone: string,
  myPhone: string
): Promise<UserCheckResult> {
  try {
    console.log('[checkUserForCall] Target:', targetPhone, 'My:', myPhone);
    
    const userRef = ref(db, `users/${targetPhone}`);
    const snap = await get(userRef);

    if (!snap.exists()) {
      console.log('[checkUserForCall] User not found in Firebase');
      return { exists: false, online: false, blockedByTarget: false, user: null };
    }

    // Check if target has blocked me (target's block list, my phone)
    const blockRef = ref(db, `blocked/${targetPhone}/${myPhone}`);
    const blockSnap = await get(blockRef);
    const blockedByTarget = blockSnap.exists();
    console.log('[checkUserForCall] Block check path:', `blocked/${targetPhone}/${myPhone}`, 'Blocked:', blockedByTarget);

    const data = snap.val();
    return {
      exists: true,
      online: data.online === true,
      blockedByTarget,
      user: {
        phone: targetPhone,
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
    return { exists: false, online: false, blockedByTarget: false, user: null };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// FRIENDSHIP — Check and manage friend relationships
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Check if two users are friends.
 * Friendship is stored in both users' friends lists.
 */
export async function checkIfFriends(
  db: Database,
  myPhone: string,
  targetPhone: string
): Promise<boolean> {
  try {
    // Check if target is in my friends list
    const friendRef = ref(db, `friends/${myPhone}/${targetPhone}`);
    const snap = await get(friendRef);
    return snap.exists();
  } catch (error) {
    console.error('[Firebase] Error checking friendship:', error);
    return false;
  }
}

/**
 * Check if there's a pending friend request between two users.
 * Returns: 'none' | 'sent' (I sent to them) | 'received' (they sent to me)
 */
export async function checkPendingRequest(
  db: Database,
  myPhone: string,
  targetPhone: string
): Promise<'none' | 'sent' | 'received'> {
  try {
    // Check if I sent a request to them
    const sentRef = ref(db, `friendRequests/${targetPhone}/${myPhone}`);
    const sentSnap = await get(sentRef);
    if (sentSnap.exists()) return 'sent';

    // Check if they sent a request to me
    const receivedRef = ref(db, `friendRequests/${myPhone}/${targetPhone}`);
    const receivedSnap = await get(receivedRef);
    if (receivedSnap.exists()) return 'received';

    return 'none';
  } catch (error) {
    console.error('[Firebase] Error checking pending request:', error);
    return 'none';
  }
}

/**
 * Add user to friends list (mutual - both sides).
 * Called when a friend request is accepted.
 */
export async function addToFriends(
  db: Database,
  myPhone: string,
  myUser: UserData,
  targetPhone: string,
  targetName: string,
  targetAvatar: string,
  targetMood: string,
  targetMoodEmoji: string
): Promise<void> {
  const now = Date.now();
  
  // Add target to my friends
  await set(ref(db, `friends/${myPhone}/${targetPhone}`), {
    name: targetName,
    avatar: targetAvatar,
    mood: targetMood,
    moodEmoji: targetMoodEmoji,
    addedAt: now,
  });

  // Add me to target's friends
  await set(ref(db, `friends/${targetPhone}/${myPhone}`), {
    name: myUser.nickname || 'Anonymous',
    avatar: myUser.avatar || 'cat',
    mood: myUser.mood || '',
    moodEmoji: myUser.moodEmoji || '',
    addedAt: now,
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// REAL-TIME CHAT — Messages between friends
// ══════════════════════════════════════════════════════════════════════════════

export interface ChatMessage {
  id: string;
  from: string;
  text: string;
  timestamp: number;
}

/**
 * Generate a consistent chat room ID for two users.
 * Always uses sorted phone numbers so both users get the same room.
 */
export function getChatRoomId(phone1: string, phone2: string): string {
  const sorted = [phone1, phone2].sort();
  return `chat_${sorted[0]}_${sorted[1]}`;
}

/**
 * Send a chat message to a friend.
 * Returns false if the target is blocked.
 */
export async function sendChatMessage(
  db: Database,
  myPhone: string,
  targetPhone: string,
  text: string
): Promise<boolean> {
  // Don't allow chatting with blocked users
  if (isBlocked(targetPhone)) {
    console.log('[sendChatMessage] Blocked - cannot send to:', targetPhone);
    return false;
  }
  
  const roomId = getChatRoomId(myPhone, targetPhone);
  const messageRef = push(ref(db, `chats/${roomId}/messages`));
  await set(messageRef, {
    from: myPhone,
    text,
    timestamp: Date.now(),
  });
  return true;
}

/**
 * Listen for new chat messages in a conversation.
 * Filters out messages from blocked users.
 * Returns cleanup function.
 */
export function listenChatMessages(
  db: Database,
  myPhone: string,
  targetPhone: string,
  onMessage: (message: ChatMessage) => void
): () => void {
  const roomId = getChatRoomId(myPhone, targetPhone);
  const messagesRef = ref(db, `chats/${roomId}/messages`);
  let cleaned = false;

  const listener = onChildAdded(messagesRef, (snap) => {
    if (cleaned || !snap.exists()) return;
    const msg = snap.val();
    
    // Don't show messages from blocked users
    if (msg.from !== myPhone && isBlocked(msg.from)) {
      return;
    }
    
    onMessage({
      id: snap.key || Date.now().toString(),
      from: msg.from,
      text: msg.text,
      timestamp: msg.timestamp,
    });
  });

  return () => {
    cleaned = true;
    off(messagesRef, 'child_added', listener);
  };
}

/**
 * Load chat history for a conversation.
 */
export async function loadChatHistory(
  db: Database,
  myPhone: string,
  targetPhone: string,
  limit: number = 50
): Promise<ChatMessage[]> {
  const roomId = getChatRoomId(myPhone, targetPhone);
  const messagesRef = ref(db, `chats/${roomId}/messages`);
  
  try {
    const snap = await get(messagesRef);
    if (!snap.exists()) return [];

    const messages: ChatMessage[] = [];
    snap.forEach((child) => {
      const msg = child.val();
      messages.push({
        id: child.key || Date.now().toString(),
        from: msg.from,
        text: msg.text,
        timestamp: msg.timestamp,
      });
    });

    // Sort by timestamp and return last N messages
    return messages
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-limit);
  } catch (error) {
    console.error('[Firebase] Error loading chat history:', error);
    return [];
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// UNIQUE GUFTGU NUMBER GENERATION
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Generate a random 7-digit Guftgu number.
 */
function generateRandomNumber(): string {
  // Generate 7-digit number (1000000 to 9999999)
  const num = Math.floor(1000000 + Math.random() * 9000000);
  return num.toString();
}

/**
 * Check if a Guftgu number is already taken in Firebase.
 */
export async function isNumberTaken(
  db: Database,
  phone: string
): Promise<boolean> {
  try {
    const userRef = ref(db, `users/${phone}`);
    const snap = await get(userRef);
    return snap.exists();
  } catch (error) {
    console.error('[Firebase] Error checking number:', error);
    // On error, assume taken for safety
    return true;
  }
}

/**
 * Generate a unique Guftgu number that doesn't exist in Firebase.
 * Tries up to maxAttempts times before falling back to timestamp-based.
 */
export async function generateUniqueGuftguNumber(
  db: Database,
  maxAttempts: number = 10
): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const candidate = generateRandomNumber();
    const taken = await isNumberTaken(db, candidate);
    
    if (!taken) {
      console.log(`[Firebase] Generated unique number on attempt ${i + 1}:`, candidate);
      return candidate;
    }
    
    console.log(`[Firebase] Number ${candidate} already taken, trying again...`);
  }
  
  // Fallback: use timestamp + random to virtually guarantee uniqueness
  const ts = Date.now().toString().slice(-5);
  const rand = Math.floor(10 + Math.random() * 90);
  const fallback = ts + rand.toString();
  console.log('[Firebase] Using fallback number:', fallback);
  return fallback;
}

// ══════════════════════════════════════════════════════════════════════════════
// DIRECT CALL SIGNALING
// ══════════════════════════════════════════════════════════════════════════════

export interface IncomingCall {
  from: string;
  name: string;
  avatar: string;
  mood: string;
  moodEmoji: string;
  timestamp: number;
  status: 'ringing' | 'accepted' | 'declined' | 'cancelled' | 'ended';
}

export interface CallSession {
  caller: string;
  callee: string;
  callerName: string;
  calleeName: string;
  callerAvatar: string;
  calleeAvatar: string;
  status: 'ringing' | 'accepted' | 'declined' | 'cancelled' | 'ended';
  startedAt: number;
  connectedAt?: number;
  endedAt?: number;
}

/**
 * Initiate a call to another user.
 * Creates an entry in calls/{targetPhone}/incoming/{myPhone}
 */
export async function initiateCall(
  db: Database,
  myPhone: string,
  myUser: UserData,
  targetPhone: string
): Promise<string> {
  const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  
  // Clean up any stale call data from a previous call to the same user
  // (e.g. leftover 'declined' status that would poison the new listener)
  await remove(ref(db, `calls/${myPhone}/outgoing/${targetPhone}`));

  const callData: IncomingCall = {
    from: myPhone,
    name: myUser.nickname || 'Anonymous',
    avatar: myUser.avatar || 'cat',
    mood: myUser.mood || '',
    moodEmoji: myUser.moodEmoji || '',
    timestamp: Date.now(),
    status: 'ringing',
  };

  console.log('[initiateCall] Sending call data:', callData);

  // Write to target's incoming calls
  await set(ref(db, `calls/${targetPhone}/incoming/${myPhone}`), callData);
  
  // Set up auto-cleanup on disconnect
  onDisconnect(ref(db, `calls/${targetPhone}/incoming/${myPhone}`)).remove();

  console.log('[Firebase] Call initiated to:', targetPhone);
  return callId;
}

/**
 * Listen for incoming calls.
 * Returns cleanup function.
 */
export function listenIncomingCalls(
  db: Database,
  myPhone: string,
  onIncomingCall: (call: IncomingCall & { callerPhone: string }) => void,
  onCallRemoved: (callerPhone: string) => void
): () => void {
  const incomingRef = ref(db, `calls/${myPhone}/incoming`);
  let cleaned = false;

  console.log('[listenIncomingCalls] Setting up listener for:', myPhone);

  // Listen for new incoming calls
  const addedListener = onChildAdded(incomingRef, (snap) => {
    if (cleaned || !snap.exists()) return;
    const callerPhone = snap.key!;
    const callData = snap.val() as IncomingCall;
    
    console.log('[listenIncomingCalls] Incoming call from:', callerPhone, 'status:', callData.status);
    
    // Only notify for ringing calls
    if (callData.status === 'ringing') {
      // Check if caller is blocked
      const blocked = isBlocked(callerPhone);
      console.log('[listenIncomingCalls] Is caller blocked?', blocked, 'Blocked list:', getBlocked());
      
      if (blocked) {
        // Silently decline blocked callers
        console.log('[listenIncomingCalls] Declining blocked caller');
        remove(snap.ref);
        return;
      }
      onIncomingCall({ ...callData, callerPhone });
    }
  });

  // Listen for call removals (cancelled by caller, etc)
  const removedListener = onChildRemoved(incomingRef, (snap) => {
    if (cleaned) return;
    const callerPhone = snap.key!;
    console.log('[listenIncomingCalls] Call removed from:', callerPhone);
    onCallRemoved(callerPhone);
  });

  return () => {
    cleaned = true;
    off(incomingRef, 'child_added', addedListener);
    off(incomingRef, 'child_removed', removedListener);
  };
}

/**
 * Accept an incoming call.
 * Returns the connected timestamp for synchronized timers.
 */
export async function acceptCall(
  db: Database,
  myPhone: string,
  callerPhone: string
): Promise<number> {
  const connectedAt = Date.now();
  
  // Update call status with connected timestamp
  await set(ref(db, `calls/${myPhone}/incoming/${callerPhone}/status`), 'accepted');
  await set(ref(db, `calls/${myPhone}/incoming/${callerPhone}/connectedAt`), connectedAt);
  
  // Notify caller that call was accepted with the same timestamp
  await set(ref(db, `calls/${callerPhone}/outgoing/${myPhone}`), {
    status: 'accepted',
    connectedAt: connectedAt,
    timestamp: connectedAt,
  });
  
  console.log('[Firebase] Call accepted from:', callerPhone, 'at:', connectedAt);
  return connectedAt;
}

/**
 * Decline an incoming call.
 */
export async function declineCall(
  db: Database,
  myPhone: string,
  callerPhone: string
): Promise<void> {
  // Notify caller that call was declined
  await set(ref(db, `calls/${callerPhone}/outgoing/${myPhone}`), {
    status: 'declined',
    timestamp: Date.now(),
  });
  
  // Remove incoming call
  await remove(ref(db, `calls/${myPhone}/incoming/${callerPhone}`));
  
  console.log('[Firebase] Call declined from:', callerPhone);
}

/**
 * Cancel an outgoing call (before answered).
 */
export async function cancelCall(
  db: Database,
  myPhone: string,
  targetPhone: string
): Promise<void> {
  // Remove the incoming call notification
  await remove(ref(db, `calls/${targetPhone}/incoming/${myPhone}`));
  
  // Clean up any outgoing status
  await remove(ref(db, `calls/${myPhone}/outgoing/${targetPhone}`));
  
  console.log('[Firebase] Call cancelled to:', targetPhone);
}

/**
 * End an active call.
 */
export async function endCall(
  db: Database,
  myPhone: string,
  otherPhone: string
): Promise<void> {
  // Clean up both sides
  await remove(ref(db, `calls/${myPhone}/incoming/${otherPhone}`));
  await remove(ref(db, `calls/${otherPhone}/incoming/${myPhone}`));
  await remove(ref(db, `calls/${myPhone}/outgoing/${otherPhone}`));
  await remove(ref(db, `calls/${otherPhone}/outgoing/${myPhone}`));
  
  console.log('[Firebase] Call ended with:', otherPhone);
}

/**
 * Listen for outgoing call status changes (accepted/declined).
 * When accepted, also returns the connectedAt timestamp for synchronized timers.
 */
export function listenOutgoingCallStatus(
  db: Database,
  myPhone: string,
  targetPhone: string,
  onStatusChange: (status: 'accepted' | 'declined' | 'cancelled' | 'ended', connectedAt?: number) => void
): () => void {
  const outgoingRef = ref(db, `calls/${myPhone}/outgoing/${targetPhone}`);
  let cleaned = false;
  let hasSeenData = false;

  const listener = onValue(outgoingRef, (snap) => {
    if (cleaned) return;
    
    if (!snap.exists()) {
      // If we previously had data and now it's gone, the call was ended
      if (hasSeenData) {
        console.log('[listenOutgoingCallStatus] Call data removed - call ended');
        onStatusChange('ended');
      }
      return;
    }
    
    hasSeenData = true;
    const data = snap.val();
    if (data.status) {
      onStatusChange(data.status, data.connectedAt);
    }
  });

  return () => {
    cleaned = true;
    off(outgoingRef, 'value', listener);
  };
}

/**
 * Listen for incoming call status changes (for the receiver).
 * Detects when the caller ends the call.
 */
export function listenIncomingCallStatus(
  db: Database,
  myPhone: string,
  callerPhone: string,
  onCallEnded: () => void
): () => void {
  const incomingRef = ref(db, `calls/${myPhone}/incoming/${callerPhone}`);
  let cleaned = false;
  let hasSeenData = false;

  const listener = onValue(incomingRef, (snap) => {
    if (cleaned) return;
    
    if (snap.exists()) {
      hasSeenData = true;
    } else if (hasSeenData) {
      // Data was removed - caller ended the call
      console.log('[listenIncomingCallStatus] Call data removed - call ended by caller');
      onCallEnded();
    }
  });

  return () => {
    cleaned = true;
    off(incomingRef, 'value', listener);
  };
}

/**
 * Clean up call data when call ends.
 */
export async function cleanupCallData(
  db: Database,
  myPhone: string,
  otherPhone: string
): Promise<void> {
  await remove(ref(db, `calls/${myPhone}/incoming/${otherPhone}`));
  await remove(ref(db, `calls/${myPhone}/outgoing/${otherPhone}`));
  await remove(ref(db, `calls/${otherPhone}/incoming/${myPhone}`));
  await remove(ref(db, `calls/${otherPhone}/outgoing/${myPhone}`));
}

// ══════════════════════════════════════════════════════════════════════════════
// DIRECT CALL — WebRTC ROOM ID EXCHANGE
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Set WebRTC roomId on a direct call so the receiver can join.
 * Caller writes roomId after creating the WebRTC room.
 * Path: calls/{receiverPhone}/incoming/{callerPhone}/roomId
 */
export async function setDirectCallRoomId(
  db: Database,
  callerPhone: string,
  receiverPhone: string,
  roomId: string
): Promise<void> {
  await set(ref(db, `calls/${receiverPhone}/incoming/${callerPhone}/roomId`), roomId);
  console.log('[Firebase] Direct call roomId set:', roomId, 'for', receiverPhone);
}

/**
 * Watch for WebRTC roomId on a direct call.
 * Receiver watches for the caller to set the roomId after accepting.
 * Returns cleanup function.
 */
export function watchDirectCallRoomId(
  db: Database,
  myPhone: string,
  callerPhone: string,
  onRoomId: (roomId: string) => void
): () => void {
  const roomIdRef = ref(db, `calls/${myPhone}/incoming/${callerPhone}/roomId`);
  let cleaned = false;

  const listener = onValue(roomIdRef, (snap) => {
    if (cleaned) return;
    if (snap.exists()) {
      const roomId = snap.val() as string;
      console.log('[Firebase] Direct call roomId received:', roomId);
      onRoomId(roomId);
    }
  });

  return () => {
    cleaned = true;
    off(roomIdRef, 'value', listener);
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// FRIEND PRESENCE — Real-time online/offline status for friends list
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Watch the online status of multiple friends in real-time.
 * Creates one Firebase listener per friend phone.
 * @param db         Realtime Database instance
 * @param phones     Array of friend phone numbers to watch
 * @param onChange   Called whenever any friend's status changes
 * @returns          Cleanup function — unsubscribes all listeners
 */
export function listenFriendsOnlineStatus(
  db: Database,
  phones: string[],
  onChange: (phone: string, online: boolean, lastSeen: number | null) => void
): () => void {
  if (!phones.length) return () => {};

  const cleanups: Array<() => void> = [];

  for (const phone of phones) {
    const userRef = ref(db, `users/${phone}`);

    const listener = onValue(userRef, (snap) => {
      if (!snap.exists()) {
        onChange(phone, false, null);
        return;
      }
      const data = snap.val() as { online?: boolean; lastSeen?: number };
      onChange(phone, data.online === true, data.lastSeen ?? null);
    });

    cleanups.push(() => off(userRef, 'value', listener));
  }

  return () => cleanups.forEach((fn) => fn());
}

