import { useState, useRef, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import Avatar from '@/components/Avatar';
import { BOT_REPLIES } from '@/lib/data';
import { IconChevronLeft, IconPhone, IconSend } from '@/lib/icons';
import { S } from '@/lib/strings';

interface Message {
  id: string;
  text: string;
  mine: boolean;
  time: string;
  system?: boolean;
}

export default function ChatScreen() {
  const { state, showScreen, goBack } = useApp();
  const isActive = state.screen === 'screen-chat';
  const pal = state.currentPal;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isActive && pal) {
      setMessages([{
        id: 'sys-1',
        text: S.chat.matchSystemMsg(pal.name),
        mine: false,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        system: true,
      }]);
    }
  }, [isActive, pal]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    const text = input.trim();
    if (!text || !pal) return;
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newMsg: Message = { id: Date.now().toString(), text, mine: true, time: now };
    setMessages((prev) => [...prev, newMsg]);
    setInput('');

    // Bot reply
    setTyping(true);
    setTimeout(() => {
      const mood = pal.mood || 'Chill';
      const pool = BOT_REPLIES[mood] || BOT_REPLIES['Chill'];
      const reply = pool[Math.floor(Math.random() * pool.length)];
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        text: reply,
        mine: false,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }]);
      setTyping(false);
    }, 1200 + Math.random() * 2000);
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
          <button className="chat-action-btn" onClick={() => showScreen('screen-call')}>
            <IconPhone size={18} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.map((msg) =>
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
        )}
        {typing && (
          <div className="msg-row">
            <div className="msg-avatar-sm">
              <Avatar avatarKey={pal.avatar} size={28} />
            </div>
            <div className="typing-indicator">
              <div className="typing-dot" />
              <div className="typing-dot" />
              <div className="typing-dot" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="chat-input-bar">
        <textarea
          className="chat-input"
          placeholder={S.chat.placeholder}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
        />
        <button className="chat-send" onClick={sendMessage}>
          <IconSend />
        </button>
      </div>
    </div>
  );
}
