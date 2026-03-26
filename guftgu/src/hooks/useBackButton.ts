import { useEffect, useRef, useCallback } from 'react';

/**
 * Mobile-first hardware/browser back & forward button blocker.
 *
 * Strategy:
 * 1.  Seed two history entries on init and always stay in the middle.
 *     This traps both back AND forward — popstate fires for both.
 * 2.  On every popstate we immediately replace back to the "middle" slot,
 *     so the browser never actually navigates away.
 * 3.  CSS `overscroll-behavior-x: none` blocks swipe-to-navigate on mobile.
 * 4.  Screens can register custom back handlers via `useBackHandler`.
 */

// ── Global handler stack (shared across hook instances) ──
type BackHandler = () => boolean | void;

const handlerStack: { id: string; fn: BackHandler }[] = [];

let popstateAttached = false;
let lastBackTap = 0;

function attachPopstate(fallback: () => void, showToast: (m: string) => void, getScreen: () => string) {
  if (popstateAttached) return;
  popstateAttached = true;

  // Build a 3-entry stack: [guard-back] [★ current ★] [guard-forward]
  // We always stay on the middle entry so both back & forward are trapped.
  window.history.replaceState({ guftgu: 'back-guard' }, '');
  window.history.pushState({ guftgu: 'current' }, '');       // ← we live here
  window.history.pushState({ guftgu: 'forward-guard' }, '');
  window.history.back(); // move to the middle "current" slot

  window.addEventListener('popstate', (e) => {
    const tag = e.state?.guftgu;

    if (tag === 'back-guard') {
      // User pressed browser BACK → push back to the middle
      window.history.pushState({ guftgu: 'current' }, '');
      window.history.pushState({ guftgu: 'forward-guard' }, '');
      window.history.back(); // stay on "current"

      // Invoke the app's back logic
      if (handlerStack.length > 0) {
        handlerStack[handlerStack.length - 1].fn();
        return;
      }
      const screen = getScreen();
      if (screen === 'screen-home') {
        const now = Date.now();
        if (now - lastBackTap < 2000) {
          window.close();
        } else {
          lastBackTap = now;
          showToast('Press back again to exit');
        }
      } else {
        fallback();
      }
      return;
    }

    if (tag === 'forward-guard') {
      // User pressed browser FORWARD → just go back to middle, ignore
      window.history.back();
      return;
    }

    // Any other state (e.g. "current") — rebuild the guard if needed
    // This handles edge cases where the stack gets out of sync
    window.history.pushState({ guftgu: 'forward-guard' }, '');
    window.history.back();
  });

  // Block mobile swipe-to-navigate gesture (Chrome, Edge, Safari)
  document.documentElement.style.overscrollBehaviorX = 'none';
  document.body.style.overscrollBehaviorX = 'none';
}

/**
 * Call from a root component (e.g. AppProvider) to wire up the global listener.
 * Only needs to be called once.
 */
export function useBackButtonInit(
  goBack: () => void,
  showToast: (m: string) => void,
  getScreen: () => string,
) {
  useEffect(() => {
    attachPopstate(goBack, showToast, getScreen);
  }, [goBack, showToast, getScreen]);

  /** Call this whenever you navigate (screen change, onboard step, etc.) */
  const pushHistory = useCallback(() => {
    window.history.pushState({ guftgu: true }, '');
  }, []);

  return { pushHistory };
}

/**
 * Call from individual screens to register a custom back handler.
 * Return `true` from the handler if you consumed the event.
 *
 * Example (OnboardScreen):
 *   useBackHandler('onboard', () => { if (step > 0) goPrev(); });
 */
export function useBackHandler(id: string, handler: BackHandler) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const entry = { id, fn: () => handlerRef.current() };
    handlerStack.push(entry);
    return () => {
      const idx = handlerStack.findIndex((h) => h === entry);
      if (idx !== -1) handlerStack.splice(idx, 1);
    };
  }, [id]);
}
