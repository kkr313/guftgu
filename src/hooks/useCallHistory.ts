/**
 * useCallHistory — shared hook for loading call history from localStorage.
 * Used by HomeScreen and HistoryScreen.
 *
 * Usage:
 *   const calls = useCallHistory(isActive);
 */
import { useState, useEffect } from 'react';
import { getCallHistory, CallRecord } from '@/lib/storage';

export function useCallHistory(isActive: boolean): CallRecord[] {
  const [calls, setCalls] = useState<CallRecord[]>([]);

  useEffect(() => {
    if (isActive) setCalls(getCallHistory());
  }, [isActive]);

  // Listen for storage events (cross-tab) and custom events
  useEffect(() => {
    const handleStorage = () => {
      setCalls(getCallHistory());
    };
    const handleUpdate = () => {
      setCalls(getCallHistory());
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('callHistoryUpdate', handleUpdate);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('callHistoryUpdate', handleUpdate);
    };
  }, []);

  return calls;
}
