import type { SignalExplanation } from "./signals";
import { foldGreek } from "./signals";
import type { ParseFields, Word } from "./types";
import { normalizeMissing } from "./utils";

const POSTPOSITIVES = new Set(["δε", "γαρ", "ουν", "μεν", "τε"]);

export type ArticlePair = {
  articleId: string;
  headId: string;
  from: number;
  to: number;
};

function agrees(article: Word, word: Word): boolean {
  for (const field of ["case", "number", "gender"] as const) {
    const left = normalizeMissing(article.parse?.[field]);
    const right = normalizeMissing(word.parse?.[field]);
    if (!left || !right || left !== right) return false;
  }
  return true;
}

function isArticle(word: Word): boolean {
  if (word.parse?.pos !== "article") return false;
  if (!word.lemma) return true;
  return foldGreek(word.lemma) === "ο";
}

function isPostpositive(word: Word): boolean {
  const lemma = word.lemma ? foldGreek(word.lemma) : foldGreek(word.surface);
  return POSTPOSITIVES.has(lemma);
}

function isModifier(word: Word): boolean {
  if (word.parse?.pos === "adjective") return true;
  return word.parse?.pos === "verb" && word.parse.mood === "participle";
}

/** Article ὁ with the noun it agrees with. Adjectives and participles can be the head when no noun follows. */
export function articlePairs(words: Word[]): ArticlePair[] {
  const pairs: ArticlePair[] = [];
  const usedHeads = new Set<string>();

  for (let i = 0; i < words.length; i++) {
    const article = words[i];
    if (!isArticle(article)) continue;

    let modifierHead: number | null = null;
    for (let j = i + 1; j < words.length; j++) {
      const word = words[j];
      if (isPostpositive(word)) continue;
      if (!agrees(article, word)) break;

      if (word.parse?.pos === "noun" && !usedHeads.has(word.id)) {
        pairs.push({ articleId: article.id, headId: word.id, from: i, to: j });
        usedHeads.add(word.id);
        modifierHead = null;
        break;
      }
      if (isModifier(word)) {
        if (modifierHead === null && !usedHeads.has(word.id)) modifierHead = j;
        continue;
      }
      break;
    }

    if (modifierHead !== null) {
      const head = words[modifierHead];
      pairs.push({ articleId: article.id, headId: head.id, from: i, to: modifierHead });
      usedHeads.add(head.id);
    }
  }

  return pairs;
}

export type VerseSegment =
  | { kind: "word"; word: Word }
  | { kind: "pair"; pair: ArticlePair; words: Word[] };

export function verseSegments(words: Word[], pairs: ArticlePair[]): VerseSegment[] {
  const byStart = new Map(pairs.map((pair) => [pair.from, pair]));
  const segments: VerseSegment[] = [];
  let index = 0;
  while (index < words.length) {
    const pair = byStart.get(index);
    if (pair) {
      segments.push({ kind: "pair", pair, words: words.slice(pair.from, pair.to + 1) });
      index = pair.to + 1;
    } else {
      segments.push({ kind: "word", word: words[index] });
      index += 1;
    }
  }
  return segments;
}

export function agreementFill(word: Word, words: Word[]): Pick<ParseFields, "case" | "number" | "gender"> | undefined {
  const pair = articlePairs(words).find((item) => item.articleId === word.id);
  if (!pair) return undefined;
  const parsed = word.parse;
  if (!parsed?.case || !parsed.number || !parsed.gender) return undefined;
  return { case: parsed.case, number: parsed.number, gender: parsed.gender };
}

export function plainSurface(surface: string): string {
  return surface.replace(/[\s,.;:·]+$/u, "");
}

const NOMINAL = ["case", "number", "gender"] as const;

export function nominalFeatures(word: Word): string {
  return NOMINAL.map((field) => word.parse?.[field]).filter(Boolean).join(" ");
}

/** Case, number, and gender of the head are known only after the student has parsed them. */
export function headNominalKnown(head: Word, answer: Partial<ParseFields> | undefined): boolean {
  return NOMINAL.every((field) => {
    const gold = normalizeMissing(head.parse?.[field]);
    if (!gold) return true;
    return normalizeMissing(answer?.[field]) === gold;
  });
}

export function explainAgreement(article: Word, head: Word, revealFeatures: boolean): SignalExplanation {
  const headSurface = plainSurface(head.surface);
  const features = nominalFeatures(article);
  return {
    title: `Agrees with ${headSurface}`,
    contrast: revealFeatures
      ? `${plainSurface(article.surface)} matches ${headSurface}: ${features}.`
      : `${plainSurface(article.surface)} belongs with ${headSurface}. Parse that word, and this article matches it.`,
    evidence: [
      "An article takes the case, number, and gender of the word it belongs with. Those three are not a second noun to parse.",
    ],
    english: `“the” with ${headSurface}.`,
    chartKey: "article",
    chartLabel: "Article",
    irregular: false,
  };
}
