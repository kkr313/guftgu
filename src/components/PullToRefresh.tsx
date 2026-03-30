import { useRef, useState, useEffect, useCallback } from 'react';
import { playRefreshSound } from '@/lib/sounds';

/**
 * Pull-to-refresh overlay.
 * Wrap around your app content. When the user pulls down from the top
 * of the page the spinner appears and `window.location.reload()` fires.
 *
 * The component listens on `touchstart / touchmove / touchend` at the
 * document level and checks whether the active scroll container is at
 * scrollTop ≤ 0 before activating, so normal scrolling is unaffected.
 *
 * Once triggered, a full-screen refresh loader is shown until the page reloads.
 */

const THRESHOLD = 90;   // px the user must pull before we trigger
const MAX_PULL   = 130;  // visual cap so the spinner doesn't fly away
const SPINNER_SIZE = 36;

export default function PullToRefresh() {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const startY    = useRef(0);
  const pulling   = useRef(false);
  const canPull   = useRef(false);

  /** Check whether any ancestor scroll-container is scrolled down */
  const isScrolledToTop = useCallback(() => {
    // Check the active screen's .scroll-body
    const activeScreen = document.querySelector('.screen.active');
    if (activeScreen) {
      const scrollBody = activeScreen.querySelector('.scroll-body');
      if (scrollBody && scrollBody.scrollTop > 0) return false;
    }

    // Also check the chat messages area
    const chatMessages = document.querySelector('.chat-messages');
    if (chatMessages && chatMessages.scrollTop > 0) return false;

    return true;
  }, []);

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (refreshing) return;
      if (!isScrolledToTop()) { canPull.current = false; return; }
      canPull.current = true;
      startY.current = e.touches[0].clientY;
      pulling.current = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (refreshing || !canPull.current) return;
      const dy = e.touches[0].clientY - startY.current;

      if (dy > 10) {
        // Only start if still at top (user might have started scrolling)
        if (!pulling.current && !isScrolledToTop()) {
          canPull.current = false;
          return;
        }
        pulling.current = true;
        const clamped = Math.min(dy * 0.5, MAX_PULL);  // dampen
        setPullDistance(clamped);
        // Prevent the browser's native pull-to-refresh
        if (dy > 15) e.preventDefault();
      } else {
        pulling.current = false;
        setPullDistance(0);
      }
    };

    const onTouchEnd = () => {
      if (!pulling.current || refreshing) {
        setPullDistance(0);
        pulling.current = false;
        return;
      }
      if (pullDistance >= THRESHOLD * 0.5) {
        // Trigger refresh
        playRefreshSound();
        setRefreshing(true);
        setPullDistance(THRESHOLD * 0.5);
        setTimeout(() => window.location.reload(), 800);
      } else {
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
  }, [refreshing, pullDistance, isScrolledToTop]);

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

  const progress = Math.min(pullDistance / (THRESHOLD * 0.5), 1);
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
