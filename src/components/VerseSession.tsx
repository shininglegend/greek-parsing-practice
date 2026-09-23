import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { loadVerse } from "../api";
import {
  agreementFill,
  articlePairs,
  explainAgreement,
  headNominalKnown,
  nominalFeatures,
  plainSurface,
  verseSegments,
} from "../articlePairs";
import { type LexiconEntry, prefetchLemmas } from "../lexicon";
import { useSession } from "../session";
import {
  explainCorrect,
  explainMiss,
  fieldsToExplain,
  findCue,
  foldGreek,
  type SignalExplanation,
} from "../signals";
import { ApiError, askTutor, recordAttempt } from "../studyApi";
import type { DrillAnswer, ParseFields, Verse, Word } from "../types";
import {
  celebrateWithConfetti,
  FIELD_SPECS,
  formatRef,
  isFieldRelevant,
  NT_BOOKS,
  normalizeMissing,
  scoreParse,
} from "../utils";
import { progressForVerse, readProgress, writeProgress } from "../verseProgress";
import { Footer, Header, Modal, VerseSelector } from "./";
import { SignalCard } from "./SignalCard";
import { TranslateStep } from "./TranslateStep";

type LoadState =
  | { kind: "idle" }
  | { kind: "loading"; ref: string }
  | { kind: "loaded"; verse: Verse }
  | { kind: "error"; msg: string };

const VERSE_KEY = "greekparser.verse";

function parseRef(ref: string | null | undefined) {
  const normalized = ref?.trim().replace(/(\d)\.(\d+)$/, "$1:$2");
  const match = normalized?.match(/^(.+)\s+(\d+):(\d+)$/);
  if (!match) return null;
  const book =
    NT_BOOKS.find((entry) => entry.abbrev === match[1] || entry.name === match[1])?.abbrev ?? null;
  if (!book) return null;
  return { book, chapter: match[2], verse: match[3] };
}

function savedRef() {
  try {
    return parseRef(localStorage.getItem(VERSE_KEY));
  } catch {
    return null;
  }
}

function initialRef(search: string) {
  const ref = new URLSearchParams(search).get("ref");
  if (ref) return parseRef(ref) ?? { book: "Jn", chapter: "1", verse: "1" };
  return savedRef() ?? { book: "Jn", chapter: "1", verse: "1" };
}

const PARSE_KEYS: (keyof ParseFields)[] = [
  "pos",
  "case",
  "number",
  "gender",
  "tense",
  "voice",
  "mood",
  "person",
];

// Surface + gold parse fields so the tutor can cite agreement partners.
function formatVerseParses(words: Word[]): string {
  return words
    .map((word) => {
      const parts = PARSE_KEYS.flatMap((key) => {
        const value = word.parse?.[key];
        return value ? [`${key}: ${value}`] : [];
      });
      return parts.length > 0 ? `${word.surface} (${parts.join("; ")})` : word.surface;
    })
    .join(" ");
}

function visibleFields(word: Word, answer: DrillAnswer | undefined, pairedArticle: boolean) {
  const goldPos = normalizeMissing(word.parse?.pos);
  const selectedPos = normalizeMissing(answer?.pos);
  const posCorrect = Boolean(selectedPos && goldPos && selectedPos === goldPos);
  return FIELD_SPECS.filter((spec) => {
    if (!normalizeMissing(word.parse?.[spec.key])) return false;
    if (spec.key === "pos") return true;
    if (pairedArticle) return false;
    if (!posCorrect) return false;
    return isFieldRelevant(selectedPos, spec.key, answer ?? {});
  });
}

function signalText(note: SignalExplanation) {
  return [note.title, note.contrast, ...note.evidence, note.english, note.grammar?.definition]
    .filter(Boolean)
    .join("\n");
}

