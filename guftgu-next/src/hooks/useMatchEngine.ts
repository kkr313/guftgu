// useMatchEngine - Match-finding logic with Firebase real-time queue + demo fallback
import { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { MOOD_EMOJIS, genUniqueName, pickRandom } from '@/lib/data';
import { ref, remove } from 'firebase/database';
import { S } from '@/lib/strings';
import { enterMatchQueue, writeMatchResponse, watchMatchState, setMatchRoomId, watchMatchRoomId, cleanupMatch, PalInfo as FBPalInfo } from '@/lib/firebase-service';
import { generateRoomId, createRoom, joinRoom, startDemoCall, cleanup as cleanupWebRTC } from '@/lib/webrtc';

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

  const cleanup = useCallback(() => {
    if (tipTimer.current) clearInterval(tipTimer.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (demoTimer.current) clearTimeout(demoTimer.current);
    if (cleanupQueueRef.current) cleanupQueueRef.current();
    if (cleanupMatchStateRef.current) cleanupMatchStateRef.current();
    if (cleanupRoomWatchRef.current) cleanupRoomWatchRef.current();
    cleanupWebRTC();
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
    startCountdown();
  }, [startCountdown]);

  const startCall = useCallback(() => {
    const db = dbRef.current;
    const matchId = currentMatchId.current;
    const role = currentRole.current;
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    dispatch({ type: 'SET_PAL', pal: { avatar: pal.avatar, name: pal.name, mood: pal.mood, moodEmoji: pal.moodEmoji, phone: pal.phone } });
    if (cleanupQueueRef.current) { cleanupQueueRef.current(); cleanupQueueRef.current = null; }
    if (cleanupMatchStateRef.current) { cleanupMatchStateRef.current(); cleanupMatchStateRef.current = null; }
    setConnecting(true);
    const onConnected = () => { setConnecting(false); showScreen('screen-call'); };
    const onError = (error: Error) => { setConnecting(false); showToast('Mic error: ' + error.message); goBack(); };
    if (isDemo.current || !db || !matchId) { startDemoCall(onConnected, onError); return; }
    if (role === 'caller') {
      const roomId = generateRoomId();
      createRoom(db, roomId, onConnected, () => { showToast('Call ended'); goBack(); }, onError).then(() => { setMatchRoomId(db, matchId, roomId); });
    } else {
      cleanupRoomWatchRef.current = watchMatchRoomId(db, matchId, (roomId) => {
        if (cleanupRoomWatchRef.current) { cleanupRoomWatchRef.current(); cleanupRoomWatchRef.current = null; }
        joinRoom(db, roomId, onConnected, () => { showToast('Call ended'); goBack(); }, onError);
      });
      setTimeout(() => { if (cleanupRoomWatchRef.current) { cleanupRoomWatchRef.current(); cleanupRoomWatchRef.current = null; setConnecting(false); showToast('Connection timed out'); goBack(); } }, 20000);
    }
  }, [dbRef, pal, dispatch, showScreen, showToast, goBack]);

  const startSearch = useCallback(() => {
    const db = dbRef.current;
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

  const acceptMatch = useCallback(() => {
    if (waitingForOther || connecting) return;
    const db = dbRef.current;
    const matchId = currentMatchId.current;
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    if (isDemo.current || !db || !matchId) { startCall(); return; }
    setWaitingForOther(true);
    writeMatchResponse(db, matchId, state.guftguPhone, 'accepted');
    showToast('Waiting for the other person...');
    cleanupMatchStateRef.current = watchMatchState(db, matchId, state.guftguPhone, () => {
      if (cleanupMatchStateRef.current) { cleanupMatchStateRef.current(); cleanupMatchStateRef.current = null; }
      setWaitingForOther(false); startCall();
    }, () => {
      if (cleanupMatchStateRef.current) { cleanupMatchStateRef.current(); cleanupMatchStateRef.current = null; }
      setWaitingForOther(false); showToast('They skipped - finding another match...');
      setMatchFound(false); setSearching(true); setTimeout(startSearch, 700);
    });
  }, [dbRef, state.guftguPhone, waitingForOther, connecting, showToast, startCall, startSearch]);

  const declineMatch = useCallback(() => {
    const db = dbRef.current;
    const matchId = currentMatchId.current;
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    if (db && matchId && !isDemo.current) writeMatchResponse(db, matchId, state.guftguPhone, 'skipped');
    if (cleanupMatchStateRef.current) { cleanupMatchStateRef.current(); cleanupMatchStateRef.current = null; }
    if (cleanupQueueRef.current) { cleanupQueueRef.current(); cleanupQueueRef.current = null; }
    setWaitingForOther(false); setMatchFound(false); setSearching(true);
    currentMatchId.current = null; currentRole.current = null; isDemo.current = false;
    setTimeout(startSearch, 500);
  }, [dbRef, state.guftguPhone, startSearch]);

  const cancelSearch = useCallback(() => {
    cleanup();
    const db = dbRef.current;
    if (db) {
      remove(ref(db, 'matchQueue/' + state.guftguPhone));
      remove(ref(db, 'matchProposals/' + state.guftguPhone));
      if (currentMatchId.current) cleanupMatch(db, currentMatchId.current, state.guftguPhone);
    }
    goBack();
  }, [cleanup, dbRef, state.guftguPhone, goBack]);

  return { searching, matchFound, connecting, waitingForOther, pal, countdown, tipIdx, queueCount, searchTips: SEARCH_TIPS, acceptMatch, declineMatch, cancelSearch };
}
