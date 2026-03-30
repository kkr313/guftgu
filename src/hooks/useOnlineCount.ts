/**
 * useOnlineCount — Firebase-backed online user count.
 * Counts users with online=true in the users collection.
 * Excludes: yourself, blocked users, and stale users (no activity in 5 mins).
 *
 * Usage:
 *   const onlineCount = useOnlineCount(isActive, dbRef, myPhone);
 */
import { useState, useEffect } from 'react';
import { Database, ref, onValue, DataSnapshot } from 'firebase/database';
import { getBlocked } from '@/lib/storage';

// Consider a user stale if no activity in 2 minutes
const STALE_TIMEOUT_MS = 2 * 60 * 1000;

export function useOnlineCount(
  isActive: boolean,
  dbRef: React.MutableRefObject<Database | null>,
  myPhone?: string,
): string {
  const [onlineCount, setOnlineCount] = useState('');

  useEffect(() => {
    if (!isActive) return;

    const db = dbRef.current;

    // ── Guard: wait until we know our own phone number ──────────────────
    if (!myPhone) return;

    if (!db) {
      setOnlineCount('offline');
      return;
    }

    const blockedUsers = getBlocked().map(b => b.phone);
    const usersRef = ref(db, 'users');
    const myPhoneStr = String(myPhone).trim();

    const unsub = onValue(
      usersRef,
      (snap: DataSnapshot) => {
        let count = 0;
        const now = Date.now();

        snap.forEach((child: DataSnapshot) => {
          const userPhone = String(child.key || '').trim();
          const userData = child.val() as { online?: boolean; lastSeen?: number } | null;

          // Must be marked online
          if (userData?.online !== true) return;

          // Skip yourself
          if (userPhone === myPhoneStr) return;

          // Skip blocked users
          if (userPhone && blockedUsers.includes(userPhone)) return;

          // Must have a valid numeric lastSeen — entries without one are orphaned
          const lastSeen = userData?.lastSeen;
          if (typeof lastSeen !== 'number') return;

          // Skip stale users (lastSeen > 2 minutes ago)
          if (now - lastSeen > STALE_TIMEOUT_MS) return;

          count++;
        });

        if (count === 0) {
          setOnlineCount('No one online');
        } else {
          setOnlineCount(count.toLocaleString('en-IN') + ' online');
        }
      },
      () => {
        setOnlineCount('connecting...');
      }
    );

    return () => unsub();
  }, [isActive, dbRef, myPhone]);

  return onlineCount;
}

