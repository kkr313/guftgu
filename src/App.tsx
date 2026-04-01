import React from 'react';
import OnboardScreen from '@/components/screens/OnboardScreen';
import WelcomeScreen from '@/components/screens/WelcomeScreen';
import HomeScreen from '@/components/screens/HomeScreen';
import MatchScreen from '@/components/screens/MatchScreen';
import CallScreen from '@/components/screens/CallScreen';
import ChatScreen from '@/components/screens/ChatScreen';
import ChatsScreen from '@/components/screens/ChatsScreen';
import NotifsScreen from '@/components/screens/NotifsScreen';
import NotificationsScreen from '@/components/screens/NotificationsScreen';
import ProfileScreen from '@/components/screens/ProfileScreen';
import HistoryScreen from '@/components/screens/HistoryScreen';
import BlockedScreen from '@/components/screens/BlockedScreen';
import AboutScreen from '@/components/screens/AboutScreen';
import BottomNav from '@/components/BottomNav';
import Toast from '@/components/Toast';
import IncomingCallModal from '@/components/IncomingCallModal';
import PullToRefresh from '@/components/PullToRefresh';
import GestureTip from '@/components/GestureTip';
import OfflineBanner from '@/components/OfflineBanner';
import { useApp, Screen } from '@/context/AppContext';

/** Map screen IDs to their components */
const SCREEN_MAP: Record<Screen, React.ComponentType> = {
  'screen-onboard': OnboardScreen,
  'screen-welcome': WelcomeScreen,
  'screen-home': HomeScreen,
  'screen-match': MatchScreen,
  'screen-call': CallScreen,
  'screen-chat': ChatScreen,
  'screen-chats': ChatsScreen,
  'screen-notifs': NotifsScreen,
  'screen-notifications': NotificationsScreen,
  'screen-profile': ProfileScreen,
  'screen-history': HistoryScreen,
  'screen-blocked': BlockedScreen,
  'screen-appinfo': AboutScreen,
};

/**
 * Screens that must stay mounted when a call is active —
 * CallScreen stays alive so WebRTC isn't torn down when switching to ChatScreen.
 */
const CALL_ACTIVE_SCREENS: Screen[] = ['screen-call', 'screen-chat'];

export default function App() {
  const { state, incomingCall, handleAcceptCall, handleDeclineCall, handleBlockCaller } = useApp();

  // Show loading splash while restoring user from localStorage
  if (state.isRestoring) {
    return (
      <div id="app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg1)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎙️</div>
          <div style={{ color: 'var(--text2)', fontSize: 14 }}>Loading...</div>
        </div>
      </div>
    );
  }

  // Determine which screens to mount
  const current = state.screen;
  const callIsActive = state.currentPal !== null;
  const screensToMount = new Set<Screen>([current]);

  // Keep call + chat mounted during an active call so WebRTC persists
  if (callIsActive) {
    CALL_ACTIVE_SCREENS.forEach((s) => screensToMount.add(s));
  }

  return (
    <>
      <PullToRefresh />
      <div id="app">
        {(Object.entries(SCREEN_MAP) as [Screen, React.ComponentType][]).map(([id, Component]) =>
          screensToMount.has(id) ? <Component key={id} /> : null
        )}
      </div>
      <BottomNav />
      <Toast />
      
      {/* Incoming Call Modal */}
      <IncomingCallModal
        isOpen={!!incomingCall}
        callerName={incomingCall?.callerName || ''}
        callerAvatar={incomingCall?.callerAvatar || 'cat'}
        callerMood={incomingCall?.callerMood || ''}
        callerMoodEmoji={incomingCall?.callerMoodEmoji || ''}
        onAccept={handleAcceptCall}
        onDecline={handleDeclineCall}
        onBlock={handleBlockCaller}
      />

      {/* One-time gesture tips overlay (shows after onboarding) */}
      {state.guftguPhone && <GestureTip />}

      {/* Offline overlay for PWA */}
      <OfflineBanner />
    </>
  );
}
