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

// Consider a user stale if no activity in 5 minutes
const STALE_TIMEOUT_MS = 5 * 60 * 1000;

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
    // If myPhone is empty/undefined the first snapshot would count ourselves
    // because the self-skip condition `myPhone && ...` would short-circuit.
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
        // Capture currentTime inside the callback so it's never stale
        const now = Date.now();

        snap.forEach((child: DataSnapshot) => {
          const userPhone = String(child.key || '').trim();
          const userData = child.val() as { online?: boolean; lastSeen?: number } | null;

          // Must be marked online
          if (userData?.online !== true) return;

          // Skip yourself — myPhone is guaranteed non-empty here
          if (userPhone === myPhoneStr) return;

          // Skip blocked users
          if (userPhone && blockedUsers.includes(userPhone)) return;

          // Skip stale users (lastSeen > 5 minutes ago)
          const lastSeen = userData?.lastSeen;
          if (typeof lastSeen === 'number' && now - lastSeen > STALE_TIMEOUT_MS) return;

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

