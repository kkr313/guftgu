import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import Avatar from '@/components/Avatar';
import MoodModal from '@/components/MoodModal';
import LangModal from '@/components/LangModal';
import RegionModal from '@/components/RegionModal';
import { callTypeClass, getGreeting, REGION_DATA } from '@/lib/data';
import { useCallHistory } from '@/hooks/useCallHistory';
import { useOnlineCount } from '@/hooks/useOnlineCount';
import { checkUserForCall, initiateCall } from '@/lib/firebase-service';
import { formatRelativeTime, getDisplayName } from '@/lib/storage';
import { IconPhone, IconBell } from '@/lib/icons';
import { S } from '@/lib/strings';

export default function HomeScreen() {
  const { state, dispatch, showScreen, showToast, saveUserData, dbRef, unreadNotifCount } = useApp();
  const isActive = state.screen === 'screen-home';
  const u = state.user;

  const [moodModalOpen, setMoodModalOpen] = useState(false);
  const [langModalOpen, setLangModalOpen] = useState(false);
  const [regionModalOpen, setRegionModalOpen] = useState(false);
  const [dialInput, setDialInput] = useState('');
  const [isDialing, setIsDialing] = useState(false);

  // Hooks — replace duplicated inline logic
  const callHistory = useCallHistory(isActive);
  const onlineCount = useOnlineCount(isActive, dbRef, state.guftguPhone);
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

  const handleRegionSelect = (region: string) => {
    saveUserData({ ...u, region }, state.guftguPhone);
    setRegionModalOpen(false);
    showToast(`Region updated to ${region}`);
  };

  const regionIcon = REGION_DATA.find(r => r.region === u.region)?.icon || '📍';

  const handleDial = async () => {
    // Don't allow starting a call with a different person if already in a call
    if (state.currentPal) {
      showToast('📞 Please end your current call first');
      return;
    }

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
      showToast('Connection error — try again');
      return;
    }

    setIsDialing(true);
    try {
      console.log('[HomeScreen] Checking user:', targetPhone, 'myPhone:', state.guftguPhone);
      const result = await checkUserForCall(dbRef.current, targetPhone, state.guftguPhone);
      console.log('[HomeScreen] Check result:', result);

      if (!result.exists) {
        console.log('[HomeScreen] User not found');
        showToast(S.home.userNotFound);
        setIsDialing(false);
        return;
      }

      // If target has blocked me, show generic "not available" (hide real reason)
      if (result.blockedByTarget) {
        console.log('[HomeScreen] Blocked by target');
        showToast(S.home.userNotAvailable);
        setIsDialing(false);
        return;
      }

      if (!result.online) {
        console.log('[HomeScreen] User offline');
        showToast(S.home.userOffline);
        setIsDialing(false);
        return;
      }

      // User exists and is online — initiate call via Firebase
      await initiateCall(dbRef.current, state.guftguPhone, state.user, targetPhone);
      
      // Set the pal info with outgoing call flag
      dispatch({
        type: 'SET_PAL',
        pal: {
          phone: targetPhone,
          name: result.user?.name || 'Anonymous',
          avatar: result.user?.avatar || 'cat',
          mood: result.user?.mood || '',
          moodEmoji: result.user?.moodEmoji || '',
          isOutgoingCall: true, // We initiated this call
        },
      });
      
      showToast(`📞 Calling ${result.user?.name || 'User'}...`);
      setDialInput('');
      
      // Go to call screen in "ringing" state
      // CallScreen will handle listening for accept/decline
      showScreen('screen-call');
      
    } catch (error) {
      console.error('Dial error:', error);
      showToast('Something went wrong — try again');
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
          <div className="home-topbar-actions">
            <button className="home-notif-btn" onClick={() => showScreen('screen-notifications')} style={{ position: 'relative' }}>
              <IconBell size={20} />
              {unreadNotifCount > 0 && (
                <span className="nav-badge" style={{ top: 0, right: 0 }} aria-label={`${unreadNotifCount} unread`}>
                  {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                </span>
              )}
            </button>
            <div className="home-avatar-btn" onClick={() => showScreen('screen-profile')}>
              <Avatar avatarKey={u.avatar || 'cat'} size={42} />
            </div>
          </div>
        </div>

        {/* Online count - right aligned */}
        <div className="online-count-row">
          <div className="online-pill">
            <div className="online-dot" />
            {onlineCount || '...'}
          </div>
        </div>

        {/* Find button */}
        <div className="home-match-section">
          <button className="find-btn" onClick={() => showScreen('screen-match')}>
            <div className="find-btn-glow" />
            <div className="find-btn-tap-hint">
              <span className="tap-hand">👆</span>
              <span className="tap-ripple" />
            </div>
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

        {/* Match Preferences — 3 circle options */}
        <div className="match-prefs-section">
          <div className="match-prefs-header">
            <div className="match-prefs-title">{S.home.matchPrefsTitle}</div>
            <div className="match-prefs-sub">{S.home.matchPrefsSub}</div>
          </div>
          <div className="match-prefs-circles">
            <div className="match-pref-item" onClick={() => setMoodModalOpen(true)}>
              <div className="match-pref-circle mood-circle">
                <span className="match-pref-emoji">{u.moodEmoji || '😊'}</span>
              </div>
              <div className="match-pref-label">{S.home.mood}</div>
              <div className="match-pref-value">{u.mood || 'Happy'}</div>
            </div>
            <div className="match-pref-item" onClick={() => setLangModalOpen(true)}>
              <div className="match-pref-circle lang-circle">
                <span className="match-pref-emoji">🌐</span>
              </div>
              <div className="match-pref-label">{S.home.language}</div>
              <div className="match-pref-value">{u.language || 'Hindi'}</div>
            </div>
            <div className="match-pref-item" onClick={() => setRegionModalOpen(true)}>
              <div className="match-pref-circle region-circle">
                <span className="match-pref-emoji">{regionIcon}</span>
              </div>
              <div className="match-pref-label">{S.home.region}</div>
              <div className="match-pref-value">{u.region || 'North'}</div>
            </div>
          </div>
        </div>


        {/* Call a friend dial */}
        <div className="home-dial-card">
          <div className="dial-header">
            <div className="dial-title">{S.home.callAFriend}</div>
            <div className="dial-my-number">Your #: <span>{state.guftguPhone || '—'}</span></div>
          </div>
          <div className="dial-input-row">
            <input
              className={`dial-input${dialInput.length >= 7 ? ' dial-valid' : ''}`}
              type="text"
              placeholder={S.home.dialPlaceholder}
              value={dialInput}
              onChange={(e) => setDialInput(e.target.value.replace(/\D/g, '').slice(0, 7))}
              disabled={isDialing}
              onKeyDown={(e) => e.key === 'Enter' && dialInput.length >= 7 && handleDial()}
              maxLength={7}
              inputMode="numeric"
              pattern="[0-9]*"
            />
            <button 
              className={`dial-call-btn${isDialing ? ' dialing' : ''}${dialInput.length < 7 || !!state.currentPal ? ' disabled' : ''}`} 
              onClick={handleDial}
              disabled={isDialing || dialInput.length < 7 || !!state.currentPal}
              title={state.currentPal ? 'Cannot call during an active call' : ''}
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
                  <div className="hist-name">{getDisplayName(c.phone || '', c.name)}</div>
                  <div className="hist-detail">{c.duration || '00:00'}</div>
                </div>
                <div className="hist-meta">
                  <span className="hist-time">{formatRelativeTime(c.callStartedAt || c.timestamp)}</span>
                  <span className={`hist-type ${callTypeClass(c.type)}`}>{c.type || 'Outgoing'}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modals */}
      <MoodModal open={moodModalOpen} selected={u.mood || 'Happy'} onSelect={handleMoodSelect} onClose={() => setMoodModalOpen(false)} />
      <LangModal open={langModalOpen} selected={u.language || 'Hindi'} onSelect={handleLangSelect} onClose={() => setLangModalOpen(false)} />
      <RegionModal open={regionModalOpen} selected={u.region || 'North'} onSelect={handleRegionSelect} onClose={() => setRegionModalOpen(false)} />
    </div>
  );
}
