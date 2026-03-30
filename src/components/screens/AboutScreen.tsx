import { useApp } from '@/context/AppContext';
import { IconChevronLeft, IconShare } from '@/lib/icons';
import { S } from '@/lib/strings';

export default function AboutScreen() {
  const { state, goBack, showToast } = useApp();
  const isActive = state.screen === 'screen-appinfo';
  const currentYear = new Date().getFullYear();

  const handleShareApp = async () => {
    const shareData = {
      title: S.profile.shareTitle,
      text: S.profile.shareText,
      url: S.profile.shareUrl,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }
    // Fallback: copy link
    if (navigator.clipboard) {
      navigator.clipboard.writeText(S.profile.shareUrl);
      showToast(S.profile.shareCopiedToast);
    }
  };

  return (
    <div id="screen-appinfo" className={`screen${isActive ? ' active' : ''}`}>
      <div className="scroll-body" style={{ padding: 0 }}>
        {/* Header */}
        <div className="appinfo-header">
          <div className="appinfo-back" onClick={goBack}>
            <IconChevronLeft />
          </div>
          <div className="appinfo-logo">🎙️</div>
          <div className="appinfo-name">Guftgu</div>
          <div className="appinfo-tagline">बात करो, दिल से — Speak freely, connect deeply</div>
          <div className="appinfo-version">Version 4.0 · Build 2026.03.22</div>
        </div>

        {/* What is Guftgu */}
        <div className="appinfo-section">
          <div className="appinfo-section-title">✨ What is Guftgu?</div>
          <div className="appinfo-text">
            Guftgu is a fully anonymous voice & chat app made for India. Share your thoughts, secrets, and feelings with strangers who truly listen — no judgments, no identity, just real conversations.
          </div>
        </div>

        {/* Key Features */}
        <div className="appinfo-section">
          <div className="appinfo-section-title">🚀 Key Features</div>
          <div className="appinfo-feature">🎭 <b>100% Anonymous</b> — No phone number, no name, no trace</div>
          <div className="appinfo-feature">📞 <b>Voice Calls</b> — Talk to strangers via WebRTC</div>
          <div className="appinfo-feature">📱 <b>Dial by Number</b> — Call friends using Guftgu number</div>
          <div className="appinfo-feature">💬 <b>Text Chat</b> — Chat with mood-matched strangers</div>
          <div className="appinfo-feature">🎯 <b>Smart Matching</b> — Mood + Language + Region</div>
          <div className="appinfo-feature">🌐 <b>9 Languages</b> — Hindi, English, Bengali, Tamil & more</div>
          <div className="appinfo-feature">🐱 <b>30+ Avatars</b> — Animals, professions, fantasy characters</div>
          <div className="appinfo-feature">📊 <b>Call History</b> — Track your recent conversations</div>
        </div>

        {/* Changelog */}
        <div className="appinfo-section">
          <div className="appinfo-section-title">📋 Changelog</div>
          <div className="appinfo-changelog">
            <div className="changelog-version">
              <div className="changelog-badge">v4.0</div>
              <div className="changelog-date">March 2026</div>
            </div>
            <div className="changelog-items">
              <div className="changelog-item">✅ Voice calls with WebRTC + Firebase signaling</div>
              <div className="changelog-item">✅ Dial-by-phone — call friends directly</div>
              <div className="changelog-item">✅ Incoming call overlay with accept/decline</div>
              <div className="changelog-item">✅ Call history with duration tracking</div>
              <div className="changelog-item">✅ 30+ SVG avatar picker on profile</div>
              <div className="changelog-item">✅ Region-based matching (North/South/East/West)</div>
              <div className="changelog-item">✅ Language & mood modals for quick changes</div>
              <div className="changelog-item">✅ Redesigned match search with orbital animations</div>
              <div className="changelog-item">✅ "Find My Vibe" hero button with glow effect</div>
              <div className="changelog-item">✅ Delete account with 30-day recovery</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="appinfo-section" style={{ textAlign: 'center', paddingBottom: 32 }}>
          <div className="about-share-cta" onClick={handleShareApp}>
            <IconShare size={18} /> Share Guftgu with friends
          </div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 16 }}>Made with ❤️ in India</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>© 2025–{currentYear} Guftgu · All rights reserved</div>
        </div>
      </div>
    </div>
  );
}
