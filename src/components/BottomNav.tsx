import { useApp } from '@/context/AppContext';
import { IconHome, IconUsers, IconChat, IconUser } from '@/lib/icons';
import { S } from '@/lib/strings';

export default function BottomNav() {
  const { state, showScreen, unreadNotifCount, unreadMsgCount } = useApp();

  const navScreens = ['screen-home', 'screen-chats', 'screen-notifs', 'screen-profile'];
  if (!navScreens.includes(state.screen)) return null;

  // Unread count from chats (NotifsScreen) — conversations with unread messages
  // We'll use unreadNotifCount for the Notifications bell badge

  const NAV_ITEMS = [
    { id: 'screen-home' as const, label: S.nav.home, icon: <IconHome /> },
    { id: 'screen-chats' as const, label: S.nav.friends, icon: <IconUsers /> },
    { id: 'screen-notifs' as const, label: S.nav.chats, icon: <IconChat /> },
    { id: 'screen-profile' as const, label: S.nav.profile, icon: <IconUser /> },
  ];

  return (
    <nav className="bottom-nav nav-visible">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          id={`nav-btn-${item.id}`}
          className={`nav-item${state.screen === item.id ? ' active' : ''}`}
          onClick={() => showScreen(item.id)}
        >
          <div style={{ position: 'relative', display: 'inline-flex' }}>
            {item.icon}
            {/* Badge: show unread msg count on the chats tab */}
            {item.id === 'screen-notifs' && unreadMsgCount > 0 && (
              <span
                className="nav-badge"
                aria-label={`${unreadMsgCount} unread messages`}
              >
                {unreadMsgCount > 9 ? '9+' : unreadMsgCount}
              </span>
            )}
            {/* Badge: show unread notif count on the profile tab (notifications bell) */}
            {item.id === 'screen-profile' && unreadNotifCount > 0 && (
              <span
                className="nav-badge"
                aria-label={`${unreadNotifCount} unread notifications`}
              >
                {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
              </span>
            )}
          </div>
          {item.label}
        </button>
      ))}
    </nav>
  );
}
