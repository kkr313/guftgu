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
import { useApp } from '@/context/AppContext';

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

  return (
    <>
      <PullToRefresh />
      <div id="app">
        <OnboardScreen />
        <WelcomeScreen />
        <HomeScreen />
        <MatchScreen />
        <CallScreen />
        <ChatScreen />
        <ChatsScreen />
        <NotifsScreen />
        <NotificationsScreen />
        <ProfileScreen />
        <HistoryScreen />
        <BlockedScreen />
        <AboutScreen />
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
    </>
  );
}
