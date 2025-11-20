// Dodson Greek Lexicon integration - lazy loading by first letter

export type LexiconDefinition = {
  role: "brief" | "full";
  text: string;
};

export type LexiconEntry = {
  n: string;
  orth: string;
  definitions: LexiconDefinition[];
};

type LetterData = {
  letter: string;
  count: number;
  entries: LexiconEntry[];
};

// Cache fetched letter files to avoid redundant requests
const cache = new Map<string, LexiconEntry[]>();

const BASE_URL = "https://raw.githubusercontent.com/shininglegend/Dodson-Greek-Lexicon/refs/heads/master/split-json";

/**
 * Fetch lexicon data for a specific Greek letter
 */
async function fetchLetterData(letter: string): Promise<LexiconEntry[]> {
  if (cache.has(letter)) {
    return cache.get(letter)!;
  }

  try {
    const url = `${BASE_URL}/${encodeURIComponent(letter)}.json`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${letter}: ${response.statusText}`);
    }
    const data: LetterData = await response.json();
    cache.set(letter, data.entries);
    return data.entries;
  } catch (err) {
    console.error(`Error fetching lexicon for letter ${letter}:`, err);
    return [];
  }
}

/**
 * Get the first letter of a Greek word, normalized to lowercase and without diacritics
 */
function getFirstLetter(word: string): string {
  if (!word) return "";
  
  // Normalize to NFD (decomposed form) to separate base letter from diacritics
  const normalized = word[0].normalize("NFD");
  
  // Remove diacritical marks (accents, breathing marks, etc.)
  // Unicode ranges: combining diacritical marks
  const baseLetter = normalized.replace(/[\u0300-\u036f]/g, "");
  
  return baseLetter.toLowerCase();
}

/**
 * Look up lexicon entry for a lemma
 * Returns entry with brief and full definitions, or undefined if not found
 */
export async function lookupLemma(lemma: string): Promise<LexiconEntry | undefined> {
  if (!lemma) return undefined;

  const firstLetter = getFirstLetter(lemma);
  const entries = await fetchLetterData(firstLetter);

  // Strategy:
  // 1. Try exact match on the base orth (before comma)
  // 2. Try exact match on full orth
  // 3. Try prefix match only if lemma is longer than 2 characters (to avoid ὁ matching ὁμείρομαι)
  
  // First: exact match on base form (most common case)
  let entry = entries.find(e => {
    const orth = e.orth.split(",")[0].trim();
    return orth === lemma;
  });
  
  if (entry) return entry;
  
  // Second: exact match on full orth (handles cases like "ὁ, ἡ, τό")
  entry = entries.find(e => e.orth === lemma);
  
  if (entry) return entry;
  
  // Third: prefix match only for longer words (3+ chars) to avoid false matches
  if (lemma.length >= 3) {
    entry = entries.find(e => e.orth.startsWith(lemma));
  }
  
  // If still not found, return undefined (word may not be in lexicon)
  return entry;
}

/**
 * Get just the brief definition text for a lemma
 */
export async function getBriefDefinition(lemma: string): Promise<string | undefined> {
  const entry = await lookupLemma(lemma);
  return entry?.definitions.find(d => d.role === "brief")?.text;
}

/**
 * Get just the full definition text for a lemma
 */
export async function getFullDefinition(lemma: string): Promise<string | undefined> {
  const entry = await lookupLemma(lemma);
  return entry?.definitions.find(d => d.role === "full")?.text;
}

/**
 * Prefetch lexicon data for all lemmas in a list
 * Returns a map of lemma -> entry for quick lookup
 */
export async function prefetchLemmas(lemmas: string[]): Promise<Map<string, LexiconEntry>> {
  const uniqueLetters = new Set(lemmas.map(getFirstLetter).filter(Boolean));
  
  // Fetch all unique letters in parallel
  await Promise.all(Array.from(uniqueLetters).map(fetchLetterData));
  
  // Build map of lemma -> entry
  const result = new Map<string, LexiconEntry>();
  for (const lemma of lemmas) {
    const entry = await lookupLemma(lemma);
    if (entry) {
      result.set(lemma, entry);
    }
  }
  
  return result;
}
