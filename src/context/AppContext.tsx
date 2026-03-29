// @refresh reset
import React, { createContext, useContext, useReducer, useCallback, useRef, useEffect, useState } from 'react';
import { UserData, loadUser, saveUser as persistUser, genGuftguPhone, getCallHistory, saveCallToHistory, CallRecord, getFriends, saveFriends, FriendRecord, getPending, savePending, PendingRecord, getBlocked, saveBlocked, BlockedRecord, isBlocked, getDisplayName, addNotif, getUnreadNotifCount, markAllNotifsRead, seedWelcomeNotif, getTotalUnreadMessages, bumpUnreadCount, clearUnreadCount, getChatConversations, saveChatConversations } from '@/lib/storage';
import { playMessageSound, playNotifSound, playFriendOnlineSound } from '@/lib/sounds';
import { Database, ref, set, remove, onValue, push, get, child, off, onChildAdded, DataSnapshot, serverTimestamp } from 'firebase/database';
import { initFirebase, getDb } from '@/lib/firebase';
import { registerUser, syncBlockList, setOnlineStatus, listenIncomingCalls, IncomingCall, acceptCall, declineCall, blockUserFirebase, listenFriendRequests, listenFriendAccepted, listenFriendsOnlineStatus, listenChatMessages } from '@/lib/firebase-service';
import { useBackButtonInit } from '@/hooks/useBackButton';

// ── Types ──────────────────────────────────────────
export type Screen =
  | 'screen-onboard' | 'screen-welcome' | 'screen-home'
  | 'screen-match' | 'screen-call' | 'screen-chat'
  | 'screen-chats' | 'screen-notifs' | 'screen-profile'
  | 'screen-history' | 'screen-blocked' | 'screen-appinfo'
  | 'screen-notifications';

export interface PalInfo {
  avatar: string;
  name: string;
  mood: string;
  moodEmoji: string;
  phone: string | null;
  isOutgoingCall?: boolean; // true if we initiated the call
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
  | { type: 'SHOW_TOAST'; msg: string }
  | { type: 'HIDE_TOAST' }
  | { type: 'RESTORE_USER'; user: UserData; phone: string }
  | { type: 'FINISH_RESTORE' }
  | { type: 'LOGOUT' };

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
    case 'SHOW_TOAST':
      return { ...state, toastMsg: action.msg, toastVisible: true };
    case 'HIDE_TOAST':
      return { ...state, toastVisible: false };
    case 'RESTORE_USER':
      return { ...state, user: { ...defaultUser, ...action.user }, guftguPhone: action.phone, screen: 'screen-home', isRestoring: false };
    case 'FINISH_RESTORE':
      return { ...state, isRestoring: false };
    case 'LOGOUT':
      // Full reset to initial state
      return {
        ...initialState,
        screen: 'screen-onboard',
        isRestoring: false,
        firebaseConnected: false,
      };
    default:
      return state;
  }
}

