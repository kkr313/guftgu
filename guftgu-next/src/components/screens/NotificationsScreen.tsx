import { useApp } from '@/context/AppContext';
import { IconChevronLeft } from '@/lib/icons';
import { S } from '@/lib/strings';

export default function NotificationsScreen() {
  const { state, goBack } = useApp();
  const isActive = state.screen === 'screen-notifications';

  return (
    <div id="screen-notifications" className={`screen${isActive ? ' active' : ''}`}>
      {/* Fixed header */}
      <div className="screen-fixed-header">
        <button className="blocked-back-btn" onClick={goBack}>
          <IconChevronLeft />
        </button>
        <div className="screen-fixed-title">{S.notifs.title}</div>
      </div>

      {/* Scrollable content */}
      <div className="scroll-body" style={{ paddingTop: 90 }}>
        <div className="chats-empty" style={{ marginTop: 40 }}>
          <div className="chats-empty-icon">{S.notifs.emptyIcon}</div>
          <div className="chats-empty-title">{S.notifs.emptyTitle}</div>
          <div className="chats-empty-sub">{S.notifs.emptySub}</div>
        </div>
      </div>
    </div>
  );
}
