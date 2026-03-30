import { useRef, useState, useEffect, useCallback } from 'react';
import { playRefreshSound } from '@/lib/sounds';

/**
 * Pull-to-refresh — only triggers on a deliberate pull-down from the very top.
 *
 * Safeguards so normal scrolling never triggers it:
 *  1. Touch must start when scroll container is at scrollTop ≤ 0.
 *  2. First 30 px of downward finger movement is a "dead zone" — nothing happens.
 *  3. After the dead zone we re-verify scroll is still at 0. If the browser
 *     scrolled during the dead zone the pull is cancelled.
 *  4. Horizontal movement > vertical during the dead zone → cancelled (swipe).
 *  5. A high threshold (70 px visible / ~170 px finger) before reload triggers.
 */

const DEAD_ZONE   = 30;   // px of finger movement before pull tracking starts
const THRESHOLD   = 70;   // visible pull px needed to trigger refresh
const MAX_PULL    = 140;   // visual cap (dampened)
const SPINNER_SIZE = 36;

export default function PullToRefresh() {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const startY       = useRef(0);
  const startX       = useRef(0);
  const pulling      = useRef(false);   // true once past dead zone
  const canPull      = useRef(false);   // initial eligibility
  const decided      = useRef(false);   // direction decided (down vs scroll/swipe)
  const pullRef      = useRef(0);
  const refreshRef   = useRef(false);

  /** True only when every visible scroll container is at the very top */
  const isScrolledToTop = useCallback(() => {
    const activeScreen = document.querySelector('.screen.active');
    if (activeScreen) {
      const scrollBody = activeScreen.querySelector('.scroll-body');
      if (scrollBody && scrollBody.scrollTop > 1) return false;
    }
    const chatMessages = document.querySelector('.chat-messages');
    if (chatMessages && chatMessages.scrollTop > 1) return false;
    return true;
  }, []);

  const doRefresh = useCallback(() => {
    if (refreshRef.current) return;
    refreshRef.current = true;
    setRefreshing(true);
    playRefreshSound();
    setTimeout(() => window.location.reload(), 600);
    // Safety fallback
    setTimeout(() => {
      refreshRef.current = false;
      setRefreshing(false);
      setPullDistance(0);
      pullRef.current = 0;
    }, 3000);
  }, []);

  const resetPull = useCallback(() => {
    pulling.current = false;
    canPull.current = false;
    decided.current = false;
    pullRef.current = 0;
    setPullDistance(0);
  }, []);

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (refreshRef.current) return;
      resetPull();

      // Only eligible if scroll is at the very top
      if (!isScrolledToTop()) return;

      canPull.current = true;
      startY.current = e.touches[0].clientY;
      startX.current = e.touches[0].clientX;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (refreshRef.current || !canPull.current) return;

      const dy = e.touches[0].clientY - startY.current;
      const dx = e.touches[0].clientX - startX.current;

      // ── Not pulling down at all → let the browser scroll normally ──
      if (dy <= 0) {
        if (pulling.current) resetPull();
        return;
      }

      // ── Dead zone: first 30 px of downward movement ──
      if (!decided.current) {
        // If horizontal movement is dominant → user is swiping, cancel
        if (Math.abs(dx) > dy) {
          canPull.current = false;
          return;
        }
        // Still within dead zone — don't show anything yet
        if (dy < DEAD_ZONE) return;

        // Exiting dead zone — re-verify scroll is still at top
        // (browser may have scrolled the container during the dead zone)
        if (!isScrolledToTop()) {
          canPull.current = false;
          return;
        }
        decided.current = true;
      }

      // ── Past dead zone: track the pull ──
      pulling.current = true;
      const effective = dy - DEAD_ZONE;           // subtract dead zone from visual
      const clamped = Math.min(effective * 0.45, MAX_PULL);  // dampen
      pullRef.current = clamped;
      setPullDistance(clamped);

      // Prevent native scroll / pull-to-refresh while we're pulling
      e.preventDefault();
    };

    const onTouchEnd = () => {
      if (!pulling.current || refreshRef.current) {
        resetPull();
        return;
      }
      if (pullRef.current >= THRESHOLD) {
        doRefresh();
      } else {
        resetPull();
      }
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove,   { passive: false });
    document.addEventListener('touchend', onTouchEnd,      { passive: true });
    document.addEventListener('touchcancel', resetPull,    { passive: true });

    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', resetPull);
    };
  }, [isScrolledToTop, doRefresh, resetPull]);

  // ── Full-screen refresh loader ──
  if (refreshing) {
    return (
      <div className="ptr-loader-overlay">
        <div className="ptr-loader-content">
          <div className="ptr-loader-spinner">
            <svg viewBox="0 0 24 24" width={44} height={44} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21 12a9 9 0 1 1-6.22-8.56" />
            </svg>
          </div>
          <div className="ptr-loader-text">Refreshing…</div>
        </div>
      </div>
    );
  }

  // ── Pull indicator (while dragging) ──
  if (pullDistance === 0) return null;

  const progress = Math.min(pullDistance / THRESHOLD, 1);
  const rotation = pullDistance * 4;

  return (
    <div className="ptr-overlay" style={{ transform: `translateY(${pullDistance}px)` }}>
      <div
        className="ptr-spinner"
        style={{
          opacity: progress,
          transform: `rotate(${rotation}deg) scale(${0.5 + progress * 0.5})`,
          width: SPINNER_SIZE,
          height: SPINNER_SIZE,
        }}
      >
        <svg viewBox="0 0 24 24" width={SPINNER_SIZE} height={SPINNER_SIZE} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M21 12a9 9 0 1 1-6.22-8.56" />
        </svg>
      </div>
    </div>
  );
}
