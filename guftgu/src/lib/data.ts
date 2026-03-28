// Data constants used throughout the app

import { S } from '@/lib/strings';

export const MOOD_DATA = [
  { mood: 'Happy', emoji: '😄' },
  { mood: 'Sad', emoji: '😔' },
  { mood: 'Anxious', emoji: '😰' },
  { mood: 'Bored', emoji: '😑' },
  { mood: 'Lonely', emoji: '🥺' },
  { mood: 'Excited', emoji: '🤩' },
  { mood: 'Angry', emoji: '😤' },
  { mood: 'Curious', emoji: '🤔' },
  { mood: 'Chill', emoji: '😎' },
] as const;

export const MOOD_EMOJIS: Record<string, string> = {
  Happy: '😄', Sad: '😔', Anxious: '😰', Bored: '😑',
  Lonely: '🥺', Excited: '🤩', Angry: '😤', Curious: '🤔', Chill: '😎',
};

export const LANG_DATA = [
  { lang: 'Hindi', flag: '🇮🇳', native: 'हिन्दी' },
  { lang: 'English', flag: '🌐', native: 'English' },
  { lang: 'Bengali', flag: '🪷', native: 'বাংলা' },
  { lang: 'Odia', flag: '🌸', native: 'ଓଡ଼ିଆ' },
  { lang: 'Tamil', flag: '🌺', native: 'தமிழ்' },
  { lang: 'Telugu', flag: '🌼', native: 'తెలుగు' },
  { lang: 'Marathi', flag: '🏵️', native: 'मराठी' },
  { lang: 'Kannada', flag: '☘️', native: 'ಕನ್ನಡ' },
  { lang: 'Punjabi', flag: '🌻', native: 'ਪੰਜਾਬੀ' },
  { lang: 'Bhojpuri', flag: '🎋', native: 'भोजपुरी' },
];

export const REGION_DATA = [
  { region: 'North', icon: '🏔️', name: 'North India', states: 'Delhi · UP · Punjab · HP' },
  { region: 'South', icon: '🌴', name: 'South India', states: 'TN · Kerala · Karnataka' },
  { region: 'East', icon: '🌊', name: 'East India', states: 'WB · Odisha · Bihar' },
  { region: 'West', icon: '🌅', name: 'West India', states: 'MH · Gujarat · Goa' },
  { region: 'Central', icon: '🌾', name: 'Central India', states: 'MP · CG · Telangana' },
  { region: 'Northeast', icon: '🏕️', name: 'Northeast', states: 'Assam · Manipur · NE' },
];

export const INTENT_DATA = [
  { intent: 'Just chat', icon: '💬', sub: 'Free flow' },
  { intent: 'Vent', icon: '🌊', sub: 'Off my chest' },
  { intent: 'Laugh', icon: '😂', sub: 'Jokes & fun' },
  { intent: 'Deep talk', icon: '🧠', sub: 'Ideas & life' },
];

export const BOT_REPLIES: Record<string, string[]> = {
  Chill: ["Yeah, just vibing honestly 😎", "Not much, you?", "That's chill. I like it.", "Same energy lol", "Yeah I get that feeling"],
  Happy: ["Omg yes! That's amazing 😄", "I love that for you!", "Yesss let's go!!", "That made my day honestly", "Happy vibes only 🎉"],
  Sad: ["I understand... 😔", "That's really tough, I'm sorry", "It's okay to feel that way", "I'm here for you 💙", "You're not alone in this"],
  Anxious: ["Take it one step at a time 💛", "Deep breaths, you've got this", "That sounds really stressful", "I've been there too, it gets better", "Is there anything that helps?"],
  Lonely: ["I'm glad we're talking 🥺", "You deserve good company", "Tell me more about your day?", "I feel that sometimes too", "We're in this together 💙"],
  Excited: ["YESSSS 🤩", "Wait tell me everything!!", "That's so exciting omg", "I'm excited FOR you", "This is amazing news!!"],
  Angry: ["Ugh that's so frustrating", "I'd be mad too honestly", "They were wrong for that", "You have every right to feel that", "Breathe... then vent more 😤"],
  Curious: ["Ooh that's interesting 🤔", "I never thought about it that way", "Tell me more?", "What made you think of that?", "That's actually a great question"],
  Bored: ["Same honestly 😑", "Let's make something up to talk about", "Ok random question: cats or dogs?", "What's the most random skill you have?", "Tell me something nobody knows about you"],
};

export const NAME_ADJECTIVES = [
  'Silent', 'Quiet', 'Bold', 'Bright', 'Dark', 'Swift', 'Calm', 'Wild',
  'Deep', 'Soft', 'Sharp', 'Hazy', 'Warm', 'Cool', 'Fierce', 'Gentle',
  'Lone', 'Blue', 'Golden', 'Mystic', 'Lazy', 'Brave', 'Witty', 'Proud',
];

export const NAME_NOUNS = [
  'Tiger', 'River', 'Storm', 'Cloud', 'Falcon', 'Drifter', 'Wolf', 'Spark',
  'Comet', 'Ember', 'Pebble', 'Tide', 'Fox', 'Sage', 'Hawk', 'Breeze',
  'Shadow', 'Flame', 'Echo', 'Pilgrim', 'Crest', 'Nomad', 'Glimmer', 'Pulse',
];

export const QS_AVATARS = ['cat', 'fox', 'wolf', 'panda', 'lion', 'frog', 'owl', 'penguin', 'wizard', 'robot', 'fairy', 'alien', 'ninja', 'knight', 'angel', 'samurai'];
export const QS_MOODS = ['Happy', 'Chill', 'Excited', 'Lonely', 'Curious', 'Bored'];

export function genUniqueName(): string {
  const adj = NAME_ADJECTIVES[Math.floor(Math.random() * NAME_ADJECTIVES.length)];
  const noun = NAME_NOUNS[Math.floor(Math.random() * NAME_NOUNS.length)];
  return adj + noun + String(Math.floor(10 + Math.random() * 90));
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  const days = Math.floor(hrs / 24);
  if (days < 7) return days + 'd ago';
  return Math.floor(days / 7) + 'w ago';
}

export function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function callTypeClass(type: string): string {
  if (!type) return 'outgoing';
  const t = type.toLowerCase();
  if (t === 'missed') return 'missed';
  if (t === 'incoming') return 'incoming';
  if (t === 'blocked') return 'blocked';
  if (t === 'declined') return 'declined';
  return 'outgoing';
}

/** Format seconds into m:ss — used by CallScreen, history displays */
export function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

/** Time-of-day greeting — sources text from S.home.greetings */
export function getGreeting(): string {
  const hr = new Date().getHours();
  if (hr < 5) return S.home.greetings.night;
  if (hr < 12) return S.home.greetings.morning;
  if (hr < 17) return S.home.greetings.afternoon;
  return S.home.greetings.evening;
}

/** Pick a random element from an array */
export function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
