import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProvider } from '@/context/AppContext';
import App from './App';
import './globals.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
);

// ── Register PWA Service Worker ──
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('[PWA] Service Worker registered, scope:', reg.scope);

        // Check for updates every 60 seconds
        setInterval(() => reg.update(), 60 * 1000);

        // Notify user when a new version is available
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available — auto-refresh on next navigation
              console.log('[PWA] New version available, will activate on reload');
            }
          });
        });
      })
      .catch((err) => {
        console.warn('[PWA] Service Worker registration failed:', err);
      });
  });
}
