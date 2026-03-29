import { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import Avatar from '@/components/Avatar';
import { ChatConversation, getChatConversations, deleteChatConversation, clearAllConversations, formatRelativeTime, getDisplayName } from '@/lib/storage';
import { S } from '@/lib/strings';
import { IconTrash } from '@/lib/icons';


export default function NotifsScreen() {
  const { state, dispatch, showScreen, showToast, friendsOnline } = useApp();
  const isActive = state.screen === 'screen-notifs';

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Sort by latest message first
  const sortedConversations = useMemo(
    () => [...conversations].sort((a, b) => b.lastMessageTime - a.lastMessageTime),
    [conversations]
  );

  // Load real conversations from localStorage on screen activation
  useEffect(() => {
    if (isActive) {
      setConversations(getChatConversations());
    }
  }, [isActive]);

  // Refresh when a new message updates the conversation list
  useEffect(() => {
    const handler = () => {
      if (isActive) setConversations(getChatConversations());
    };
    window.addEventListener('conversationsUpdate', handler);
    return () => window.removeEventListener('conversationsUpdate', handler);
  }, [isActive]);

  // Open chat with a conversation
  const openChat = (conv: ChatConversation) => {
    dispatch({
      type: 'SET_PAL',
      pal: { name: getDisplayName(conv.phone, conv.name), phone: conv.phone, avatar: conv.avatar, mood: '', moodEmoji: '' },
    });
    showScreen('screen-chat');
  };

  // Delete a conversation
  const handleDelete = (phone: string, name: string) => {
    setConversations(prev => prev.filter(c => c.phone !== phone));
    deleteChatConversation(phone);
    showToast(S.notifs.deleteToast);
  };

  // Clear all conversations
  const handleClearAll = () => {
    setConversations([]);
    clearAllConversations();
    setShowClearConfirm(false);
    showToast(S.notifs.clearedToast);
  };

  return (
    <div id="screen-notifs" className={`screen${isActive ? ' active' : ''}`}>
      {/* Fixed header */}
      <div className="screen-fixed-header" style={{ display: 'flex', alignItems: 'center' }}>
        <div className="screen-fixed-title" style={{ flex: 1 }}>{S.notifs.title}</div>
        {sortedConversations.length > 0 && (
          <button className="history-clear-btn" onClick={() => setShowClearConfirm(true)}>
            {S.notifs.clearAll}
          </button>
        )}
      </div>

      {/* Scrollable content */}
      <div className="scroll-body" style={{ paddingTop: 90 }}>
        {sortedConversations.length === 0 ? (
          <div className="chats-empty" style={{ marginTop: 40 }}>
            <div className="chats-empty-icon">{S.notifs.emptyIcon}</div>
            <div className="chats-empty-title">{S.notifs.emptyTitle}</div>
            <div className="chats-empty-sub">{S.notifs.emptySub}</div>
          </div>
        ) : (
          <div className="convo-list">
            {sortedConversations.map(conv => {
              const displayName = getDisplayName(conv.phone, conv.name);
              return (
                <div key={conv.phone} className="convo-item">
                  {/* Clickable area: avatar + info */}
                  <div className="convo-tap-area" onClick={() => openChat(conv)}>
                    <div className="convo-avatar" style={{ position: 'relative' }}>
                      <Avatar avatarKey={conv.avatar} size={48} />
                      {/* Show presence dot for friends */}
                      {friendsOnline[conv.phone] !== undefined && (
                        <span className={`friend-presence-dot${friendsOnline[conv.phone] ? ' online' : ' offline'}`} />
                      )}
                    </div>
                    <div className="convo-info">
                      <div className="convo-name-row">
                        <span className="convo-name">{displayName}</span>
                        <span className="convo-time">{formatRelativeTime(conv.lastMessageTime)}</span>
                      </div>
                      <div className="convo-preview-row">
                        <span className="convo-preview">{conv.lastMessage}</span>
                        {conv.unreadCount > 0 && (
                          <span className="convo-unread">{conv.unreadCount}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Delete button */}
                  <button
                    className="convo-delete-btn"
                    title="Delete chat"
                    onClick={() => handleDelete(conv.phone, displayName)}
                  >
                    <IconTrash size={18} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Clear All Confirmation Modal */}
      {showClearConfirm && (
        <div className="modal-overlay show" onClick={() => setShowClearConfirm(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-handle" />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center', padding: '10px 20px 20px' }}>
              <div className="delete-icon" style={{ width: 40, height: 40 }}><IconTrash size={18} color="#e53935" /></div>
              <div className="delete-title" style={{ marginTop: 4 }}>{S.notifs.clearConfirm}</div>
              <div className="delete-actions" style={{ display: 'flex', gap: 10, width: '100%', marginTop: 8 }}>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowClearConfirm(false)}>{S.notifs.clearNo}</button>
                <button className="btn btn-danger" style={{ flex: 1 }} onClick={handleClearAll}>{S.notifs.clearYes}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
