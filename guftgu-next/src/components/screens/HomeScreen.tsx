import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import Avatar from '@/components/Avatar';
import MoodModal from '@/components/MoodModal';
import LangModal from '@/components/LangModal';
import { callTypeClass, getGreeting } from '@/lib/data';
import { useCallHistory } from '@/hooks/useCallHistory';
import { useOnlineCount } from '@/hooks/useOnlineCount';
import { checkUserForCall } from '@/lib/firebase-service';
import { IconPhone } from '@/lib/icons';
import { S } from '@/lib/strings';

export default function HomeScreen() {
  const { state, dispatch, showScreen, showToast, saveUserData, dbRef } = useApp();
  const isActive = state.screen === 'screen-home';
  const u = state.user;

  const [moodModalOpen, setMoodModalOpen] = useState(false);
  const [langModalOpen, setLangModalOpen] = useState(false);
  const [autoConnect, setAutoConnect] = useState(false);
  const [dialInput, setDialInput] = useState('');
  const [isDialing, setIsDialing] = useState(false);

  // Hooks — replace duplicated inline logic
  const callHistory = useCallHistory(isActive);
  const onlineCount = useOnlineCount(isActive, dbRef);
  const greeting = getGreeting();

  const handleMoodSelect = (mood: string, emoji: string) => {
    saveUserData({ ...u, mood, moodEmoji: emoji }, state.guftguPhone);
    setMoodModalOpen(false);
    showToast(`Mood set to ${emoji} ${mood}`);
  };

  const handleLangSelect = (lang: string) => {
    saveUserData({ ...u, language: lang }, state.guftguPhone);
    setLangModalOpen(false);
    showToast(`Language set to ${lang}`);
  };

  const handleToggleAutoConnect = () => {
    setAutoConnect(!autoConnect);
    showToast(!autoConnect ? S.home.autoConnectOn : S.home.autoConnectOff);
  };

  const handleDial = async () => {
    const targetPhone = dialInput.trim();
    
    // Empty check
    if (!targetPhone) {
      showToast(S.home.enterNumberToast);
      return;
    }

    // Can't call yourself
    if (targetPhone === state.guftguPhone) {
      showToast(S.home.cantCallSelf);
      return;
    }

    // Check Firebase for user existence and online status
    if (!dbRef?.current) {
      showToast('❌ Connection error — try again');
      return;
    }

    setIsDialing(true);
    try {
      const result = await checkUserForCall(dbRef.current, targetPhone);

      if (!result.exists) {
        showToast(S.home.userNotFound);
        setIsDialing(false);
        return;
      }

      if (!result.online) {
        showToast(S.home.userOffline);
        setIsDialing(false);
        return;
      }

      // User exists and is online — proceed with call
      showToast(S.home.connectingTo(result.user?.name || 'User'));
      
      // Set the pal and go to call screen
      dispatch({
        type: 'SET_PAL',
        pal: {
          phone: targetPhone,
          name: result.user?.name || 'Anonymous',
          avatar: result.user?.avatar || 'cat',
          mood: result.user?.mood || '',
          moodEmoji: result.user?.moodEmoji || '',
        },
      });
      
      setDialInput('');
      showScreen('screen-call');
    } catch (error) {
      console.error('Dial error:', error);
      showToast('❌ Something went wrong — try again');
    } finally {
      setIsDialing(false);
    }
  };

  return (
    <div id="screen-home" className={`screen${isActive ? ' active' : ''}`}>
      <div className="scroll-body">
        {/* Top bar */}
        <div className="home-topbar">
          <div className="home-greeting-wrap">
            <div className="home-greeting">{greeting}</div>
            <div className="home-name">Hey, {u.nickname || 'Pal'}</div>
          </div>
          <div className="home-avatar-btn" onClick={() => showScreen('screen-profile')}>
            <Avatar avatarKey={u.avatar || 'cat'} size={42} />
          </div>
        </div>

        {/* Online count */}
        <div style={{ padding: '8px 20px 0' }}>
          <div className="online-pill">
            <div className="online-dot" />
            {onlineCount || '...'}
          </div>
        </div>

        {/* Find button */}
        <div className="home-match-section">
          <button className="find-btn" onClick={() => showScreen('screen-match')}>
            <div className="find-btn-glow" />
            <div className="find-btn-content">
              <div className="find-btn-top">
                <div className="find-btn-icon">🎙️</div>
                <div className="find-btn-label">{S.home.findGuftgu}</div>
              </div>
              <div className="find-btn-sub">
                {u.language || 'Hindi'} · {u.mood || 'Any mood'} · {u.intent || 'Just chat'}
              </div>
            </div>
            <div className="find-btn-arrow">→</div>
          </button>
        </div>

        {/* Preference cards */}
        <div className="home-prefs">
          <div className="home-pref-card" onClick={() => setMoodModalOpen(true)}>
            <div className="home-pref-icon">{u.moodEmoji || '😊'}</div>
            <div className="home-pref-info">
              <div className="home-pref-label">{S.home.mood}</div>
              <div className="home-pref-value">{u.mood || 'Happy'}</div>
            </div>
            <div className="home-pref-action">✎</div>
          </div>
          <div className="home-pref-card" onClick={() => setLangModalOpen(true)}>
            <div className="home-pref-icon">🌐</div>
            <div className="home-pref-info">
              <div className="home-pref-label">{S.home.language}</div>
              <div className="home-pref-value">{u.language || 'Hindi'}</div>
            </div>
            <div className="home-pref-action">✎</div>
          </div>
        </div>
        <div className="home-pref-hint">Tap a card to change your match preferences</div>

        {/* Auto connect */}
        <div className="home-auto-connect" onClick={handleToggleAutoConnect}>
          <div className="hac-left">
            <div className="hac-icon">⚡</div>
            <div className="hac-text">{S.home.autoConnect}</div>
          </div>
          <div className={`hac-toggle${autoConnect ? ' on' : ''}`} />
        </div>

        {/* Call a friend dial */}
        <div className="home-dial-card">
          <div className="dial-header">
            <div className="dial-title">{S.home.callAFriend}</div>
            <div className="dial-my-number">Your #: <span>{state.guftguPhone || '—'}</span></div>
          </div>
          <div className="dial-input-row">
            <input
              className="dial-input"
              type="text"
              placeholder={S.home.dialPlaceholder}
              value={dialInput}
              onChange={(e) => setDialInput(e.target.value)}
              disabled={isDialing}
              onKeyDown={(e) => e.key === 'Enter' && handleDial()}
            />
            <button 
              className={`dial-call-btn${isDialing ? ' dialing' : ''}`} 
              onClick={handleDial}
              disabled={isDialing}
            >
              {isDialing ? (
                <span className="dial-spinner">⏳</span>
              ) : (
                <IconPhone size={20} color="#0A0B10" strokeWidth={2.5} />
              )}
            </button>
          </div>
        </div>

        {/* Recent calls */}
        <div className="home-section">
          <div className="home-section-header">
            <div className="home-section-title">{S.home.recentCalls}</div>
            <div className="home-section-action" onClick={() => showScreen('screen-history')}>{S.home.seeAll}</div>
          </div>
          {callHistory.length === 0 ? (
            <div className="home-empty">
              <div className="home-empty-icon">{S.home.emptyCallsIcon}</div>
              <div className="home-empty-text">{S.home.emptyCallsText}</div>
            </div>
          ) : (
            callHistory.slice(0, 5).map((c, i) => (
              <div key={i} className="history-item">
                <div className="hist-avatar">
                  <Avatar avatarKey={c.avatar || 'cat'} size={28} />
                </div>
                <div className="hist-info">
                  <div className="hist-name">{c.name}</div>
                  <div className="hist-detail">{c.duration || 'Missed'}</div>
                </div>
                <div className="hist-meta">
                  <span className="hist-time">{c.time || ''}</span>
                  <span className={`hist-type ${callTypeClass(c.type)}`}>{c.type || 'Outgoing'}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Bottom pills */}
        <div className="home-history-row">
          <div className="home-pill-btn" onClick={() => showScreen('screen-history')}>{S.home.callHistoryPill}</div>
          <div className="home-pill-btn" onClick={() => showScreen('screen-chats')}>{S.home.friendsPill}</div>
        </div>
      </div>

      {/* Modals */}
      <MoodModal open={moodModalOpen} selected={u.mood || 'Happy'} onSelect={handleMoodSelect} onClose={() => setMoodModalOpen(false)} />
      <LangModal open={langModalOpen} selected={u.language || 'Hindi'} onSelect={handleLangSelect} onClose={() => setLangModalOpen(false)} />
    </div>
  );
}
