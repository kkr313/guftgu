/**
 * useOnlineCount — Firebase-backed online user count.
 * Counts users with online=true in the users collection
 * Excludes: yourself, blocked users, and stale users (no activity in 5 mins)
 *
 * Usage:
 *   const onlineCount = useOnlineCount(isActive, dbRef, myPhone);
 */
import { useState, useEffect } from 'react';
import { Database, ref, onValue } from 'firebase/database';
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
    if (db) {
      // Get blocked users list
      const blockedUsers = getBlocked().map(b => b.phone);
      const now = Date.now();
      
      // Listen to users collection and count online users
      const usersRef = ref(db, 'users');
      const unsub = onValue(usersRef, (snap) => {
        let count = 0;
        const currentTime = Date.now();
        const onlineUsers: string[] = [];
        const skippedUsers: { phone: string; reason: string }[] = [];
        
        snap.forEach((child) => {
          const userPhone = child.key;
          const userData = child.val();
          
          // Skip if not online
          if (userData?.online !== true) {
            return;
          }
          
          // Skip yourself
          if (myPhone && userPhone === myPhone) {
            skippedUsers.push({ phone: userPhone || 'unknown', reason: 'self' });
            return;
          }
          
          // Skip blocked users
          if (userPhone && blockedUsers.includes(userPhone)) {
            skippedUsers.push({ phone: userPhone, reason: 'blocked' });
            return;
          }
          
          // Skip stale users (lastSeen > 5 minutes ago)
          // Note: lastSeen might be a server timestamp object or number
          const lastSeen = userData?.lastSeen;
          if (lastSeen && typeof lastSeen === 'number') {
            if (currentTime - lastSeen > STALE_TIMEOUT_MS) {
              skippedUsers.push({ phone: userPhone || 'unknown', reason: 'stale' });
              return; // Skip stale user
            }
          }
          
          onlineUsers.push(userPhone || 'unknown');
          count++;
        });
        
        console.log('[OnlineCount] My phone:', myPhone);
        console.log('[OnlineCount] Online users:', onlineUsers);
        console.log('[OnlineCount] Skipped:', skippedUsers);
        console.log('[OnlineCount] Final count:', count);
        
        // Format the count
        if (count === 0) {
          setOnlineCount('No one online');
        } else {
          setOnlineCount(count.toLocaleString('en-IN') + ' online');
        }
      }, () => {
        // Error fallback - show "connecting"
        setOnlineCount('connecting...');
      });
      return () => unsub();
    } else {
      setOnlineCount('offline');
    }
  }, [isActive, dbRef, myPhone]);

  return onlineCount;
}
