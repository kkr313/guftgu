import { useEffect, useCallback } from 'react';

/**
 * FULLY disable browser back / forward / hardware back.
 *
 * Strategy:
 * 1.  Seed a 3-entry history stack: [guard-back] [★current★] [guard-forward].
 * 2.  On every popstate we silently restore the middle slot — the browser
 *     never actually navigates away and NO app logic runs.
 * 3.  All in-app navigation is done via React state (`showScreen`, `goBack`),
 *     which never touches `window.history`, so the trap stays intact.
 * 4.  CSS `overscroll-behavior-x: none` blocks swipe-to-navigate on mobile.
 */

let popstateAttached = false;

function attachPopstate() {
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
      // User pressed browser/hardware BACK → silently restore the middle slot
      window.history.pushState({ guftgu: 'current' }, '');
      window.history.pushState({ guftgu: 'forward-guard' }, '');
      window.history.back(); // stay on "current"
      // Do NOTHING — back is fully disabled
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

  // Block keyboard shortcuts for back/forward (Alt+Left, Alt+Right, Backspace)
  window.addEventListener('keydown', (e) => {
    // Alt + ArrowLeft / Alt + ArrowRight (browser back/forward)
    if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      return;
    }
    // Backspace when not focused on an input (some browsers navigate back)
    if (e.key === 'Backspace') {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag !== 'INPUT' && tag !== 'TEXTAREA' && !(e.target as HTMLElement)?.isContentEditable) {
        e.preventDefault();
      }
    }
  });
}

/**
 * Call from a root component (e.g. AppProvider) to wire up the global listener.
 * Only needs to be called once. Browser/hardware back & forward are fully dead.
 * Only in-app back buttons (which call goBack / showScreen) will navigate.
 */
export function useBackButtonInit(
  _goBack: () => void,
  _showToast: (m: string) => void,
  _getScreen: () => string,
) {
  useEffect(() => {
    attachPopstate();
  }, []);

  /** Call this whenever you navigate (screen change, onboard step, etc.) */
  const pushHistory = useCallback(() => {
    // No-op: we no longer push history entries for screen changes
    // because the history stack is locked in a permanent 3-entry trap.
  }, []);

  return { pushHistory };
}
