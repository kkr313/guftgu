import { useApp } from '@/context/AppContext';
import { S } from '@/lib/strings';

export default function NotifsScreen() {
  const { state } = useApp();
  const isActive = state.screen === 'screen-notifs';

  return (
    <div id="screen-notifs" className={`screen${isActive ? ' active' : ''}`}>
      <div className="scroll-body" style={{ padding: '60px 20px 0' }}>
        <div className="notif-header-text">{S.notifs.title}</div>
        <div className="notif-sub">{S.notifs.subtitle}</div>

        <div className="chats-empty" style={{ marginTop: 40 }}>
          <div className="chats-empty-icon">{S.notifs.emptyIcon}</div>
          <div className="chats-empty-title">{S.notifs.emptyTitle}</div>
          <div className="chats-empty-sub">{S.notifs.emptySub}</div>
        </div>
      </div>
    </div>
  );
}
