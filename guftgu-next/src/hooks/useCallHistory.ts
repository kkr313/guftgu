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

  return calls;
}
