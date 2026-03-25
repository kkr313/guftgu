import { useState, useCallback, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import Avatar from '@/components/Avatar';
import { AVATAR_CATEGORIES } from '@/components/Avatar';
import { MOOD_DATA, LANG_DATA, REGION_DATA, INTENT_DATA, QS_AVATARS, QS_MOODS, genUniqueName, MOOD_EMOJIS } from '@/lib/data';
import { genGuftguPhone } from '@/lib/storage';
import { generateUniqueGuftguNumber } from '@/lib/firebase-service';
import { IconChevronLeft } from '@/lib/icons';
import { S } from '@/lib/strings';
import { isProfane } from '@/lib/profanity';
import { useBackHandler } from '@/hooks/useBackButton';

type ObStep = 0 | 1 | 2 | 3 | 4 | 'qs';

// Position map: clock positions for 6 regions around the India center
// Maps to REGION_DATA order: North→top, South→bottom, East→br, West→tl, Central→bl, Northeast→tr
const REGION_POSITIONS = ['top', 'bottom', 'br', 'tl', 'bl', 'tr'] as const;

function RegionOrbit({ selected, onSelect }: { selected: string; onSelect: (r: string) => void }) {
  const selectedData = REGION_DATA.find((r) => r.region === selected);
  return (
    <div className="region-orbit-wrap">
      <div className="region-orbit">
        {/* India center */}
        <div className="region-center">
          <div className="region-center-flag">🇮🇳</div>
          <div className="region-center-label">India</div>
        </div>
        {/* 6 region nodes */}
        {REGION_DATA.map((r, i) => (
          <div
            key={r.region}
            className={`region-node${selected === r.region ? ' selected' : ''}`}
            data-pos={REGION_POSITIONS[i]}
            onClick={() => onSelect(r.region)}
          >
            <div className="region-icon">{r.icon}</div>
            <div className="region-name">{r.name}</div>
          </div>
        ))}
      </div>
      {/* Selected region states caption */}
      {selectedData && (
        <div className="region-states-caption" key={selected}>
          <span className="region-states-icon">{selectedData.icon}</span>
          <span className="region-states-text">{selectedData.states}</span>
        </div>
      )}
    </div>
  );
}
export default function OnboardScreen() {
  const { state, showScreen, showToast, saveUserData, dbRef } = useApp();
  const [step, setStep] = useState<ObStep>(0);
  const [maxStep, setMaxStep] = useState(0); // highest step visited
  const [isGeneratingNumber, setIsGeneratingNumber] = useState(false);

  // Full setup state
  const [mood, setMood] = useState('Happy');
  const [moodEmoji, setMoodEmoji] = useState('😄');
  const [avatar, setAvatar] = useState('cat');
  const [language, setLanguage] = useState('Hindi');
  const [region, setRegion] = useState('North');
  const [intent, setIntent] = useState('Just chat');
  const [nickname, setNickname] = useState('');
  const [avatarTab, setAvatarTab] = useState<'animal' | 'people' | 'fantasy'>('animal');
  const [nameChips, setNameChips] = useState(() => Array.from({ length: 6 }, genUniqueName));
  const [selectedChip, setSelectedChip] = useState('');

  // Quick start state
  const [qsAvatar, setQsAvatar] = useState(() => QS_AVATARS[Math.floor(Math.random() * QS_AVATARS.length)]);
  const [qsName, setQsName] = useState(genUniqueName);
  const [qsMood, setQsMood] = useState<string>(() => QS_MOODS[Math.floor(Math.random() * QS_MOODS.length)]);
  const [qsLang, setQsLang] = useState('Hindi');
  const [qsRegion, setQsRegion] = useState('');

  const reshuffleQS = useCallback(() => {
    setQsAvatar((prev) => {
      let next; do { next = QS_AVATARS[Math.floor(Math.random() * QS_AVATARS.length)]; } while (next === prev && QS_AVATARS.length > 1);
      return next;
    });
    setQsName((prev) => {
      let next; do { next = genUniqueName(); } while (next === prev);
      return next;
    });
    setQsMood((prev) => {
      let next; do { next = QS_MOODS[Math.floor(Math.random() * QS_MOODS.length)]; } while (next === prev && QS_MOODS.length > 1);
      return next;
    });
    setQsLang('Hindi');
    setQsRegion('');
  }, []);

  const refreshNameChips = useCallback(() => {
    const chips = Array.from({ length: 6 }, genUniqueName);
    setNameChips(chips);
    setSelectedChip(chips[0]);
    setNickname(chips[0]);
  }, []);

  const finishQS = async () => {
    if (!qsLang) { showToast(S.onboard.toastPickLangQs); return; }
    if (isGeneratingNumber) return;
    
    setIsGeneratingNumber(true);
    try {
      // Generate unique number from Firebase, fallback to random if no connection
      const phone = dbRef?.current 
        ? await generateUniqueGuftguNumber(dbRef.current)
        : genGuftguPhone();
      
      saveUserData({
        nickname: qsName, avatar: qsAvatar, mood: qsMood,
        moodEmoji: MOOD_EMOJIS[qsMood] || '😊',
        language: qsLang, region: qsRegion, intent: 'Just chat',
      }, phone);
      showScreen('screen-welcome');
    } catch (error) {
      console.error('Error generating number:', error);
      // Fallback to random generation
      const phone = genGuftguPhone();
      saveUserData({
        nickname: qsName, avatar: qsAvatar, mood: qsMood,
        moodEmoji: MOOD_EMOJIS[qsMood] || '😊',
        language: qsLang, region: qsRegion, intent: 'Just chat',
      }, phone);
      showScreen('screen-welcome');
    } finally {
      setIsGeneratingNumber(false);
    }
  };

  const finishOnboard = async () => {
    if (!nickname || nickname.length < 2) { showToast(S.onboard.toastNickname); return; }
    if (isProfane(nickname)) { showToast(S.onboard.step4WarningProfane); return; }
    if (isGeneratingNumber) return;
    
    setIsGeneratingNumber(true);
    try {
      // Generate unique number from Firebase, fallback to random if no connection
      const phone = dbRef?.current 
        ? await generateUniqueGuftguNumber(dbRef.current)
        : genGuftguPhone();
      
      saveUserData({
        nickname, avatar, mood, moodEmoji,
        language, region, intent,
      }, phone);
      showScreen('screen-welcome');
    } catch (error) {
      console.error('Error generating number:', error);
      // Fallback to random generation
      const phone = genGuftguPhone();
      saveUserData({
        nickname, avatar, mood, moodEmoji,
        language, region, intent,
      }, phone);
      showScreen('screen-welcome');
    } finally {
      setIsGeneratingNumber(false);
    }
  };

  const goNext = () => {
    if (step === 0) { setStep(1); setMaxStep((m) => Math.max(m, 1)); window.history.pushState({ guftgu: true, obStep: 1 }, ''); return; }
    if (step === 1) { if (!mood) { showToast(S.onboard.toastPickMood); return; } setStep(2); setMaxStep((m) => Math.max(m, 2)); window.history.pushState({ guftgu: true, obStep: 2 }, ''); return; }
    if (step === 2) { if (!avatar) { showToast(S.onboard.toastPickAvatar); return; } setStep(3); setMaxStep((m) => Math.max(m, 3)); window.history.pushState({ guftgu: true, obStep: 3 }, ''); return; }
    if (step === 3) { if (!language) { showToast(S.onboard.toastPickLang); return; } refreshNameChips(); setStep(4); setMaxStep((m) => Math.max(m, 4)); window.history.pushState({ guftgu: true, obStep: 4 }, ''); return; }
  };

  const goPrev = () => {
    if (step === 'qs') { setStep(0); return; }
    if (typeof step === 'number' && step > 0) { setStep((step - 1) as ObStep); return; }
  };

  const isActive = state.screen === 'screen-onboard';

  // Reset to splash (step 0) when screen becomes active and user has no phone (fresh start / after delete)
  useEffect(() => {
    if (isActive && !state.guftguPhone) {
      // Reset step to splash
      setStep(0);
      setMaxStep(0);
      // Reset Quick Start state
      reshuffleQS();
      // Reset Full Onboard state
      setMood('Happy');
      setMoodEmoji('😄');
      setAvatar('cat');
      setLanguage('Hindi');
      setRegion('North');
      setIntent('Just chat');
      setNickname('');
      setAvatarTab('animal');
      setSelectedChip('');
    }
  }, [isActive, state.guftguPhone, reshuffleQS]);

  // Mobile back button: go to previous onboarding step
  useBackHandler('onboard', () => {
    if (!isActive) return;
    if (step === 'qs') { setStep(0); return; }
    if (typeof step === 'number' && step > 0) { setStep((step - 1) as ObStep); return; }
    // step === 0: do nothing — we're at the start
  });

  return (
    <div id="screen-onboard" className={`screen${isActive ? ' active' : ''}`}>
      <div className="onboard-bg" />
      {/* Back button */}
      <button className={`ob-back-btn${step !== 0 ? ' visible' : ''}`} onClick={goPrev}>
        <IconChevronLeft />
      </button>

      <div className={`onboard-content${step === 0 ? ' splash-active' : ''}`}>
        {/* Logo — always visible */}
        <div className="onboard-logo">
          <div className="logo-icon">🎙️</div>
          <div className="logo-text">{S.appName}</div>
        </div>
        <div className="onboard-tagline">
          <div className="tagline-hindi">{S.onboard.taglineHindi}</div>
          <div className="tagline-en">{S.onboard.taglineEn}</div>
        </div>

        {/* Progress bar — visible on steps 1-4 */}
        <div className={`ob-progress${typeof step === 'number' && step >= 1 && step <= 4 ? ' visible' : ''}`}>
          <div className="ob-prog-steps">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="ob-prog-step">
                <div
                  className={`ob-prog-dot${typeof step === 'number' && i < step ? ' done' : ''}${i === step ? ' active' : ''}${i <= maxStep && i !== step ? ' clickable' : ''}`}
                  onClick={() => { if (i <= maxStep && i !== step) setStep(i as ObStep); }}
                >
                  {typeof step === 'number' && i < step ? '\u2713' : i}
                </div>
                {i < 4 && (
                  <div className={`ob-prog-line${typeof step === 'number' && i < step ? ' done' : ''}`}>
                    <div className="ob-prog-line-fill" style={{ transform: typeof step === 'number' && i < step ? 'scaleX(1)' : 'scaleX(0)' }} />
                  </div>
                )}
              </div>
            ))}
          </div>
          {typeof step === 'number' && step >= 1 && step <= 4 && (
            <div className="ob-prog-label">Step <span>{step}</span> of 4</div>
          )}
        </div>

        {/* STEP 0: SPLASH */}
        {step === 0 && (
          <div className="onboard-step active">
            <div className="splash-highlights">
              {S.onboard.highlights.map((h, i) => (
                <div key={i} className="splash-hl"><span className="splash-hl-icon">{h.icon}</span>{h.text}</div>
              ))}
            </div>
            <div className="qs-card" onClick={() => { reshuffleQS(); setStep('qs'); window.history.pushState({ guftgu: true, obStep: 'qs' }, ''); }}>
              <div className="qs-icon">⚡</div>
              <div className="qs-info">
                <div className="qs-title">{S.onboard.quickStartTitle}</div>
                <div className="qs-sub">{S.onboard.quickStartSub}</div>
              </div>
              <div className="qs-arrow">›</div>
            </div>
            <div className="or-divider">
              <div className="or-line" />
              <div className="or-text">OR SET UP YOURSELF</div>
              <div className="or-line" />
            </div>
            <button className="btn btn-primary" onClick={goNext}>
              {S.onboard.fullSetupBtn}
            </button>
            <div className="splash-hero-img">
              <img src="/guftgu_wal_img.jpg" alt="Guftgu — anonymous voice chat" />
            </div>
            <div className="splash-footer">
              🎭 Stay fully anonymous &nbsp;·&nbsp;
              <svg width="20" height="14" viewBox="0 0 20 14" style={{ verticalAlign: 'middle', borderRadius: 2, marginBottom: 1 }} xmlns="http://www.w3.org/2000/svg">
                <rect width="20" height="14" fill="#138808" />
                <rect width="20" height="9.33" fill="#fff" />
                <rect width="20" height="4.67" fill="#FF9933" />
                <circle cx="10" cy="7" r="2.2" fill="none" stroke="#000080" strokeWidth="0.4" />
              </svg>
              {' '}Made for India
            </div>
          </div>
        )}

        {/* STEP 1: MOOD */}
        {step === 1 && (
          <div className="onboard-step active">
            <div className="step-title">{S.onboard.step1Title}</div>
            <div className="step-sub">{S.onboard.step1Sub}</div>
            <div className="mood-grid">
              {MOOD_DATA.map((m) => (
                <div key={m.mood} className={`mood-card${mood === m.mood ? ' selected' : ''}`} onClick={() => { setMood(m.mood); setMoodEmoji(m.emoji); }}>
                  <div className="mood-emoji">{m.emoji}</div>
                  <div className="mood-name">{m.mood}</div>
                </div>
              ))}
            </div>
            <div className="step3-section-label">{S.onboard.step1IntentTitle}</div>
            <div className="intent-row">
              {INTENT_DATA.map((i) => (
                <div key={i.intent} className={`intent-chip${intent === i.intent ? ' selected' : ''}`} onClick={() => setIntent(i.intent)}>
                  <div className="intent-chip-icon">{i.icon}</div>
                  <div>
                    <div className="intent-chip-title">{i.intent}</div>
                    <div className="intent-chip-sub">{i.sub}</div>
                  </div>
                </div>
              ))}
            </div>
            <button className="btn btn-primary" onClick={goNext}>{S.common.continueBtn}</button>
            <div className="ob-settings-hint">{S.onboard.qsSettingsHint}</div>
          </div>
        )}

        {/* STEP 2: AVATAR */}
        {step === 2 && (
          <div className="onboard-step active">
            <div className="step-title">{S.onboard.step2Title}</div>
            <div className="step-sub">{S.onboard.step2Sub}</div>
            <div className="avatar-tabs">
              {(['animal', 'people', 'fantasy'] as const).map((tab) => (
                <button key={tab} className={`avatar-tab${avatarTab === tab ? ' active' : ''}`} onClick={() => { setAvatarTab(tab); setAvatar(AVATAR_CATEGORIES[tab][0]); }}>
                  {tab === 'animal' ? S.onboard.avatarTabAnimal : tab === 'people' ? S.onboard.avatarTabPeople : S.onboard.avatarTabFantasy}
                </button>
              ))}
            </div>
            <div className="avatar-grid">
              {AVATAR_CATEGORIES[avatarTab].map((key) => (
                <div key={key} className={`avatar-opt${avatar === key ? ' selected' : ''}`} onClick={() => setAvatar(key)}>
                  <Avatar avatarKey={key} size={48} />
                  <span className="avatar-opt-name">{key}</span>
                </div>
              ))}
            </div>
            <button className="btn btn-primary" onClick={goNext}>{S.common.continueBtn}</button>
            <div className="ob-settings-hint">{S.onboard.qsSettingsHint}</div>
          </div>
        )}

        {/* STEP 3: LANGUAGE + REGION */}
        {step === 3 && (
          <div className="onboard-step active">
            <div className="step-title">{S.onboard.step3Title}</div>
            <div className="step-sub">{S.onboard.step3Sub}</div>
            <div className="step3-section-label">{S.onboard.step3LangLabel}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
              {LANG_DATA.map((l) => (
                <div key={l.lang} className={`lang-pill${language === l.lang ? ' selected' : ''}`} onClick={() => setLanguage(l.lang)}>
                  <span className="lang-flag">{l.flag}</span>
                  <span className="lang-name">{l.lang}</span>
                </div>
              ))}
            </div>
            <div className="step3-section-label">{S.onboard.step3RegionLabel}</div>
            <RegionOrbit selected={region} onSelect={setRegion} />
            <button className="btn btn-primary" onClick={goNext}>{S.common.continueBtn}</button>
            <div className="ob-settings-hint">{S.onboard.qsSettingsHint}</div>
          </div>
        )}

        {/* STEP 4: NICKNAME */}
        {step === 4 && (
          <div className="onboard-step active">
            <div className="step-title">{S.onboard.step4Title}</div>
            <div className="step-sub">{S.onboard.step4Sub}</div>
            <div className="step3-section-label">{S.onboard.step4SuggestedLabel}</div>
            <div className="name-suggestion">
              {nameChips.map((n) => (
                <div key={n} className={`name-chip${selectedChip === n ? ' active' : ''}`} onClick={() => { setSelectedChip(n); setNickname(n); }}>
                  {n}
                </div>
              ))}
              <div className="name-chip" style={{ borderStyle: 'dashed', color: 'var(--text3)' }} onClick={refreshNameChips}>
                {S.common.moreNames}
              </div>
            </div>
            <div className="or-divider">
              <div className="or-line" />
              <div className="or-text">{S.common.orType}</div>
              <div className="or-line" />
            </div>
            <input
              type="text"
              placeholder={S.onboard.step4Placeholder}
              value={nickname}
              onChange={(e) => { setNickname(e.target.value); setSelectedChip(''); }}
              style={{ marginBottom: 8 }}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              maxLength={20}
            />
            <div style={{ fontSize: 11, color: isProfane(nickname) ? '#FF6B6B' : nickname.length >= 2 ? 'var(--accent2)' : 'var(--text3)', marginBottom: 24 }}>
              {isProfane(nickname)
                ? S.onboard.step4WarningProfane
                : nickname.length > 0 && nickname.length < 2
                ? S.onboard.step4WarningShort
                : nickname.length >= 2
                ? S.onboard.step4Good
                : S.onboard.step4Hint}
            </div>
            <button className="btn btn-primary" onClick={finishOnboard} disabled={isGeneratingNumber}>
              {isGeneratingNumber ? '⏳ Setting up...' : S.onboard.startGuftgu}
            </button>
            <div className="ob-settings-hint">{S.onboard.step4Hint}</div>
          </div>
        )}

        {/* QUICK START */}
        {step === 'qs' && (
          <div className="onboard-step active">
            <div className="step-label">{S.onboard.qsLabel}</div>
            <div className="step-title">{S.onboard.qsTitle}</div>
            <div className="step-sub">{S.onboard.qsSub}</div>
            <div className="qs-profile-preview">
              <div className="qs-preview-avatar">
                <Avatar avatarKey={qsAvatar} size={56} />
              </div>
              <div className="qs-preview-details">
                <div className="qs-preview-name">{qsName}</div>
                <div className="qs-preview-meta">Feeling {qsMood} {MOOD_EMOJIS[qsMood] || '😊'} · Just chat</div>
              </div>
              <button className="qs-preview-edit" onClick={reshuffleQS}>{S.onboard.qsShuffle}</button>
            </div>
            <div className="step3-section-label">{S.onboard.step3LangLabel}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
              {LANG_DATA.map((l) => (
                <div key={l.lang} className={`lang-pill${qsLang === l.lang ? ' selected' : ''}`} onClick={() => setQsLang(l.lang)}>
                  <span className="lang-flag">{l.flag}</span>
                  <span className="lang-name">{l.lang}</span>
                </div>
              ))}
            </div>
            <div className="step3-section-label">{S.onboard.qsRegionLabel}</div>
            <RegionOrbit selected={qsRegion} onSelect={setQsRegion} />
            <button className="btn btn-primary" onClick={finishQS} disabled={isGeneratingNumber}>
              {isGeneratingNumber ? '⏳ Setting up...' : S.onboard.qsStartBtn}
            </button>
            <div className="ob-settings-hint">{S.onboard.qsSettingsHint}</div>
          </div>
        )}
      </div>
    </div>
  );
}
