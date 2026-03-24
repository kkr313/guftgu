/**
 * useOnlineCount — Firebase-backed online user count.
 * Counts users with online=true in the users collection
 *
 * Usage:
 *   const onlineCount = useOnlineCount(isActive, dbRef);
 */
import { useState, useEffect } from 'react';
import { Database, ref, onValue } from 'firebase/database';

export function useOnlineCount(
  isActive: boolean,
  dbRef: React.MutableRefObject<Database | null>,
): string {
  const [onlineCount, setOnlineCount] = useState('');

  useEffect(() => {
    if (!isActive) return;
    const db = dbRef.current;
    if (db) {
      // Listen to users collection and count online users
      const usersRef = ref(db, 'users');
      const unsub = onValue(usersRef, (snap) => {
        let count = 0;
        snap.forEach((child) => {
          if (child.val()?.online === true) {
            count++;
          }
        });
        // Show real count (minimum 1 for yourself)
        const total = Math.max(count, 1);
        setOnlineCount(total.toLocaleString('en-IN') + ' online');
      }, () => {
        // Error fallback - show "connecting"
        setOnlineCount('connecting...');
      });
      return () => unsub();
    } else {
      setOnlineCount('offline');
    }
  }, [isActive, dbRef]);

  return onlineCount;
}
