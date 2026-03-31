import { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import Avatar from '@/components/Avatar';
import { getFriends, getPending, FriendRecord, PendingRecord, saveFriends, savePending, BlockedRecord, getBlocked, saveBlocked, formatRelativeTime, deleteChatConversation } from '@/lib/storage';
import { 
  listenFriendRequests, 
  listenFriendAccepted, 
  acceptFriendRequest, 
  declineFriendRequest,
  cancelFriendRequest,
  addToFriends,
  initiateCall,
  checkUserForCall,
  blockUserFirebase,
  removeFriendFirebase,
} from '@/lib/firebase-service';
import { timeAgo } from '@/lib/data';
import { S } from '@/lib/strings';
import { IconUnfriend } from '@/lib/icons';

export default function ChatsScreen() {
  const { state, dispatch, showScreen, showToast, dbRef, friendsOnline, friendsLastSeen } = useApp();
  const isActive = state.screen === 'screen-chats';

  const [tab, setTab] = useState<'friends' | 'pending'>('friends');
  const [friends, setFriends] = useState<FriendRecord[]>([]);
  const [pending, setPending] = useState<PendingRecord[]>([]);
  const [editingFriend, setEditingFriend] = useState<FriendRecord | null>(null);
  const [editName, setEditName] = useState('');
  const [showRenameModal, setShowRenameModal] = useState(false);

  // Sort: online friends first, then newest first
  const sortedFriends = useMemo(() => [...friends].sort((a, b) => {
    const aOnline = friendsOnline[a.phone] ? 1 : 0;
    const bOnline = friendsOnline[b.phone] ? 1 : 0;
    if (bOnline !== aOnline) return bOnline - aOnline; // online first
    return b.addedAt - a.addedAt;
  }), [friends, friendsOnline]);
  const sortedPending = useMemo(() => [...pending].sort((a, b) => b.timestamp - a.timestamp), [pending]);

  // Load real data from localStorage on screen activation
  useEffect(() => {
    if (isActive) {
      setFriends(getFriends());
      setPending(getPending());
    }
  }, [isActive]);

  // Refresh friends list when localStorage changes (e.g., other side unfriends us)
  useEffect(() => {
    const handleFriends = () => {
      if (isActive) setFriends(getFriends());
    };
    const handlePending = () => {
      if (isActive) setPending(getPending());
    };
    window.addEventListener('friendsUpdate', handleFriends);
    window.addEventListener('pendingUpdate', handlePending);
    return () => {
      window.removeEventListener('friendsUpdate', handleFriends);
      window.removeEventListener('pendingUpdate', handlePending);
    };
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
          await declineFriendRequest(dbRef.current, state.guftguPhone, p.phone, state.user.nickname, state.user.avatar);
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

  const callFriend = async (f: FriendRecord) => {
    // Don't allow starting a call with a different person if already in a call
    if (state.currentPal && state.currentPal.phone !== f.phone) {
      showToast('📞 Please end your current call first');
      return;
    }

    if (!dbRef?.current || !state.guftguPhone) {
      showToast('Connection error — try again');
      return;
    }

    try {
      // Check if user is online
      const result = await checkUserForCall(dbRef.current, f.phone, state.guftguPhone);
      if (!result.exists) { showToast('User not found'); return; }
      if (result.blockedByTarget) { showToast('User is not available'); return; }
      if (!result.online) { showToast(`${f.nickname || f.name} is offline`); return; }

      // Initiate the call in Firebase so the other person gets notified
      await initiateCall(dbRef.current, state.guftguPhone, state.user, f.phone);

      // Set pal with outgoing flag
      dispatch({
        type: 'SET_PAL',
        pal: {
          phone: f.phone,
          name: f.nickname || f.name,
          avatar: f.avatar,
          mood: f.mood,
          moodEmoji: f.moodEmoji,
          isOutgoingCall: true,
        },
      });
      showScreen('screen-call');
    } catch (error) {
      console.error('Call friend error:', error);
      showToast('Failed to call — try again');
    }
  };

  // ── Unfriend: remove from friends list ──
  const unfriendUser = async (f: FriendRecord) => {
    const updated = friends.filter(x => x.phone !== f.phone);
    setFriends(updated);
    saveFriends(updated);
    // Remove from conversation list (they won't be able to chat anymore)
    // deleteChatConversation already calls markChatDeleted internally
    deleteChatConversation(f.phone);
    // Remove from Firebase friends list (both sides)
    if (dbRef?.current && state.guftguPhone) {
      removeFriendFirebase(dbRef.current, state.guftguPhone, f.phone).catch(() => {});
    }
    showToast(`${f.nickname || f.name} has been removed from friends list`);
  };

  // ── Block from friends: move to blocked list + remove from friends ──
  const blockFromFriends = async (f: FriendRecord) => {
    // Remove from friends locally
    const updatedFriends = friends.filter(x => x.phone !== f.phone);
    setFriends(updatedFriends);
    saveFriends(updatedFriends);

    // Block on Firebase (handles localStorage too)
    if (dbRef?.current && state.guftguPhone) {
      try {
        await blockUserFirebase(dbRef.current, state.guftguPhone, f.phone, f.name, f.avatar);
      } catch (error) {
        console.error('Failed to block on Firebase:', error);
        // Fallback: save to localStorage only
        const blocked = getBlocked();
        if (!blocked.some(b => b.phone === f.phone)) {
          const newBlocked: BlockedRecord = { phone: f.phone, name: f.name, nickname: f.nickname, avatar: f.avatar, blockedAt: Date.now() };
          saveBlocked([...blocked, newBlocked]);
        }
      }
    } else {
      // Offline fallback: save to localStorage
      const blocked = getBlocked();
      if (!blocked.some(b => b.phone === f.phone)) {
        const newBlocked: BlockedRecord = { phone: f.phone, name: f.name, nickname: f.nickname, avatar: f.avatar, blockedAt: Date.now() };
        saveBlocked([...blocked, newBlocked]);
      }
    }
    showToast(`🚫 ${f.nickname || f.name} has been blocked`);
  };

  // ── Block from pending: decline request + block + remove from pending ──
  const blockFromPending = async (p: PendingRecord) => {
    // Remove from pending locally
    const updatedPending = pending.filter(x => x.phone !== p.phone);
    setPending(updatedPending);
    savePending(updatedPending);

    // Block on Firebase (handles localStorage too)
    if (dbRef?.current && state.guftguPhone) {
      try {
        // First decline/cancel the friend request
        if (p.direction === 'incoming') {
          await declineFriendRequest(dbRef.current, state.guftguPhone, p.phone, state.user.nickname, state.user.avatar);
        } else {
          await cancelFriendRequest(dbRef.current, state.guftguPhone, p.phone);
        }
        await blockUserFirebase(dbRef.current, state.guftguPhone, p.phone, p.name, p.avatar);
      } catch (error) {
        console.error('Failed to block on Firebase:', error);
        // Fallback: save to localStorage only
        const blocked = getBlocked();
        if (!blocked.some(b => b.phone === p.phone)) {
          const newBlocked: BlockedRecord = { phone: p.phone, name: p.name, avatar: p.avatar, blockedAt: Date.now() };
          saveBlocked([...blocked, newBlocked]);
        }
      }
    } else {
      // Offline fallback: save to localStorage
      const blocked = getBlocked();
      if (!blocked.some(b => b.phone === p.phone)) {
        const newBlocked: BlockedRecord = { phone: p.phone, name: p.name, avatar: p.avatar, blockedAt: Date.now() };
        saveBlocked([...blocked, newBlocked]);
      }
    }
    showToast(`🚫 ${p.name} has been blocked`);
  };

  // ── Rename friend: start editing ──
  const startRename = (f: FriendRecord) => {
    setEditingFriend(f);
    setEditName(f.nickname || f.name);
    setShowRenameModal(true);
  };

  // ── Rename friend: save nickname ──
  const saveRename = () => {
    if (!editingFriend) return;
    const trimmed = editName.trim();
    if (!trimmed) {
      setShowRenameModal(false);
      setEditingFriend(null);
      return;
    }
    const updated = friends.map(x =>
      x.phone === editingFriend.phone ? { ...x, nickname: trimmed === editingFriend.name ? undefined : trimmed } : x
    );
    setFriends(updated);
    saveFriends(updated);
    setShowRenameModal(false);
    setEditingFriend(null);
    showToast(`✏️ Saved as "${trimmed}"`);
  };

  // ── Rename friend: cancel editing ──
  const cancelRename = () => {
    setShowRenameModal(false);
    setEditingFriend(null);
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
                  {/* Top row: avatar + info */}
                  <div className="friend-top-row">
                    <div className="friend-avatar" style={{ position: 'relative' }}>
                      <Avatar avatarKey={f.avatar || 'cat'} size={48} />
                      <span
                        className={`friend-presence-dot${friendsOnline[f.phone] ? ' online' : ' offline'}`}
                        title={friendsOnline[f.phone] ? 'Online' : friendsLastSeen[f.phone] ? `Last seen ${formatRelativeTime(friendsLastSeen[f.phone]!)}` : 'Offline'}
                      />
                    </div>
                    <div className="friend-info">
                      <div className="friend-name">
                        <span className="friend-name-text">{f.nickname || f.name}</span>
                        <button className="friend-rename-btn" onClick={(e) => { e.stopPropagation(); startRename(f); }} title="Rename">✏️</button>
                      </div>
                      {f.nickname && <div className="friend-original-name">aka {f.name}</div>}
                      <div className="friend-mood">{f.moodEmoji} {f.mood}</div>
                      <div className="friend-status-row">
                        {friendsOnline[f.phone]
                          ? <span className="friend-online-label">🟢 Online now</span>
                          : <span className="friend-offline-label">
                              {friendsLastSeen[f.phone]
                                ? `Last seen ${formatRelativeTime(friendsLastSeen[f.phone]!)}`
                                : 'Offline'}
                            </span>
                        }
                      </div>
                    </div>
                  </div>
                  {/* Bottom row: action buttons */}
                  <div className="friend-actions">
                    <button className="friend-action-btn chat" onClick={() => openChatWithFriend(f)} title="Chat">
                      <span className="friend-action-icon">💬</span><span className="friend-action-label">Chat</span>
                    </button>
                    <button 
                      className={`friend-action-btn call${!!(state.currentPal && state.currentPal.phone !== f.phone) ? ' disabled' : ''}`} 
                      onClick={() => callFriend(f)} 
                      title={!!(state.currentPal && state.currentPal.phone !== f.phone) ? 'Cannot call during an active call' : 'Call'}
                      disabled={!!(state.currentPal && state.currentPal.phone !== f.phone)}
                    >
                      <span className="friend-action-icon">📞</span><span className="friend-action-label">Call</span>
                    </button>
                    <button className="friend-action-btn rename" onClick={(e) => { e.stopPropagation(); startRename(f); }} title="Rename">
                      <span className="friend-action-icon">✏️</span><span className="friend-action-label">Rename</span>
                    </button>
                    <button className="friend-action-btn unfriend" onClick={() => unfriendUser(f)} title="Unfriend">
                      <span className="friend-action-icon"><IconUnfriend size={18} /></span><span className="friend-action-label">Remove</span>
                    </button>
                    <button className="friend-action-btn block" onClick={() => blockFromFriends(f)} title="Block">
                      <span className="friend-action-icon">🚫</span><span className="friend-action-label">Block</span>
                    </button>
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

      {/* Rename Friend Modal */}
      {showRenameModal && editingFriend && (
        <div className="modal-overlay show" onClick={cancelRename}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <div className="modal-handle" />
            <div style={{ padding: '16px 24px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
                <Avatar avatarKey={editingFriend.avatar || 'cat'} size={48} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>{editingFriend.name}</div>
                  {editingFriend.moodEmoji && (
                    <div style={{ fontSize: 13, color: 'var(--text3)' }}>{editingFriend.moodEmoji} {editingFriend.mood}</div>
                  )}
                </div>
              </div>
              <div style={{ width: '100%' }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 6, display: 'block' }}>
                  ✏️ Set a nickname
                </label>
                <input
                  className="rename-modal-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') cancelRename(); }}
                  autoFocus
                  maxLength={20}
                  placeholder={editingFriend.name}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    fontSize: 16,
                    borderRadius: 12,
                    border: '2px solid var(--border)',
                    background: 'var(--bg2)',
                    color: 'var(--text)',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => (e.target as HTMLInputElement).style.borderColor = 'var(--accent2)'}
                  onBlur={(e) => (e.target as HTMLInputElement).style.borderColor = 'var(--border)'}
                />
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                  {editName.length}/20 characters
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, width: '100%', marginTop: 4 }}>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={cancelRename}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveRename} disabled={!editName.trim()}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
