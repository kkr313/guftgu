import { useApp } from '@/context/AppContext';
import Avatar from '@/components/Avatar';
import { callTypeClass } from '@/lib/data';
import { useCallHistory } from '@/hooks/useCallHistory';
import { formatRelativeTime, getDisplayName } from '@/lib/storage';
import { IconChevronLeft } from '@/lib/icons';
import { S } from '@/lib/strings';

export default function HistoryScreen() {
  const { state, goBack } = useApp();
  const isActive = state.screen === 'screen-history';
  const calls = useCallHistory(isActive);

  return (
    <div id="screen-history" className={`screen${isActive ? ' active' : ''}`}>
      {/* Fixed header */}
      <div className="screen-fixed-header">
        <button className="blocked-back-btn" onClick={goBack}>
          <IconChevronLeft />
        </button>
        <div className="screen-fixed-title">{S.history.title}</div>
      </div>

      {/* Scrollable content */}
      <div className="scroll-body" style={{ paddingTop: 90, paddingBottom: 24 }}>
        {calls.length === 0 ? (
          <div className="home-empty">
            <div className="home-empty-icon">{S.history.emptyIcon}</div>
            <div className="home-empty-text">{S.history.emptyText}</div>
          </div>
        ) : (
          <div style={{ padding: '0 20px' }}>
            {calls.slice(0, 30).map((c, i) => (
              <div key={i} className="history-item">
                <div className="hist-avatar">
                  <Avatar avatarKey={c.avatar || 'cat'} size={36} />
                </div>
                <div className="hist-info">
                  <div className="hist-name">{getDisplayName(c.phone || '', c.name)}</div>
                  <div className="hist-detail">{c.duration || '00:00'}</div>
                </div>
                <div className="hist-meta">
                  <span className="hist-time">
                    {formatRelativeTime(c.callStartedAt || c.timestamp)}
                  </span>
                  <span className={`hist-type ${callTypeClass(c.type)}`}>{c.type || 'Outgoing'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
