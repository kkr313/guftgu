import { useApp } from '@/context/AppContext';
import { IconHome, IconUsers, IconChat, IconUser } from '@/lib/icons';
import { S } from '@/lib/strings';

const NAV_ITEMS = [
  { id: 'screen-home' as const, label: S.nav.home, icon: <IconHome /> },
  { id: 'screen-chats' as const, label: S.nav.friends, icon: <IconUsers /> },
  { id: 'screen-notifs' as const, label: S.nav.chats, icon: <IconChat /> },
  { id: 'screen-profile' as const, label: S.nav.profile, icon: <IconUser /> },
];

export default function BottomNav() {
  const { state, showScreen } = useApp();

  const navScreens = ['screen-home', 'screen-chats', 'screen-notifs', 'screen-profile'];
  if (!navScreens.includes(state.screen)) return null;

  return (
    <nav className="bottom-nav nav-visible">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          className={`nav-item${state.screen === item.id ? ' active' : ''}`}
          onClick={() => showScreen(item.id)}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </nav>
  );
}
