import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import Avatar from '@/components/Avatar';
import MoodModal from '@/components/MoodModal';
import LangModal from '@/components/LangModal';
import RegionModal from '@/components/RegionModal';
import AvatarPickerModal from '@/components/AvatarPickerModal';
import { clearAllData } from '@/lib/storage';
import { S } from '@/lib/strings';

export default function ProfileScreen() {
  const { state, showScreen, showToast, saveUserData } = useApp();
  const isActive = state.screen === 'screen-profile';
  const u = state.user;

  const [moodModalOpen, setMoodModalOpen] = useState(false);
  const [langModalOpen, setLangModalOpen] = useState(false);
  const [regionModalOpen, setRegionModalOpen] = useState(false);
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

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
  };

  const handleAvatarSelect = (key: string) => {
    saveUserData({ ...u, avatar: key }, state.guftguPhone);
    setAvatarModalOpen(false);
    showToast(S.profile.avatarUpdatedToast);
  };

  const handleDeleteAccount = () => {
    clearAllData();
    setDeleteModalOpen(false);
    showScreen('screen-onboard');
    showToast(S.profile.deletedToast);
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
            {u.moodEmoji || '😊'} {u.mood || 'Happy'}
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

        {/* Stats */}
        <div className="profile-stats">
          <div className="profile-stat">
            <div className="stat-value">0</div>
            <div className="stat-label">{S.profile.statCalls}</div>
          </div>
          <div className="profile-stat">
            <div className="stat-value">0</div>
            <div className="stat-label">{S.profile.statFriends}</div>
          </div>
          <div className="profile-stat">
            <div className="stat-value">0h</div>
            <div className="stat-label">{S.profile.statTalkTime}</div>
          </div>
        </div>

        {/* Settings */}
        <div className="profile-section">
          <div className="setting-item" onClick={() => setMoodModalOpen(true)}>
            <div className="setting-icon" style={{ background: 'rgba(255,107,107,0.1)' }}>{S.profile.settingMoodIcon}</div>
            <div className="setting-info">
              <div className="setting-name">{S.profile.settingMood}</div>
              <div className="setting-desc">{u.mood || '—'} {u.moodEmoji || ''}</div>
            </div>
            <div className="setting-arrow">{S.common.settingArrow}</div>
          </div>
          <div className="setting-item" onClick={() => setLangModalOpen(true)}>
            <div className="setting-icon" style={{ background: 'rgba(78,205,196,0.1)' }}>{S.profile.settingLangIcon}</div>
            <div className="setting-info">
              <div className="setting-name">{S.profile.settingLang}</div>
              <div className="setting-desc">{u.language || 'Hindi'}</div>
            </div>
            <div className="setting-arrow">{S.common.settingArrow}</div>
          </div>
          <div className="setting-item" onClick={() => setRegionModalOpen(true)}>
            <div className="setting-icon" style={{ background: 'rgba(255,230,109,0.1)' }}>{S.profile.settingRegionIcon}</div>
            <div className="setting-info">
              <div className="setting-name">{S.profile.settingRegion}</div>
              <div className="setting-desc">{u.region || 'North'}</div>
            </div>
            <div className="setting-arrow">{S.common.settingArrow}</div>
          </div>
          <div className="setting-item" onClick={() => showScreen('screen-blocked')}>
            <div className="setting-icon" style={{ background: 'rgba(255,59,48,0.1)' }}>{S.profile.settingBlockedIcon}</div>
            <div className="setting-info">
              <div className="setting-name">{S.profile.settingBlocked}</div>
              <div className="setting-desc">{S.profile.settingBlockedDesc}</div>
            </div>
            <div className="setting-arrow">{S.common.settingArrow}</div>
          </div>
          <div className="setting-item" style={{ borderColor: 'rgba(255,59,48,0.2)' }} onClick={() => setDeleteModalOpen(true)}>
            <div className="setting-icon" style={{ background: 'rgba(255,59,48,0.1)' }}>{S.profile.settingDeleteIcon}</div>
            <div className="setting-info">
              <div className="setting-name" style={{ color: 'var(--accent)' }}>{S.profile.settingDelete}</div>
              <div className="setting-desc">{S.profile.settingDeleteDesc}</div>
            </div>
            <div className="setting-arrow">{S.common.settingArrow}</div>
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
    </div>
  );
}
