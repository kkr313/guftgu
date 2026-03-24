/**
 * useTimer — reusable seconds timer hook.
 * Used by CallScreen for call duration.
 *
 * Usage:
 *   const { seconds, formatted, start, stop, reset } = useTimer();
 */
import { useState, useRef, useCallback } from 'react';
import { formatTime } from '@/lib/data';

export function useTimer() {
  const [seconds, setSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    stop(); // clear any existing
    setSeconds(0);
    intervalRef.current = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
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
