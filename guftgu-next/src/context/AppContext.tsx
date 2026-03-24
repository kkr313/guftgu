
import React, { createContext, useContext, useReducer, useCallback, useRef, useEffect } from 'react';
import { UserData, loadUser, saveUser as persistUser, genGuftguPhone, getCallHistory, saveCallToHistory as persistCall, CallRecord, getFriends, saveFriends, FriendRecord, getPending, savePending, PendingRecord, getBlocked, saveBlocked, BlockedRecord, isBlocked } from '@/lib/storage';
import { Database, ref, set, remove, onValue, push, get, child, off, onChildAdded } from 'firebase/database';
import { initFirebase, getDb } from '@/lib/firebase';
import { registerUser, syncBlockList, setOnlineStatus } from '@/lib/firebase-service';
import { useBackButtonInit } from '@/hooks/useBackButton';

// ── Types ──────────────────────────────────────────
export type Screen =
  | 'screen-onboard' | 'screen-welcome' | 'screen-home'
  | 'screen-match' | 'screen-call' | 'screen-chat'
  | 'screen-chats' | 'screen-notifs' | 'screen-profile'
  | 'screen-history' | 'screen-blocked' | 'screen-appinfo';

export interface PalInfo {
  avatar: string;
  name: string;
  mood: string;
  moodEmoji: string;
  phone: string | null;
}

interface AppState {
  screen: Screen;
  prevScreen: Screen | null;
  user: UserData;
  guftguPhone: string;
  currentPal: PalInfo | null;
  isMuted: boolean;
  callSecs: number;
  firebaseConnected: boolean;
  autoConnect: boolean;
  toastMsg: string;
  toastVisible: boolean;
  isRestoring: boolean; // True while checking localStorage on mount
}

type Action =
  | { type: 'SET_SCREEN'; screen: Screen }
  | { type: 'SET_USER'; user: UserData }
  | { type: 'SET_PHONE'; phone: string }
  | { type: 'SET_PAL'; pal: PalInfo | null }
  | { type: 'SET_MUTED'; muted: boolean }
  | { type: 'SET_CALL_SECS'; secs: number }
  | { type: 'SET_FIREBASE'; connected: boolean }
  | { type: 'SET_AUTO_CONNECT'; auto: boolean }
  | { type: 'SHOW_TOAST'; msg: string }
  | { type: 'HIDE_TOAST' }
  | { type: 'RESTORE_USER'; user: UserData; phone: string }
  | { type: 'FINISH_RESTORE' };

const defaultUser: UserData = {
  nickname: '', avatar: 'cat', mood: 'Happy', moodEmoji: '😄',
  language: 'Hindi', region: 'North', intent: 'Just chat',
};

const initialState: AppState = {
  screen: 'screen-onboard',
  prevScreen: null,
  user: defaultUser,
  guftguPhone: '',
  currentPal: null,
  isMuted: false,
  callSecs: 0,
  firebaseConnected: false,
  autoConnect: false,
  toastMsg: '',
  toastVisible: false,
  isRestoring: true, // Start with true - we're checking localStorage
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_SCREEN':
      return { ...state, prevScreen: state.screen, screen: action.screen };
    case 'SET_USER':
      return { ...state, user: action.user };
    case 'SET_PHONE':
      return { ...state, guftguPhone: action.phone };
    case 'SET_PAL':
      return { ...state, currentPal: action.pal };
    case 'SET_MUTED':
      return { ...state, isMuted: action.muted };
    case 'SET_CALL_SECS':
      return { ...state, callSecs: action.secs };
    case 'SET_FIREBASE':
      return { ...state, firebaseConnected: action.connected };
    case 'SET_AUTO_CONNECT':
      return { ...state, autoConnect: action.auto };
    case 'SHOW_TOAST':
      return { ...state, toastMsg: action.msg, toastVisible: true };
    case 'HIDE_TOAST':
      return { ...state, toastVisible: false };
    case 'RESTORE_USER':
      return { ...state, user: { ...defaultUser, ...action.user }, guftguPhone: action.phone, screen: 'screen-home', isRestoring: false };
    case 'FINISH_RESTORE':
      return { ...state, isRestoring: false };
    default:
      return state;
  }
}

