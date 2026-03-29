import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { IconChevronLeft } from '@/lib/icons';
import { NotifRecord, getNotifs, clearAllNotifs, saveNotifs } from '@/lib/storage';
import { S } from '@/lib/strings';

const TYPE_COLORS: Record<string, string> = {
  welcome: 'type-system',
  friend_request: 'type-friend',
  friend_accepted: 'type-friend',
  missed_call: 'type-call',
  app_update: 'type-system',
};

export default function NotificationsScreen() {
  const { state, goBack, showToast, markNotifsRead } = useApp();
  const isActive = state.screen === 'screen-notifications';

  const [notifs, setNotifs] = useState<NotifRecord[]>([]);

  // Load + mark as read when screen becomes active
  useEffect(() => {
    if (isActive) {
      setNotifs(getNotifs());
      markNotifsRead();
    }
  }, [isActive, markNotifsRead]);

  // Re-sync when new notifs arrive while screen is open
  useEffect(() => {
    const handler = () => {
      if (isActive) {
        setNotifs(getNotifs());
        markNotifsRead();
      }
    };
    window.addEventListener('notifsUpdate', handler);
    window.addEventListener('callHistoryUpdate', handler);
    return () => {
      window.removeEventListener('notifsUpdate', handler);
      window.removeEventListener('callHistoryUpdate', handler);
    };
  }, [isActive, markNotifsRead]);

  const clearAll = () => {
    clearAllNotifs();
    setNotifs([]);
    showToast(S.notifications.clearedToast);
  };

  const dismissOne = (id: string) => {
    const updated = notifs.filter(n => n.id !== id);
    setNotifs(updated);
    saveNotifs(updated);
  };

  return (
    <div id="screen-notifications" className={`screen${isActive ? ' active' : ''}`}>
      {/* Fixed header */}
      <div className="screen-fixed-header">
        <button className="blocked-back-btn" onClick={goBack}>
          <IconChevronLeft />
        </button>
        <div className="screen-fixed-title">{S.notifications.title}</div>
        {notifs.length > 0 && (
          <button className="notif-clear-btn" onClick={clearAll}>
            {S.notifications.clearAll}
          </button>
        )}
      </div>

      {/* Scrollable content */}
      <div className="scroll-body" style={{ paddingTop: 110 }}>
        {notifs.length === 0 ? (
          <div className="chats-empty" style={{ marginTop: 40 }}>
            <div className="chats-empty-icon">{S.notifications.emptyIcon}</div>
            <div className="chats-empty-title">{S.notifications.emptyTitle}</div>
            <div className="chats-empty-sub">{S.notifications.emptySub}</div>
          </div>
        ) : (
          <>
            {notifs.map(n => (
              <div
                key={n.id}
                className={`notif-item${n.unread ? ' unread' : ''}`}
                onClick={() => dismissOne(n.id)}
              >
                <div className={`notif-icon ${TYPE_COLORS[n.type] ?? 'type-system'}`}>
                  {n.icon}
                </div>
                <div className="notif-body">
                  <div className="notif-title">{n.title}</div>
                  <div className="notif-text" dangerouslySetInnerHTML={{ __html: n.body }} />
                  <div className="notif-time">
                    {n.time > 0
                      ? new Date(n.time).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })
                      : 'When you joined'}
                  </div>
                </div>
                {n.unread && <div className="notif-unread-dot" />}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
