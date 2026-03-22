// js/lang-data.js
// ══════════════════════════════════════════════════════
// SINGLE SOURCE OF TRUTH for language data.
// Used by: onboarding.js, mood.js, matching.js
// Add new languages here — they appear everywhere instantly.
// ══════════════════════════════════════════════════════

const LANG_DATA = [
  { lang: 'Hindi',   flag: '🇮🇳', native: 'हिन्दी'   },
  { lang: 'English', flag: '🌐', native: 'English'   },
  { lang: 'Bengali', flag: '🪷', native: 'বাংলা'     },
  { lang: 'Odia',    flag: '🌸', native: 'ଓଡ଼ିଆ'    },
  { lang: 'Tamil',   flag: '🌺', native: 'தமிழ்'     },
  { lang: 'Telugu',  flag: '🌼', native: 'తెలుగు'   },
  { lang: 'Marathi', flag: '🏵️', native: 'मराठी'    },
  { lang: 'Kannada', flag: '☘️', native: 'ಕನ್ನಡ'    },
  { lang: 'Punjabi', flag: '🌻', native: 'ਪੰਜਾਬੀ'   },
  { lang: 'Bhojpuri',flag: '🎋', native: 'भोजपुरी'  },
];

// Helper: renders a lang-pill-row into any container by ID
// Used by onboarding (QS + Step 3) and the modal
function renderLangPills(containerId, selectedLang, onClickFn) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = LANG_DATA.map(l => `
    <div class="lang-pill${l.lang === selectedLang ? ' selected' : ''}"
         data-lang="${l.lang}"
         onclick="${onClickFn}(this)">
      <span class="lang-flag">${l.flag}</span>
      <span class="lang-name">${l.lang}</span>
      <span class="lang-native">${l.native}</span>
    </div>`).join('');
}