function wordParsed(word: Word, answer: DrillAnswer | undefined, pairedArticle: boolean): boolean {
  const fields = visibleFields(word, answer, pairedArticle);
  if (fields.length === 0) return false;
  return fields.every((field) => {
    const gold = normalizeMissing(word.parse?.[field.key]);
    const guess = normalizeMissing(answer?.[field.key]);
    return Boolean(gold && guess && gold === guess);
  });
}

function WordButton({
  word,
  active,
  selected,
  parsed,
  marked,
  onSelect,
}: {
  word: Word;
  active: boolean;
  selected: boolean;
  parsed: boolean;
  marked: boolean;
  onSelect: () => void;
}) {
  const tone = active
    ? parsed
      ? "bg-green-700 text-white"
      : "bg-slate-900 text-white"
    : parsed
      ? "text-green-900"
      : selected
        ? "text-slate-900"
        : "text-slate-400";
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`px-1 rounded-md ${tone} ${marked ? "underline decoration-amber-500 decoration-2" : ""}`}
    >
      {word.surface}
    </button>
  );
}

export function VerseSession() {
  const { user } = useSession();
  const [params, setSearchParams] = useSearchParams();
  const start = initialRef(params.toString());
  const [selectedBook, setSelectedBook] = useState(start.book);
  const [chapter, setChapter] = useState(start.chapter);
  const [verseNum, setVerseNum] = useState(start.verse);
  const [state, setState] = useState<LoadState>({ kind: "idle" });
  const [answers, setAnswers] = useState<Record<string, DrillAnswer>>({});
  const [selectedWordIds, setSelectedWordIds] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [phase, setPhase] = useState<"parse" | "translate">("parse");
  const [english, setEnglish] = useState("");
  const [translateWordIds, setTranslateWordIds] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [miss, setMiss] = useState<{ field: keyof ParseFields; priorMisses: number } | null>(null);
  const [whyOpen, setWhyOpen] = useState(false);
  const [definitionWord, setDefinitionWord] = useState<Word | null>(null);
  const [glossWordId, setGlossWordId] = useState<string | null>(null);
  const [tutorReply, setTutorReply] = useState<string | null>(null);
  const [tutorError, setTutorError] = useState<string | null>(null);
  const [tutorLoading, setTutorLoading] = useState(false);
  const confettiTriggered = useRef(false);
  const restoredProgress = useRef(false);
  const verseData = state.kind === "loaded" ? state.verse : undefined;
  const pairs = useMemo(() => articlePairs(verseData?.words ?? []), [verseData]);

  async function loadRef(book: string, chap: string, verse: string) {
    const formatted = formatRef(book, chap, verse);
    setState({ kind: "loading", ref: formatted });
    setMiss(null);
    setWhyOpen(false);
    setTutorReply(null);
    confettiTriggered.current = false;
    try {
      const loaded = await loadVerse(formatted);
      const lemmas = loaded.words.map((word) => word.lemma).filter(Boolean) as string[];
      const lexicon = await prefetchLemmas(lemmas).catch(() => new Map<string, LexiconEntry>());
      const withGlosses: Verse = {
        ...loaded,
        words: loaded.words.map((word) => {
          if (!word.lemma) return word;
          const entry = lexicon.get(word.lemma);
          if (!entry) return word;
          return {
            ...word,
            definition: {
              brief: entry.definitions.find((item) => item.role === "brief")?.text,
              full: entry.definitions.find((item) => item.role === "full")?.text,
            },
          };
        }),
      };
      const saved = readProgress(withGlosses.ref);
      const progress = progressForVerse(
        saved,
        withGlosses.words.map((word) => word.id)
      );
      restoredProgress.current = saved !== null;
      setState({ kind: "loaded", verse: withGlosses });
      setAnswers(progress.answers);
      setSelectedWordIds(new Set(progress.selectedWordIds));
      setActiveId(progress.activeId);
      setPhase(progress.phase);
      setEnglish(progress.english);
      setTranslateWordIds(progress.translateWordIds);
      setShowCompare(progress.showCompare);
      try {
        localStorage.setItem(VERSE_KEY, formatted);
      } catch {
        // Private mode can reject storage; the URL still keeps the verse.
      }
      if (params.get("ref") !== formatted) {
        setSearchParams({ ref: formatted }, { replace: true });
      }
    } catch (error) {
      setState({
        kind: "error",
        msg: error instanceof Error ? error.message : "error",
      });
    }
  }

  // Load the verse from the URL once. Later loads go through the selector.
  const loadInitial = useEffectEvent(() => {
    loadRef(start.book, start.chapter, start.verse);
  });
  useEffect(() => {
    loadInitial();
  }, []);

  const wordsToShow = verseData?.words.filter((word) => selectedWordIds.has(word.id)) ?? [];
  const active = wordsToShow.find((word) => word.id === activeId) ?? wordsToShow[0];
  const activeIndex = active ? wordsToShow.findIndex((word) => word.id === active.id) : -1;

  const allFilled =
    wordsToShow.length > 0 &&
    wordsToShow.every((word) => {
      const goldPos = normalizeMissing(word.parse?.pos);
      const selectedPos = normalizeMissing(answers[word.id]?.pos);
      if (goldPos && selectedPos !== goldPos) return false;
      const fields = visibleFields(
        word,
        answers[word.id],
        pairs.some((pair) => pair.articleId === word.id)
      );
      if (fields.length === 0) return !word.parse;
      return fields.every((field) => normalizeMissing(answers[word.id]?.[field.key]));
    });

  const attempted = wordsToShow.some((word) =>
    Object.values(answers[word.id] ?? {}).some((value) => normalizeMissing(value))
  );

  useEffect(() => {
    if (restoredProgress.current) {
      restoredProgress.current = false;
      if (allFilled && attempted) confettiTriggered.current = true;
      return;
    }
    if (!allFilled || !attempted || confettiTriggered.current) return;
    celebrateWithConfetti();
    confettiTriggered.current = true;
  }, [allFilled, attempted]);

  useEffect(() => {
    if (!verseData) return;
    writeProgress(verseData.ref, {
      phase,
      answers,
      selectedWordIds: [...selectedWordIds],
      activeId,
      english,
      translateWordIds,
      showCompare,
    });
  }, [
    verseData,
    phase,
    answers,
    selectedWordIds,
    activeId,
    english,
    translateWordIds,
    showCompare,
  ]);

  const cueDisplay = active ? findCue(verseData?.words ?? [], active.parse)?.display : undefined;

  const note = useMemo(() => {
    if (!active || !verseData) return null;
    if (miss?.field) {
      const guess = normalizeMissing(answers[active.id]?.[miss.field]);
      const gold = normalizeMissing(active.parse?.[miss.field]);
      if (!guess || !gold || guess === gold) return null;
      return explainMiss({
        surface: active.surface,
        lemma: active.lemma,
        field: miss.field,
        guess,
        gold,
        parse: active.parse,
        verseWords: verseData.words,
      });
    }
    return null;
  }, [active, answers, miss, verseData]);

  const correctNotes = useMemo(() => {
    if (!active || !verseData || !whyOpen) return [];
    const pair = pairs.find((item) => item.articleId === active.id);
    const head = pair ? verseData.words.find((word) => word.id === pair.headId) : undefined;
    const posGuess = normalizeMissing(answers[active.id]?.pos);
    const posGold = normalizeMissing(active.parse?.pos);
    if (pair && head && posGuess === "article" && posGold === "article") {
      return [explainAgreement(active, head, headNominalKnown(head, answers[head.id]))];
    }
    const visible = visibleFields(active, answers[active.id], Boolean(pair));
    const explained = fieldsToExplain(visible, (field) => {
      const guess = normalizeMissing(answers[active.id]?.[field.key]);
      const gold = normalizeMissing(active.parse?.[field.key]);
      return Boolean(guess && gold && guess === gold);
    });
    return explained.flatMap((field) => {
      const gold = normalizeMissing(active.parse?.[field.key]);
      if (!gold) return [];
      return [
        explainCorrect({
          surface: active.surface,
          lemma: active.lemma,
          field: field.key,
          gold,
          parse: active.parse,
          verseWords: verseData.words,
        }),
      ];
    });
  }, [active, answers, verseData, whyOpen, pairs]);

  async function choose(word: Word, field: keyof ParseFields, value: string) {
    if (answers[word.id]?.[field] === value) return;
    const gold = normalizeMissing(word.parse?.[field]);
    const guess = normalizeMissing(value);
    const fill =
      field === "pos" && guess === gold && gold === "article" && verseData
        ? agreementFill(word, verseData.words)
        : undefined;
    setAnswers((prev) => ({
      ...prev,
      [word.id]: { ...prev[word.id], [field]: value, ...fill },
    }));
    setWhyOpen(false);
    setTutorReply(null);
    if (!gold || !guess || !verseData || !user) {
      if (gold && guess && guess !== gold) setMiss({ field, priorMisses: 0 });
      else setMiss(null);
      return;
    }
    const cue = field === "mood" ? findCue(verseData.words, word.parse)?.display : undefined;
    try {
      const result = await recordAttempt({
        verseRef: verseData.ref,
        wordId: word.id,
        surface: word.surface,
        lemma: word.lemma,
        field,
        guess,
        gold,
        cue,
      });
      setMiss(guess === gold ? null : { field, priorMisses: result.priorMisses });
    } catch {
      setMiss(guess === gold ? null : { field, priorMisses: 0 });
    }
  }

  async function explainFurther() {
    if (!note || !active || !verseData) return;
    await askAbout(note, {
      gold: `${miss?.field}: ${normalizeMissing(active.parse?.[miss?.field ?? "pos"])}`,
      guess: `${miss?.field}: ${normalizeMissing(answers[active.id]?.[miss?.field ?? "pos"])}`,
    });
  }

  async function explainWhole() {
    if (!active || !verseData || correctNotes.length === 0) return;
    const parse = correctNotes.map((item) => item.title).join("; ");
    await askAbout(correctNotes, { gold: parse, guess: parse, whole: true });
  }

  async function askAbout(
    notes: SignalExplanation | SignalExplanation[],
    extra: { gold: string; guess: string; whole?: boolean }
  ) {
    if (!active || !verseData) return;
    const cards = Array.isArray(notes) ? notes : [notes];
    setTutorLoading(true);
    setTutorError(null);
    try {
      const result = await askTutor("/api/explain", {
        verseRef: verseData.ref,
        surface: active.surface,
        lemma: active.lemma,
        gold: extra.gold,
        guess: extra.guess,
        whole: extra.whole ?? false,
        verseParses: formatVerseParses(verseData.words),
        signal: cards.map(signalText).join("\n\n"),
      });
      setTutorReply(result.reply);
    } catch (error) {
      setTutorError(error instanceof ApiError ? error.message : "The tutor could not answer.");
    } finally {
      setTutorLoading(false);
    }
  }

  const approved = user?.status === "approved" || user?.role === "admin";
  const score = wordsToShow.reduce(
    (sum, word) => {
      const parsed = scoreParse(word.parse, answers[word.id] ?? {});
      return { correct: sum.correct + parsed.correct, total: sum.total + parsed.total };
    },
    { correct: 0, total: 0 }
  );

  function showWord(index: number) {
    setMiss(null);
    setActiveId(wordsToShow[index]?.id ?? null);
  }

  function selectWord(wordId: string) {
    setActiveId(wordId);
    setSelectedWordIds((prev) => new Set(prev).add(wordId));
    setMiss(null);
    setPhase("parse");
  }

  const activePair = active ? pairs.find((pair) => pair.articleId === active.id) : undefined;
  const activeHead = activePair
    ? verseData?.words.find((word) => word.id === activePair.headId)
    : undefined;
  const articleAgreed = Boolean(
    active &&
      activeHead &&
      normalizeMissing(answers[active.id]?.pos) === "article" &&
      normalizeMissing(active.parse?.pos) === "article"
  );
  const showAgreementFeatures = Boolean(
    activeHead && headNominalKnown(activeHead, answers[activeHead.id])
  );

  return (
    <>
      <Header />
      <div className="w-full p-4 pb-36 space-y-4">
        <VerseSelector
          selectedBook={selectedBook}
          chapter={chapter}
          verse={verseNum}
          onBookChange={setSelectedBook}
          onChapterChange={setChapter}
          onVerseChange={setVerseNum}
          onLoad={() => loadRef(selectedBook, chapter, verseNum)}
          surfaceLine=""
          hideSurface
          loading={state.kind === "loading"}
          error={state.kind === "error" ? state.msg : undefined}
          onNavigate={(direction) => {
            const current = parseInt(verseNum, 10);
            if (Number.isNaN(current)) return;
            const next = direction === "prev" ? current - 1 : current + 1;
            if (next < 1) return;
            setVerseNum(String(next));
            loadRef(selectedBook, chapter, String(next));
          }}
        />

        {verseData && phase === "parse" && (
          <>
            <div className="font-greek text-2xl leading-relaxed mx-auto flex w-fit max-w-full flex-wrap items-baseline gap-x-3 gap-y-3">
              {verseSegments(verseData.words, pairs).map((segment) => {
                if (segment.kind === "pair") {
                  const head = verseData.words.find((word) => word.id === segment.pair.headId);
                  return (
                    <span
                      key={segment.pair.articleId}
                      title={head ? `Agrees with ${plainSurface(head.surface)}` : undefined}
                      className="inline-flex items-baseline gap-x-1 rounded-full border border-sky-400 px-[1.5px] py-px"
                    >
                      {segment.words.map((word) => (
                        <WordButton
                          key={word.id}
                          word={word}
                          active={word.id === active?.id}
                          selected={selectedWordIds.has(word.id)}
                          parsed={wordParsed(
                            word,
                            answers[word.id],
                            word.id === segment.pair.articleId
                          )}
                          marked={Boolean(
                            cueDisplay && foldGreek(word.surface) === foldGreek(cueDisplay) && note
                          )}
                          onSelect={() => selectWord(word.id)}
                        />
                      ))}
                    </span>
                  );
                }
                return (
                  <WordButton
                    key={segment.word.id}
                    word={segment.word}
                    active={segment.word.id === active?.id}
                    selected={selectedWordIds.has(segment.word.id)}
                    parsed={wordParsed(
                      segment.word,
                      answers[segment.word.id],
                      pairs.some((pair) => pair.articleId === segment.word.id)
                    )}
                    marked={Boolean(
                      cueDisplay &&
                        foldGreek(segment.word.surface) === foldGreek(cueDisplay) &&
                        note
                    )}
                    onSelect={() => selectWord(segment.word.id)}
                  />
                );
              })}
            </div>

            {active ? (
              <>
                <div className="card mx-auto w-fit max-w-full space-y-2 p-3">
                  {active.definition?.brief ? (
                    <div className="flex w-full items-baseline justify-between gap-3">
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 cursor-pointer items-baseline justify-between gap-3 text-left"
                        aria-expanded={glossWordId === active.id}
                        onClick={() =>
                          setGlossWordId((current) => (current === active.id ? null : active.id))
                        }
                      >
                        <span className="font-greek text-3xl">{active.surface}</span>
                        <span
                          className={`min-w-0 flex-1 text-center text-sm ${
                            glossWordId === active.id ? "text-slate-600" : "text-slate-400"
                          }`}
                        >
                          {glossWordId === active.id ? active.definition.brief : "tap for gloss"}
                        </span>
                      </button>
                      {active.lemma && (
                        <button
                          type="button"
                          className="badge"
                          onClick={() => setDefinitionWord(active)}
                        >
                          {active.lemma}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="font-greek text-3xl">{active.surface}</div>
                      {active.lemma && (
                        <button
                          type="button"
                          className="badge"
                          onClick={() => setDefinitionWord(active)}
                        >
                          {active.lemma}
                        </button>
                      )}
                    </div>
                  )}
                  {visibleFields(
                    active,
                    answers[active.id],
                    pairs.some((pair) => pair.articleId === active.id)
                  ).map((field) => {
                    const value = answers[active.id]?.[field.key] ?? "";
                    const gold = normalizeMissing(active.parse?.[field.key]);
                    const guess = normalizeMissing(value);
                    const status =
                      !guess || !gold ? "neutral" : guess === gold ? "correct" : "incorrect";
                    return (
                      <fieldset key={field.key}>
                        <legend className="text-xs text-slate-600 mb-1">{field.label}</legend>
                        <div className="flex flex-wrap gap-1.5">
                          {field.options
                            .filter((option) => option !== "—")
                            .map((option) => (
                              <button
                                key={option}
                                type="button"
                                aria-pressed={value === option}
                                onClick={() => choose(active, field.key, option)}
                                className={`min-h-9 px-2.5 py-1 rounded-md border text-sm ${
                                  value === option && status === "correct"
                                    ? "bg-green-100 border-green-600"
                                    : value === option && status === "incorrect"
                                      ? "bg-red-100 border-red-600"
                                      : value === option
                                        ? "bg-slate-900 text-white border-slate-900"
                                        : "bg-white border-slate-300"
                                }`}
                              >
                                {option}
                              </button>
                            ))}
                        </div>
                      </fieldset>
                    );
                  })}
                  {articleAgreed && activeHead && (
                    <p className="text-sm text-slate-700">
                      Agrees with{" "}
                      <span className="font-greek">{plainSurface(activeHead.surface)}</span>
                      {showAgreementFeatures
                        ? `: ${nominalFeatures(active)}.`
                        : ". Parse that word, and this article matches it."}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="text-sm text-slate-600 underline py-1"
                      onClick={() => {
                        const remaining = wordsToShow.filter((word) => word.id !== active.id);
                        setSelectedWordIds((prev) => {
                          const next = new Set(prev);
                          next.delete(active.id);
                          return next;
                        });
                        setMiss(null);
                        if (remaining.length === 0) {
                          setActiveId(null);
                          setPhase("translate");
                          return;
                        }
                        setActiveId(remaining[0]?.id ?? null);
                      }}
                    >
                      Skip this word
                    </button>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="btn"
                        disabled={activeIndex <= 0}
                        onClick={() => showWord(activeIndex - 1)}
                      >
                        Previous
                      </button>
                      {(allFilled || activeIndex < wordsToShow.length - 1) && (
                        <button
                          type="button"
                          className={`btn ${
                            allFilled ||
                            wordParsed(
                              active,
                              answers[active.id],
                              pairs.some((pair) => pair.articleId === active.id)
                            )
                              ? "!border-green-700 !bg-green-700 hover:!bg-green-800"
                              : ""
                          }`}
                          onClick={() =>
                            allFilled ? setPhase("translate") : showWord(activeIndex + 1)
                          }
                        >
                          {allFilled ? "Translate this verse" : "Next"}
                        </button>
                      )}
                      {!note && (
                        <button
                          type="button"
                          className="text-sm underline"
                          onClick={() => setWhyOpen((open) => !open)}
                        >
                          {whyOpen ? "Hide why" : "Why this form"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {note && (
                  <SignalCard
                    note={note}
                    priorMisses={miss?.priorMisses}
                    action={
                      approved ? (
                        <button
                          type="button"
                          className="btn w-fit"
                          disabled={tutorLoading}
                          onClick={explainFurther}
                        >
                          {tutorLoading ? "Asking…" : "Explain further"}
                        </button>
                      ) : (
                        <button type="button" className="btn w-fit opacity-60" disabled>
                          {user?.status === "pending"
                            ? "Waiting for approval"
                            : user?.status === "denied"
                              ? "Tutor notes are off for this account"
                              : "Sign in to ask the tutor"}
                        </button>
                      )
                    }
                  >
                    {tutorError && <p className="text-sm text-red-700">{tutorError}</p>}
                    {tutorReply && <p className="whitespace-pre-wrap">{tutorReply}</p>}
                  </SignalCard>
                )}

                {correctNotes.length > 1 && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <p className="text-sm font-medium text-slate-800">The whole parse</p>
                      {approved ? (
                        <button
                          type="button"
                          className="btn text-sm"
                          disabled={tutorLoading}
                          onClick={explainWhole}
                        >
                          {tutorLoading ? "Asking…" : "Explain the full parse"}
                        </button>
                      ) : (
                        <button type="button" className="btn text-sm opacity-60" disabled>
                          {user?.status === "pending"
                            ? "Waiting for approval"
                            : user?.status === "denied"
                              ? "Tutor notes are off for this account"
                              : "Sign in to ask the tutor"}
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {(tutorError || tutorReply) && correctNotes.length > 1 && (
                  <div className="space-y-2">
                    {tutorError && <p className="text-sm text-red-700">{tutorError}</p>}
                    {tutorReply && <p className="text-sm whitespace-pre-wrap">{tutorReply}</p>}
                  </div>
                )}
                {correctNotes.length > 0 && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {correctNotes.map((item) => (
                      <SignalCard key={item.title} note={item} />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="card mx-auto w-fit max-w-full space-y-3 p-4">
                <p className="text-sm text-slate-700">Every word was skipped.</p>
                <button type="button" className="btn" onClick={() => setPhase("translate")}>
                  Translate this verse
                </button>
              </div>
            )}
          </>
        )}

        {verseData && phase === "translate" && (
          <TranslateStep
            key={verseData.ref}
            verse={verseData}
            english={english}
            onEnglish={setEnglish}
            translateWordIds={translateWordIds}
            onTranslateWordIds={setTranslateWordIds}
            showCompare={showCompare}
            onShowCompare={setShowCompare}
          />
        )}

        {verseData && <Footer />}
      </div>

      {verseData && (
        <div className="fixed bottom-0 inset-x-0 border-t bg-white">
          <div className="w-full px-4 py-3 flex items-center justify-between gap-2">
            <div className="text-sm text-slate-600">
              {score.total > 0 ? `${score.correct}/${score.total}` : "Parse"}
            </div>
            {phase === "translate" ? (
              <button type="button" className="btn" onClick={() => setPhase("parse")}>
                Back to parsing
              </button>
            ) : allFilled || wordsToShow.length === 0 ? (
              <button type="button" className="btn" onClick={() => setPhase("translate")}>
                {wordsToShow.length === 0 ? "Translate this verse" : "Translate"}
              </button>
            ) : (
              <div className="flex flex-wrap items-center justify-end gap-3">
                <p className="text-sm text-slate-600 text-right">
                  Completely parse this verse to get to the translate step
                </p>
                <button type="button" className="btn" onClick={() => setPhase("translate")}>
                  Skip to translate
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <Modal
        isOpen={Boolean(definitionWord)}
        onClose={() => setDefinitionWord(null)}
        title={definitionWord?.lemma ?? "Lexicon"}
      >
        <p className="text-sm">
          {definitionWord?.definition?.full ||
            definitionWord?.definition?.brief ||
            "No lexicon entry."}
        </p>
      </Modal>
    </>
  );
}
