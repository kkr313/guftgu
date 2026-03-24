import { useApp } from '@/context/AppContext';
import Avatar from '@/components/Avatar';
import { callTypeClass } from '@/lib/data';
import { useCallHistory } from '@/hooks/useCallHistory';
import { IconChevronLeft } from '@/lib/icons';
import { S } from '@/lib/strings';

export default function HistoryScreen() {
  const { state, goBack } = useApp();
  const isActive = state.screen === 'screen-history';
  const calls = useCallHistory(isActive);

  return (
    <div id="screen-history" className={`screen${isActive ? ' active' : ''}`}>
      <div className="scroll-body" style={{ padding: '60px 20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button className="blocked-back-btn" onClick={goBack}>
            <IconChevronLeft />
          </button>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{S.history.title}</div>
        </div>

        {calls.length === 0 ? (
          <div className="home-empty">
            <div className="home-empty-icon">{S.history.emptyIcon}</div>
            <div className="home-empty-text">{S.history.emptyText}</div>
          </div>
        ) : (
          calls.slice(0, 30).map((c, i) => (
            <div key={i} className="history-item">
              <div className="hist-avatar">
                <Avatar avatarKey={c.avatar || 'cat'} size={36} />
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
    </div>
  );
}
