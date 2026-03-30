import { useApp } from '@/context/AppContext';
import Avatar from '@/components/Avatar';
import { useMatchEngine } from '@/hooks/useMatchEngine';
import { IconChevronLeft } from '@/lib/icons';
import { S } from '@/lib/strings';

export default function MatchScreen() {
  const { state } = useApp();
  const isActive = state.screen === 'screen-match';
  const u = state.user;

  const {
    searching, matchFound, pal, countdown, tipIdx,
    searchTips, acceptMatch, declineMatch, cancelSearch,
    queueCount,
  } = useMatchEngine(isActive);

  return (
    <div id="screen-match" className={`screen${isActive ? ' active' : ''}`}>
      <div className="match-bg" />
      <div className="match-content">
        <div className="match-back" onClick={cancelSearch}>
          <IconChevronLeft />
        </div>

        {/* Searching state */}
        {searching && !matchFound && (
          <div id="searchState" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', width: '100%', maxWidth: 340, paddingInline: 8 }}>
            <div className="match-status-pill searching">
              <div className="status-dot-pulse" />
              {S.match.searching}
            </div>
            <div className="search-orbit-wrap">
              <div className="search-rings">
                <div className="ring" /><div className="ring" /><div className="ring" /><div className="ring" />
              </div>
              <div className="search-center">{u.moodEmoji || '😄'}</div>
              {/* Orbiting emojis */}
              <div className="orbit-track orbit-1"><span className="orbit-emoji">😄</span></div>
              <div className="orbit-track orbit-2"><span className="orbit-emoji">😎</span></div>
              <div className="orbit-track orbit-3"><span className="orbit-emoji">🤩</span></div>
              <div className="orbit-track orbit-4"><span className="orbit-emoji">🥺</span></div>
              <div className="orbit-track orbit-5"><span className="orbit-emoji">🤔</span></div>
              <div className="orbit-track orbit-6"><span className="orbit-emoji">😑</span></div>
            </div>
            <div className="match-title">{S.match.findingTitle}</div>
            <div className="match-sub">{S.match.findingSub(u.language || 'Hindi')}</div>
            {queueCount > 0 && (
              <div style={{ fontSize: 13, color: 'var(--accent2)', marginTop: 12, marginBottom: 12, opacity: 0.8 }}>
                👥 {queueCount} {queueCount === 1 ? 'person' : 'people'} waiting to match
              </div>
            )}
            <div className="search-tips" style={{ position: 'relative' }}>
              {searchTips.map((tip, i) => (
                <div key={i} className={`search-tip${tipIdx === i ? ' active' : ''}`}>{tip}</div>
              ))}
            </div>
            <button className="btn btn-ghost match-cancel-btn" onClick={cancelSearch}>{S.match.cancelBtn}</button>
          </div>
        )}

        {/* Match found overlay */}
        {matchFound && (
          <div className="match-found show" style={{ display: 'flex' }}>
            <div className="match-status-pill found">
              <div className="status-dot-pulse" style={{ background: 'var(--accent2)' }} />
              {S.match.matchFound}
            </div>
            <div className="match-found-avatars">
              <div className="mf-avatar" style={{ background: 'linear-gradient(135deg,#FF6B6B33,#FF8E5333)', marginRight: -12, zIndex: 1 }}>
                <Avatar avatarKey={u.avatar || 'cat'} size={60} />
              </div>
              <div className="mf-heart">💕</div>
              <div className="mf-avatar" style={{ background: 'linear-gradient(135deg,#4ECDC433,#26A69A33)', marginLeft: -12 }}>
                <Avatar avatarKey={pal.avatar} size={60} />
              </div>
            </div>
            <div className="mf-title">{S.match.itsAMatch}</div>
            <div className="mf-name">{pal.name}</div>
            <div className="mf-mood">{pal.moodEmoji} {S.match.feeling(pal.mood)}</div>
            <div className="mf-badges">
              <span className="mf-badge">{u.language || 'Hindi'}</span>
              <span className="mf-badge">{pal.region || 'Region'}</span>
            </div>
            <div className="mf-countdown">{countdown}</div>
            <div className="mf-actions">
              <button className="mf-decline" onClick={declineMatch}>{S.match.skipBtn}</button>
              <button className="mf-accept" onClick={acceptMatch}>{S.match.connectBtn}</button>
            </div>
            <div className="mf-safety-row">
              <button className="mf-safety-btn" onClick={declineMatch}>{S.match.blockBtn}</button>
              <button className="mf-safety-btn" onClick={declineMatch}>{S.match.reportBtn}</button>
            </div>
          </div>
        )}
      </div>
      {/* Footer shown for both states */}
      <div className="match-footer">{S.match.safetyFooter}</div>
    </div>
  );
}
