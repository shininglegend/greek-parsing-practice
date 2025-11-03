import type { Verse, Word, ParseFields } from "./types";

// MorphGNT verse lookup + verse JSON.
// If the service is unavailable, a tiny fallback for Jn 1:1 is provided.
const BASE = "https://api.morphgnt.org";

async function fetchJSON<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json() as Promise<T>;
}

type MorphWord = {
  "@id"?: string;
  text: string;
  word?: string;
  crit_text?: string;
  lemma?: string;
  pos?: string;
  case?: string;
  number?: string;
  gender?: string;
  tense?: string;
  voice?: string;
  mood?: string;
  person?: string;
};

type MorphVerse = {
  "@id": string;
  title: string;
  words: MorphWord[];
};

type VerseLookupResponse = {
  verse_id: string;
};

// Map MorphGNT single-letter codes to our internal format
const POS_MAP: Record<string, string> = {
  'N': 'noun',
  'V': 'verb',
  'RA': 'article',
  'RD': 'pron',
  'RR': 'pron',
  'RP': 'pron',
  'P': 'prep',
  'C': 'conj',
  'D': 'adv',
  'A': 'adj',
  'I': 'interj',
  'X': 'part'
};

const CASE_MAP: Record<string, string> = {
  'N': 'nom',
  'G': 'gen',
  'D': 'dat',
  'A': 'acc',
  'V': 'voc'
};

const NUMBER_MAP: Record<string, string> = {
  'S': 'sg',
  'P': 'pl'
};

const GENDER_MAP: Record<string, string> = {
  'M': 'masc',
  'F': 'fem',
  'N': 'neut'
};

const TENSE_MAP: Record<string, string> = {
  'P': 'pres',
  'I': 'impf',
  'F': 'fut',
  'A': 'aor',
  'X': 'perf',
  'Y': 'plup'
};

const VOICE_MAP: Record<string, string> = {
  'A': 'act',
  'M': 'mid',
  'P': 'pass'
};

const MOOD_MAP: Record<string, string> = {
  'I': 'ind',
  'S': 'subj',
  'O': 'opt',
  'N': 'inf',
  'P': 'part',
  'M': 'impv'
};

function decodeParse(w: MorphWord): Partial<ParseFields> | undefined {
  const fields: Partial<ParseFields> = {};
  
  if (w.pos && POS_MAP[w.pos]) fields.pos = POS_MAP[w.pos];
  if (w.case && CASE_MAP[w.case]) fields.case = CASE_MAP[w.case];
  if (w.number && NUMBER_MAP[w.number]) fields.number = NUMBER_MAP[w.number];
  if (w.gender && GENDER_MAP[w.gender]) fields.gender = GENDER_MAP[w.gender];
  if (w.tense && TENSE_MAP[w.tense]) fields.tense = TENSE_MAP[w.tense];
  if (w.voice && VOICE_MAP[w.voice]) fields.voice = VOICE_MAP[w.voice];
  if (w.mood && MOOD_MAP[w.mood]) fields.mood = MOOD_MAP[w.mood];
  if (w.person) fields.person = w.person;
  
  return Object.keys(fields).length > 0 ? fields : undefined;
}

function mapVerse(mv: MorphVerse): Verse {
  const words: Word[] = mv.words.map((w, i) => ({
    surface: w.text || w.word || w.crit_text || "",
    lemma: w.lemma,
    parse: decodeParse(w),
    id: w["@id"] ?? `${mv["@id"]}-${i}`
  }));
  return { ref: mv.title, words };
}

export async function loadVerse(ref: string): Promise<Verse> {
  // 1) lookup verse id
  const q = encodeURIComponent(ref);
  try {
    const lookup = await fetchJSON<VerseLookupResponse>(`${BASE}/v0/verse-lookup/?${q}`);
    if (!lookup?.verse_id) throw new Error("verse id not found");
    
    // 2) fetch the actual verse data using the returned verse_id
    const verseUrl = `${BASE}${lookup.verse_id}`;
    const vjson = await fetchJSON<MorphVerse>(verseUrl);
    return mapVerse(vjson);
  } catch (err) {
    console.error("API fetch failed:", err);
    // fallback: Jn 1:2 minimal demo matching the structure from the API
    if (/^jn\s*1[:.]2$/i.test(ref) || /^john\s*1[:.]2$/i.test(ref)) {
      const fallback: MorphVerse = {
        "@id": "/v0/verse/640102.json",
        "title": "John 1.2",
        "words": [
          { text: "οὗτος", lemma: "οὗτος", pos: "RD", case: "N", number: "S", gender: "M" },
          { text: "ἦν", lemma: "εἰμί", pos: "V", person: "3", tense: "I", voice: "A", mood: "I", number: "S" },
          { text: "ἐν", lemma: "ἐν", pos: "P" },
          { text: "ἀρχῇ", lemma: "ἀρχή", pos: "N", case: "D", number: "S", gender: "F" },
          { text: "πρὸς", lemma: "πρός", pos: "P" },
          { text: "τὸν", lemma: "ὁ", pos: "RA", case: "A", number: "S", gender: "M" },
          { text: "θεόν", lemma: "θεός", pos: "N", case: "A", number: "S", gender: "M" }
        ]
      };
      return mapVerse(fallback);
    }
    throw new Error("Lookup failed");
  }
}
