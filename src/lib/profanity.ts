/**
 * Profanity / vulgar-name filter
 * Covers English, Hindi (romanized / Hinglish), and common leetspeak variations.
 * All checks are case-insensitive and strip common substitution characters.
 *
 * Two matching strategies:
 *  1. EXACT_STEMS — short / ambiguous stems tested with word-boundary logic
 *     so "class" doesn't match "ass", "document" doesn't match "cum", etc.
 *  2. SUBSTRING_STEMS — long, unambiguous stems that are profane no matter
 *     where they appear (e.g. "chutiya", "madarchod").
 */

// ── Short / ambiguous stems — matched with word boundaries ──
// These are profane on their own but commonly appear inside normal words.
const EXACT_STEMS: string[] = [
  'ass', 'a55',
  'cum', 'kum',
  'fag',
  'dic', 'dik',
  'cok',
  'mc', 'bc',
  'bkl',
  'gand', 'gaand',
  'chut', 'choot',
  'haram',
  'ullu',
  'saala',
  'suar',
  'nude', 'nud3',
  'sexy', 'sexi',
  'porn', 'p0rn',
  'rape', 'r4pe',
  'pedo', 'paedo',
];

// ── Long / unambiguous stems — matched as substrings (no boundaries needed) ──
const SUBSTRING_STEMS: string[] = [
  // English
  'fuck', 'fuk', 'fuq', 'fck', 'phuck', 'phuk',
  'shit', 'sh1t',
  'bitch', 'b1tch', 'btch', 'biatch',
  'dick', 'd1ck',
  'cock', 'c0ck',
  'pussy', 'pu55y', 'pus5y',
  'cunt', 'kunt',
  'whore', 'wh0re',
  'slut', 'sl0t',
  'nigger', 'n1gger', 'nigg3r', 'nigga', 'n1gga',
  'faggot',
  'retard', 'retrd',
  'penis', 'pen1s',
  'vagina', 'vag1na',
  'boob', 'b00b',
  'dildo', 'd1ldo',
  'jerkoff', 'jackoff',
  'wank', 'wanker',
  'molest',

  // Hindi / Hinglish (romanized) — long enough to be unambiguous
  'bhosdi', 'bhosd1', 'bhosdike', 'bhosdiwale', 'bhosdiwali',
  'madarchod', 'maderchod',
  'behenchod', 'bhenchod', 'bhnchd',
  'chutiya', 'chut1ya', 'chutiy',
  'lund', 'lauda', 'lavda', 'lawda',
  'randi', 'rand1',
  'harami', 'haramkhor', 'haram1',
  'kutta', 'kutti', 'kuttiya',
  'suwwar',
  'jhantu', 'jhant',
  'tatti', 'tatt1',
  'gandu',
  'baklund', 'bakland',
  'dalla',
  'hijra', 'h1jra', 'hijda',
  'kamina', 'kameena',
  'badzaat',
  'gadha',
];

// Build exact-match regex: each stem wrapped with start/end or non-alpha boundaries
// Matches "ass" but not "class" or "passage"
const EXACT_RE = new RegExp(
  EXACT_STEMS.map((s) => `(?:^|[^a-z])${s}(?:$|[^a-z])`).join('|'),
  'i',
);

// Build substring regex: matches anywhere in the normalized string
const SUBSTRING_RE = new RegExp(
  SUBSTRING_STEMS.map((s) => `(?:${s})`).join('|'),
  'i',
);

/**
 * Normalize a string: lowercase, strip accents, collapse common
 * leetspeak substitutions (@ → a, 0 → o, 1 → i, 3 → e, $ → s, 5 → s),
 * remove non-alpha characters (spaces, hyphens, underscores, dots, digits).
 */
function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/@/g, 'a')
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/\$/g, 's')
    .replace(/5/g, 's')
    .replace(/\+/g, 't')
    .replace(/[^a-z]/g, ''); // strip everything except lowercase letters
}

/**
 * Light normalization that preserves word boundaries (spaces → single space).
 * Used for the EXACT_RE check so "my ass" still matches but "class" doesn't.
 */
function normalizeSoft(input: string): string {
  return input
    .toLowerCase()
    .replace(/@/g, 'a')
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/\$/g, 's')
    .replace(/5/g, 's')
    .replace(/\+/g, 't')
    .replace(/[^a-z\s]/g, '')  // keep letters AND spaces
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Returns `true` if the name contains profanity / vulgar content.
 */
export function isProfane(name: string): boolean {
  if (!name || name.trim().length === 0) return false;

  const normalized = normalize(name);
  const soft = normalizeSoft(name);

  // 1. Check long/unambiguous stems as substrings
  if (SUBSTRING_RE.test(normalized)) return true;

  // 2. Check short/ambiguous stems with boundary awareness
  //    Pad with spaces so start/end anchors in the regex work
  if (EXACT_RE.test(` ${soft} `)) return true;

  return false;
}
