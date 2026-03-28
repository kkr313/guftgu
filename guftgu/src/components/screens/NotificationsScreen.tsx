import { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { IconChevronLeft } from '@/lib/icons';
import { formatRelativeTime } from '@/lib/storage';
import { S } from '@/lib/strings';

interface NotifItem {
  id: string;
  type: 'call' | 'friend' | 'system';
  icon: string;
  text: string;
  time: number;
  unread: boolean;
}

// ── Dummy notifications for UI preview ──
const DUMMY_NOTIFS: NotifItem[] = [
  { id: 'n1', type: 'call', icon: '📞', text: '<b>Aarav</b> tried to call you', time: Date.now() - 300000, unread: true },
  { id: 'n2', type: 'friend', icon: '🤝', text: '<b>Priya</b> accepted your friend request', time: Date.now() - 1800000, unread: true },
  { id: 'n3', type: 'call', icon: '📵', text: 'You missed a call from <b>Rohan</b>', time: Date.now() - 3600000, unread: true },
  { id: 'n4', type: 'friend', icon: '👋', text: '<b>Sneha</b> sent you a friend request', time: Date.now() - 7200000, unread: false },
  { id: 'n5', type: 'system', icon: '🎉', text: 'Welcome to <b>Guftgu</b>! Start matching now', time: Date.now() - 14400000, unread: false },
  { id: 'n6', type: 'call', icon: '📞', text: '<b>Vikram</b> called you · 4m 23s', time: Date.now() - 28800000, unread: false },
  { id: 'n7', type: 'friend', icon: '🤝', text: '<b>Ananya</b> accepted your friend request', time: Date.now() - 43200000, unread: false },
  { id: 'n8', type: 'system', icon: '🔔', text: 'You have <b>3 unread messages</b>', time: Date.now() - 86400000, unread: false },
  { id: 'n9', type: 'call', icon: '📵', text: 'You missed a call from <b>Diya</b>', time: Date.now() - 172800000, unread: false },
  { id: 'n10', type: 'friend', icon: '👋', text: '<b>Kabir</b> sent you a friend request', time: Date.now() - 259200000, unread: false },
  { id: 'n11', type: 'system', icon: '✨', text: 'New feature: <b>Nicknames</b> — rename your friends!', time: Date.now() - 432000000, unread: false },
  { id: 'n12', type: 'call', icon: '📞', text: '<b>Arjun</b> called you · 12m 05s', time: Date.now() - 604800000, unread: false },
];

export default function NotificationsScreen() {
  const { state, goBack, showToast } = useApp();
  const isActive = state.screen === 'screen-notifications';

  const [notifs, setNotifs] = useState<NotifItem[]>(DUMMY_NOTIFS);

  const sortedNotifs = useMemo(
    () => [...notifs].sort((a, b) => b.time - a.time),
    [notifs]
  );

  const clearAll = () => {
    setNotifs([]);
    showToast(S.notifications.clearedToast);
  };

  return (
    <div id="screen-notifications" className={`screen${isActive ? ' active' : ''}`}>
      {/* Fixed header */}
      <div className="screen-fixed-header">
        <button className="blocked-back-btn" onClick={goBack}>
          <IconChevronLeft />
        </button>
        <div className="screen-fixed-title">{S.notifications.title}</div>
        {sortedNotifs.length > 0 && (
          <button className="notif-clear-btn" onClick={clearAll}>
            {S.notifications.clearAll}
          </button>
        )}
      </div>

      {/* Scrollable content */}
      <div className="scroll-body" style={{ paddingTop: 110 }}>
        {sortedNotifs.length === 0 ? (
          <div className="chats-empty" style={{ marginTop: 40 }}>
            <div className="chats-empty-icon">{S.notifications.emptyIcon}</div>
            <div className="chats-empty-title">{S.notifications.emptyTitle}</div>
            <div className="chats-empty-sub">{S.notifications.emptySub}</div>
          </div>
        ) : (
          <>
            {sortedNotifs.map(n => (
              <div key={n.id} className={`notif-item${n.unread ? ' unread' : ''}`}>
                <div className={`notif-icon type-${n.type}`}>{n.icon}</div>
                <div className="notif-body">
                  <div className="notif-text" dangerouslySetInnerHTML={{ __html: n.text }} />
                  <div className="notif-time">{formatRelativeTime(n.time)}</div>
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
