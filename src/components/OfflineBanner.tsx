import { useState, useEffect } from 'react';

/**
 * Full-screen overlay shown when internet is disconnected while app is loaded.
 * This handles the PWA scenario where the cached SPA loads but has no connectivity.
 * Uses navigator.onLine + online/offline events for real-time detection.
 */
export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);

    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);

    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  // Show with a tiny delay so it doesn't flash during brief reconnects
  useEffect(() => {
    if (isOffline) {
      const t = setTimeout(() => setShow(true), 800);
      return () => clearTimeout(t);
    } else {
      setShow(false);
    }
  }, [isOffline]);

  if (!show) return null;

  return (
    <div className="offline-overlay">
      <div className="offline-card">
        <div className="offline-icon">📶</div>
        <h2 className="offline-title">You're Offline</h2>
        <p className="offline-tagline">बात करो, दिल से</p>
        <p className="offline-desc">
          Guftgu needs an internet connection for voice calls and messaging. 
          Please check your Wi-Fi or mobile data.
        </p>
        <button className="offline-retry-btn" onClick={() => window.location.reload()}>
          Try Again
        </button>
        <div className="offline-hint">We'll reconnect automatically when you're back online ✨</div>
      </div>
    </div>
  );
}
