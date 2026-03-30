import { useState, useEffect, useRef } from 'react';

const STORAGE_KEY = 'guftgu_gesture_tip_seen';
const AUTO_CLOSE_MS = 5000;

const tips = [
  { icon: '👆↓', title: 'Pull to Refresh', desc: 'Swipe down from the top of any screen to reload the app.' },
  { icon: '🔙',  title: 'In-App Back Only', desc: 'Browser & hardware back buttons are disabled. Use the ← button inside the app.' },
  { icon: '📱',  title: 'Works Offline', desc: 'This is a PWA — add it to your home screen for the best experience.' },
];

export default function GestureTip() {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Only show once ever
    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
    } catch { /* ignore */ }

    // Small delay so the app renders first
    const showTimer = setTimeout(() => setVisible(true), 600);
    return () => clearTimeout(showTimer);
  }, []);

  useEffect(() => {
    if (!visible) return;
    // Auto-close after 5 seconds
    timerRef.current = setTimeout(() => dismiss(), AUTO_CLOSE_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [visible]);

  const dismiss = () => {
    setClosing(true);
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }
    setTimeout(() => setVisible(false), 300); // let exit animation play
  };

  if (!visible) return null;

  return (
    <div className={`gesture-tip-overlay${closing ? ' gesture-tip-closing' : ''}`} onClick={dismiss}>
      <div className="gesture-tip-card" onClick={(e) => e.stopPropagation()}>
        {/* Progress bar (auto-close countdown) */}
        <div className="gesture-tip-progress">
          <div
            className="gesture-tip-progress-bar"
            style={{ animationDuration: `${AUTO_CLOSE_MS}ms` }}
          />
        </div>

        <div className="gesture-tip-header">
          <span className="gesture-tip-emoji">💡</span>
          <span className="gesture-tip-title">Quick Tips</span>
        </div>

        <div className="gesture-tip-list">
          {tips.map((tip, i) => (
            <div key={i} className="gesture-tip-item">
              <span className="gesture-tip-item-icon">{tip.icon}</span>
              <div className="gesture-tip-item-text">
                <div className="gesture-tip-item-title">{tip.title}</div>
                <div className="gesture-tip-item-desc">{tip.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <button className="gesture-tip-close" onClick={dismiss}>Got it!</button>
      </div>
    </div>
  );
}
