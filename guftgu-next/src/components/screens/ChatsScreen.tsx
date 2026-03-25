import { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import Avatar from '@/components/Avatar';
import { getFriends, getPending, FriendRecord, PendingRecord, saveFriends, savePending, BlockedRecord, getBlocked, saveBlocked, formatRelativeTime } from '@/lib/storage';
import { 
  listenFriendRequests, 
  listenFriendAccepted, 
  acceptFriendRequest, 
  declineFriendRequest,
  cancelFriendRequest,
  addToFriends
} from '@/lib/firebase-service';
import { timeAgo } from '@/lib/data';
import { S } from '@/lib/strings';
import { IconUnfriend } from '@/lib/icons';

export default function ChatsScreen() {
  const { state, dispatch, showScreen, showToast, dbRef } = useApp();
  const isActive = state.screen === 'screen-chats';

  const [tab, setTab] = useState<'friends' | 'pending'>('friends');
  const [friends, setFriends] = useState<FriendRecord[]>([]);
  const [pending, setPending] = useState<PendingRecord[]>([]);
  const [editingPhone, setEditingPhone] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // Sort: newest first (latest addedAt / timestamp on top)
  const sortedFriends = useMemo(() => [...friends].sort((a, b) => b.addedAt - a.addedAt), [friends]);
  const sortedPending = useMemo(() => [...pending].sort((a, b) => b.timestamp - a.timestamp), [pending]);

  // ── Dummy data for UI preview ──
  const DUMMY_FRIENDS: FriendRecord[] = [
    { phone: '1000001', name: 'Aarav', avatar: 'cat', mood: 'Happy', moodEmoji: '😄', addedAt: Date.now() - 86400000 },
    { phone: '1000002', name: 'Priya', avatar: 'dog', mood: 'Chill', moodEmoji: '😎', addedAt: Date.now() - 172800000 },
    { phone: '1000003', name: 'Rohan', avatar: 'panda', mood: 'Excited', moodEmoji: '🤩', addedAt: Date.now() - 259200000 },
    { phone: '1000004', name: 'Sneha', avatar: 'bunny', mood: 'Sleepy', moodEmoji: '😴', addedAt: Date.now() - 345600000 },
    { phone: '1000005', name: 'Vikram', avatar: 'fox', mood: 'Bored', moodEmoji: '😑', addedAt: Date.now() - 432000000 },
    { phone: '1000006', name: 'Ananya', avatar: 'koala', mood: 'Curious', moodEmoji: '🤔', addedAt: Date.now() - 518400000 },
    { phone: '1000007', name: 'Kabir', avatar: 'penguin', mood: 'Energetic', moodEmoji: '⚡', addedAt: Date.now() - 604800000 },
    { phone: '1000008', name: 'Diya', avatar: 'owl', mood: 'Romantic', moodEmoji: '🥰', addedAt: Date.now() - 691200000 },
    { phone: '1000009', name: 'Arjun', avatar: 'tiger', mood: 'Angry', moodEmoji: '😤', addedAt: Date.now() - 777600000 },
    { phone: '1000010', name: 'Meera', avatar: 'bear', mood: 'Sad', moodEmoji: '😢', addedAt: Date.now() - 864000000 },
  ];
  const DUMMY_PENDING: PendingRecord[] = [
    { phone: '2000001', name: 'Ishaan', avatar: 'lion', mood: 'Happy', moodEmoji: '😄', direction: 'incoming', timestamp: Date.now() - 3600000 },
    { phone: '2000002', name: 'Kavya', avatar: 'deer', mood: 'Shy', moodEmoji: '🙈', direction: 'incoming', timestamp: Date.now() - 7200000 },
    { phone: '2000003', name: 'Rahul', avatar: 'wolf', mood: 'Chill', moodEmoji: '😎', direction: 'outgoing', timestamp: Date.now() - 10800000 },
    { phone: '2000004', name: 'Nisha', avatar: 'unicorn', mood: 'Dreamy', moodEmoji: '✨', direction: 'incoming', timestamp: Date.now() - 14400000 },
    { phone: '2000005', name: 'Aditya', avatar: 'dragon', mood: 'Fired up', moodEmoji: '🔥', direction: 'outgoing', timestamp: Date.now() - 18000000 },
    { phone: '2000006', name: 'Riya', avatar: 'hamster', mood: 'Playful', moodEmoji: '🐹', direction: 'incoming', timestamp: Date.now() - 21600000 },
    { phone: '2000007', name: 'Siddharth', avatar: 'monkey', mood: 'Funny', moodEmoji: '🤣', direction: 'outgoing', timestamp: Date.now() - 25200000 },
    { phone: '2000008', name: 'Tanvi', avatar: 'cat', mood: 'Peaceful', moodEmoji: '🕊️', direction: 'incoming', timestamp: Date.now() - 28800000 },
    { phone: '2000009', name: 'Harsh', avatar: 'tiger', mood: 'Confident', moodEmoji: '💪', direction: 'incoming', timestamp: Date.now() - 32400000 },
    { phone: '2000010', name: 'Pooja', avatar: 'bunny', mood: 'Grateful', moodEmoji: '🙏', direction: 'outgoing', timestamp: Date.now() - 36000000 },
    { phone: '2000011', name: 'Devesh', avatar: 'owl', mood: 'Studious', moodEmoji: '📚', direction: 'incoming', timestamp: Date.now() - 39600000 },
    { phone: '2000012', name: 'Simran', avatar: 'penguin', mood: 'Dancing', moodEmoji: '💃', direction: 'incoming', timestamp: Date.now() - 43200000 },
  ];

  // Load local data on mount + merge dummy data for preview
  useEffect(() => {
    if (isActive) {
      const realFriends = getFriends();
      const realPending = getPending();
      // Always use dummy data for UI preview during development
      setFriends(realFriends.length > 0 ? realFriends : DUMMY_FRIENDS);
      setPending(DUMMY_PENDING);
    }
  }, [isActive]);

  // Listen for Firebase friend requests and acceptances
  useEffect(() => {
    if (!isActive || !dbRef?.current || !state.guftguPhone) return;

    const db = dbRef.current;
    const myPhone = state.guftguPhone;

    // Listen for incoming friend requests
    const unsubRequests = listenFriendRequests(db, myPhone, (request) => {
      setPending(prev => {
        // Check if already exists
        if (prev.some(p => p.phone === request.phone)) return prev;
        
        const newPending: PendingRecord = {
          phone: request.phone,
          name: request.name,
          avatar: request.avatar,
          mood: request.mood,
          moodEmoji: request.moodEmoji,
          direction: 'incoming',
          timestamp: request.timestamp,
        };
        const updated = [...prev, newPending];
        savePending(updated);
        showToast(`📩 ${request.name} wants to be friends!`);
        return updated;
      });
    });

    // Listen for friend request acceptances (when someone accepts MY request)
    const unsubAccepted = listenFriendAccepted(db, myPhone, (friend) => {
      // Move from pending to friends
      setPending(prev => {
        const updated = prev.filter(p => p.phone !== friend.phone);
        savePending(updated);
        return updated;
      });

      setFriends(prev => {
        if (prev.some(f => f.phone === friend.phone)) return prev;
        const newFriend: FriendRecord = {
          phone: friend.phone,
          name: friend.name,
          avatar: friend.avatar,
          mood: friend.mood,
          moodEmoji: friend.moodEmoji,
          addedAt: Date.now(),
        };
        const updated = [...prev, newFriend];
        saveFriends(updated);
        showToast(`🎉 ${friend.name} accepted your friend request!`);
        return updated;
      });
    });

    return () => {
      unsubRequests();
      unsubAccepted();
    };
  }, [isActive, dbRef, state.guftguPhone]); // eslint-disable-line react-hooks/exhaustive-deps

  const acceptPending = async (p: PendingRecord) => {
    // Accept via Firebase
    if (dbRef?.current && state.guftguPhone) {
      try {
        // Accept the request (notify them)
        await acceptFriendRequest(dbRef.current, state.guftguPhone, state.user, p.phone);
        
        // Add to mutual friends list in Firebase
        await addToFriends(
          dbRef.current,
          state.guftguPhone,
          state.user,
          p.phone,
          p.name,
          p.avatar,
          p.mood,
          p.moodEmoji
        );
      } catch (error) {
        console.error('Failed to accept friend request:', error);
      }
    }

    // Update local state
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

  const declinePending = async (p: PendingRecord) => {
    // Decline or cancel via Firebase
    if (dbRef?.current && state.guftguPhone) {
      try {
        if (p.direction === 'incoming') {
          await declineFriendRequest(dbRef.current, state.guftguPhone, p.phone);
        } else {
          await cancelFriendRequest(dbRef.current, state.guftguPhone, p.phone);
        }
      } catch (error) {
        console.error('Failed to decline/cancel friend request:', error);
      }
    }

    // Update local state
    const updatedPending = pending.filter((x) => x.phone !== p.phone);
    setPending(updatedPending);
    savePending(updatedPending);
  };

  const openChatWithFriend = (f: FriendRecord) => {
    // Set the pal and go to chat screen
    dispatch({
      type: 'SET_PAL',
      pal: {
        phone: f.phone,
        name: f.nickname || f.name,
        avatar: f.avatar,
        mood: f.mood,
        moodEmoji: f.moodEmoji,
      },
    });
    showScreen('screen-chat');
  };

  const callFriend = (f: FriendRecord) => {
    // Set the pal and go to call screen
    dispatch({
      type: 'SET_PAL',
      pal: {
        phone: f.phone,
        name: f.nickname || f.name,
        avatar: f.avatar,
        mood: f.mood,
        moodEmoji: f.moodEmoji,
      },
    });
    showScreen('screen-call');
  };

  // ── Unfriend: remove from friends list ──
  const unfriendUser = (f: FriendRecord) => {
    const updated = friends.filter(x => x.phone !== f.phone);
    setFriends(updated);
    saveFriends(updated);
    showToast(`${f.nickname || f.name} has been removed from friends list`);
    // TODO: Remove from Firebase when real implementation
  };

  // ── Block from friends: move to blocked list + remove from friends ──
  const blockFromFriends = (f: FriendRecord) => {
    // Remove from friends
    const updatedFriends = friends.filter(x => x.phone !== f.phone);
    setFriends(updatedFriends);
    saveFriends(updatedFriends);

    // Add to blocked (preserve nickname)
    const blocked = getBlocked();
    if (!blocked.some(b => b.phone === f.phone)) {
      const newBlocked: BlockedRecord = { phone: f.phone, name: f.name, nickname: f.nickname, avatar: f.avatar, blockedAt: Date.now() };
      saveBlocked([...blocked, newBlocked]);
    }
    showToast(`🚫 ${f.nickname || f.name} has been blocked`);
    // TODO: Block on Firebase when real implementation
  };

  // ── Block from pending: move to blocked list + remove from pending ──
  const blockFromPending = (p: PendingRecord) => {
    // Remove from pending
    const updatedPending = pending.filter(x => x.phone !== p.phone);
    setPending(updatedPending);
    savePending(updatedPending);

    // Add to blocked
    const blocked = getBlocked();
    if (!blocked.some(b => b.phone === p.phone)) {
      const newBlocked: BlockedRecord = { phone: p.phone, name: p.name, avatar: p.avatar, blockedAt: Date.now() };
      saveBlocked([...blocked, newBlocked]);
    }
    showToast(`🚫 ${p.name} has been blocked`);
    // TODO: Block on Firebase when real implementation
  };

  // ── Rename friend: start editing ──
  const startRename = (f: FriendRecord) => {
    setEditingPhone(f.phone);
    setEditName(f.nickname || f.name);
  };

  // ── Rename friend: save nickname ──
  const saveRename = (f: FriendRecord) => {
    const trimmed = editName.trim();
    if (!trimmed) {
      setEditingPhone(null);
      return;
    }
    const updated = friends.map(x =>
      x.phone === f.phone ? { ...x, nickname: trimmed === f.name ? undefined : trimmed } : x
    );
    setFriends(updated);
    saveFriends(updated);
    setEditingPhone(null);
    showToast(`✏️ Saved as "${trimmed}"`);
  };

  // ── Rename friend: cancel editing ──
  const cancelRename = () => {
    setEditingPhone(null);
    setEditName('');
  };

  return (
    <div id="screen-chats" className={`screen${isActive ? ' active' : ''}`}>
      {/* Fixed header + tabs */}
      <div className="screen-fixed-header">
        <div className="screen-fixed-title">{S.chats.title}</div>
      </div>
      <div className="chats-tabs-fixed">
        <div className="chats-tab-inner">
          <button className={`chats-tab${tab === 'friends' ? ' active' : ''}`} onClick={() => setTab('friends')}>
            {S.chats.tabFriends}
            {friends.length > 0 && <span className="chats-tab-badge">{friends.length}</span>}
          </button>
          <button className={`chats-tab${tab === 'pending' ? ' active' : ''}`} onClick={() => setTab('pending')}>
            {S.chats.tabPending}
            {pending.length > 0 && <span className="chats-tab-badge">{pending.length}</span>}
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="scroll-body" style={{ paddingTop: 140, paddingBottom: 'calc(var(--nav-h) + var(--safe-bottom) + 24px)' }}>
        <div className="chats-panel">
          {/* Friends tab */}
          {tab === 'friends' && (
            sortedFriends.length === 0 ? (
              <div className="chats-empty">
                <div className="chats-empty-icon">{S.chats.emptyFriendsIcon}</div>
                <div className="chats-empty-title">{S.chats.emptyFriendsTitle}</div>
                <div className="chats-empty-sub">{S.chats.emptyFriendsSub}</div>
              </div>
            ) : (
              sortedFriends.map((f) => (
                <div key={f.phone} className="friend-item">
                  <div className="friend-avatar">
                    <Avatar avatarKey={f.avatar || 'cat'} size={48} />
                  </div>
                  <div className="friend-info">
                    {editingPhone === f.phone ? (
                      <div className="friend-rename-row">
                        <input
                          className="friend-rename-input"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveRename(f); if (e.key === 'Escape') cancelRename(); }}
                          autoFocus
                          maxLength={20}
                          placeholder={f.name}
                        />
                        <button className="friend-rename-save" onClick={() => saveRename(f)}>✓</button>
                        <button className="friend-rename-cancel" onClick={cancelRename}>✕</button>
                      </div>
                    ) : (
                      <>
                        <div className="friend-name">
                          {f.nickname || f.name}
                          <button className="friend-rename-btn" onClick={(e) => { e.stopPropagation(); startRename(f); }} title="Rename">✏️</button>
                        </div>
                        {f.nickname && <div className="friend-original-name">aka {f.name}</div>}
                        <div className="friend-mood">{f.moodEmoji} {f.mood}</div>
                        <div className="friend-timeline">🤝 Friends {formatRelativeTime(f.addedAt)}</div>
                      </>
                    )}
                  </div>
                  <div className="friend-actions">
                    <button className="friend-action-btn chat" onClick={() => openChatWithFriend(f)} title="Chat">💬</button>
                    <button className="friend-action-btn call" onClick={() => callFriend(f)} title="Call">📞</button>
                    <button className="friend-action-btn unfriend" onClick={() => unfriendUser(f)} title="Unfriend"><IconUnfriend size={22} /></button>
                    <button className="friend-action-btn block" onClick={() => blockFromFriends(f)} title="Block">🚫</button>
                  </div>
                </div>
              ))
            )
          )}

          {/* Pending tab */}
          {tab === 'pending' && (
            sortedPending.length === 0 ? (
              <div className="chats-empty">
                <div className="chats-empty-icon">{S.chats.emptyPendingIcon}</div>
                <div className="chats-empty-title">{S.chats.emptyPendingTitle}</div>
                <div className="chats-empty-sub">{S.chats.emptyPendingSub}</div>
              </div>
            ) : (
              sortedPending.map((p) => (
                <div key={p.phone} className="pending-item">
                  <div className="pending-avatar">
                    <Avatar avatarKey={p.avatar || 'cat'} size={44} />
                  </div>
                  <div className="pending-info">
                    <div className="pending-name">{p.name}</div>
                    <div className="pending-type">{p.direction === 'incoming' ? S.chats.wantsToBeFriends : S.chats.sentByYou}</div>
                    <div className="pending-timeline">{p.direction === 'incoming' ? '📩' : '📤'} {formatRelativeTime(p.timestamp)}</div>
                  </div>
                  <div className="pending-actions">
                    {p.direction === 'incoming' ? (
                      <>
                        <button className="pending-btn accept" onClick={() => acceptPending(p)} title="Accept friend request">{S.common.accept}</button>
                        <button className="pending-btn decline" onClick={() => declinePending(p)} title="Decline friend request">{S.common.decline}</button>
                      </>
                    ) : (
                      <button className="pending-btn cancel" onClick={() => declinePending(p)} title="Withdraw your friend request">Withdraw</button>
                    )}
                    <button className="pending-btn block" onClick={() => blockFromPending(p)} title="Block this user">🚫</button>
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
