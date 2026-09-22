import { articlePairs, plainSurface } from "./articlePairs";
import { englishFor, findCue } from "./signals";
import type { ParseFields, Word } from "./types";

const FIELD_ORDER: (keyof ParseFields)[] = [
  "pos",
  "case",
  "number",
  "gender",
  "tense",
  "voice",
  "mood",
  "person",
];

export type ChecklistLine = {
  wordId: string;
  surface: string;
  text: string;
};

/** What the gold parse commits the English to. Not a grade of the user's sentence. */
export function buildChecklist(words: Word[]): ChecklistLine[] {
  const cue = findCue(
    words,
    words.find((word) => word.parse?.mood === "subjunctive")?.parse
  );
  const pairs = articlePairs(words);
  const lines: ChecklistLine[] = [];
  for (const word of words) {
    if (!word.parse) continue;
    const pair = pairs.find((item) => item.articleId === word.id);
    if (pair && word.parse.pos === "article") {
      const head = words.find((item) => item.id === pair.headId);
      const features = [word.parse.case, word.parse.number, word.parse.gender].filter(Boolean).join(" ");
      lines.push({
        wordId: word.id,
        surface: word.surface,
        text: head
          ? `${plainSurface(word.surface)} with ${plainSurface(head.surface)}: ${features}, “the”.`
          : `${word.surface}, article: “the”.`,
      });
      continue;
    }
    for (const field of FIELD_ORDER) {
      const gold = word.parse[field];
      if (!gold) continue;
      const english = englishFor(field, gold, field === "mood" ? cue : undefined);
      lines.push({
        wordId: word.id,
        surface: word.surface,
        text: `${word.surface}, ${gold}: ${english}`,
      });
    }
  }
  return lines;
}
