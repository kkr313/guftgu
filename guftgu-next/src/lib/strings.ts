/**
 * Centralized text constants for the Guftgu app.
 * Import from here instead of hardcoding strings in components.
 *
 * Usage:
 *   import { S } from '@/lib/strings';
 *   <div>{S.call.connected}</div>
 */

/* ─── App‑wide ──────────────────────────────────────────── */

export const S = {
  appName: 'Guftgu',

  /* ─── Common / Shared ──────────────────────────────────── */
  common: {
    cancel: 'Cancel',
    delete: 'Delete',
    copy: 'Copy',
    unblock: 'Unblock',
    accept: 'Accept',
    decline: 'Decline',
    continueBtn: 'Continue',
    back: 'Back',
    close: '✕',
    moreNames: '🔀 More',
    orType: 'OR TYPE',
    settingArrow: '›',
  },

  /* ─── Onboard Screen ──────────────────────────────────── */
  onboard: {
    taglineHindi: 'बात करो, दिल से',
    taglineEn: 'Speak freely · Connect deeply',
    highlights: [
      { icon: '🎭', text: '100% Anonymous' },
      { icon: '🎙️', text: 'Voice calls' },
      { icon: '🌍', text: 'Indian languages' },
      { icon: '💬', text: 'Text chat' },
    ],
    quickStartTitle: 'Quick Start',
    quickStartSub: "We'll pick a random avatar & name — just choose your language & jump in",
    fullSetupBtn: '🎭 Choose Your Vibe',
    splashFooter: '🎭 Stay fully anonymous  ·  Made for India',

    step1Label: 'Step 1',
    step1Title: 'How are you feeling?',
    step1Sub: 'Your mood helps us find the right match',
    step1IntentTitle: 'What do you want to do?',

    step2Label: 'Step 2',
    step2Title: 'Pick your avatar',
    step2Sub: 'Pick one that represents you \u2014 no real identity revealed.',

    step3Label: 'Step 3',
    step3Title: 'Language & Region',
    step3Sub: 'Chat in the language you love',
    step3LangLabel: 'Language',
    step3RegionLabel: 'Region',

    step4Label: 'Step 4',
    step4Title: 'What should we call you?',
    step4Sub: 'Pick a suggestion or type your own \u2014 you stay fully anonymous.',
    step4SuggestedLabel: '\u2728 Suggested names',
    step4Placeholder: 'Or type your own name...',
    step4WarningShort: '\u26A0 At least 2 characters needed',
    step4WarningProfane: '\u26A0 That name isn\u2019t allowed \u2014 please pick something nicer.',
    step4Good: '\u2713 Looking good!',
    step4Hint: '\u2713 No email or phone required \u00B7 \u2713 Fully anonymous',

    startGuftgu: 'Start talking \uD83C\uDF99\uFE0F',

    qsLabel: 'Quick Start · 1 step',
    qsTitle: 'Where are you from?',
    qsSub: "That's all we need — everything else is randomised for you.",
    qsShuffle: '🔀 Shuffle',
    qsRegionLabel: 'Region (optional)',
    qsStartBtn: '⚡ Start Guftgu',
    qsSettingsHint: 'You can update your profile anytime from Settings',

    avatarTabAnimal: '🐾 Animals',
    avatarTabPeople: '👤 People',
    avatarTabFantasy: '✨ Fantasy',

    /** Progress bar */
    stepOf: (step: number) => `Step ${step} of 4`,

    /** Toasts */
    toastPickMood: 'Pick a mood first 😊',
    toastPickAvatar: 'Choose an avatar first',
    toastPickLang: 'Choose a language 🌍',
    toastPickLangQs: 'Pick a language 🌍',
    toastNickname: 'Enter a nickname (2+ chars) 👤',
  },

  /* ─── Welcome Screen ──────────────────────────────────── */
  welcome: {
    phoneLabel: 'Your Guftgu Number',
    phoneHint: 'Share this with friends to call you directly',
    featureAnon: 'Fully anonymous',
    featureNoAccount: 'No account needed',
    featureMadeIn: 'Made for India',
    enterBtn: "Let's Guftgu!",
  },

  /* ─── Home Screen ─────────────────────────────────────── */
  home: {
    greetings: {
      night: 'Night owl 🦉',
      morning: 'Good morning 🌅',
      afternoon: 'Good afternoon ☀️',
      evening: 'Good evening 🌙',
    },
    findGuftgu: 'Find a Guftgu',
    mood: 'Mood',
    language: 'Language',
    autoConnect: 'Auto Connect',
    autoConnectOn: '⚡ Auto Connect on',
    autoConnectOff: 'Auto Connect off',
    callAFriend: '📞 Call a Friend',
    dialPlaceholder: 'Enter Guftgu number',
    recentCalls: 'Recent Calls',
    seeAll: 'See All',
    emptyCallsIcon: '📋',
    emptyCallsText: 'No calls yet.\nStart a Guftgu or call a friend!',
    callHistoryPill: '📋 Call History',
    friendsPill: '👥 Friends',
    enterNumberToast: 'Enter a Guftgu number',
    callingToast: (num: string) => `Calling ${num}...`,
  },

  /* ─── Match Screen ────────────────────────────────────── */
  match: {
    searchTips: [
      'Looking for someone who gets you…',
      'Connecting hearts across India…',
      'Finding your vibe match…',
      'Searching for your next Guftgu…',
      'Someone special is out there…',
    ],
    searching: 'Searching…',
    findingTitle: 'Finding your Guftgu…',
    findingSub: (lang: string) => `Looking for someone who speaks ${lang} and matches your vibe`,
    cancelBtn: 'Cancel',
    safetyFooter: '🔒 Anonymous · End-to-end private',
    matchFound: 'Match Found!',
    itsAMatch: "It\u2019s a match!",
    feeling: (mood: string) => `Feeling ${mood}`,
    skipBtn: 'Skip',
    connectBtn: 'Connect 🎙️',
    blockBtn: '🚫 Block',
    reportBtn: '⚠️ Report',
  },

  /* ─── Call Screen ─────────────────────────────────────── */
  call: {
    connected: '● CONNECTED',
    friendRequestSent: 'Friend request sent! 💌',
    requestSentLabel: 'Request Sent',
    addFriendLabel: 'Add Friend',
    addFriendIcon: '❤️',
    addFriendSentIcon: '✓',
    mute: 'Mute',
    unmute: 'Unmute',
    end: 'End',
    speaker: 'Speaker',
    speakerOn: 'Speaker On',
    switchToChat: '💬 Switch to Chat',
    block: '🚫 Block',
    userBlocked: 'User blocked',
    callEndedToast: (duration: string) => `Call ended · ${duration}`,
  },

  /* ─── Chat Screen ─────────────────────────────────────── */
  chat: {
    placeholder: 'Type a message...',
    matchSystemMsg: (name: string) => `You matched with ${name} 🎉`,
  },

  /* ─── Chats / Friends Screen ──────────────────────────── */
  chats: {
    title: 'Friends',
    tabFriends: 'Friends',
    tabPending: 'Pending',
    emptyFriendsIcon: '👥',
    emptyFriendsTitle: 'No friends yet',
    emptyFriendsSub: 'Start a Guftgu and tap "Add Friend" during a call!',
    emptyPendingIcon: '📬',
    emptyPendingTitle: 'No pending requests',
    emptyPendingSub: 'Friend requests you send or receive will appear here',
    wantsToBeFriends: 'Wants to be friends',
    sentByYou: 'Sent by you',
    friendAddedToast: 'Friend added! 🎉',
    callComingSoon: (name: string) => `Call ${name} — coming soon!`,
  },

  /* ─── History Screen ──────────────────────────────────── */
  history: {
    title: 'Call History',
    emptyIcon: '📋',
    emptyText: 'No call history yet.\nYour calls will appear here.',
  },

  /* ─── Notifications Screen ────────────────────────────── */
  notifs: {
    title: 'Notifications',
    subtitle: 'Your activity updates',
    emptyIcon: '🔔',
    emptyTitle: 'No notifications yet',
    emptySub: 'Friend requests and call alerts will show up here',
  },

  /* ─── Blocked Screen ──────────────────────────────────── */
  blocked: {
    title: 'Blocked Users',
    countLabel: (count: number) => `${count} blocked`,
    subtitle: "Blocked users can\u2019t match with you or send friend requests.",
    emptyIcon: '✌️',
    emptyTitle: 'No blocked users',
    emptySub: "You haven\u2019t blocked anyone yet. Good vibes all around!",
    unblockToast: 'User unblocked ✓',
  },

  /* ─── Profile Screen ──────────────────────────────────── */
  profile: {
    editBadge: '✎',
    phoneIcon: '📱',
    phoneLabel: 'Guftgu Number',
    copyBtn: 'Copy',
    copiedToast: 'Copied to clipboard! 📋',
    statCalls: 'Calls',
    statFriends: 'Friends',
    statTalkTime: 'Talk Time',
    settingMoodIcon: '😊',
    settingMood: 'Mood',
    settingLangIcon: '🌐',
    settingLang: 'Language',
    settingRegionIcon: '🗺️',
    settingRegion: 'Region',
    settingBlockedIcon: '🚫',
    settingBlocked: 'Blocked Users',
    settingBlockedDesc: 'Manage blocked users',
    settingDeleteIcon: '🗑️',
    settingDelete: 'Delete Account',
    settingDeleteDesc: 'Remove all data permanently',
    deleteModalIcon: '⚠️',
    deleteModalTitle: 'Delete Account?',
    deleteModalDesc:
      'This will permanently delete your profile, call history, friends list, and all data. This action cannot be undone.',
    deletedToast: 'Account deleted. Start fresh!',
    moodUpdatedToast: (emoji: string) => `Mood updated! ${emoji}`,
    avatarUpdatedToast: 'Avatar updated! ✨',
  },

  /* ─── Modals ──────────────────────────────────────────── */
  modal: {
    moodTitle: 'How are you feeling?',
    langTitle: 'Choose Language',
    regionTitle: 'Choose Region',
    avatarTitle: 'Choose Avatar',
    avatarTabAnimal: '🐾 Animals',
    avatarTabPeople: '👤 People',
    avatarTabFantasy: '✨ Fantasy',
  },

  /* ─── Bottom Nav ──────────────────────────────────────── */
  nav: {
    home: 'Home',
    friends: 'Friends',
    notifs: 'Notifs',
    profile: 'Profile',
  },
} as const;
