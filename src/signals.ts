import { GRAMMAR_DEFINITIONS } from "./data/grammarDefinitions";
import { MORPHOLOGY_CHARTS } from "./data/morphologyCharts";
import type { ParseFields } from "./types";

export type ChartKey = keyof typeof MORPHOLOGY_CHARTS;

export type SignalExplanation = {
  title: string;
  contrast: string;
  evidence: string[];
  english: string;
  grammar?: { term: string; definition: string; example?: string };
  chartKey?: ChartKey;
  chartLabel?: string;
  cue?: string;
  irregular: boolean;
};

type Cue = {
  folded: string;
  display: string;
  note: string;
  /** Only treat this cue as evidence when the gold parse matches. */
  when?: (parse: ParseFields) => boolean;
};

const SUBJUNCTIVE_CUES: Cue[] = [
  {
    folded: "ινα",
    display: "ἵνα",
    note: "After ἵνα this is usually “so that” or “in order that,” not a flat statement.",
  },
  {
    folded: "οπως",
    display: "ὅπως",
    note: "ὅπως with the subjunctive usually marks purpose.",
  },
  {
    folded: "εαν",
    display: "ἐάν",
    note: "ἐάν with the subjunctive is a condition (“if”), not a plain assertion.",
  },
  {
    folded: "οταν",
    display: "ὅταν",
    note: "ὅταν with the subjunctive is “whenever,” an indefinite time.",
  },
  {
    folded: "εως",
    display: "ἕως",
    note: "ἕως with the subjunctive is “until,” looking forward rather than stating a fact.",
  },
  {
    folded: "μη",
    display: "μή",
    note: "μή with an aorist subjunctive is often a prohibition (“do not…”), not a statement with οὐ.",
    when: (parse) => parse.mood === "subjunctive" && parse.tense === "aorist",
  },
];

const IRREGULAR_LEMMAS = new Set([
  "ειμι",
  "οιδα",
  "φημι",
  "ειπον",
  "ερχομαι",
  "διδωμι",
  "τιθημι",
  "ιστημι",
  "ιημι",
]);

const FIELD_LABEL: Record<string, string> = {
  pos: "Part of speech",
  case: "Case",
  number: "Number",
  gender: "Gender",
  tense: "Tense",
  voice: "Voice",
  mood: "Mood",
  person: "Person",
};

const GRAMMAR_SECTION: Record<string, keyof typeof GRAMMAR_DEFINITIONS> = {
  pos: "partOfSpeech",
  case: "case",
  number: "number",
  gender: "gender",
  tense: "tense",
  voice: "voice",
  mood: "mood",
  person: "person",
};

/** English job of a parse value. Shown on misses and on the translation checklist. */
export const ENGLISH_CONSEQUENCE: Record<string, Record<string, string>> = {
  case: {
    nominative: "usually the subject, or a predicate noun",
    genitive: "often “of,” or possession",
    dative: "often “to,” “for,” “in,” or “by”",
    accusative: "often the direct object, or motion toward",
    vocative: "direct address",
  },
  number: {
    singular: "one",
    plural: "more than one",
  },
  gender: {
    masculine: "agrees with a masculine noun",
    feminine: "agrees with a feminine noun",
    neuter: "agrees with a neuter noun",
  },
  tense: {
    present: "ongoing or unmarked time, often present in English",
    imperfect: "ongoing or repeated action in the past",
    future: "later time",
    aorist: "a simple or whole action, often a simple past in narrative",
    perfect: "a state resulting from a completed action",
    pluperfect: "a resulting state already in place in the past",
  },
  voice: {
    active: "the subject performs the action",
    middle: "the subject is involved in the action; English often flattens this",
    passive: "the subject receives the action",
    "middle/passive": "the form is middle or passive; context decides which",
  },
  mood: {
    indicative: "a statement or a question presented as actual",
    imperative: "a command or request",
    subjunctive: "possibility, purpose, or exhortation — often “might,” “should,” or “so that”",
    optative: "a wish, or a more remote possibility",
    infinitive: "“to …” — a verbal noun, not the main finite verb",
    participle: "an -ing form that still has tense and voice, and agrees like an adjective",
  },
  person: {
    first: "“I” or “we”",
    second: "“you”",
    third: "“he,” “she,” “it,” or “they”",
  },
  pos: {
    noun: "a person, place, thing, or idea",
    verb: "an action or state",
    adjective: "describes a noun and agrees with it",
    adverb: "modifies a verb, adjective, or adverb; usually uninflected",
    preposition: "relates a noun to the rest of the clause and governs a case",
    pronoun: "stands in for a noun",
    conjunction: "connects words or clauses",
    particle: "a small uninflected word that shades the clause",
    article: "“the,” agreeing in case, number, and gender",
  },
};

export function foldGreek(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ς/g, "σ")
    .toLowerCase();
}

export function findCue(
  words: { surface: string }[],
  parse: ParseFields | undefined
): Cue | undefined {
  if (!parse || parse.mood !== "subjunctive") return undefined;
  for (const cue of SUBJUNCTIVE_CUES) {
    if (cue.when && !cue.when(parse)) continue;
    const hit = words.some((word) => foldGreek(word.surface) === cue.folded);
    if (hit) return cue;
  }
  return undefined;
}

export function englishFor(
  field: string,
  gold: string,
  cue?: Cue
): string {
  if (field === "mood" && gold === "subjunctive" && cue) return cue.note;
  return ENGLISH_CONSEQUENCE[field]?.[gold] ?? `This value is ${gold}.`;
}

