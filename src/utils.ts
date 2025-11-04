import type { FieldSpec, ParseFields } from "./types";

export const FIELD_SPECS: FieldSpec[] = [
  { key: "pos",    label: "Part of Speech", options: ["noun","verb","adjective","adverb","preposition","pronoun","conjunction","particle","article"] },
  { key: "case",   label: "Case",           options: ["nominative","genitive","dative","accusative","vocative","—"] },
  { key: "number", label: "Number",         options: ["singular","plural","—"] },
  { key: "gender", label: "Gender",         options: ["masculine","feminine","neuter","—"] },
  { key: "tense",  label: "Tense",          options: ["present","imperfect","future","aorist","perfect","pluperfect","—"] },
  { key: "voice",  label: "Voice",          options: ["active","middle","passive","middle/passive","—"] },
  { key: "mood",   label: "Mood",           options: ["indicative","imperative","subjunctive","optative","infinitive","participle","—"] },
  { key: "person", label: "Person",         options: ["first","second","third","—"] },
];

// Map short forms (from API) to long forms (for display/comparison)
const VALUE_NORMALIZATION: Record<string, string> = {
  // Part of speech
  'adj': 'adjective',
  'adv': 'adverb',
  'prep': 'preposition',
  'pron': 'pronoun',
  'conj': 'conjunction',
  'part': 'particle',
  // Case
  'nom': 'nominative',
  'gen': 'genitive',
  'dat': 'dative',
  'acc': 'accusative',
  'voc': 'vocative',
  // Number
  'sg': 'singular',
  'pl': 'plural',
  // Gender
  'masc': 'masculine',
  'fem': 'feminine',
  'neut': 'neuter',
  // Tense
  'pres': 'present',
  'impf': 'imperfect',
  'fut': 'future',
  'aor': 'aorist',
  'perf': 'perfect',
  'plup': 'pluperfect',
  // Voice
  'act': 'active',
  'mid': 'middle',
  'pass': 'passive',
  'mp': 'middle/passive',
  // Mood
  'ind': 'indicative',
  'impv': 'imperative',
  'subj': 'subjunctive',
  'opt': 'optative',
  'inf': 'infinitive',
  // Person
  '1': 'first',
  '2': 'second',
  '3': 'third',
};

export function normalizeMissing(v?: string): string | undefined {
  if (!v) return undefined;
  const s = v.trim().toLowerCase();
  if (["", "-", "—", "na", "none"].includes(s)) return undefined;
  // Normalize short forms to long forms
  return VALUE_NORMALIZATION[s] || s;
}

export function scoreParse(
  gold: ParseFields | undefined,
  guess: Partial<ParseFields>
) {
  let total = 0, correct = 0;
  const details: { key: keyof ParseFields; ok: boolean; gold?: string; guess?: string }[] = [];
  FIELD_SPECS.forEach(f => {
    const g = normalizeMissing(gold?.[f.key]);
    const u = normalizeMissing(guess[f.key]);
    if (g === undefined) return; // field not provided → ignore
    total += 1;
    const ok = g === u;
    if (ok) correct += 1;
    details.push({ key: f.key, ok, gold: g, guess: u });
  });
  return { correct, total, details };
}

// New Testament books in canonical order
export const NT_BOOKS = [
  { name: "Matthew", abbrev: "Mt" },
  { name: "Mark", abbrev: "Mk" },
  { name: "Luke", abbrev: "Lk" },
  { name: "John", abbrev: "Jn" },
  { name: "Acts", abbrev: "Acts" },
  { name: "Romans", abbrev: "Rom" },
  { name: "1 Corinthians", abbrev: "1Cor" },
  { name: "2 Corinthians", abbrev: "2Cor" },
  { name: "Galatians", abbrev: "Gal" },
  { name: "Ephesians", abbrev: "Eph" },
  { name: "Philippians", abbrev: "Phil" },
  { name: "Colossians", abbrev: "Col" },
  { name: "1 Thessalonians", abbrev: "1Thess" },
  { name: "2 Thessalonians", abbrev: "2Thess" },
  { name: "1 Timothy", abbrev: "1Tim" },
  { name: "2 Timothy", abbrev: "2Tim" },
  { name: "Titus", abbrev: "Titus" },
  { name: "Philemon", abbrev: "Phlm" },
  { name: "Hebrews", abbrev: "Heb" },
  { name: "James", abbrev: "Jas" },
  { name: "1 Peter", abbrev: "1Pet" },
  { name: "2 Peter", abbrev: "2Pet" },
  { name: "1 John", abbrev: "1Jn" },
  { name: "2 John", abbrev: "2Jn" },
  { name: "3 John", abbrev: "3Jn" },
  { name: "Jude", abbrev: "Jude" },
  { name: "Revelation", abbrev: "Rev" }
];

// Books with only one chapter (need to hardcode chapter 1)
const SINGLE_CHAPTER_BOOKS = ["Phlm", "2Jn", "3Jn", "Jude"];

export function formatRef(book: string, chapter: string, verse: string): string {
  const bookAbbrev = book.trim();
  let chap = chapter.trim();
  const v = verse.trim();
  
  // For single-chapter books, force chapter to be "1"
  if (SINGLE_CHAPTER_BOOKS.includes(bookAbbrev)) {
    chap = "1";
  }
  
  return `${bookAbbrev} ${chap}:${v}`;
}

// Define which fields are relevant for each part of speech
type FieldKey = keyof ParseFields;

export const RELEVANT_FIELDS: Record<string, FieldKey[]> = {
  noun: ["case", "number", "gender"],
  verb: ["tense", "voice", "mood", "person", "number"],
  adjective: ["case", "number", "gender"],
  pronoun: ["case", "number", "gender", "person"],
  article: ["case", "number", "gender"],
  participle: ["tense", "voice", "case", "number", "gender"],
  adverb: [],
  preposition: [],
  conjunction: [],
  particle: [],
};

export function isFieldRelevant(pos: string | undefined, field: FieldKey): boolean {
  if (!pos) return true; // Show all fields if no POS selected
  const normalized = normalizeMissing(pos);
  if (!normalized) return true;
  const relevantFields = RELEVANT_FIELDS[normalized];
  if (!relevantFields) return true; // Unknown POS, show all
  return relevantFields.includes(field);
}