// ── Context ──────────────────────────────────────────
interface IncomingCallData {
  callerPhone: string;
  callerName: string;
  callerAvatar: string;
  callerMood: string;
  callerMoodEmoji: string;
}

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  showScreen: (screen: Screen) => void;
  goBack: () => void;
  showToast: (msg: string) => void;
  saveUserData: (user: UserData, phone: string) => void;
  dbRef: React.MutableRefObject<Database | null>;
  incomingCall: IncomingCallData | null;
  handleAcceptCall: () => void;
  handleDeclineCall: () => void;
  handleBlockCaller: () => void;
  unreadNotifCount: number;
  markNotifsRead: () => void;
  unreadMsgCount: number;
  clearChatUnread: (phone: string) => void;
  friendsOnline: Record<string, boolean>;
  friendsLastSeen: Record<string, number | null>;
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
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
  const [unreadNotifCount, setUnreadNotifCount] = useState(() => getUnreadNotifCount());
  const [unreadMsgCount, setUnreadMsgCount] = useState(() => getTotalUnreadMessages());
  const [friendsOnline, setFriendsOnline] = useState<Record<string, boolean>>({});
  const [friendsLastSeen, setFriendsLastSeen] = useState<Record<string, number | null>>({});

  /** Expose to ChatScreen — clears unread and syncs badge */
  const clearChatUnread = useCallback((phone: string) => {
    clearUnreadCount(phone);
    setUnreadMsgCount(getTotalUnreadMessages());
  }, []);

  // Keep unread counts in sync with storage events
  useEffect(() => {
    const syncNotifs = () => setUnreadNotifCount(getUnreadNotifCount());
    const syncMsgs = () => setUnreadMsgCount(getTotalUnreadMessages());
    window.addEventListener('notifsUpdate', syncNotifs);
    window.addEventListener('callHistoryUpdate', syncNotifs);
    window.addEventListener('conversationsUpdate', syncMsgs);
    return () => {
      window.removeEventListener('notifsUpdate', syncNotifs);
      window.removeEventListener('callHistoryUpdate', syncNotifs);
      window.removeEventListener('conversationsUpdate', syncMsgs);
    };
  }, []);

  const markNotifsRead = useCallback(() => {
    markAllNotifsRead();
    setUnreadNotifCount(0);
  }, []);

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
      const unsubscribe = onValue(connRef, (snap: DataSnapshot) => {
        const connected = snap.val() === true;
        dispatch({ type: 'SET_FIREBASE', connected });
        // On connect: sync block list and set online
        if (connected && state.guftguPhone) {
          syncBlockList(db, state.guftguPhone).catch(() => { });
          setOnlineStatus(db, state.guftguPhone, true).catch(() => { });
        }
      });

      // Handle page unload to mark offline
      const handleBeforeUnload = () => {
        if (state.guftguPhone && db) {
          // Use sendBeacon for reliable offline status on page close
          // Note: Firebase SDK handles this via onDisconnect, but this is a backup
          setOnlineStatus(db, state.guftguPhone, false).catch(() => { });
        }
      };
      window.addEventListener('beforeunload', handleBeforeUnload);

      // Cleanup on unmount
      return () => {
        off(connRef, 'value', unsubscribe as any);
        window.removeEventListener('beforeunload', handleBeforeUnload);
        if (state.guftguPhone) {
          setOnlineStatus(db, state.guftguPhone, false).catch(() => { });
        }
      };
    }).catch(() => {
      dispatch({ type: 'SET_FIREBASE', connected: false });
    });
  }, [state.guftguPhone]);

  // Heartbeat to keep lastSeen updated (every 2 minutes)
  useEffect(() => {
    if (!state.guftguPhone || !state.firebaseConnected || !dbRef.current) return;

    const heartbeat = setInterval(() => {
      if (dbRef.current && state.guftguPhone) {
        // Update lastSeen to show we're still active
        const lastSeenRef = ref(dbRef.current, `users/${state.guftguPhone}/lastSeen`);
        set(lastSeenRef, serverTimestamp()).catch(() => { });
      }
    }, 2 * 60 * 1000); // Every 2 minutes

    return () => clearInterval(heartbeat);
  }, [state.guftguPhone, state.firebaseConnected]);

  const showScreen = useCallback((screen: Screen) => {
    dispatch({ type: 'SET_SCREEN', screen });
    window.history.pushState({ guftgu: true, screen }, '');
    // Scroll the target screen's content to top
    requestAnimationFrame(() => {
      const el = document.getElementById(screen);
      if (el) {
        const scrollBody = el.querySelector('.scroll-body');
        if (scrollBody) scrollBody.scrollTop = 0;
      }
    });
  }, []);

  const goBack = useCallback(() => {
    const target = state.prevScreen || 'screen-home';
    dispatch({ type: 'SET_SCREEN', screen: target });
    // Scroll the target screen's content to top
    requestAnimationFrame(() => {
      const el = document.getElementById(target);
      if (el) {
        const scrollBody = el.querySelector('.scroll-body');
        if (scrollBody) scrollBody.scrollTop = 0;
      }
    });
  }, [state.prevScreen]);

  const showToast = useCallback((msg: string) => {
    dispatch({ type: 'SHOW_TOAST', msg });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => dispatch({ type: 'HIDE_TOAST' }), 2000);
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
    // Seed welcome notification on first registration
    seedWelcomeNotif();
    // Register user in Firebase if connected
    if (dbRef.current) {
      registerUser(dbRef.current, phone, user).catch(() => {
        // Silent fail — localStorage is primary storage
      });
    }
  }, []);

  // Listen for incoming calls
  useEffect(() => {
    if (!dbRef.current || !state.guftguPhone || !state.firebaseConnected) return;

    const cleanup = listenIncomingCalls(
      dbRef.current,
      state.guftguPhone,
      (call) => {
        console.log('[App] Incoming call from:', call.callerPhone);
        setIncomingCall({
          callerPhone: call.callerPhone,
          callerName: getDisplayName(call.callerPhone, call.name),
          callerAvatar: call.avatar,
          callerMood: call.mood,
          callerMoodEmoji: call.moodEmoji,
        });
      },
      (callerPhone) => {
        console.log('[App] Call removed from:', callerPhone);
        setIncomingCall((prev) => {
          if (prev?.callerPhone === callerPhone) {
            console.log('[App] Caller cancelled, not saving duplicate entry');
            return null;
          }
          return prev;
        });
      }
    );

    return cleanup;
  }, [state.guftguPhone, state.firebaseConnected]);

  // Listen for friend requests — create a notification for each
  useEffect(() => {
    if (!dbRef.current || !state.guftguPhone || !state.firebaseConnected) return;

    const cleanup = listenFriendRequests(dbRef.current, state.guftguPhone, (req) => {
      addNotif({
        type: 'friend_request',
        icon: '🤝',
        title: 'New Friend Request',
        body: `<b>${req.name || 'Someone'}</b> wants to be your friend`,
        time: req.timestamp || Date.now(),
        unread: true,
        meta: { phone: req.phone, avatar: req.avatar || 'cat' },
      });
      // Show a toast too
      showToast(`🤝 Friend request from ${req.name || 'someone'}`);
    });

    return cleanup;
  }, [state.guftguPhone, state.firebaseConnected, showToast]);

  // Listen for accepted friend requests — create a notification
  useEffect(() => {
    if (!dbRef.current || !state.guftguPhone || !state.firebaseConnected) return;

    const cleanup = listenFriendAccepted(dbRef.current, state.guftguPhone, (friend) => {
      addNotif({
        type: 'friend_accepted',
        icon: '🎉',
        title: 'Friend Request Accepted',
        body: `<b>${friend.name || 'Someone'}</b> accepted your friend request`,
        time: friend.timestamp || Date.now(),
        unread: true,
        meta: { phone: friend.phone, avatar: friend.avatar || 'cat' },
      });
      showToast(`🎉 ${friend.name || 'Someone'} accepted your request!`);
    });

    return cleanup;
  }, [state.guftguPhone, state.firebaseConnected, showToast]);

  // Handle accepting incoming call
  const handleAcceptCall = useCallback(async () => {
    console.log('[handleAcceptCall] Starting...', { incomingCall, guftguPhone: state.guftguPhone });
    if (!incomingCall || !dbRef.current || !state.guftguPhone) return;

    try {
      // acceptCall now returns the connectedAt timestamp
      const connectedAt = await acceptCall(dbRef.current, state.guftguPhone, incomingCall.callerPhone);

      const palData = {
        phone: incomingCall.callerPhone,
        name: incomingCall.callerName,
        avatar: incomingCall.callerAvatar,
        mood: incomingCall.callerMood,
        moodEmoji: incomingCall.callerMoodEmoji,
        isOutgoingCall: false, // We received this call
        connectedAt: connectedAt, // For synchronized timer
      };
      console.log('[handleAcceptCall] Setting pal:', palData);

      // Clear incoming call modal first
      setIncomingCall(null);

      // Set the caller as pal
      dispatch({
        type: 'SET_PAL',
        pal: palData as any, // connectedAt is extra field
      });

      // Small delay to ensure state is updated before navigating
      // This helps React batch the updates properly
      requestAnimationFrame(() => {
        console.log('[handleAcceptCall] Navigating to screen-call');
        dispatch({ type: 'SET_SCREEN', screen: 'screen-call' });
        showToast('Call connected!');
      });
    } catch (error) {
      console.error('Failed to accept call:', error);
      showToast('Failed to connect');
      setIncomingCall(null);
    }
  }, [incomingCall, state.guftguPhone, showToast]);

  // Handle declining incoming call
  const handleDeclineCall = useCallback(async () => {
    if (!incomingCall || !dbRef.current || !state.guftguPhone) return;

    try {
      await declineCall(dbRef.current, state.guftguPhone, incomingCall.callerPhone);

      // Save as declined incoming call
      saveCallToHistory({
        avatar: incomingCall.callerAvatar || 'cat',
        name: getDisplayName(incomingCall.callerPhone, incomingCall.callerName || 'Unknown'),
        phone: incomingCall.callerPhone,
        mood: incomingCall.callerMood || '',
        duration: '00:00',
        type: 'Declined',
        timestamp: Date.now(),
        callStartedAt: Date.now(),
      });

      setIncomingCall(null);
    } catch (error) {
      console.error('Failed to decline call:', error);
      setIncomingCall(null);
    }
  }, [incomingCall, state.guftguPhone]);

  // Handle blocking incoming caller
  const handleBlockCaller = useCallback(async () => {
    if (!incomingCall || !dbRef.current || !state.guftguPhone) return;

    try {
      // First decline the call
      await declineCall(dbRef.current, state.guftguPhone, incomingCall.callerPhone);

      // Then block the caller
      await blockUserFirebase(
        dbRef.current,
        state.guftguPhone,
        incomingCall.callerPhone,
        incomingCall.callerName,
        incomingCall.callerAvatar
      );

      // Save as blocked call
      saveCallToHistory({
        avatar: incomingCall.callerAvatar || 'cat',
        name: getDisplayName(incomingCall.callerPhone, incomingCall.callerName || 'Unknown'),
        phone: incomingCall.callerPhone,
        mood: incomingCall.callerMood || '',
        duration: '00:00',
        type: 'Blocked',
        timestamp: Date.now(),
        callStartedAt: Date.now(),
      });

      setIncomingCall(null);
      showToast('🚫 User blocked');
    } catch (error) {
      console.error('Failed to block caller:', error);
      setIncomingCall(null);
      showToast('Failed to block user');
    }
  }, [incomingCall, state.guftguPhone, showToast]);

  // Watch friends' online status — re-subscribe whenever the friends list or
  // Firebase connection changes. Fire a toast when a friend comes online.
  const prevOnlineRef = useRef<Record<string, boolean>>({});
  useEffect(() => {
    if (!dbRef.current || !state.guftguPhone || !state.firebaseConnected) return;

    const friends = getFriends();
    if (!friends.length) return;

    const phones = friends.map(f => f.phone);

    const cleanup = listenFriendsOnlineStatus(
      dbRef.current,
      phones,
      (phone, online, lastSeen) => {
        // Detect transition offline → online and show toast
        const wasOnline = prevOnlineRef.current[phone];
        if (online && wasOnline === false) {
          const friend = getFriends().find(f => f.phone === phone);
          const name = friend?.nickname || friend?.name || phone;
          showToast(`🟢 ${name} is now online`);
          playFriendOnlineSound();
        }
        prevOnlineRef.current[phone] = online;

        setFriendsOnline(prev => ({ ...prev, [phone]: online }));
        setFriendsLastSeen(prev => ({ ...prev, [phone]: lastSeen }));
      }
    );

    return cleanup;
    // Re-subscribe when friends list changes or Firebase reconnects
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.firebaseConnected, state.guftguPhone,
  // Stringify friend phones so the effect re-runs when a friend is added/removed
  // eslint-disable-next-line react-hooks/exhaustive-deps
  getFriends().map(f => f.phone).join(',')]);

  // ── Global background message listener ──────────────────────────────────
  // Keeps a real-time listener open for EVERY friend's conversation so that
  // when a message arrives and the user is NOT inside that specific chat,
  // we bump the unread badge and play a notification sound.
  const screenRef2 = useRef(state.screen);
  screenRef2.current = state.screen;
  const currentPalRef = useRef(state.currentPal);
  currentPalRef.current = state.currentPal;

  useEffect(() => {
    if (!dbRef.current || !state.guftguPhone || !state.firebaseConnected) return;

    const friends = getFriends();
    if (!friends.length) return;

    const myPhone = state.guftguPhone;
    const db = dbRef.current;

    // Track which message IDs we've already processed to avoid double-counting
    const seenIds = new Set<string>();

    const cleanups: Array<() => void> = [];
    let initialBatchDone = false;

    // Small delay to let onChildAdded fire its initial historical batch
    const initTimer = setTimeout(() => { initialBatchDone = true; }, 1500);

    friends.forEach(friend => {
      const unsub = listenChatMessages(db, myPhone, friend.phone, (msg) => {
        // Skip own messages
        if (msg.from === myPhone) return;
        // Skip already-seen ids
        if (seenIds.has(msg.id)) return;
        seenIds.add(msg.id);

        // Skip the initial historical batch — only react to truly new messages
        if (!initialBatchDone) return;

        const currentScreen = screenRef2.current;
        const currentPal = currentPalRef.current;

        const isInsideThisChat =
          currentScreen === 'screen-chat' && currentPal?.phone === friend.phone;

        if (!isInsideThisChat) {
          // Update conversation preview + bump unread count
          const convos = getChatConversations();
          const idx = convos.findIndex(c => c.phone === friend.phone);
          if (idx >= 0) {
            convos[idx] = {
              ...convos[idx],
              lastMessage: msg.text,
              lastMessageTime: msg.timestamp,
              unreadCount: (convos[idx].unreadCount || 0) + 1,
            };
          } else {
            convos.unshift({
              phone: friend.phone,
              name: friend.nickname || friend.name,
              avatar: friend.avatar,
              lastMessage: msg.text,
              lastMessageTime: msg.timestamp,
              unreadCount: 1,
            });
          }
          saveChatConversations(convos);
          // Sync badge count from storage
          setUnreadMsgCount(getTotalUnreadMessages());
          // Play notification sound
          playMessageSound();
          // Show a toast
          const name = friend.nickname || friend.name;
          showToast(`💬 ${name}: ${msg.text.slice(0, 40)}`);
        }
      });
      cleanups.push(unsub);
    });

    return () => {
      clearTimeout(initTimer);
      cleanups.forEach(fn => fn());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.firebaseConnected, state.guftguPhone,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  getFriends().map(f => f.phone).join(',')]);

  return (
    <AppContext.Provider value={{
      state, dispatch, showScreen, goBack, showToast, saveUserData, dbRef,
      incomingCall, handleAcceptCall, handleDeclineCall, handleBlockCaller,
      unreadNotifCount, markNotifsRead,
      unreadMsgCount, clearChatUnread,
      friendsOnline, friendsLastSeen,
    }}>
      {children}
    </AppContext.Provider>
  );
}
