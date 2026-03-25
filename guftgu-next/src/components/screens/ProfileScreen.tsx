import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import Avatar from '@/components/Avatar';
import MoodModal from '@/components/MoodModal';
import LangModal from '@/components/LangModal';
import RegionModal from '@/components/RegionModal';
import AvatarPickerModal from '@/components/AvatarPickerModal';
import { clearAllData, getBlocked, getCallHistory, getFriends } from '@/lib/storage';
import { deleteUserFromFirebase } from '@/lib/firebase-service';
import { S } from '@/lib/strings';

export default function ProfileScreen() {
  const { state, showScreen, showToast, saveUserData, dbRef, dispatch } = useApp();
  const isActive = state.screen === 'screen-profile';
  const u = state.user;

  const [moodModalOpen, setMoodModalOpen] = useState(false);
  const [langModalOpen, setLangModalOpen] = useState(false);
  const [regionModalOpen, setRegionModalOpen] = useState(false);
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [notificationsOn, setNotificationsOn] = useState(true);
  const [blockedCount, setBlockedCount] = useState(0);
  
  // Stats
  const [stats, setStats] = useState({ chats: 0, calls: 0, friends: 0, totalMinutes: 0 });

  useEffect(() => {
    if (isActive) {
      setBlockedCount(getBlocked().length);
      
      // Fetch real stats
      const callHistory = getCallHistory();
      const friends = getFriends();
      
      // Count calls and calculate total talk time
      const calls = callHistory.length;
      let totalMinutes = 0;
      callHistory.forEach(call => {
        // Parse duration like "2:34" or "12:05"
        const parts = call.duration?.split(':');
        if (parts && parts.length === 2) {
          totalMinutes += parseInt(parts[0], 10) || 0;
          totalMinutes += (parseInt(parts[1], 10) || 0) / 60;
        }
      });
      
      // Count unique chats (unique names from call history)
      const uniqueChats = new Set(callHistory.map(c => c.name)).size;
      
      setStats({
        chats: uniqueChats,
        calls: calls,
        friends: friends.length,
        totalMinutes: Math.round(totalMinutes)
      });
    }
  }, [isActive]);

  const handleMoodSelect = (mood: string, emoji: string) => {
    saveUserData({ ...u, mood, moodEmoji: emoji }, state.guftguPhone);
    setMoodModalOpen(false);
    showToast(S.profile.moodUpdatedToast(emoji));
  };

  const handleLangSelect = (lang: string) => {
    saveUserData({ ...u, language: lang }, state.guftguPhone);
    setLangModalOpen(false);
  };

  const handleRegionSelect = (region: string) => {
    saveUserData({ ...u, region }, state.guftguPhone);
    setRegionModalOpen(false);
    showToast(`Region updated to ${region}!`);
  };

  const handleAvatarSelect = (key: string) => {
    saveUserData({ ...u, avatar: key }, state.guftguPhone);
    setAvatarModalOpen(false);
    showToast(S.profile.avatarUpdatedToast);
  };

  const handleDeleteAccount = async () => {
    const phone = state.guftguPhone;
    const db = dbRef.current;

    // Close modal immediately for better UX
    setDeleteModalOpen(false);
    showToast('Deleting account...');

    try {
      // 1. Delete from Firebase (if connected)
      if (db && phone) {
        await deleteUserFromFirebase(db, phone);
      }

      // 2. Clear all local storage data
      clearAllData();

      // 3. Reset app state completely using LOGOUT action
      dispatch({ type: 'LOGOUT' });

      // 4. Show success toast after state reset
      setTimeout(() => {
        showToast(S.profile.deletedToast);
      }, 100);
    } catch (error) {
      console.error('Delete account error:', error);
      // Still proceed with local cleanup even if Firebase fails
      clearAllData();
      dispatch({ type: 'LOGOUT' });
      setTimeout(() => {
        showToast(S.profile.deletedToast);
      }, 100);
    }
  };

  const copyPhone = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(state.guftguPhone || '');
      showToast(S.profile.copiedToast);
    }
  };

  return (
    <div id="screen-profile" className={`screen${isActive ? ' active' : ''}`}>
      <div className="scroll-body">
        {/* Hero section */}
        <div className="profile-hero">
          <div className="profile-avatar-wrap" onClick={() => setAvatarModalOpen(true)}>
            <div className="profile-avatar">
              <Avatar avatarKey={u.avatar || 'cat'} size={90} />
            </div>
            <div className="profile-edit-badge">{S.profile.editBadge}</div>
          </div>
          <div className="profile-name">{u.nickname || '—'}</div>
          <div className="profile-mood-tag">
            <span>{u.moodEmoji || '�'}</span>
            <span>{u.mood || 'Chill'}</span>
          </div>
          <div className="palcode-card">
            <div className="palcode-icon">{S.profile.phoneIcon}</div>
            <div className="palcode-info">
              <div className="palcode-label">{S.profile.phoneLabel}</div>
              <div className="palcode-value">{state.guftguPhone || '—'}</div>
            </div>
            <button className="palcode-copy" onClick={copyPhone}>{S.profile.copyBtn}</button>
          </div>
        </div>

        {/* Stats - Redesigned */}
        <div className="profile-stats-grid">
          <div className="profile-stat-card accent">
            <div className="stat-icon">💬</div>
            <div className="stat-content">
              <div className="stat-value">{stats.chats}</div>
              <div className="stat-label">Chats</div>
            </div>
          </div>
          <div className="profile-stat-card accent">
            <div className="stat-icon">📞</div>
            <div className="stat-content">
              <div className="stat-value">{stats.calls}</div>
              <div className="stat-label">Calls</div>
            </div>
          </div>
          <div className="profile-stat-card accent">
            <div className="stat-icon">👥</div>
            <div className="stat-content">
              <div className="stat-value">{stats.friends}</div>
              <div className="stat-label">Friends</div>
            </div>
          </div>
          <div className="profile-stat-card accent">
            <div className="stat-icon">⏱️</div>
            <div className="stat-content">
              <div className="stat-value">{stats.totalMinutes}<span className="stat-unit">m</span></div>
              <div className="stat-label">Talk Time</div>
            </div>
          </div>
        </div>

        {/* Preferences Section */}
        <div className="profile-section">
          <div className="section-header">
            <div className="section-title">{S.profile.sectionPreferences}</div>
          </div>
          <div className="setting-item" onClick={() => setLangModalOpen(true)}>
            <div className="setting-icon">{S.profile.settingLangIcon}</div>
            <div className="setting-info">
              <div className="setting-name">{S.profile.settingLang}</div>
              <div className="setting-desc">{u.language || 'Hindi'}</div>
            </div>
            <div className="setting-arrow">{S.common.settingArrow}</div>
          </div>
          <div className="setting-item" onClick={() => setMoodModalOpen(true)}>
            <div className="setting-icon">{S.profile.settingMoodIcon}</div>
            <div className="setting-info">
              <div className="setting-name">{S.profile.settingMood}</div>
              <div className="setting-desc">{u.mood || 'Chill'} {u.moodEmoji || '😎'}</div>
            </div>
            <div className="setting-arrow">{S.common.settingArrow}</div>
          </div>
          <div className="setting-item" onClick={() => setRegionModalOpen(true)}>
            <div className="setting-icon">{S.profile.settingRegionIcon}</div>
            <div className="setting-info">
              <div className="setting-name">{S.profile.settingRegion}</div>
              <div className="setting-desc">{u.region || 'North'}</div>
            </div>
            <div className="setting-arrow">{S.common.settingArrow}</div>
          </div>
        </div>

        {/* Privacy Section */}
        <div className="profile-section">
          <div className="section-header">
            <div className="section-title">{S.profile.sectionPrivacy}</div>
          </div>
          <div className="setting-item">
            <div className="setting-icon">{S.profile.settingNotifIcon}</div>
            <div className="setting-info">
              <div className="setting-name">{S.profile.settingNotif}</div>
              <div className="setting-desc">{S.profile.settingNotifDesc}</div>
            </div>
            <div
              className={`toggle${notificationsOn ? ' on' : ''}`}
              onClick={() => setNotificationsOn(!notificationsOn)}
            />
          </div>
          <div className="setting-item" onClick={() => showScreen('screen-blocked')}>
            <div className="setting-icon">{S.profile.settingBlockedIcon}</div>
            <div className="setting-info">
              <div className="setting-name">{S.profile.settingBlocked}</div>
              <div className="setting-desc">{blockedCount > 0 ? `${blockedCount} blocked` : S.profile.settingBlockedDesc}</div>
            </div>
            <div className="setting-arrow">{S.common.settingArrow}</div>
          </div>
        </div>

        {/* App Section */}
        <div className="profile-section" style={{ marginBottom: 12 }}>
          <div className="section-header">
            <div className="section-title">{S.profile.sectionApp}</div>
          </div>
          <div className="setting-item" onClick={() => showScreen('screen-appinfo')}>
            <div className="setting-icon">{S.profile.settingAboutIcon}</div>
            <div className="setting-info">
              <div className="setting-name">{S.profile.settingAbout}</div>
              <div className="setting-desc">{S.profile.settingAboutDesc}</div>
            </div>
            <div className="setting-arrow">{S.common.settingArrow}</div>
          </div>
          <div className="setting-item" onClick={() => setHelpModalOpen(true)}>
            <div className="setting-icon">💬</div>
            <div className="setting-info">
              <div className="setting-name">Help & Support</div>
              <div className="setting-desc">Get help via email or WhatsApp</div>
            </div>
            <div className="setting-arrow">{S.common.settingArrow}</div>
          </div>
          <div className="setting-item" onClick={() => window.location.href = 'mailto:guftgu31398@gmail.com?subject=Report%20-%20Guftgu&body=Describe%20the%20issue%3A%0A%0A'}>
            <div className="setting-icon">🚨</div>
            <div className="setting-info">
              <div className="setting-name">Report an Issue</div>
              <div className="setting-desc">Report bugs or abuse via email</div>
            </div>
            <div className="setting-arrow">{S.common.settingArrow}</div>
          </div>
          <div className="setting-item" onClick={() => setDeleteModalOpen(true)}>
            <div className="setting-icon">{S.profile.settingDeleteIcon}</div>
            <div className="setting-info">
              <div className="setting-name" style={{ color: 'var(--accent)' }}>{S.profile.settingDelete}</div>
              <div className="setting-desc">{S.profile.settingDeleteDesc}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <MoodModal open={moodModalOpen} selected={u.mood || 'Happy'} onSelect={handleMoodSelect} onClose={() => setMoodModalOpen(false)} />
      <LangModal open={langModalOpen} selected={u.language || 'Hindi'} onSelect={handleLangSelect} onClose={() => setLangModalOpen(false)} />
      <RegionModal open={regionModalOpen} selected={u.region || 'North'} onSelect={handleRegionSelect} onClose={() => setRegionModalOpen(false)} />
      <AvatarPickerModal open={avatarModalOpen} selected={u.avatar || 'cat'} onSelect={handleAvatarSelect} onClose={() => setAvatarModalOpen(false)} />

      {/* Delete Account Modal */}
      <div className={`modal-overlay${deleteModalOpen ? ' show' : ''}`} onClick={() => setDeleteModalOpen(false)}>
        <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="modal-handle" />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center', padding: '14px 20px 0' }}>
            <div className="delete-icon">{S.profile.deleteModalIcon}</div>
            <div className="delete-title">{S.profile.deleteModalTitle}</div>
            <div className="delete-desc">
              {S.profile.deleteModalDesc}
            </div>
            <div className="delete-actions" style={{ display: 'flex', gap: 10, width: '100%', paddingBottom: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setDeleteModalOpen(false)}>{S.common.cancel}</button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={handleDeleteAccount}>
                {S.common.delete}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Help & Support Modal */}
      <div className={`modal-overlay${helpModalOpen ? ' show' : ''}`} onClick={() => setHelpModalOpen(false)}>
        <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="modal-handle" />
          <div style={{ padding: '14px 20px 20px' }}>
            <div style={{ fontSize: 18, fontWeight: 600, textAlign: 'center', marginBottom: 16 }}>💬 Help & Support</div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 20 }}>
              Need help? Reach out to us anytime. We're here to assist you!
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <a
                href="mailto:guftgu31398@gmail.com?subject=Help%20Request%20-%20Guftgu"
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'var(--card-bg)', borderRadius: 12, textDecoration: 'none', color: 'inherit' }}
              >
                <div style={{ fontSize: 24 }}>📧</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>Email Us</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>guftgu31398@gmail.com</div>
                </div>
              </a>
              <a
                href="https://wa.me/919597831754?text=Hi%2C%20I%20need%20help%20with%20Guftgu%20app"
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'var(--card-bg)', borderRadius: 12, textDecoration: 'none', color: 'inherit' }}
              >
                <div style={{ fontSize: 24 }}>💬</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>WhatsApp</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>+91 95978 31754</div>
                </div>
              </a>
            </div>
            <button className="btn btn-ghost" style={{ width: '100%', marginTop: 16 }} onClick={() => setHelpModalOpen(false)}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
