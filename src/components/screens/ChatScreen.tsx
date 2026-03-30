import { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import Avatar from '@/components/Avatar';
import { getFriends, getChatConversations, saveChatConversations, ChatConversation, bumpUnreadCount, formatRelativeTime, getChatDeletedSince, clearChatDeletedSince, markChatDeleted } from '@/lib/storage';
import { playMessageSound } from '@/lib/sounds';
import { 
  sendChatMessage, 
  listenChatMessages, 
  loadChatHistory,
  checkIfFriends,
  initiateCall,
  checkUserForCall,
  ChatMessage 
} from '@/lib/firebase-service';
import { IconChevronLeft, IconPhone, IconSend } from '@/lib/icons';
import { S } from '@/lib/strings';

interface DisplayMessage {
  id: string;
  text: string;
  mine: boolean;
  time: string;
  system?: boolean;
}

export default function ChatScreen() {
  const { state, dispatch, showScreen, showToast, goBack, dbRef, clearChatUnread, friendsOnline, friendsLastSeen } = useApp();
  const isActive = state.screen === 'screen-chat';
  const pal = state.currentPal;
  const myUser = state.user;

  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [isFriend, setIsFriend] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const processedIds = useRef<Set<string>>(new Set());

  // Handle voice call to friend
  const handleCallFriend = async () => {
    if (!dbRef?.current || !state.guftguPhone || !pal?.phone) {
      showToast('Unable to start call');
      return;
    }

    // Don't allow starting a call with a different person if already in a call
    if (state.currentPal && state.currentPal.phone !== pal.phone) {
      showToast('📞 Please end your current call first');
      return;
    }

    const canCall = await checkUserForCall(dbRef.current, pal.phone, state.guftguPhone);
    if (!canCall.exists || canCall.blockedByTarget) {
      showToast('User is not available for calls');
      return;
    }

    await initiateCall(dbRef.current, state.guftguPhone, myUser, pal.phone);
  };

  // Check if users are friends and load chat history
  useEffect(() => {
    if (!isActive || !pal?.phone || !state.guftguPhone) {
      setMessages([]);
      processedIds.current.clear();
      setLoading(true);
      return;
    }

    // Clear unread badge when screen opens
    clearChatUnread(pal!.phone);

    // Check friendship locally first
    const localFriends = getFriends();
    const isLocalFriend = localFriends.some(f => f.phone === pal.phone);

    if (isLocalFriend) {
      setIsFriend(true);
    } else {
      // Not a friend locally — don't check Firebase (treat as not friends)
      // This correctly handles the unfriend case where the conversation is opened
      // from the chat list but the user has since been unfriended
      setIsFriend(false);
      setMessages([{
        id: 'sys-1',
        text: '🔒 You are no longer friends. Send a new friend request to chat again.',
        mine: false,
        time: '',
        system: true,
      }]);
      setLoading(false);
      return;
    }

    // Get the deletion cutoff for this conversation (if user deleted chat)
    const deletedSince = getChatDeletedSince(pal.phone);

    // Load chat history
    if (dbRef?.current) {
      loadChatHistory(dbRef.current, state.guftguPhone, pal.phone)
        .then(history => {
          // Filter out messages that were sent before the user deleted this chat
          const filteredHistory = deletedSince
            ? history.filter(msg => msg.timestamp > deletedSince)
            : history;

          const displayMessages: DisplayMessage[] = filteredHistory.map(msg => {
            processedIds.current.add(msg.id);
            return {
              id: msg.id,
              text: msg.text,
              mine: msg.from === state.guftguPhone,
              time: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            };
          });
          
          // Add system message at the beginning
          displayMessages.unshift({
            id: 'sys-1',
            text: S.chat.matchSystemMsg(pal.name),
            mine: false,
            time: '',
            system: true,
          });
          
          setMessages(displayMessages);
          setLoading(false);
        })
        .catch(() => {
          setMessages([{
            id: 'sys-1',
            text: S.chat.matchSystemMsg(pal.name),
            mine: false,
            time: '',
            system: true,
          }]);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [isActive, pal?.phone, state.guftguPhone, dbRef]);

  /** Persist conversation to localStorage so the Chats tab (NotifsScreen) shows real data */
  const updateConversationList = useCallback((lastMessage: string) => {
    if (!pal?.phone) return;
    const convos = getChatConversations();
    const existing = convos.findIndex(c => c.phone === pal!.phone);
    const updated: ChatConversation = {
      phone: pal!.phone,
      name: pal!.name,
      avatar: pal!.avatar,
      lastMessage,
      lastMessageTime: Date.now(),
      unreadCount: existing >= 0 ? convos[existing].unreadCount : 0,
    };
    if (existing >= 0) {
      convos[existing] = updated;
    } else {
      convos.unshift(updated);
    }
    saveChatConversations(convos);
    window.dispatchEvent(new Event('conversationsUpdate'));
  }, [pal]);

  // Listen for new messages in real-time
  useEffect(() => {
    if (!isActive || !pal?.phone || !dbRef?.current || !state.guftguPhone) return;

    // Record the time we started listening — any message older than this is
    // "historical" (already rendered from loadChatHistory) and must NOT trigger
    // a sound or unread badge. Using timestamp is reliable; setTimeout is not.
    const listenStartedAt = Date.now();

    const unsub = listenChatMessages(
      dbRef.current,
      state.guftguPhone,
      pal.phone,
      (msg: ChatMessage) => {
        // Skip if already rendered by the history load
        if (processedIds.current.has(msg.id)) return;
        processedIds.current.add(msg.id);

        const displayMsg: DisplayMessage = {
          id: msg.id,
          text: msg.text,
          mine: msg.from === state.guftguPhone,
          time: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages(prev => [...prev, displayMsg]);

        // Only react to truly NEW incoming messages (sent after we opened the screen)
        const isNewMessage = msg.timestamp >= listenStartedAt;
        if (msg.from !== state.guftguPhone) {
          updateConversationList(msg.text);
          if (isNewMessage) {
            // Play beep ONLY for messages that arrive while chat is open
            playMessageSound();
          }
        }
      }
    );

    return () => {
      unsub();
    };
  }, [isActive, pal?.phone, dbRef, state.guftguPhone]);


  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);


  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !pal?.phone || !dbRef?.current || !state.guftguPhone) return;

    if (!isFriend) {
      showToast(S.call.chatFriendsOnly);
      return;
    }

    setInput('');

    try {
      const success = await sendChatMessage(dbRef.current, state.guftguPhone, pal.phone, text);
      if (!success) {
        showToast('🚫 Cannot message blocked user');
      } else {
        // Clear deletion marker when user sends a new message — history restarts from here
        clearChatDeletedSince(pal.phone);
        updateConversationList(text);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      showToast('❌ Failed to send message');
    }
  };

  const goToCall = () => {
    showScreen('screen-call');
  };

  if (!pal) return null;

  return (
    <div id="screen-chat" className={`screen${isActive ? ' active' : ''}`}>
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-back" onClick={goBack}>
          <IconChevronLeft />
        </div>
        <div className="chat-header-avatar">
          <Avatar avatarKey={pal.avatar} size={42} />
        </div>
        <div className="chat-header-info">
          <div className="chat-header-name">{pal.name}</div>
          <div className="chat-header-status">
            {pal.phone && friendsOnline[pal.phone]
              ? <><div className="online-dot" /> Online</>
              : pal.phone && friendsLastSeen[pal.phone]
                ? <span style={{ color: 'var(--text-3)', fontSize: '0.78rem' }}>
                    Last seen {formatRelativeTime(friendsLastSeen[pal.phone]!)}
                  </span>
                : <span style={{ color: 'var(--text-3)', fontSize: '0.78rem' }}>Offline</span>
            }
            {' '}{pal.moodEmoji} {pal.mood}
          </div>
        </div>
        <div className="chat-header-actions">
          {isFriend && (
            <button
              className="chat-action-btn"
              onClick={handleCallFriend}
              disabled={!!state.currentPal}
              title={state.currentPal ? 'Call is already active' : 'Voice call'}
            >
              <IconPhone size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Not friends warning */}
      {!loading && !isFriend && (
        <div className="chat-not-friends">
          <div className="chat-not-friends-icon">🔒</div>
          <div className="chat-not-friends-text">
            You need to be friends to chat.<br/>
            Send a friend request during a call!
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="chat-messages">
        {loading ? (
          <div className="chat-loading">Loading messages...</div>
        ) : (
          messages.map((msg) =>
            msg.system ? (
              <div key={msg.id} className="msg-system">{msg.text}</div>
            ) : (
              <div key={msg.id} className={`msg-row${msg.mine ? ' mine' : ''}`}>
                {!msg.mine && (
                  <div className="msg-avatar-sm">
                    <Avatar avatarKey={pal.avatar} size={28} />
                  </div>
                )}
                <div className="msg-bubble-wrap">
                  <div className="msg-bubble">{msg.text}</div>
                  <div className="msg-time">{msg.time}</div>
                </div>
              </div>
            )
          )
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className={`chat-input-bar${!isFriend ? ' disabled' : ''}`}>
        <textarea
          className="chat-input"
          placeholder={isFriend ? S.chat.placeholder : '🔒 Friends only'}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          disabled={!isFriend}
        />
        <button className="chat-send" onClick={sendMessage} disabled={!isFriend}>
          <IconSend />
        </button>
      </div>
    </div>
  );
}
