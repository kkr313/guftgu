/**
 * useTimer — reusable seconds timer hook.
 * Used by CallScreen for call duration.
 *
 * Usage:
 *   const { seconds, formatted, start, stop, reset } = useTimer();
 *   // Or with a start timestamp for synchronized timers:
 *   start(startTimestamp);
 */
import { useState, useRef, useCallback } from 'react';
import { formatTime } from '@/lib/data';

export function useTimer() {
  const [seconds, setSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // start() can optionally take a timestamp to sync timers across users
  const start = useCallback((fromTimestamp?: number) => {
    stop(); // clear any existing
    
    // If a timestamp is provided, calculate elapsed time from it
    // Otherwise start from 0
    startTimeRef.current = fromTimestamp || Date.now();
    
    const updateSeconds = () => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setSeconds(Math.max(0, elapsed));
    };
    
    updateSeconds(); // Set initial value immediately
    intervalRef.current = setInterval(updateSeconds, 1000);
  }, [stop]);

  const reset = useCallback(() => {
    stop();
    setSeconds(0);
  }, [stop]);

  return {
    seconds,
    formatted: formatTime(seconds),
    start,
    stop,
    reset,
  };
}
