import type { DrillAnswer } from "./types";

// This tab only. A reload keeps the study; another window starts fresh.
const STORAGE_KEY = "greekparser.progress";

const ANSWER_FIELDS = ["pos", "case", "number", "gender", "tense", "voice", "mood", "person"];

export type VerseProgress = {
  phase: "parse" | "translate";
  answers: Record<string, DrillAnswer>;
  selectedWordIds: string[];
  activeId: string | null;
  english: string;
  translateWordIds: string[];
  showCompare: boolean;
};

type Store = Record<string, VerseProgress>;

function box(storage?: Storage): Storage | null {
  if (storage) return storage;
  try {
    return sessionStorage;
  } catch {
    return null;
  }
}

function stringList(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) return null;
  return value;
}

function answersOf(value: unknown): Record<string, DrillAnswer> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const answers: Record<string, DrillAnswer> = {};
  for (const [wordId, fields] of Object.entries(value)) {
    if (!fields || typeof fields !== "object" || Array.isArray(fields)) return null;
    const answer: DrillAnswer = {};
    for (const [key, field] of Object.entries(fields)) {
      if (!ANSWER_FIELDS.includes(key) || typeof field !== "string") continue;
      answer[key] = field;
    }
    answers[wordId] = answer;
  }
  return answers;
}

function normalize(value: unknown): VerseProgress | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<VerseProgress>;
  if (record.phase !== "parse" && record.phase !== "translate") return null;
  const answers = answersOf(record.answers);
  const selectedWordIds = stringList(record.selectedWordIds);
  const translateWordIds = stringList(record.translateWordIds);
  if (!answers || !selectedWordIds || !translateWordIds) return null;
  if (record.activeId !== null && typeof record.activeId !== "string") return null;
  if (typeof record.english !== "string" || typeof record.showCompare !== "boolean") return null;
  return {
    phase: record.phase,
    answers,
    selectedWordIds,
    activeId: record.activeId,
    english: record.english,
    translateWordIds,
    showCompare: record.showCompare,
  };
}

export function readProgress(ref: string, storage?: Storage): VerseProgress | null {
  const store = box(storage);
  if (!store) return null;
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Store;
    return normalize(parsed[ref]);
  } catch {
    return null;
  }
}

export function writeProgress(ref: string, progress: VerseProgress, storage?: Storage): void {
  const store = box(storage);
  if (!store) return;
  try {
    const raw = store.getItem(STORAGE_KEY);
    const parsed: Store = raw ? (JSON.parse(raw) as Store) : {};
    parsed[ref] = progress;
    store.setItem(STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // Private mode or a full quota. The verse still works for this view.
  }
}

function keepKnown(ids: string[], allowed: Set<string>): { ids: string[]; stale: boolean } {
  const kept = ids.filter((id) => allowed.has(id));
  return { ids: kept, stale: ids.length > 0 && kept.length === 0 };
}

/** Saved progress for this verse, or a fresh parse of every word. */
export function progressForVerse(saved: VerseProgress | null, wordIds: string[]): VerseProgress {
  const fresh: VerseProgress = {
    phase: "parse",
    answers: {},
    selectedWordIds: wordIds,
    activeId: wordIds[0] ?? null,
    english: "",
    translateWordIds: wordIds,
    showCompare: false,
  };
  if (!saved) return fresh;
  const allowed = new Set(wordIds);
  const selected = keepKnown(saved.selectedWordIds, allowed);
  const translating = keepKnown(saved.translateWordIds, allowed);
  const selectedWordIds = selected.stale ? wordIds : selected.ids;
  const answers: Record<string, DrillAnswer> = {};
  for (const [wordId, answer] of Object.entries(saved.answers)) {
    if (allowed.has(wordId)) answers[wordId] = answer;
  }
  const activeId =
    saved.activeId && selectedWordIds.includes(saved.activeId)
      ? saved.activeId
      : (selectedWordIds[0] ?? null);
  return {
    phase: saved.phase,
    answers,
    selectedWordIds,
    activeId,
    english: saved.english,
    translateWordIds: translating.stale ? wordIds : translating.ids,
    showCompare: saved.showCompare,
  };
}
