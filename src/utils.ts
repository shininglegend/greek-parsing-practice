import type { FieldSpec, ParseFields } from "./types";

export const FIELD_SPECS: FieldSpec[] = [
  { key: "pos",    label: "Part of Speech", options: ["noun","verb","adj","adv","prep","pron","conj","part","article"] },
  { key: "case",   label: "Case",           options: ["nom","gen","dat","acc","voc","—"] },
  { key: "number", label: "Number",         options: ["sg","pl","—"] },
  { key: "gender", label: "Gender",         options: ["masc","fem","neut","—"] },
  { key: "tense",  label: "Tense",          options: ["pres","impf","fut","aor","perf","plup","—"] },
  { key: "voice",  label: "Voice",          options: ["act","mid","pass","mp","—"] },
  { key: "mood",   label: "Mood",           options: ["ind","impv","subj","opt","inf","part","—"] },
  { key: "person", label: "Person",         options: ["1","2","3","—"] },
];

export function normalizeMissing(v?: string): string | undefined {
  if (!v) return undefined;
  const s = v.trim().toLowerCase();
  if (["", "-", "—", "na", "none"].includes(s)) return undefined;
  return s;
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

export function formatRef(input: string) {
  return input.trim().replace(/\s+/g, " ");
}