function grammarFor(field: string, gold: string) {
  const sectionKey = GRAMMAR_SECTION[field];
  if (!sectionKey) return undefined;
  const section = GRAMMAR_DEFINITIONS[sectionKey];
  const goldKey = gold.toLowerCase();
  const item = section.items.find((entry) => {
    const term = entry.term.toLowerCase();
    return term === goldKey || term.startsWith(`${goldKey} `);
  });
  if (!item) return undefined;
  return { term: item.term, definition: item.definition, example: item.example };
}

function chartFor(
  field: string,
  gold: string,
  parse: ParseFields | undefined
): { key: ChartKey; label: string } | undefined {
  const pos = parse?.pos;
  if (pos === "article" || gold === "article") {
    return { key: "article", label: "Article" };
  }
  if (field === "voice" && (gold === "middle" || gold === "passive" || gold === "middle/passive")) {
    return { key: "middlePassive", label: "Middle/Passive" };
  }
  if (field === "case" || field === "number" || field === "gender") {
    if (pos === "noun" || pos === "adjective" || pos === "pronoun") {
      return { key: "secondDeclension", label: "2nd declension (a sample paradigm)" };
    }
  }
  const tense = field === "tense" ? gold : parse?.tense;
  if (pos === "verb" || field === "tense" || field === "mood" || field === "voice" || field === "person") {
    if (tense === "imperfect") return { key: "imperfectActive", label: "Imperfect active" };
    if (tense === "future") return { key: "futureActive", label: "Future active" };
    if (tense === "aorist") return { key: "aoristActive", label: "Aorist active" };
    if (tense === "perfect" || tense === "pluperfect") {
      return { key: "perfectActive", label: "Perfect active" };
    }
    if (tense === "present" || field === "mood" || field === "person") {
      return { key: "presentActive", label: "Present active" };
    }
  }
  return undefined;
}

function pairEvidence(
  field: string,
  guess: string,
  gold: string,
  surface: string,
  parse: ParseFields | undefined
): string[] {
  const lines: string[] = [];
  const pair = `${guess}>${gold}`;

  if (field === "mood" && (gold === "subjunctive" || guess === "subjunctive")) {
    lines.push(
      "Thematic subjunctives lengthen the connecting vowel: indicative ο/ε becomes subjunctive ω/η."
    );
    if (gold === "subjunctive") {
      const ending = foldGreek(surface).slice(-4);
      if (/[ηω]/.test(ending)) {
        lines.push("This form shows that lengthened vowel.");
      }
    }
  }

  if (field === "tense" && (pair === "imperfect>aorist" || pair === "aorist>imperfect")) {
    lines.push(
      "Both can be past. The imperfect is ongoing or repeated; the aorist is a simple whole. The stem and ending distinguish them. An augment (ἐ-) is common to both."
    );
  }

  if (field === "voice" && (gold === "middle" || gold === "passive" || guess === "middle" || guess === "passive")) {
    lines.push(
      "In the present, imperfect, and perfect, middle and passive endings often look the same. The difference is what the subject is doing."
    );
  }

  if (field === "case" && ((guess === "genitive" && gold === "dative") || (guess === "dative" && gold === "genitive"))) {
    lines.push(
      "Genitive singular often ends in -ου, -ς, or -ος. Dative singular often ends in -ι or -ῳ (an iota)."
    );
  }

  if (field === "mood" && (gold === "participle" || guess === "participle")) {
    lines.push(
      "A participle has case, number, and gender, and no person. A finite verb has person and can be the main verb of the clause."
    );
  }

  if (field === "mood" && (gold === "infinitive" || guess === "infinitive")) {
    lines.push(
      "An infinitive does not take person or, usually, number. It behaves as “to …,” not as “he does.”"
    );
  }

  if (parse?.mood === "participle" && (field === "case" || field === "gender" || field === "number")) {
    lines.push("This is a participle, so it agrees like an adjective: case, number, and gender.");
  }

  return lines;
}

export function explainMiss(input: {
  surface: string;
  lemma?: string;
  field: keyof ParseFields;
  guess: string;
  gold: string;
  parse?: ParseFields;
  verseWords: { surface: string }[];
}): SignalExplanation {
  const { surface, lemma, field, guess, gold, parse, verseWords } = input;
  const cue = findCue(verseWords, { ...parse, [field]: gold });
  const irregular = lemma ? IRREGULAR_LEMMAS.has(foldGreek(lemma)) : false;
  const label = FIELD_LABEL[field] ?? field;
  const evidence = pairEvidence(field, guess, gold, surface, parse);
  if (cue && field === "mood") {
    evidence.unshift(`${cue.display} in this verse is a signal for the subjunctive.`);
  }
  if (irregular) {
    evidence.push(
      `${lemma} is irregular, so a regular ending chart may not match this form. The parse still stands.`
    );
  }
  if (evidence.length === 0) {
    evidence.push(`Compare this form with the ${gold} paradigm, not the ${guess} one.`);
  }

  const chart = chartFor(field, gold, parse);
  return {
    title: `${label}: ${gold}`,
    contrast: `You chose ${guess}. This form is ${gold}.`,
    evidence,
    english: englishFor(field, gold, field === "mood" ? cue : undefined),
    grammar: grammarFor(field, gold),
    chartKey: chart?.key,
    chartLabel: chart?.label,
    cue: cue?.display,
    irregular,
  };
}

/** Same teaching note for a correct field, without the contrast of a wrong guess. */
export function explainCorrect(input: {
  surface: string;
  lemma?: string;
  field: keyof ParseFields;
  gold: string;
  parse?: ParseFields;
  verseWords: { surface: string }[];
}): SignalExplanation {
  const note = explainMiss({ ...input, guess: input.gold });
  const evidence = note.evidence.filter(
    (line) => !line.startsWith("Compare this form with the")
  );
  return {
    ...note,
    contrast: `This form is ${input.gold}.`,
    evidence: evidence.length > 0 ? evidence : ["The form and the clause around it are the signal."],
  };
}
