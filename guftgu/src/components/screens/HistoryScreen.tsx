import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import Avatar from '@/components/Avatar';
import { callTypeClass } from '@/lib/data';
import { getCallHistory, formatRelativeTime, getDisplayName, clearCallHistory } from '@/lib/storage';
import { IconChevronLeft, IconTrash } from '@/lib/icons';
import { S } from '@/lib/strings';

export default function HistoryScreen() {
  const { state, goBack, showToast } = useApp();
  const isActive = state.screen === 'screen-history';
  const [calls, setCalls] = useState<ReturnType<typeof getCallHistory>>([]);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Load calls when screen becomes active
  useEffect(() => {
    if (isActive) setCalls(getCallHistory());
  }, [isActive]);

  const handleClearAll = () => {
    setCalls([]);
    clearCallHistory();
    setShowClearConfirm(false);
    showToast(S.history.clearedToast);
  };

  return (
    <div id="screen-history" className={`screen${isActive ? ' active' : ''}`}>
      {/* Fixed header */}
      <div className="screen-fixed-header" style={{ display: 'flex', alignItems: 'center' }}>
        <button className="blocked-back-btn" onClick={goBack}>
          <IconChevronLeft />
        </button>
        <div className="screen-fixed-title" style={{ flex: 1 }}>{S.history.title}</div>
        {calls.length > 0 && (
          <button className="history-clear-btn" onClick={() => setShowClearConfirm(true)}>
            {S.history.clearAll}
          </button>
        )}
      </div>

      {/* Scrollable content */}
      <div className="scroll-body" style={{ paddingTop: 110, paddingBottom: 24 }}>
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

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <div className="modal-overlay show" onClick={() => setShowClearConfirm(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-handle" />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center', padding: '10px 20px 20px' }}>
              <div className="delete-icon" style={{ width: 40, height: 40 }}><IconTrash size={18} color="#e53935" /></div>
              <div className="delete-title" style={{ marginTop: 4 }}>{S.history.clearConfirm}</div>
              <div className="delete-actions" style={{ display: 'flex', gap: 10, width: '100%', marginTop: 8 }}>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowClearConfirm(false)}>{S.history.clearNo}</button>
                <button className="btn btn-danger" style={{ flex: 1 }} onClick={handleClearAll}>{S.history.clearYes}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
