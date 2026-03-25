import { useState, useEffect, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import Avatar from '@/components/Avatar';
import { saveCallToHistory, getFriends, saveFriends, FriendRecord } from '@/lib/storage';
import { sendFriendRequest, checkIfFriends, checkPendingRequest, blockUserFirebase, cleanupCallData, cancelCall, listenOutgoingCallStatus, listenIncomingCallStatus, acceptFriendRequest, addToFriends } from '@/lib/firebase-service';
import { useTimer } from '@/hooks/useTimer';
import { IconChevronLeft, IconMic, IconMicOff, IconPhoneEnd, IconSpeaker } from '@/lib/icons';
import { S } from '@/lib/strings';

export default function CallScreen() {
  const { state, dispatch, showScreen, showToast, goBack, dbRef } = useApp();
  const isActive = state.screen === 'screen-call';
  const pal = state.currentPal;

  // Debug logging
  console.log('[CallScreen] Render:', { isActive, pal, screen: state.screen });

  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [addFriendSent, setAddFriendSent] = useState(false);
  const [isFriend, setIsFriend] = useState(false);
  const [friendStatus, setFriendStatus] = useState<'none' | 'friend' | 'sent' | 'received' | 'loading'>('loading');
  const [callStatus, setCallStatus] = useState<'ringing' | 'connected'>('ringing');
  const [callStartedAt] = useState<number>(Date.now()); // Track when the call screen was shown
  const audioContextRef = useRef<AudioContext | null>(null);
  const ringIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const formattedRef = useRef<string>('00:00'); // Track current duration for callbacks
  const { seconds, formatted, start, stop, reset } = useTimer();

  // Keep formattedRef in sync with formatted
  useEffect(() => {
    formattedRef.current = formatted;
  }, [formatted]);

  // Check friendship status when call starts
  useEffect(() => {
    if (isActive && pal?.phone && dbRef?.current && state.guftguPhone) {
      setFriendStatus('loading');
      
      // First check local friends list
      const localFriends = getFriends();
      const isLocalFriend = localFriends.some(f => f.phone === pal.phone);
      
      if (isLocalFriend) {
        setIsFriend(true);
        setFriendStatus('friend');
        return;
      }

      // Then check Firebase
      Promise.all([
        checkIfFriends(dbRef.current, state.guftguPhone, pal.phone),
        checkPendingRequest(dbRef.current, state.guftguPhone, pal.phone)
      ]).then(([areFriends, pendingStatus]) => {
        if (areFriends) {
          setIsFriend(true);
          setFriendStatus('friend');
        } else if (pendingStatus === 'sent') {
          setFriendStatus('sent');
          setAddFriendSent(true);
        } else if (pendingStatus === 'received') {
          setFriendStatus('received');
        } else {
          setFriendStatus('none');
        }
      }).catch(() => {
        setFriendStatus('none');
      });
    }
  }, [isActive, pal?.phone, dbRef, state.guftguPhone]);

  // Store the connected timestamp for synchronized timer
  const [connectedAt, setConnectedAt] = useState<number | null>(null);

  // Set call status based on whether this is an outgoing or incoming call
  // And listen for status changes
  useEffect(() => {
    console.log('[CallScreen] Call setup effect:', { isActive, palPhone: pal?.phone, isOutgoingCall: pal?.isOutgoingCall, hasDbRef: !!dbRef?.current, guftguPhone: state.guftguPhone });
    
    // For incoming calls, set connected immediately even before other deps are ready
    // The connectedAt will be set from AppContext when accepting
    if (pal?.phone && pal?.isOutgoingCall === false) {
      console.log('[CallScreen] Incoming call - setting connected immediately');
      setCallStatus('connected');
      // Use the connectedAt from pal if available, otherwise use current time
      const timestamp = (pal as any).connectedAt || Date.now();
      setConnectedAt(timestamp);
      start(timestamp);
    }
    
    if (!isActive || !pal?.phone || !dbRef?.current || !state.guftguPhone) {
      console.log('[CallScreen] Skipping listener setup - missing deps');
      return;
    }

    let unsubscribeOutgoing: (() => void) | undefined;
    let unsubscribeIncoming: (() => void) | undefined;

    if (pal.isOutgoingCall) {
      // We initiated the call - show ringing and wait for response
      console.log('[CallScreen] Setting ringing state for outgoing call');
      setCallStatus('ringing');
      
      // Listen for status changes from the receiver
      unsubscribeOutgoing = listenOutgoingCallStatus(
        dbRef.current,
        state.guftguPhone,
        pal.phone,
        (status: 'accepted' | 'declined' | 'cancelled' | 'ended', timestamp?: number) => {
          console.log('[CallScreen] Call status changed:', status, 'connectedAt:', timestamp);
          if (status === 'accepted') {
            setCallStatus('connected');
            // Use the shared timestamp from Firebase for synchronized timer
            const connectedTime = timestamp || Date.now();
            setConnectedAt(connectedTime);
            start(connectedTime);
            showToast('Call connected! 🎉');
          } else if (status === 'declined') {
            // Save as declined outgoing call (they rejected us)
            saveCallToHistory({
              avatar: pal?.avatar || 'cat',
              name: pal?.name || 'Unknown',
              phone: pal?.phone || undefined,
              mood: pal?.mood || '',
              duration: '00:00',
              type: 'Outgoing',
              timestamp: Date.now(),
              callStartedAt: callStartedAt,
            });
            showToast('Call declined');
            dispatch({ type: 'SET_PAL', pal: null });
            showScreen('screen-home');
          } else if (status === 'cancelled') {
            showToast('Call cancelled');
            dispatch({ type: 'SET_PAL', pal: null });
            showScreen('screen-home');
          } else if (status === 'ended') {
            // Other party ended the call - save history
            stop();
            saveCallToHistory({
              avatar: pal?.avatar || 'cat',
              name: pal?.name || 'Unknown',
              phone: pal?.phone || undefined,
              mood: pal?.mood || '',
              duration: formattedRef.current,
              type: 'Outgoing',
              timestamp: Date.now(),
              callStartedAt: callStartedAt,
            });
            showToast('Call ended');
            dispatch({ type: 'SET_PAL', pal: null });
            showScreen('screen-home');
          }
        }
      );
    } else {
      // We received the call - listen for caller ending the call
      unsubscribeIncoming = listenIncomingCallStatus(
        dbRef.current,
        state.guftguPhone,
        pal.phone,
        () => {
          // Caller ended the call - save history
          console.log('[CallScreen] Caller ended the call');
          stop();
          saveCallToHistory({
            avatar: pal?.avatar || 'cat',
            name: pal?.name || 'Unknown',
            phone: pal?.phone || undefined,
            mood: pal?.mood || '',
            duration: formattedRef.current,
            type: 'Incoming',
            timestamp: Date.now(),
            callStartedAt: callStartedAt,
          });
          showToast('Call ended');
          dispatch({ type: 'SET_PAL', pal: null });
          showScreen('screen-home');
        }
      );
    }

    return () => {
      unsubscribeOutgoing?.();
      unsubscribeIncoming?.();
    };
  }, [isActive, pal?.phone, pal?.isOutgoingCall, dbRef, state.guftguPhone]);

  // Play ringing sound when in ringing state
  useEffect(() => {
    console.log('[CallScreen] Ring effect:', { callStatus, isActive });
    
    if (callStatus !== 'ringing' || !isActive) {
      // Cleanup audio
      if (ringIntervalRef.current) {
        clearInterval(ringIntervalRef.current);
        ringIntervalRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      return;
    }

    console.log('[CallScreen] Starting ring tone');
    
    // Create audio context for ringing sound
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;

      const playRingTone = () => {
        console.log('[CallScreen] Playing ring beep');
        // Double beep pattern
        const playBeep = (delay: number, freq: number) => {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          oscillator.frequency.value = freq;
          oscillator.type = 'sine';
          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime + delay);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + delay + 0.4);
          oscillator.start(audioContext.currentTime + delay);
          oscillator.stop(audioContext.currentTime + delay + 0.4);
        };

        // Ring pattern: beep-beep (louder and longer)
        playBeep(0, 480);
        playBeep(0.5, 480);
      };

      // Play immediately and then every 2 seconds
      playRingTone();
      ringIntervalRef.current = setInterval(playRingTone, 2000);

      return () => {
        if (ringIntervalRef.current) {
          clearInterval(ringIntervalRef.current);
          ringIntervalRef.current = null;
        }
        audioContext.close().catch(() => {});
        audioContextRef.current = null;
      };
    } catch (e) {
      console.error('Failed to play ring tone:', e);
    }
  }, [callStatus, isActive]);

  // Start / stop timer when screen is active
  useEffect(() => {
    if (isActive) {
      setIsMuted(false);
      setIsSpeaker(false);
      // callStatus will be set by the outgoing/incoming call effect
    } else {
      stop();
      // Reset states when leaving
      setIsFriend(false);
      setFriendStatus('loading');
      setAddFriendSent(false);
      setCallStatus('ringing'); // Reset for next call
    }
    return () => stop();
  }, [isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  const endCall = async () => {
    stop();
    
    // Cleanup Firebase call data
    if (dbRef?.current && state.guftguPhone && pal?.phone) {
      try {
        await cleanupCallData(dbRef.current, state.guftguPhone, pal.phone);
      } catch (e) {
        console.error('Failed to cleanup call data:', e);
      }
    }
    
    // Determine call type based on who initiated
    const callType = pal?.isOutgoingCall ? 'Outgoing' : 'Incoming';
    
    saveCallToHistory({
      avatar: pal?.avatar || 'cat',
      name: pal?.name || 'Unknown',
      phone: pal?.phone || undefined,
      mood: pal?.mood || '',
      duration: formatted,
      type: callType,
      timestamp: Date.now(),
      callStartedAt: callStartedAt,
    });
    dispatch({ type: 'SET_PAL', pal: null });
    showScreen('screen-home');
    showToast(S.call.callEndedToast(formatted));
  };

  const toggleMute = () => setIsMuted(!isMuted);
  const toggleSpeaker = () => setIsSpeaker(!isSpeaker);

  const addFriend = async () => {
    if (addFriendSent || !pal?.phone || !dbRef?.current) return;
    
    setAddFriendSent(true);
    try {
      await sendFriendRequest(
        dbRef.current,
        state.guftguPhone,
        state.user,
        pal.phone
      );
      setFriendStatus('sent');
      showToast(S.call.friendRequestSent);
    } catch (error) {
      console.error('Failed to send friend request:', error);
      setAddFriendSent(false);
      showToast('❌ Failed to send request');
    }
  };

  // Accept a friend request from the current pal
  const acceptFriend = async () => {
    if (!pal?.phone || !dbRef?.current) return;
    
    try {
      // Accept the request in Firebase
      await acceptFriendRequest(
        dbRef.current,
        state.guftguPhone,
        state.user,
        pal.phone
      );
      
      // Add to friends list (both sides)
      await addToFriends(
        dbRef.current,
        state.guftguPhone,
        state.user,
        pal.phone,
        pal.name,
        pal.avatar,
        pal.mood,
        pal.moodEmoji
      );
      
      // Update local friends list
      const localFriends = getFriends();
      if (!localFriends.some(f => f.phone === pal.phone)) {
        localFriends.push({
          phone: pal.phone,
          name: pal.name,
          avatar: pal.avatar,
          mood: pal.mood,
          moodEmoji: pal.moodEmoji,
          addedAt: Date.now(),
        });
        saveFriends(localFriends);
      }
      
      // Update UI
      setIsFriend(true);
      setFriendStatus('friend');
      showToast('🎉 You are now friends!');
    } catch (error) {
      console.error('Failed to accept friend request:', error);
      showToast('❌ Failed to accept request');
    }
  };

  const switchToChat = () => {
    if (!isFriend) {
      showToast(S.call.chatFriendsOnly);
      return;
    }
    showScreen('screen-chat');
  };

  const blockUser = async () => {
    if (!pal?.phone || !dbRef?.current) {
      showToast(S.call.userBlocked);
      endCall();
      return;
    }

    try {
      await blockUserFirebase(
        dbRef.current,
        state.guftguPhone,
        pal.phone,
        pal.name,
        pal.avatar
      );
      showToast(S.call.userBlocked);
      endCall();
    } catch (error) {
      console.error('Failed to block user:', error);
      showToast(S.call.userBlocked);
      endCall();
    }
  };

  // Show loading while pal data is being set
  if (!pal) {
    console.log('[CallScreen] NO PAL - showing loading state');
    return (
      <div id="screen-call" className={`screen${isActive ? ' active' : ''}`}>
        <div className="call-bg" />
        <div className="call-content">
          <div className="call-loading">
            <div className="call-loading-icon">📞</div>
            <div className="call-loading-text">Connecting...</div>
            <div className="call-loading-dots">
              <span>.</span><span>.</span><span>.</span>
            </div>
            <div style={{ marginTop: 20, fontSize: 12, color: '#888' }}>
              DEBUG: No pal data, isActive={String(isActive)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Ringing state - when caller is waiting for target to answer
  if (callStatus === 'ringing') {
    console.log('[CallScreen] Rendering RINGING state for pal:', pal);
    return (
      <div id="screen-call" className={`screen${isActive ? ' active' : ''}`}>
        <div className="call-bg" />
        <div className="call-content">
          {/* Cancel button */}
          <div className="call-back" onClick={endCall}>
            <IconChevronLeft />
          </div>

          {/* Status - Calling */}
          <div className="call-status ringing">📞 CALLING...</div>

          {/* Avatar with ring animation */}
          <div className="call-avatar-ring calling">
            <div className="call-ring-anim" />
            <div className="call-ring-anim" />
            <div className="call-ring-anim" />
            <div className="call-avatar-main">
              <Avatar avatarKey={pal.avatar} size={136} />
            </div>
          </div>

          {/* Name & mood */}
          <div className="call-name">{pal.name}</div>
          <div className="call-mood">{pal.moodEmoji} {pal.mood}</div>

          {/* Waiting text */}
          <div className="call-waiting">Waiting for answer...</div>

          {/* Spacer */}
          <div className="call-spacer" />

          {/* Cancel Call button */}
          <div className="call-controls">
            <div className="call-ctrl" onClick={endCall}>
              <button className="call-end">
                <IconPhoneEnd />
              </button>
              <div className="call-ctrl-label">Cancel</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Connected state
  console.log('[CallScreen] Rendering CONNECTED state for pal:', pal);
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

        {/* Add Friend - only show if not already friends */}
        {friendStatus !== 'friend' && friendStatus !== 'loading' && (
          <div 
            className={`call-add-friend${addFriendSent || friendStatus === 'sent' ? ' sent' : ''}${friendStatus === 'received' ? ' received' : ''}`} 
            onClick={friendStatus === 'received' ? acceptFriend : addFriend}
          >
            <span className="call-add-friend-icon">
              {friendStatus === 'sent' ? S.call.addFriendSentIcon : 
               friendStatus === 'received' ? '📩' : S.call.addFriendIcon}
            </span>
            <span className="call-add-friend-text">
              {friendStatus === 'sent' ? S.call.requestSentLabel : 
               friendStatus === 'received' ? 'Accept Request' : S.call.addFriendLabel}
            </span>
          </div>
        )}

        {/* Friend badge - show if already friends */}
        {friendStatus === 'friend' && (
          <div className="call-friend-badge">
            <span>✓</span> Friends
          </div>
        )}

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

        {/* Switch to chat - only enabled if friends */}
        <button 
          className={`call-switch-chat${!isFriend ? ' disabled' : ''}`} 
          onClick={switchToChat}
        >
          {isFriend ? S.call.switchToChat : '🔒 Chat (Friends only)'}
        </button>

        {/* Block */}
        <div className="call-block-row">
          <button className="call-block-pill" onClick={blockUser}>
            {S.call.block}
          </button>
        </div>
      </div>
    </div>
  );
}
