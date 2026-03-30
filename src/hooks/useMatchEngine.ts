// useMatchEngine - Match-finding logic with Firebase real-time queue + demo fallback
import { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { MOOD_EMOJIS, genUniqueName, pickRandom, formatTime } from '@/lib/data';
import { ref, remove } from 'firebase/database';
import { S } from '@/lib/strings';
import { enterMatchQueue, writeMatchResponse, watchMatchState, setMatchRoomId, watchMatchRoomId, cleanupMatch, PalInfo as FBPalInfo } from '@/lib/firebase-service';
import { generateRoomId, createRoom, joinRoom, startDemoCall, cleanup as cleanupWebRTC, playCallEndedTone } from '@/lib/webrtc';
import { saveCallToHistory } from '@/lib/storage';

const SEARCH_TIPS = S.match.searchTips;
const BOT_AVATARS = ['cat', 'fox', 'wolf', 'panda', 'owl', 'wizard', 'robot', 'ninja'] as const;

export interface MatchResult {
  name: string;
  avatar: string;
  mood: string;
  moodEmoji: string;
  phone: string;
  language?: string;
  region?: string;
}

type MatchRole = 'caller' | 'callee';

export function useMatchEngine(isActive: boolean) {
  const { state, dispatch, showScreen, showToast, dbRef, goBack } = useApp();
  const u = state.user;

  const [searching, setSearching] = useState(true);
  const [matchFound, setMatchFound] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [waitingForOther, setWaitingForOther] = useState(false);
  const [pal, setPal] = useState<MatchResult>({ name: '', avatar: 'cat', mood: '', moodEmoji: '', phone: '' });
  const [countdown, setCountdown] = useState(15);
  const [tipIdx, setTipIdx] = useState(0);
  const [queueCount, setQueueCount] = useState(0);

  const tipTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const demoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cleanupQueueRef = useRef<(() => void) | null>(null);
  const cleanupMatchStateRef = useRef<(() => void) | null>(null);
  const cleanupRoomWatchRef = useRef<(() => void) | null>(null);
  const currentMatchId = useRef<string | null>(null);
  const currentRole = useRef<MatchRole | null>(null);
  const isDemo = useRef(false);
  const matchCallStartedAt = useRef<number | null>(null);
  const matchEndedRef = useRef(false);
  const callHandedOff = useRef(false); // True once call transitions to CallScreen — prevents cleanup from killing WebRTC

  const cleanup = useCallback(() => {
    if (tipTimer.current) clearInterval(tipTimer.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (demoTimer.current) clearTimeout(demoTimer.current);
    if (cleanupQueueRef.current) cleanupQueueRef.current();
    if (cleanupMatchStateRef.current) cleanupMatchStateRef.current();
    if (cleanupRoomWatchRef.current) cleanupRoomWatchRef.current();
    // Only clean up WebRTC if the call hasn't been handed off to CallScreen
    // When screen transitions match→call, this cleanup fires — we must NOT kill the active call
    if (!callHandedOff.current) {
      cleanupWebRTC();
    }
  }, []);

  useEffect(() => {
    if (!isActive || !searching) return;
    tipTimer.current = setInterval(() => setTipIdx((p) => (p + 1) % SEARCH_TIPS.length), 3500);
    return () => { if (tipTimer.current) clearInterval(tipTimer.current); };
  }, [isActive, searching]);

  const startCountdown = useCallback(() => {
    setCountdown(15);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) { if (countdownRef.current) clearInterval(countdownRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const simulateBotMatch = useCallback(() => {
    isDemo.current = true;
    const moods = Object.keys(MOOD_EMOJIS);
    const mood = pickRandom(moods);
    setPal({ name: genUniqueName(), avatar: pickRandom(BOT_AVATARS), mood, moodEmoji: MOOD_EMOJIS[mood] || '', phone: '' });
    setSearching(false);
    setMatchFound(true);
    startCountdown();
  }, [startCountdown]);

  const onMatchFound = useCallback((palInfo: FBPalInfo, matchId: string, role: MatchRole) => {
    isDemo.current = false;
    currentMatchId.current = matchId;
    currentRole.current = role;
    setPal({ name: palInfo.name, avatar: palInfo.avatar, mood: palInfo.mood, moodEmoji: palInfo.moodEmoji, phone: palInfo.phone, language: palInfo.language, region: palInfo.region });
    setSearching(false);
    setMatchFound(true);
    // Important: we stop looking at the queue once a match is found to prevent multiple proposals/matches
    if (cleanupQueueRef.current) { cleanupQueueRef.current(); cleanupQueueRef.current = null; }
    startCountdown();
  }, [startCountdown]);

  const startCall = useCallback(() => {
    const db = dbRef.current;
    const matchId = currentMatchId.current;
    const role = currentRole.current;
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    matchEndedRef.current = false;
    matchCallStartedAt.current = null;
    callHandedOff.current = false; // Reset — will be set true once onConnected fires
    dispatch({ type: 'SET_PAL', pal: { avatar: pal.avatar, name: pal.name, mood: pal.mood, moodEmoji: pal.moodEmoji, phone: pal.phone, isMatchCall: true } as any });
    // cleanupQueueRef.current is already called in onMatchFound
    if (cleanupMatchStateRef.current) { cleanupMatchStateRef.current(); cleanupMatchStateRef.current = null; }
    setConnecting(true);
    const onConnected = () => { callHandedOff.current = true; matchCallStartedAt.current = Date.now(); setConnecting(false); showScreen('screen-call'); };
    const onReconnecting = () => { showToast('⚠️ Connection unstable — reconnecting...'); };
    const onReconnected = () => { showToast('✅ Call reconnected'); };
    const onDisconnected = () => {
      if (matchEndedRef.current) return;
      matchEndedRef.current = true;
      playCallEndedTone();
      const startTs = matchCallStartedAt.current;
      const duration = startTs ? Math.floor((Date.now() - startTs) / 1000) : 0;
      const formatted = formatTime(duration);
      saveCallToHistory({ avatar: pal.avatar, name: pal.name, phone: pal.phone || '', mood: pal.mood, duration: formatted, type: 'Outgoing', timestamp: Date.now(), callStartedAt: startTs || Date.now() });
      dispatch({ type: 'SET_PAL', pal: null });
      showScreen('screen-home');
      showToast('📞 Call disconnected');
    };
    const onError = (error: Error) => { setConnecting(false); cleanupWebRTC(); showToast('Mic error: ' + error.message); goBack(); };
    if (isDemo.current || !db || !matchId) { startDemoCall(onConnected, onError); return; }
    if (role === 'caller') {
      const roomId = generateRoomId();
      createRoom(db, roomId, onConnected, onDisconnected, onError, onReconnecting, onReconnected).then(() => { setMatchRoomId(db, matchId, roomId); });
    } else {
      cleanupRoomWatchRef.current = watchMatchRoomId(db, matchId, (roomId) => {
        if (cleanupRoomWatchRef.current) { cleanupRoomWatchRef.current(); cleanupRoomWatchRef.current = null; }
        joinRoom(db, roomId, onConnected, onDisconnected, onError, onReconnecting, onReconnected);
      });
      setTimeout(() => { if (cleanupRoomWatchRef.current) { cleanupRoomWatchRef.current(); cleanupRoomWatchRef.current = null; setConnecting(false); showToast('Connection timed out'); goBack(); } }, 20000);
    }
  }, [dbRef, pal, dispatch, showScreen, showToast, goBack]);

  const startSearch = useCallback(() => {
    const db = dbRef.current;
    if (cleanupQueueRef.current) { cleanupQueueRef.current(); cleanupQueueRef.current = null; }
    if (!db || !state.firebaseConnected) { demoTimer.current = setTimeout(simulateBotMatch, 3000 + Math.random() * 3000); return; }
    cleanupQueueRef.current = enterMatchQueue(db, state.guftguPhone, u, onMatchFound, (count) => setQueueCount(count));
  }, [dbRef, state.firebaseConnected, state.guftguPhone, u, simulateBotMatch, onMatchFound]);

  useEffect(() => {
    if (!isActive) return;
    setSearching(true); setMatchFound(false); setWaitingForOther(false); setConnecting(false);
    startSearch();
    return cleanup;
  }, [isActive]); // eslint-disable-line

  useEffect(() => {
    if (matchFound && countdown === 0 && !waitingForOther && !connecting) declineMatch();
  }, [countdown, matchFound, waitingForOther, connecting]); // eslint-disable-line

  // ─── IMMEDIATE match state watcher ───────────────────────────────────────
  // Start watching the match document AS SOON as a match is found, not just
  // when Accept is clicked. This ensures:
  //  • If either side skips (or their countdown expires), the other side is
  //    instantly notified and sent back to searching.
  //  • If both accept, the call starts automatically.
  // Without this, a skip during the countdown was invisible to the other side.
  useEffect(() => {
    const db = dbRef.current;
    const matchId = currentMatchId.current;
    if (!matchFound || !db || !matchId || isDemo.current) return;

    // Don't double-subscribe if acceptMatch already set one up
    if (cleanupMatchStateRef.current) return;

    cleanupMatchStateRef.current = watchMatchState(db, matchId, state.guftguPhone, () => {
      // Both accepted — start the call
      if (cleanupMatchStateRef.current) { cleanupMatchStateRef.current(); cleanupMatchStateRef.current = null; }
      if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
      setWaitingForOther(false);
      startCall();
    }, () => {
      // Other side skipped — auto-dismiss and find another match
      if (cleanupMatchStateRef.current) { cleanupMatchStateRef.current(); cleanupMatchStateRef.current = null; }
      if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
      setWaitingForOther(false);
      showToast('They skipped — finding another match...');
      setMatchFound(false);
      setSearching(true);
      currentMatchId.current = null;
      currentRole.current = null;
      setTimeout(startSearch, 700);
    });

    return () => {
      if (cleanupMatchStateRef.current) { cleanupMatchStateRef.current(); cleanupMatchStateRef.current = null; }
    };
  }, [matchFound]); // eslint-disable-line react-hooks/exhaustive-deps

  const acceptMatch = useCallback(() => {
    if (waitingForOther || connecting) return;
    const db = dbRef.current;
    const matchId = currentMatchId.current;
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    if (isDemo.current || !db || !matchId) { startCall(); return; }
    setWaitingForOther(true);
    writeMatchResponse(db, matchId, state.guftguPhone, 'accepted');
    showToast('Waiting for the other person...');
    // NOTE: watchMatchState is already running from the useEffect above.
    // It will fire onBothAccepted→startCall or onOtherSkipped→backToSearching.
  }, [dbRef, state.guftguPhone, waitingForOther, connecting, showToast, startCall]);

  const declineMatch = useCallback(() => {
    const db = dbRef.current;
    const matchId = currentMatchId.current;
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    if (db && matchId && !isDemo.current) writeMatchResponse(db, matchId, state.guftguPhone, 'skipped');
    if (cleanupMatchStateRef.current) { cleanupMatchStateRef.current(); cleanupMatchStateRef.current = null; }

    // This triggers the enhanced cleanup which removes outgoing proposals
    if (cleanupQueueRef.current) { cleanupQueueRef.current(); cleanupQueueRef.current = null; }

    setWaitingForOther(false);
    setMatchFound(false);
    setSearching(true);
    currentMatchId.current = null;
    currentRole.current = null;
    isDemo.current = false;
    setTimeout(startSearch, 500);
  }, [dbRef, state.guftguPhone, startSearch]);

  const cancelSearch = useCallback(() => {
    callHandedOff.current = false; // Ensure WebRTC IS cleaned up on cancel
    cleanup(); // already calls cleanupQueueRef.current() which runs the new cleanup above
    const db = dbRef.current;
    if (db) {
      // These are belt-and-suspenders — the cleanup fn above handles proposedTo
      remove(ref(db, 'matchQueue/' + state.guftguPhone));
      remove(ref(db, 'matchProposals/' + state.guftguPhone));
      if (currentMatchId.current) cleanupMatch(db, currentMatchId.current, state.guftguPhone);
    }
    goBack();
  }, [cleanup, dbRef, state.guftguPhone, goBack]);

  return { searching, matchFound, connecting, waitingForOther, pal, countdown, tipIdx, queueCount, searchTips: SEARCH_TIPS, acceptMatch, declineMatch, cancelSearch };
}
