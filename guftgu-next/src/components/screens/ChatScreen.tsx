import { useState, useRef, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import Avatar from '@/components/Avatar';
import { getFriends } from '@/lib/storage';
import { 
  sendChatMessage, 
  listenChatMessages, 
  loadChatHistory,
  checkIfFriends,
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
  const { state, dispatch, showScreen, showToast, goBack, dbRef } = useApp();
  const isActive = state.screen === 'screen-chat';
  const pal = state.currentPal;

  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [isFriend, setIsFriend] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const processedIds = useRef<Set<string>>(new Set());

  // Check if users are friends and load chat history
  useEffect(() => {
    if (!isActive || !pal?.phone || !state.guftguPhone) {
      setMessages([]);
      processedIds.current.clear();
      setLoading(true);
      return;
    }

    // Check friendship locally first
    const localFriends = getFriends();
    const isLocalFriend = localFriends.some(f => f.phone === pal.phone);

    if (isLocalFriend) {
      setIsFriend(true);
    } else if (dbRef?.current) {
      // Check Firebase
      checkIfFriends(dbRef.current, state.guftguPhone, pal.phone)
        .then(result => setIsFriend(result))
        .catch(() => setIsFriend(false));
    }

    // Load chat history
    if (dbRef?.current) {
      loadChatHistory(dbRef.current, state.guftguPhone, pal.phone)
        .then(history => {
          const displayMessages: DisplayMessage[] = history.map(msg => {
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

  // Listen for new messages in real-time
  useEffect(() => {
    if (!isActive || !pal?.phone || !dbRef?.current || !state.guftguPhone) return;

    const unsub = listenChatMessages(
      dbRef.current,
      state.guftguPhone,
      pal.phone,
      (msg: ChatMessage) => {
        // Skip if already processed (from history load)
        if (processedIds.current.has(msg.id)) return;
        processedIds.current.add(msg.id);

        const displayMsg: DisplayMessage = {
          id: msg.id,
          text: msg.text,
          mine: msg.from === state.guftguPhone,
          time: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages(prev => [...prev, displayMsg]);
      }
    );

    return () => unsub();
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
            <div className="online-dot" />
            {pal.moodEmoji} {pal.mood}
          </div>
        </div>
        <div className="chat-header-actions">
          <button className="chat-action-btn" onClick={goToCall}>
            <IconPhone size={18} />
          </button>
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
