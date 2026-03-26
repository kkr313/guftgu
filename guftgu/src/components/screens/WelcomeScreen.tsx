import { useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import Avatar from '@/components/Avatar';
import { S } from '@/lib/strings';

export default function WelcomeScreen() {
  const { state, showScreen } = useApp();
  const isActive = state.screen === 'screen-welcome';
  const u = state.user;

  const enterHome = () => {
    if (typeof window !== 'undefined') localStorage.setItem('guftgu_welcomed', '1');
    showScreen('screen-home');
  };

  return (
    <div id="screen-welcome" className={`screen${isActive ? ' active' : ''}`}>
      <div className="welcome-ob-bg" />
      <div className="welcome-ob-content">
        <div className="welcome-ob-avatar" id="wcAvatar">
          <Avatar avatarKey={u.avatar || 'cat'} size={96} />
        </div>
        <div className="welcome-ob-name">{u.nickname || 'Pal'}</div>
        <div className="welcome-ob-tagline">
          Feeling {u.mood || 'Happy'} {u.moodEmoji || '😊'} · {u.intent || 'Just chat'}
        </div>
        <div className="welcome-ob-phone-wrap">
          <div className="welcome-ob-phone-label">{S.welcome.phoneLabel}</div>
          <div className="welcome-ob-phone">{state.guftguPhone || '—'}</div>
          <div className="welcome-ob-phone-hint">{S.welcome.phoneHint}</div>
        </div>
        <div className="welcome-ob-features">
          <div className="welcome-ob-feat">
            <span className="wof-icon">🎭</span>
            <span className="wof-text">{S.welcome.featureAnon}</span>
          </div>
          <div className="welcome-ob-feat">
            <span className="wof-icon">🔒</span>
            <span className="wof-text">{S.welcome.featureNoAccount}</span>
          </div>
          <div className="welcome-ob-feat">
            <span className="wof-icon">
              <svg width="20" height="14" viewBox="0 0 20 14" aria-label="India flag" xmlns="http://www.w3.org/2000/svg">
                <rect width="20" height="14" fill="#138808" />
                <rect width="20" height="9.33" fill="#fff" />
                <rect width="20" height="4.67" fill="#FF9933" />
                <circle cx="10" cy="7" r="2.2" fill="none" stroke="#000080" strokeWidth="0.4" />
                <circle cx="10" cy="7" r="0.4" fill="#000080" />
              </svg>
            </span>
            <span className="wof-text">{S.welcome.featureMadeIn}</span>
          </div>
        </div>
        <div className="welcome-ob-cta" style={{ width: '100%' }}>
          <button className="btn btn-primary welcome-cta-btn" onClick={enterHome}>
            <span className="welcome-cta-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="9" y="2" width="6" height="12" rx="3" fill="#fff"/>
                <path d="M5 11a7 7 0 0014 0" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                <line x1="12" y1="18" x2="12" y2="22" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                <line x1="8" y1="22" x2="16" y2="22" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </span>
            {S.welcome.enterBtn}
          </button>
        </div>
      </div>
    </div>
  );
}