// ── Context ──────────────────────────────────────────
interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  showScreen: (screen: Screen) => void;
  goBack: () => void;
  showToast: (msg: string) => void;
  saveUserData: (user: UserData, phone: string) => void;
  dbRef: React.MutableRefObject<Database | null>;
}

const AppContext = createContext<AppContextType | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

// ── Provider ──────────────────────────────────────────
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const dbRef = useRef<Database | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore user from localStorage on mount
  useEffect(() => {
    const stored = loadUser();
    if (stored && stored.guftguPhone) {
      // User exists - restore and go to home
      dispatch({ type: 'RESTORE_USER', user: stored.user, phone: stored.guftguPhone });
    } else {
      // No user - stay on onboard but mark restore as done
      dispatch({ type: 'FINISH_RESTORE' });
    }
  }, []);

  // Init Firebase — disabled for offline dev, enable when network available
  useEffect(() => {
    // Skip Firebase init in offline/corporate environments
    // Set to true when you want to enable Firebase features
    const ENABLE_FIREBASE = true;
    if (!ENABLE_FIREBASE) {
      dispatch({ type: 'SET_FIREBASE', connected: false });
      return;
    }
    initFirebase().then(({ db }) => {
      dbRef.current = db;
      // Test connection
      const connRef = ref(db, '.info/connected');
      const unsubscribe = onValue(connRef, (snap) => {
        const connected = snap.val() === true;
        dispatch({ type: 'SET_FIREBASE', connected });
        // On connect: sync block list and set online
        if (connected && state.guftguPhone) {
          syncBlockList(db, state.guftguPhone).catch(() => {});
          setOnlineStatus(db, state.guftguPhone, true).catch(() => {});
        }
      });
      // Cleanup on unmount
      return () => {
        off(connRef, 'value', unsubscribe as any);
        if (state.guftguPhone) {
          setOnlineStatus(db, state.guftguPhone, false).catch(() => {});
        }
      };
    }).catch(() => {
      dispatch({ type: 'SET_FIREBASE', connected: false });
    });
  }, [state.guftguPhone]);

  const showScreen = useCallback((screen: Screen) => {
    dispatch({ type: 'SET_SCREEN', screen });
    window.history.pushState({ guftgu: true, screen }, '');
  }, []);

  const goBack = useCallback(() => {
    if (state.prevScreen) {
      dispatch({ type: 'SET_SCREEN', screen: state.prevScreen });
    } else {
      dispatch({ type: 'SET_SCREEN', screen: 'screen-home' });
    }
  }, [state.prevScreen]);

  const showToast = useCallback((msg: string) => {
    dispatch({ type: 'SHOW_TOAST', msg });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => dispatch({ type: 'HIDE_TOAST' }), 2500);
  }, []);

  // Stable ref for current screen — used by popstate handler
  const screenRef = useRef(state.screen);
  screenRef.current = state.screen;
  const getScreen = useCallback(() => screenRef.current, []);

  // Init mobile back-button handler (History API + popstate)
  useBackButtonInit(goBack, showToast, getScreen);

  const saveUserData = useCallback((user: UserData, phone: string) => {
    dispatch({ type: 'SET_USER', user });
    dispatch({ type: 'SET_PHONE', phone });
    persistUser(user, phone);
    // Register user in Firebase if connected
    if (dbRef.current) {
      registerUser(dbRef.current, phone, user).catch(() => {
        // Silent fail — localStorage is primary storage
      });
    }
  }, []);

  return (
    <AppContext.Provider value={{ state, dispatch, showScreen, goBack, showToast, saveUserData, dbRef }}>
      {children}
    </AppContext.Provider>
  );
}
