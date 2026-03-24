import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import Avatar from '@/components/Avatar';
import { saveCallToHistory } from '@/lib/storage';
import { useTimer } from '@/hooks/useTimer';
import { IconChevronLeft, IconMic, IconMicOff, IconPhoneEnd, IconSpeaker } from '@/lib/icons';
import { S } from '@/lib/strings';

export default function CallScreen() {
  const { state, dispatch, showScreen, showToast, goBack, dbRef } = useApp();
  const isActive = state.screen === 'screen-call';
  const pal = state.currentPal;

  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [addFriendSent, setAddFriendSent] = useState(false);
  const { seconds, formatted, start, stop, reset } = useTimer();

  // Start / stop timer when screen is active
  useEffect(() => {
    if (isActive) {
      setIsMuted(false);
      setIsSpeaker(false);
      setAddFriendSent(false);
      start();
    } else {
      stop();
    }
    return () => stop();
  }, [isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  const endCall = () => {
    stop();
    saveCallToHistory({
      avatar: pal?.avatar || 'cat',
      name: pal?.name || 'Unknown',
      mood: pal?.mood || '',
      duration: formatted,
      type: 'Outgoing',
      time: 'just now',
      timestamp: Date.now(),
    });
    dispatch({ type: 'SET_PAL', pal: null });
    showScreen('screen-home');
    showToast(S.call.callEndedToast(formatted));
  };

  const toggleMute = () => setIsMuted(!isMuted);
  const toggleSpeaker = () => setIsSpeaker(!isSpeaker);

  const addFriend = () => {
    if (addFriendSent) return;
    setAddFriendSent(true);
    showToast(S.call.friendRequestSent);
    // TODO: Firebase friend request
  };

  const switchToChat = () => {
    showScreen('screen-chat');
  };

  if (!pal) return null;

  return (
    <div id="screen-call" className={`screen${isActive ? ' active' : ''}`}>
      <div className="call-bg" />
      <div className="call-content">
        {/* Back */}
        <div className="call-back" onClick={endCall}>
          <IconChevronLeft />
        </div>

        {/* Status */}
        <div className="call-status">{S.call.connected}</div>

        {/* Avatar */}
        <div className="call-avatar-ring">
          <div className="call-ring-anim" />
          <div className="call-ring-anim" />
          <div className="call-avatar-main">
            <Avatar avatarKey={pal.avatar} size={136} />
          </div>
        </div>

        {/* Name & mood */}
        <div className="call-name">{pal.name}</div>
        <div className="call-mood">{pal.moodEmoji} {pal.mood}</div>

        {/* Timer */}
        <div className="call-timer">{formatted}</div>

        {/* Spacer */}
        <div className="call-spacer" />

        {/* Add Friend */}
        <div className={`call-add-friend${addFriendSent ? ' sent' : ''}`} onClick={addFriend}>
          <span className="call-add-friend-icon">{addFriendSent ? S.call.addFriendSentIcon : S.call.addFriendIcon}</span>
          <span className="call-add-friend-text">{addFriendSent ? S.call.requestSentLabel : S.call.addFriendLabel}</span>
        </div>

        {/* Controls */}
        <div className="call-controls">
          <div className="call-ctrl" onClick={toggleMute}>
            <button className={`call-ctrl-btn${isMuted ? ' active' : ''}`}>
              {isMuted ? <IconMicOff /> : <IconMic />}
            </button>
            <div className="call-ctrl-label">{isMuted ? S.call.unmute : S.call.mute}</div>
          </div>

          <div className="call-ctrl" onClick={endCall}>
            <button className="call-end">
              <IconPhoneEnd />
            </button>
            <div className="call-ctrl-label">{S.call.end}</div>
          </div>

          <div className="call-ctrl" onClick={toggleSpeaker}>
            <button className={`call-ctrl-btn${isSpeaker ? ' active' : ''}`}>
              <IconSpeaker />
            </button>
            <div className="call-ctrl-label">{isSpeaker ? S.call.speakerOn : S.call.speaker}</div>
          </div>
        </div>

        {/* Switch to chat */}
        <button className="call-switch-chat" onClick={switchToChat}>
          {S.call.switchToChat}
        </button>

        {/* Block */}
        <div className="call-block-row">
          <button className="call-block-pill" onClick={() => { showToast(S.call.userBlocked); endCall(); }}>
            {S.call.block}
          </button>
        </div>
      </div>
    </div>
  );
}
