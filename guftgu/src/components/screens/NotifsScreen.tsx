import { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import Avatar from '@/components/Avatar';
import { ChatConversation, getChatConversations, saveChatConversations, deleteChatConversation, clearAllConversations, formatRelativeTime, getDisplayName } from '@/lib/storage';
import { S } from '@/lib/strings';
import { IconTrash, IconAlertTriangle } from '@/lib/icons';

// ── Dummy conversations for UI preview ──
const DUMMY_CONVERSATIONS: ChatConversation[] = [
  { phone: '1000001', name: 'Aarav', avatar: 'cat', lastMessage: 'Haha that was hilarious 😂', lastMessageTime: Date.now() - 120000, unreadCount: 3 },
  { phone: '1000002', name: 'Priya', avatar: 'dog', lastMessage: 'Sure, let me check and get back to you', lastMessageTime: Date.now() - 1800000, unreadCount: 0 },
  { phone: '1000003', name: 'Rohan', avatar: 'panda', lastMessage: 'Bro did you watch that match? 🏏', lastMessageTime: Date.now() - 3600000, unreadCount: 1 },
  { phone: '1000006', name: 'Ananya', avatar: 'koala', lastMessage: 'Thanks for the help! 🙏', lastMessageTime: Date.now() - 7200000, unreadCount: 0 },
  { phone: '1000005', name: 'Vikram', avatar: 'fox', lastMessage: 'Kya scene hai aaj?', lastMessageTime: Date.now() - 14400000, unreadCount: 0 },
  { phone: '1000004', name: 'Sneha', avatar: 'bunny', lastMessage: 'Good night 🌙', lastMessageTime: Date.now() - 36000000, unreadCount: 0 },
  { phone: '1000008', name: 'Diya', avatar: 'owl', lastMessage: 'Send me that song name na', lastMessageTime: Date.now() - 86400000, unreadCount: 2 },
  { phone: '1000007', name: 'Kabir', avatar: 'penguin', lastMessage: 'Let\'s plan something this weekend', lastMessageTime: Date.now() - 172800000, unreadCount: 0 },
  { phone: '1000009', name: 'Arjun', avatar: 'tiger', lastMessage: 'GG bhai 🎮', lastMessageTime: Date.now() - 259200000, unreadCount: 0 },
  { phone: '1000010', name: 'Meera', avatar: 'bear', lastMessage: 'Take care ❤️', lastMessageTime: Date.now() - 432000000, unreadCount: 0 },
  { phone: '2000001', name: 'Ishaan', avatar: 'lion', lastMessage: 'Kal milte hain!', lastMessageTime: Date.now() - 604800000, unreadCount: 0 },
  { phone: '2000002', name: 'Kavya', avatar: 'deer', lastMessage: 'Hehe okay 😄', lastMessageTime: Date.now() - 864000000, unreadCount: 0 },
];

export default function NotifsScreen() {
  const { state, dispatch, showScreen, showToast } = useApp();
  const isActive = state.screen === 'screen-notifs';

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Sort by latest message first
  const sortedConversations = useMemo(
    () => [...conversations].sort((a, b) => b.lastMessageTime - a.lastMessageTime),
    [conversations]
  );

  // Load conversations on mount
  useEffect(() => {
    if (isActive) {
      const real = getChatConversations();
      setConversations(real.length > 0 ? real : DUMMY_CONVERSATIONS);
    }
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
                    <div className="convo-avatar">
                      <Avatar avatarKey={conv.avatar} size={48} />
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
