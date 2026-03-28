/**
 * Profanity / vulgar-name filter
 * Covers English, Hindi (romanized / Hinglish), and common leetspeak variations.
 * All checks are case-insensitive and strip common substitution characters.
 */

// ── Blocked stems ──
// Each entry is a regex-safe stem. We test against the *normalized* input.
const BLOCKED: string[] = [
  // ── English ──
  'fuck', 'fuk', 'fuq', 'fck', 'phuck', 'phuk',
  'shit', 'sh1t', 'sht',
  'ass', 'a55',
  'bitch', 'b1tch', 'btch', 'biatch',
  'dick', 'd1ck', 'dik',
  'cock', 'c0ck', 'cok',
  'pussy', 'pu55y', 'pus5y',
  'cunt', 'kunt',
  'whore', 'wh0re', 'hoar',
  'slut', 'sl0t',
  'nigger', 'n1gger', 'nigg3r', 'nigga', 'n1gga',
  'fag', 'faggot',
  'retard', 'retrd',
  'penis', 'pen1s',
  'vagina', 'vag1na',
  'boob', 'b00b',
  'dildo', 'd1ldo',
  'jerk ?off', 'jackoff', 'jack ?off',
  'wank', 'wanker',
  'cum', 'kum',
  'porn', 'p0rn',
  'sexy', 'sexi',
  'nude', 'nud3',
  'rape', 'r4pe',
  'molest',
  'pedo', 'paedo',

  // ── Hindi / Hinglish (romanized) ──
  'bhosdi', 'bhosd1', 'bhosdike', 'bhosdiwale', 'bhosdiwali',
  'madarchod', 'madarc?hod', 'mc', 'maderchod',
  'behenchod', 'behenc?hod', 'bc', 'bhenchod', 'bhnchd',
  'chutiya', 'chut1ya', 'chutiy', 'choot', 'chut',
  'gand', 'gaand', 'g[a@]nd',
  'lund', 'l[u\\*]nd', 'lauda', 'lavda', 'l[a@]uda', 'lawda',
  'randi', 'r[a@]ndi', 'rand1',
  'harami', 'haramkhor', 'haram1',
  'kutt?a', 'kutt?i', 'kuttiya',
  'suar', 'su[a@]r', 'suwwar',
  'jhantu', 'jhant', 'jh[a@]nt',
  'tatt?i', 'tatti', 'tatt1',
  'gandu', 'g[a@]ndu',
  'bkl', 'bakl[a@]nd',
  'ch[o0]d', 'ch[o0]dna',
  'dalla', 'dall[a@]',
  'hijra', 'h1jra', 'hijda',
  'kamina', 'kam[i1]n[a@]', 'kameena',
  'badzaat', 'badz[a@][a@]t',
  'ullu',
  'gadha', 'gadh[a@]',
  'saala', 'saal[a@]', 's[a@]l[a@]',
  'haram',
];

// Build one big regex from all stems
// Stems are wrapped in word-ish boundaries (\b or start/end)
const BLOCKED_RE = new RegExp(
  BLOCKED.map((s) => `(?:${s})`).join('|'),
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
 * Returns `true` if the name contains profanity / vulgar content.
 */
export function isProfane(name: string): boolean {
  if (!name || name.trim().length === 0) return false;

  const raw = name.trim().toLowerCase();
  const normalized = normalize(name);

  // Check both raw (preserves spaces for multi-word stems) and normalized
  return BLOCKED_RE.test(raw) || BLOCKED_RE.test(normalized);
}
