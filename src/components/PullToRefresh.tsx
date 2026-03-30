import { useRef, useState, useEffect, useCallback } from 'react';
import { playRefreshSound } from '@/lib/sounds';

/**
 * Pull-to-refresh overlay.
 * Listens on touchstart / touchmove / touchend at the document level.
 * Only activates when the active screen's scroll container is at the top.
 * Shows a spinner while pulling, then a full-screen loader before reload.
 */

const THRESHOLD   = 45;   // px pull distance to trigger refresh
const MAX_PULL    = 130;   // visual cap (dampened)
const SPINNER_SIZE = 36;

export default function PullToRefresh() {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Use refs for values accessed inside touch handlers to avoid stale closures
  const startY       = useRef(0);
  const pulling      = useRef(false);
  const canPull      = useRef(false);
  const pullRef      = useRef(0);       // mirrors pullDistance without re-registering listeners
  const refreshRef   = useRef(false);   // mirrors refreshing

  /** Check whether the active scroll container is at the top */
  const isScrolledToTop = useCallback(() => {
    const activeScreen = document.querySelector('.screen.active');
    if (activeScreen) {
      const scrollBody = activeScreen.querySelector('.scroll-body');
      if (scrollBody && scrollBody.scrollTop > 0) return false;
    }
    const chatMessages = document.querySelector('.chat-messages');
    if (chatMessages && chatMessages.scrollTop > 0) return false;
    return true;
  }, []);

  const doRefresh = useCallback(() => {
    if (refreshRef.current) return; // already refreshing
    refreshRef.current = true;
    setRefreshing(true);
    playRefreshSound();

    // Reload after a short delay so the user sees the loader + hears the sound
    setTimeout(() => {
      window.location.reload();
    }, 600);

    // Safety: if reload didn't work after 3s (e.g. offline PWA), dismiss the loader
    setTimeout(() => {
      refreshRef.current = false;
      setRefreshing(false);
      setPullDistance(0);
      pullRef.current = 0;
    }, 3000);
  }, []);

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (refreshRef.current) return;
      if (!isScrolledToTop()) { canPull.current = false; return; }
      canPull.current = true;
      startY.current = e.touches[0].clientY;
      pulling.current = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (refreshRef.current || !canPull.current) return;
      const dy = e.touches[0].clientY - startY.current;

      if (dy > 10) {
        if (!pulling.current && !isScrolledToTop()) {
          canPull.current = false;
          return;
        }
        pulling.current = true;
        const clamped = Math.min(dy * 0.5, MAX_PULL);
        pullRef.current = clamped;
        setPullDistance(clamped);
        if (dy > 15) e.preventDefault();
      } else {
        pulling.current = false;
        pullRef.current = 0;
        setPullDistance(0);
      }
    };

    const onTouchEnd = () => {
      if (!pulling.current || refreshRef.current) {
        pullRef.current = 0;
        setPullDistance(0);
        pulling.current = false;
        return;
      }

      // Use the ref (never stale) instead of state closure
      if (pullRef.current >= THRESHOLD) {
        doRefresh();
      } else {
        pullRef.current = 0;
        setPullDistance(0);
      }
      pulling.current = false;
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove,   { passive: false });
    document.addEventListener('touchend', onTouchEnd,      { passive: true });

    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [isScrolledToTop, doRefresh]); // stable deps — no re-registration on pull

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
