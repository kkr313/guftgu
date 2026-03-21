// js/state.js - App state, constants, and data

const state = {
  screen: 'onboard',
  prevScreen: null,
  user: { nickname:'', avatar:'👨‍💻', mood:'Happy', moodEmoji:'😄', language:'Hindi', region:'North', intent:'Just chat' },
  guftguPhone: '',
  palcode: '',
  onboardStep: 0,
  currentPal: null,
  matchTimer: null,
  callTimer: null,
  callSecs: 0,
  isMuted: false,
};

const moodEmojis = {
  Happy:'😄', Sad:'😔', Anxious:'😰', Bored:'😑',
  Lonely:'🥺', Excited:'🤩', Angry:'😤', Curious:'🤔', Chill:'😎'
};

const pals = [
  {avatar:'🦊',name:'NightFox',mood:'Chill',moodEmoji:'😎'},
  {avatar:'🐼',name:'PandaSoul',mood:'Sad',moodEmoji:'😔'},
  {avatar:'🦉',name:'WiseOwl',mood:'Curious',moodEmoji:'🤔'},
  {avatar:'🐺',name:'LoneWolf',mood:'Lonely',moodEmoji:'🥺'},
  {avatar:'🦁',name:'SunKing',mood:'Happy',moodEmoji:'😄'},
  {avatar:'🐸',name:'QuietFrog',mood:'Bored',moodEmoji:'😑'},
  {avatar:'🦋',name:'DayDream',mood:'Excited',moodEmoji:'🤩'},
];

const botReplies = {
  Chill:["Yeah, just vibing honestly 😎","Not much, you?","That's chill. I like it.","Same energy lol","Yeah I get that feeling"],
  Happy:["Omg yes! That's amazing 😄","I love that for you!","Yesss let's go!!","That made my day honestly","Happy vibes only 🎉"],
  Sad:["I understand... 😔","That's really tough, I'm sorry","It's okay to feel that way","I'm here for you 💙","You're not alone in this"],
  Anxious:["Take it one step at a time 💛","Deep breaths, you've got this","That sounds really stressful","I've been there too, it gets better","Is there anything that helps?"],
  Lonely:["I'm glad we're talking 🥺","You deserve good company","Tell me more about your day?","I feel that sometimes too","We're in this together 💙"],
  Excited:["YESSSS 🤩","Wait tell me everything!!","That's so exciting omg","I'm excited FOR you","This is amazing news!!"],
  Angry:["Ugh that's so frustrating","I'd be mad too honestly","They were wrong for that","You have every right to feel that","Breathe... then vent more 😤"],
  Curious:["Ooh that's interesting 🤔","I never thought about it that way","Tell me more?","What made you think of that?","That's actually a great question"],
  Bored:["Same honestly 😑","Let's make something up to talk about","Ok random question: cats or dogs?","What's the most random skill you have?","Tell me something nobody knows about you"],
};

// ═══════════════════════════════════════
// SCREEN TRANSITIONS
