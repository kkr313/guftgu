import { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import Avatar from '@/components/Avatar';
import { saveCallToHistory, getFriends, saveFriends, FriendRecord } from '@/lib/storage';
import { sendFriendRequest, checkIfFriends, checkPendingRequest, blockUserFirebase, cleanupCallData, cancelCall, endCall as firebaseEndCall, listenOutgoingCallStatus, listenIncomingCallStatus, acceptFriendRequest, addToFriends, setDirectCallRoomId, watchDirectCallRoomId } from '@/lib/firebase-service';
import { useTimer } from '@/hooks/useTimer';
import { IconChevronLeft, IconMic, IconMicOff, IconPhoneEnd, IconSpeaker } from '@/lib/icons';
import { setMuted as webrtcSetMuted, cleanup as cleanupWebRTC, generateRoomId, createRoom, joinRoom, playCallEndedTone } from '@/lib/webrtc';
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
  const endingRef = useRef(false); // Guard against double history save
  const roomWatchCleanupRef = useRef<(() => void) | null>(null); // Cleanup for direct call roomId watcher
  const ringingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // Auto-cancel after 45s
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
  // Helper: set up WebRTC for direct call — caller creates room, receiver joins
  const setupDirectCallWebRTC = useCallback((role: 'caller' | 'receiver', callerPhone: string, receiverPhone: string) => {
    const db = dbRef.current;
    if (!db) return;

    const onWebRTCConnected = () => console.log('[CallScreen] WebRTC peer connected');
    const onWebRTCDisconnected = () => {
      // Peer disconnected (network drop, browser close) — end the call
      if (!endingRef.current) {
        console.log('[CallScreen] WebRTC peer disconnected — ending call');
        endingRef.current = true;
        playCallEndedTone();
        stop();
        cleanupWebRTC();
        saveCallToHistory({
          avatar: pal?.avatar || 'cat',
          name: pal?.name || 'Unknown',
          phone: pal?.phone || undefined,
          mood: pal?.mood || '',
          duration: formattedRef.current,
          type: role === 'caller' ? 'Outgoing' : 'Incoming',
          timestamp: Date.now(),
          callStartedAt: callStartedAt,
        });
        showToast('Call ended');
        dispatch({ type: 'SET_PAL', pal: null });
        showScreen('screen-home');
      }
    };
    const onWebRTCError = (err: Error) => {
      console.error('[CallScreen] WebRTC error:', err);
      showToast('❌ Audio error: ' + err.message);
    };

    if (role === 'caller') {
      // Caller: create WebRTC room → share roomId with receiver
      const roomId = generateRoomId();
      console.log('[CallScreen] Caller creating WebRTC room:', roomId);
      createRoom(db, roomId, onWebRTCConnected, onWebRTCDisconnected, onWebRTCError)
        .then(() => setDirectCallRoomId(db, callerPhone, receiverPhone, roomId));
    } else {
      // Receiver: watch for roomId from caller → join the room
      console.log('[CallScreen] Receiver watching for WebRTC roomId...');
      roomWatchCleanupRef.current = watchDirectCallRoomId(db, receiverPhone, callerPhone, (roomId) => {
        // Got the roomId — clean up the watcher and join the room
        if (roomWatchCleanupRef.current) { roomWatchCleanupRef.current(); roomWatchCleanupRef.current = null; }
        console.log('[CallScreen] Receiver joining WebRTC room:', roomId);
        joinRoom(db, roomId, onWebRTCConnected, onWebRTCDisconnected, onWebRTCError);
      });
    }
  }, [dbRef, pal, callStartedAt, stop, dispatch, showScreen, showToast]);

  useEffect(() => {
    console.log('[CallScreen] Call setup effect:', { isActive, palPhone: pal?.phone, isOutgoingCall: pal?.isOutgoingCall, hasDbRef: !!dbRef?.current, guftguPhone: state.guftguPhone });
    
    // Reset ending guard on new call
    endingRef.current = false;

    // For incoming calls (isOutgoingCall === false), set connected immediately
    if (pal?.phone && pal?.isOutgoingCall === false) {
      console.log('[CallScreen] Incoming call - setting connected immediately');
      setCallStatus('connected');
      const timestamp = (pal as any).connectedAt || Date.now();
      setConnectedAt(timestamp);
      start(timestamp);
    }

    // For match-originated calls (isMatchCall), WebRTC already connected — go straight to connected
    if (pal?.phone && (pal as any).isMatchCall) {
      console.log('[CallScreen] Match call - setting connected immediately');
      setCallStatus('connected');
      setConnectedAt(Date.now());
      start(Date.now());
    }
    
    if (!isActive || !pal?.phone || !dbRef?.current || !state.guftguPhone) {
      console.log('[CallScreen] Skipping listener setup - missing deps');
      return;
    }

    // Match calls don't use Firebase call signaling — skip listener setup
    if ((pal as any).isMatchCall) return;

    // For incoming direct calls — start WebRTC immediately (receiver side)
    if (pal.isOutgoingCall === false) {
      setupDirectCallWebRTC('receiver', pal.phone, state.guftguPhone);
    }

    let unsubscribeOutgoing: (() => void) | undefined;
    let unsubscribeIncoming: (() => void) | undefined;

    if (pal.isOutgoingCall) {
      // We initiated the call - show ringing and wait for response
      console.log('[CallScreen] Setting ringing state for outgoing call');
      setCallStatus('ringing');
      
      // Auto-cancel after 45 seconds if no answer
      ringingTimeoutRef.current = setTimeout(() => {
        if (endingRef.current) return;
        console.log('[CallScreen] Ringing timeout — auto-cancelling');
        endingRef.current = true;
        if (dbRef.current && state.guftguPhone && pal.phone) {
          cancelCall(dbRef.current, state.guftguPhone, pal.phone).catch(() => {});
        }
        playCallEndedTone();
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
        showToast('No answer — call timed out');
        dispatch({ type: 'SET_PAL', pal: null });
        showScreen('screen-home');
      }, 45000);

      // Listen for status changes from the receiver
      unsubscribeOutgoing = listenOutgoingCallStatus(
        dbRef.current,
        state.guftguPhone,
        pal.phone,
        (status: 'accepted' | 'declined' | 'cancelled' | 'ended', timestamp?: number) => {
          // BUG 2 FIX: Skip if we are already ending the call ourselves
          if (endingRef.current) return;

          console.log('[CallScreen] Call status changed:', status, 'connectedAt:', timestamp);
          if (status === 'accepted') {
            // Clear ringing timeout — call was answered
            if (ringingTimeoutRef.current) { clearTimeout(ringingTimeoutRef.current); ringingTimeoutRef.current = null; }
            setCallStatus('connected');
            // Use the shared timestamp from Firebase for synchronized timer
            const connectedTime = timestamp || Date.now();
            setConnectedAt(connectedTime);
            start(connectedTime);
            showToast('Call connected! 🎉');

            // BUG 1 FIX: Now establish WebRTC audio (caller creates room)
            if (state.guftguPhone && pal.phone) setupDirectCallWebRTC('caller', state.guftguPhone, pal.phone);
          } else if (status === 'declined') {
            if (ringingTimeoutRef.current) { clearTimeout(ringingTimeoutRef.current); ringingTimeoutRef.current = null; }
            playCallEndedTone();
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
            if (ringingTimeoutRef.current) { clearTimeout(ringingTimeoutRef.current); ringingTimeoutRef.current = null; }
            playCallEndedTone();
            showToast('Call cancelled');
            dispatch({ type: 'SET_PAL', pal: null });
            showScreen('screen-home');
          } else if (status === 'ended') {
            // Other party ended the call - save history
            playCallEndedTone();
            stop();
            cleanupWebRTC();
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
          // BUG 2 FIX: Skip if we are already ending the call ourselves
          if (endingRef.current) return;

          // Caller ended the call - play tone + save history
          console.log('[CallScreen] Caller ended the call');
          playCallEndedTone();
          stop();
          cleanupWebRTC();
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
      // Clean up ringing timeout
      if (ringingTimeoutRef.current) { clearTimeout(ringingTimeoutRef.current); ringingTimeoutRef.current = null; }
      // Clean up roomId watcher if still active
      if (roomWatchCleanupRef.current) { roomWatchCleanupRef.current(); roomWatchCleanupRef.current = null; }
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
    // BUG 2 FIX: Set guard BEFORE Firebase cleanup so listeners don't double-save
    endingRef.current = true;
    stop();
    
    // Clear ringing timeout if active
    if (ringingTimeoutRef.current) { clearTimeout(ringingTimeoutRef.current); ringingTimeoutRef.current = null; }

    // Play call-ended tone for audio feedback
    playCallEndedTone();
    
    const isMatch = (pal as any)?.isMatchCall;
    
    // For direct calls (not match), signal end via Firebase
    if (!isMatch && dbRef?.current && state.guftguPhone && pal?.phone) {
      try {
        if (callStatus === 'ringing' && pal?.isOutgoingCall) {
          // UC7: We are the caller and cancelling before the other party answered
          await cancelCall(dbRef.current, state.guftguPhone, pal.phone);
        } else {
          // UC5: Call was connected (or we are the receiver) — signal end to other party
          await firebaseEndCall(dbRef.current, state.guftguPhone, pal.phone);
        }
      } catch (e) {
        console.error('Failed to signal call end:', e);
        try { await cleanupCallData(dbRef.current, state.guftguPhone, pal.phone); } catch (_) {}
      }
    }

    // Clean up WebRTC resources (for ALL call types)
    cleanupWebRTC();
    
    // Determine call type — match calls and outgoing calls are 'Outgoing', else 'Incoming'
    const callType = (pal?.isOutgoingCall || isMatch) ? 'Outgoing' : 'Incoming';
    const duration = callStatus === 'ringing' ? '00:00' : formatted;
    
    saveCallToHistory({
      avatar: pal?.avatar || 'cat',
      name: pal?.name || 'Unknown',
      phone: pal?.phone || undefined,
      mood: pal?.mood || '',
      duration,
      type: callType,
      timestamp: Date.now(),
      callStartedAt: callStartedAt,
    });
    dispatch({ type: 'SET_PAL', pal: null });
    showScreen('screen-home');
    if (callStatus === 'ringing') {
      showToast('Call cancelled');
    } else {
      showToast(S.call.callEndedToast(duration));
    }
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    webrtcSetMuted(next); // Actually mute/unmute the mic via WebRTC
  };

  const toggleSpeaker = () => {
    // Toggle speaker state — note: Web Audio API has no direct speaker routing,
    // but we can attempt to use setSinkId on supported browsers
    const next = !isSpeaker;
    setIsSpeaker(next);
    try {
      const audioEls = document.querySelectorAll('audio');
      audioEls.forEach((el: any) => {
        if (el.setSinkId) {
          el.setSinkId(next ? 'default' : '').catch(() => {});
        }
      });
    } catch (_) { /* setSinkId not supported */ }
  };

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
