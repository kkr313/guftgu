/**
 * useMatchEngine — encapsulates all match-finding logic:
 *   Firebase queue, bot simulation, countdown, tips rotation.
 * Extracted from MatchScreen to keep the component lean.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { MOOD_EMOJIS, genUniqueName, pickRandom } from '@/lib/data';
import { ref, set, remove, onValue, get, DataSnapshot } from 'firebase/database';
import { isBlocked } from '@/lib/storage';
import { S } from '@/lib/strings';

const SEARCH_TIPS = S.match.searchTips;
const BOT_AVATARS = ['cat', 'fox', 'wolf', 'panda', 'owl', 'wizard', 'robot', 'ninja'] as const;

export interface MatchResult {
  name: string;
  avatar: string;
  mood: string;
  moodEmoji: string;
  phone: string;
}

export function useMatchEngine(isActive: boolean) {
  const { state, dispatch, showScreen, dbRef, goBack } = useApp();
  const u = state.user;

  const [searching, setSearching] = useState(true);
  const [matchFound, setMatchFound] = useState(false);
  const [pal, setPal] = useState<MatchResult>({ name: '', avatar: 'cat', mood: '', moodEmoji: '😊', phone: '' });
  const [countdown, setCountdown] = useState(5);
  const [tipIdx, setTipIdx] = useState(0);

  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tipTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fbUnsub = useRef<(() => void) | null>(null);

  /* ── Cleanup helper ─────────────────────────────── */
  const cleanup = useCallback(() => {
    if (searchRef.current) clearTimeout(searchRef.current);
    if (fbUnsub.current) fbUnsub.current();
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  /* ── Rotate tips ────────────────────────────────── */
  useEffect(() => {
    if (!isActive || !searching) return;
    tipTimer.current = setInterval(() => {
      setTipIdx((p: number) => (p + 1) % SEARCH_TIPS.length);
    }, 3500);
    return () => { if (tipTimer.current) clearInterval(tipTimer.current); };
  }, [isActive, searching]);

  /* ── Bot match simulation ───────────────────────── */
  const simulateBotMatch = useCallback(() => {
    const moods = Object.keys(MOOD_EMOJIS);
    const mood = pickRandom(moods);
    setPal({
      name: genUniqueName(),
      avatar: pickRandom(BOT_AVATARS),
      mood,
      moodEmoji: MOOD_EMOJIS[mood] || '😊',
      phone: '',
    });
    setSearching(false);
    setMatchFound(true);
  }, []);

  /* ── Countdown after match ──────────────────────── */
  const startCountdown = useCallback(() => {
    setCountdown(5);
    countdownRef.current = setInterval(() => {
      setCountdown((prev: number) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  /* ── Firebase matching ──────────────────────────── */
  const startSearch = useCallback(() => {
    const db = dbRef.current;
    if (!db) {
      searchRef.current = setTimeout(simulateBotMatch, 3000 + Math.random() * 3000);
      return;
    }

    const myEntry = {
      name: u.nickname || genUniqueName(),
      avatar: u.avatar || 'cat',
      mood: u.mood || 'Happy',
      moodEmoji: u.moodEmoji || '😄',
      language: u.language || 'Hindi',
      region: u.region || 'North',
      intent: u.intent || 'Just chat',
      phone: state.guftguPhone,
      timestamp: Date.now(),
    };

    const queueRef = ref(db, 'matchQueue/' + state.guftguPhone);
    set(queueRef, myEntry);

    const matchRef = ref(db, 'matches/' + state.guftguPhone);
    fbUnsub.current = onValue(matchRef, (snap: DataSnapshot) => {
      const val = snap.val();
      if (val && val.palPhone) {
        if (isBlocked(val.palPhone)) { remove(matchRef); return; }
        remove(queueRef);
        setPal({
          name: val.palName || 'Anonymous',
          avatar: val.palAvatar || 'cat',
          mood: val.palMood || 'Happy',
          moodEmoji: val.palMoodEmoji || '😊',
          phone: val.palPhone || '',
        });
        setSearching(false);
        setMatchFound(true);
        startCountdown();
      }
    }) as unknown as () => void;

    searchRef.current = setTimeout(async () => {
      try {
        const snap = await get(ref(db, 'matchQueue'));
        if (!snap.exists()) return;
        let matched = false;
        snap.forEach((child: DataSnapshot) => {
          if (matched) return;
          const v = child.val();
          if (!v || v.phone === state.guftguPhone) return;
          if (isBlocked(v.phone)) return;
          if (v.language === u.language) {
            matched = true;
            set(ref(db, 'matches/' + v.phone), {
              palName: u.nickname || 'Anonymous', palAvatar: u.avatar || 'cat',
              palMood: u.mood || 'Happy', palMoodEmoji: u.moodEmoji || '😊',
              palPhone: state.guftguPhone,
            });
            set(ref(db, 'matches/' + state.guftguPhone), {
              palName: v.name || 'Anonymous', palAvatar: v.avatar || 'cat',
              palMood: v.mood || 'Happy', palMoodEmoji: v.moodEmoji || '😊',
              palPhone: v.phone,
            });
            remove(ref(db, 'matchQueue/' + v.phone));
            remove(queueRef);
          }
        });
        if (!matched) {
          searchRef.current = setTimeout(simulateBotMatch, 5000 + Math.random() * 5000);
        }
      } catch {
        searchRef.current = setTimeout(simulateBotMatch, 4000);
      }
    }, 2000);
  }, [dbRef, state.guftguPhone, u, simulateBotMatch, startCountdown]);

  /* ── Start on mount ─────────────────────────────── */
  useEffect(() => {
    if (!isActive) return;
    setSearching(true);
    setMatchFound(false);
    startSearch();
    return cleanup;
  }, [isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Auto-accept when countdown hits 0 ──────────── */
  useEffect(() => {
    if (matchFound && countdown === 0) {
      cleanup();
      dispatch({
        type: 'SET_PAL',
        pal: { avatar: pal.avatar, name: pal.name, mood: pal.mood, moodEmoji: pal.moodEmoji, phone: pal.phone },
      });
      showScreen('screen-call');
    }
  }, [countdown, matchFound]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Actions ────────────────────────────────────── */
  const acceptMatch = useCallback(() => {
    cleanup();
    dispatch({
      type: 'SET_PAL',
      pal: { avatar: pal.avatar, name: pal.name, mood: pal.mood, moodEmoji: pal.moodEmoji, phone: pal.phone },
    });
    showScreen('screen-call');
  }, [cleanup, dispatch, pal, showScreen]);

  const declineMatch = useCallback(() => {
    cleanup();
    setMatchFound(false);
    setSearching(true);
    const db = dbRef.current;
    if (db) remove(ref(db, 'matches/' + state.guftguPhone));
    startSearch();
  }, [cleanup, dbRef, state.guftguPhone, startSearch]);

  const cancelSearch = useCallback(() => {
    cleanup();
    const db = dbRef.current;
    if (db) {
      remove(ref(db, 'matchQueue/' + state.guftguPhone));
      remove(ref(db, 'matches/' + state.guftguPhone));
    }
    goBack();
  }, [cleanup, dbRef, state.guftguPhone, goBack]);

  return {
    searching, matchFound, pal, countdown, tipIdx,
    searchTips: SEARCH_TIPS,
    acceptMatch, declineMatch, cancelSearch,
  };
}
