import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import Avatar from '@/components/Avatar';
import { getFriends, getPending, FriendRecord, PendingRecord, saveFriends, savePending } from '@/lib/storage';
import { timeAgo } from '@/lib/data';
import { S } from '@/lib/strings';

export default function ChatsScreen() {
  const { state, showScreen, showToast } = useApp();
  const isActive = state.screen === 'screen-chats';

  const [tab, setTab] = useState<'friends' | 'pending'>('friends');
  const [friends, setFriends] = useState<FriendRecord[]>([]);
  const [pending, setPending] = useState<PendingRecord[]>([]);

  useEffect(() => {
    if (isActive) {
      setFriends(getFriends());
      setPending(getPending());
    }
  }, [isActive]);

  const acceptPending = (p: PendingRecord) => {
    const newFriend: FriendRecord = {
      phone: p.phone, name: p.name, avatar: p.avatar,
      mood: p.mood, moodEmoji: p.moodEmoji, addedAt: Date.now(),
    };
    const updatedFriends = [...friends, newFriend];
    const updatedPending = pending.filter((x) => x.phone !== p.phone);
    setFriends(updatedFriends);
    setPending(updatedPending);
    saveFriends(updatedFriends);
    savePending(updatedPending);
    showToast(S.chats.friendAddedToast);
  };

  const declinePending = (p: PendingRecord) => {
    const updatedPending = pending.filter((x) => x.phone !== p.phone);
    setPending(updatedPending);
    savePending(updatedPending);
  };

  return (
    <div id="screen-chats" className={`screen${isActive ? ' active' : ''}`}>
      <div className="scroll-body">
        <div className="chats-header">
          <div className="chats-title">{S.chats.title}</div>
        </div>

        {/* Tabs */}
        <div className="chats-tabs">
          <button className={`chats-tab${tab === 'friends' ? ' active' : ''}`} onClick={() => setTab('friends')}>
            {S.chats.tabFriends}
            {friends.length > 0 && <span className="chats-tab-badge">{friends.length}</span>}
          </button>
          <button className={`chats-tab${tab === 'pending' ? ' active' : ''}`} onClick={() => setTab('pending')}>
            {S.chats.tabPending}
            {pending.length > 0 && <span className="chats-tab-badge">{pending.length}</span>}
          </button>
        </div>

        <div className="chats-panel">
          {/* Friends tab */}
          {tab === 'friends' && (
            friends.length === 0 ? (
              <div className="chats-empty">
                <div className="chats-empty-icon">{S.chats.emptyFriendsIcon}</div>
                <div className="chats-empty-title">{S.chats.emptyFriendsTitle}</div>
                <div className="chats-empty-sub">{S.chats.emptyFriendsSub}</div>
              </div>
            ) : (
              friends.map((f) => (
                <div key={f.phone} className="friend-item" onClick={() => showToast(S.chats.callComingSoon(f.name))}>
                  <div className="friend-avatar">
                    <Avatar avatarKey={f.avatar || 'cat'} size={48} />
                  </div>
                  <div className="friend-info">
                    <div className="friend-name">{f.name}</div>
                    <div className="friend-mood">{f.moodEmoji} {f.mood}</div>
                  </div>
                  <div className="friend-meta">
                    <div className="friend-time">{timeAgo(f.addedAt)}</div>
                  </div>
                </div>
              ))
            )
          )}

          {/* Pending tab */}
          {tab === 'pending' && (
            pending.length === 0 ? (
              <div className="chats-empty">
                <div className="chats-empty-icon">{S.chats.emptyPendingIcon}</div>
                <div className="chats-empty-title">{S.chats.emptyPendingTitle}</div>
                <div className="chats-empty-sub">{S.chats.emptyPendingSub}</div>
              </div>
            ) : (
              pending.map((p) => (
                <div key={p.phone} className="pending-item">
                  <div className="pending-avatar">
                    <Avatar avatarKey={p.avatar || 'cat'} size={44} />
                  </div>
                  <div className="pending-info">
                    <div className="pending-name">{p.name}</div>
                    <div className="pending-type">{p.direction === 'incoming' ? S.chats.wantsToBeFriends : S.chats.sentByYou}</div>
                  </div>
                  <div className="pending-actions">
                    {p.direction === 'incoming' ? (
                      <>
                        <button className="pending-btn accept" onClick={() => acceptPending(p)}>{S.common.accept}</button>
                        <button className="pending-btn decline" onClick={() => declinePending(p)}>{S.common.decline}</button>
                      </>
                    ) : (
                      <button className="pending-btn cancel" onClick={() => declinePending(p)}>{S.common.cancel}</button>
                    )}
                  </div>
                </div>
              ))
            )
          )}
        </div>
      </div>
    </div>
  );
}
