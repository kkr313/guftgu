/**
 * useOnlineCount — Firebase-backed online user count with fallback.
 * Extracted from HomeScreen for reusability.
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
      const qRef = ref(db, 'matchQueue');
      const unsub = onValue(qRef, (snap) => {
        let count = 0;
        snap.forEach(() => { count++; });
        const total = count + Math.floor(800 + Math.random() * 400);
        setOnlineCount(total.toLocaleString('en-IN') + ' online');
      });
      return () => unsub();
    } else {
      const base = 1800 + Math.floor(Math.random() * 1200);
      setOnlineCount(base.toLocaleString('en-IN') + ' online');
    }
  }, [isActive, dbRef]);

  return onlineCount;
}
