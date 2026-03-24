import OnboardScreen from '@/components/screens/OnboardScreen';
import WelcomeScreen from '@/components/screens/WelcomeScreen';
import HomeScreen from '@/components/screens/HomeScreen';
import MatchScreen from '@/components/screens/MatchScreen';
import CallScreen from '@/components/screens/CallScreen';
import ChatScreen from '@/components/screens/ChatScreen';
import ChatsScreen from '@/components/screens/ChatsScreen';
import NotifsScreen from '@/components/screens/NotifsScreen';
import ProfileScreen from '@/components/screens/ProfileScreen';
import HistoryScreen from '@/components/screens/HistoryScreen';
import BlockedScreen from '@/components/screens/BlockedScreen';
import BottomNav from '@/components/BottomNav';
import Toast from '@/components/Toast';

export default function App() {
  return (
    <>
      <div id="app">
        <OnboardScreen />
        <WelcomeScreen />
        <HomeScreen />
        <MatchScreen />
        <CallScreen />
        <ChatScreen />
        <ChatsScreen />
        <NotifsScreen />
        <ProfileScreen />
        <HistoryScreen />
        <BlockedScreen />
      </div>
      <BottomNav />
      <Toast />
    </>
  );
}
