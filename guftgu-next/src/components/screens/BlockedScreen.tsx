import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import Avatar from '@/components/Avatar';
import { getBlocked, saveBlocked, BlockedRecord } from '@/lib/storage';
import { timeAgo } from '@/lib/data';
import { IconChevronLeft } from '@/lib/icons';
import { S } from '@/lib/strings';

export default function BlockedScreen() {
  const { state, goBack, showToast } = useApp();
  const isActive = state.screen === 'screen-blocked';
  const [blocked, setBlocked] = useState<BlockedRecord[]>([]);

  useEffect(() => {
    if (isActive) setBlocked(getBlocked());
  }, [isActive]);

  const unblock = (phone: string) => {
    const updated = blocked.filter((b) => b.phone !== phone);
    setBlocked(updated);
    saveBlocked(updated);
    showToast(S.blocked.unblockToast);
  };

  return (
    <div id="screen-blocked" className={`screen${isActive ? ' active' : ''}`}>
      <div className="scroll-body">
        <div className="blocked-header">
          <button className="blocked-back-btn" onClick={goBack}>
            <IconChevronLeft />
          </button>
          <div>
            <div className="blocked-page-title">{S.blocked.title}</div>
            <div id="blockedCount" style={{ fontSize: 12, color: 'var(--text3)', marginTop: 1 }}>
              {S.blocked.countLabel(blocked.length)}
            </div>
          </div>
        </div>
        <div className="blocked-subtitle">
          {S.blocked.subtitle}
        </div>

        {blocked.length === 0 ? (
          <div className="blocked-empty">
            <div className="blocked-empty-icon">{S.blocked.emptyIcon}</div>
            <div className="blocked-empty-title">{S.blocked.emptyTitle}</div>
            <div className="blocked-empty-sub">{S.blocked.emptySub}</div>
          </div>
        ) : (
          blocked.map((b) => (
            <div key={b.phone} className="blocked-item">
              <div className="blocked-avatar">
                <Avatar avatarKey={b.avatar || 'cat'} size={46} />
              </div>
              <div className="blocked-info">
                <div className="blocked-name">{b.name}</div>
                <div className="blocked-phone">#{b.phone}</div>
                <div className="blocked-when">{b.blockedAt ? timeAgo(b.blockedAt) : 'Unknown'}</div>
              </div>
              <button className="blocked-unblock-btn" onClick={() => unblock(b.phone)}>{S.common.unblock}</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
