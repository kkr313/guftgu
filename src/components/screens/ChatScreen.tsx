import { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import Avatar from '@/components/Avatar';
import { getFriends, getChatConversations, saveChatConversations, ChatConversation, bumpUnreadCount, formatRelativeTime, getChatDeletedSince } from '@/lib/storage';
import { playMessageSound } from '@/lib/sounds';
import { 
  sendChatMessage, 
  listenChatMessages, 
  loadChatHistory,
  checkIfFriends,
  setTypingStatus,
  listenTypingStatus,
  updateSeenTimestamp,
  listenSeenStatus,
  ChatMessage 
} from '@/lib/firebase-service';
import { IconChevronLeft, IconSend } from '@/lib/icons';
import { S } from '@/lib/strings';

interface DisplayMessage {
  id: string;
  text: string;
  mine: boolean;
  time: string;
  timestamp: number;
  system?: boolean;
  status?: 'sent' | 'seen';
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
  const [palTyping, setPalTyping] = useState(false);
  const [palSeenAt, setPalSeenAt] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const processedIds = useRef<Set<string>>(new Set());
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        timestamp: 0,
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
              timestamp: msg.timestamp,
              status: msg.from === state.guftguPhone ? 'sent' as const : undefined,
            };
          });
          
          // Add system message at the beginning
          displayMessages.unshift({
            id: 'sys-1',
            text: S.chat.matchSystemMsg(pal.name),
            mine: false,
            time: '',
            timestamp: 0,
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
            timestamp: 0,
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

    // Respect the deletion marker so old messages don't leak through the
    // real-time listener (race condition: listener fires before history loads)
    const deletedSince = getChatDeletedSince(pal.phone);

    const unsub = listenChatMessages(
      dbRef.current,
      state.guftguPhone,
      pal.phone,
      (msg: ChatMessage) => {
        // Skip if already rendered by the history load
        if (processedIds.current.has(msg.id)) return;

        // Skip messages older than the deletion timestamp
        if (deletedSince && msg.timestamp <= deletedSince) return;

        processedIds.current.add(msg.id);

        const displayMsg: DisplayMessage = {
          id: msg.id,
          text: msg.text,
          mine: msg.from === state.guftguPhone,
          time: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          timestamp: msg.timestamp,
          status: msg.from === state.guftguPhone ? 'sent' as const : undefined,
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

  // ── Typing indicator: listen for pal's typing status ──
  useEffect(() => {
    if (!isActive || !pal?.phone || !dbRef?.current || !state.guftguPhone || !isFriend) {
      setPalTyping(false);
      return;
    }
    const unsub = listenTypingStatus(dbRef.current, state.guftguPhone, pal.phone, setPalTyping);
    return () => { unsub(); setPalTyping(false); };
  }, [isActive, pal?.phone, dbRef, state.guftguPhone, isFriend]);

  // ── Typing indicator: broadcast my typing status ──
  const handleInputChange = useCallback((text: string) => {
    setInput(text);
    if (!dbRef?.current || !state.guftguPhone || !pal?.phone || !isFriend) return;
    // Set typing = true
    setTypingStatus(dbRef.current, state.guftguPhone, pal.phone, true).catch(() => {});
    // Clear previous timeout
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    // Stop typing after 2s of no input
    typingTimeoutRef.current = setTimeout(() => {
      if (dbRef?.current && state.guftguPhone && pal?.phone) {
        setTypingStatus(dbRef.current, state.guftguPhone, pal.phone, false).catch(() => {});
      }
    }, 2000);
  }, [dbRef, state.guftguPhone, pal?.phone, isFriend]);

  // ── Clean up typing on unmount / screen change ──
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (dbRef?.current && state.guftguPhone && pal?.phone) {
        setTypingStatus(dbRef.current, state.guftguPhone, pal.phone, false).catch(() => {});
      }
    };
  }, [isActive, pal?.phone]);

  // ── Seen receipts: update my "seen" timestamp when I view the chat ──
  useEffect(() => {
    if (!isActive || !pal?.phone || !dbRef?.current || !state.guftguPhone || !isFriend) return;
    // Mark seen on open and whenever new messages arrive
    updateSeenTimestamp(dbRef.current, state.guftguPhone, pal.phone).catch(() => {});
  }, [isActive, pal?.phone, dbRef, state.guftguPhone, isFriend, messages.length]);

  // ── Seen receipts: listen for pal's "seen" timestamp ──
  useEffect(() => {
    if (!isActive || !pal?.phone || !dbRef?.current || !state.guftguPhone || !isFriend) {
      setPalSeenAt(0);
      return;
    }
    const unsub = listenSeenStatus(dbRef.current, state.guftguPhone, pal.phone, setPalSeenAt);
    return () => { unsub(); };
  }, [isActive, pal?.phone, dbRef, state.guftguPhone, isFriend]);


  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !pal?.phone || !dbRef?.current || !state.guftguPhone) return;

    if (!isFriend) {
      showToast(S.call.chatFriendsOnly);
      return;
    }

    setInput('');
    // Stop typing indicator on send
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setTypingStatus(dbRef.current, state.guftguPhone, pal.phone, false).catch(() => {});

    try {
      const success = await sendChatMessage(dbRef.current, state.guftguPhone, pal.phone, text);
      if (!success) {
        showToast('🚫 Cannot message blocked user');
      } else {
        updateConversationList(text);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      showToast('Failed to send message');
    }
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
            {palTyping
              ? <span className="chat-typing-label">typing<span className="typing-dots"><span>.</span><span>.</span><span>.</span></span></span>
              : pal.phone && friendsOnline[pal.phone]
                ? <><div className="online-dot" /> Online</>
                : pal.phone && friendsLastSeen[pal.phone]
                  ? <span style={{ color: 'var(--text-3)', fontSize: '0.78rem' }}>
                      Last seen {formatRelativeTime(friendsLastSeen[pal.phone]!)}
                    </span>
                  : <span style={{ color: 'var(--text-3)', fontSize: '0.78rem' }}>Offline</span>
            }
          </div>
          {pal.mood && (
            <div className="chat-header-mood">{pal.moodEmoji} {pal.mood}</div>
          )}
        </div>
        <div className="chat-header-actions">
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
                  <div className="msg-time">
                    {msg.time}
                    {msg.mine && (
                      <span className={`msg-tick${msg.timestamp && palSeenAt && msg.timestamp <= palSeenAt ? ' seen' : ''}`}>
                        {msg.timestamp && palSeenAt && msg.timestamp <= palSeenAt ? ' ✓✓' : ' ✓'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          )
        )}
        {palTyping && (
          <div className="msg-row">
            <div className="msg-avatar-sm">
              <Avatar avatarKey={pal.avatar} size={28} />
            </div>
            <div className="msg-bubble-wrap">
              <div className="msg-bubble typing-bubble">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            </div>
          </div>
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
          onChange={(e) => handleInputChange(e.target.value)}
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
