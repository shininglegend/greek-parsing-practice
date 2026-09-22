import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { loadVerse } from "../api";
import { prefetchLemmas, type LexiconEntry } from "../lexicon";
import { useSession } from "../session";
import { explainCorrect, explainMiss, fieldsToExplain, findCue, foldGreek, type SignalExplanation } from "../signals";
import { ApiError, askTutor, recordAttempt } from "../studyApi";
import type { DrillAnswer, ParseFields, Verse, Word } from "../types";
import {
  FIELD_SPECS,
  NT_BOOKS,
  celebrateWithConfetti,
  formatRef,
  isFieldRelevant,
  normalizeMissing,
  scoreParse,
} from "../utils";
import { Footer, Header, Modal, VerseSelector } from "./";
import { SignalCard } from "./SignalCard";
import { TranslateStep } from "./TranslateStep";
import { TurnstileField } from "./TurnstileField";

type LoadState =
  | { kind: "idle" }
  | { kind: "loading"; ref: string }
  | { kind: "loaded"; verse: Verse }
  | { kind: "error"; msg: string };

function initialRef(search: string) {
  const ref = new URLSearchParams(search).get("ref");
  const normalized = ref?.trim().replace(/(\d)\.(\d+)$/, "$1:$2");
  const match = normalized?.match(/^(.+)\s+(\d+):(\d+)$/);
  if (!match) return { book: "Jn", chapter: "1", verse: "1" };
  const book =
    NT_BOOKS.find((entry) => entry.abbrev === match[1] || entry.name === match[1])?.abbrev ??
    "Jn";
  return { book, chapter: match[2], verse: match[3] };
}

function visibleFields(word: Word, answer: DrillAnswer | undefined) {
  const goldPos = normalizeMissing(word.parse?.pos);
  const selectedPos = normalizeMissing(answer?.pos);
  const posCorrect = Boolean(selectedPos && goldPos && selectedPos === goldPos);
  return FIELD_SPECS.filter((spec) => {
    if (!normalizeMissing(word.parse?.[spec.key])) return false;
    if (spec.key === "pos") return true;
    if (!posCorrect) return false;
    return isFieldRelevant(selectedPos, spec.key, answer ?? {});
  });
}

function signalText(note: SignalExplanation) {
  return [note.title, note.contrast, ...note.evidence, note.english, note.grammar?.definition]
    .filter(Boolean)
    .join("\n");
}

export function VerseSession() {
  const { user, turnstileSiteKey } = useSession();
  const [params] = useSearchParams();
  const start = initialRef(params.toString());
  const [selectedBook, setSelectedBook] = useState(start.book);
  const [chapter, setChapter] = useState(start.chapter);
  const [verseNum, setVerseNum] = useState(start.verse);
  const [state, setState] = useState<LoadState>({ kind: "idle" });
  const [answers, setAnswers] = useState<Record<string, DrillAnswer>>({});
  const [selectedWordIds, setSelectedWordIds] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [phase, setPhase] = useState<"parse" | "translate">("parse");
  const [miss, setMiss] = useState<{ field: keyof ParseFields; priorMisses: number } | null>(null);
  const [whyOpen, setWhyOpen] = useState(false);
  const [definitionWord, setDefinitionWord] = useState<Word | null>(null);
  const [tutorReply, setTutorReply] = useState<string | null>(null);
  const [tutorError, setTutorError] = useState<string | null>(null);
  const [tutorLoading, setTutorLoading] = useState(false);
  const [token, setToken] = useState("");
  const confettiTriggered = useRef(false);
  const verseData = state.kind === "loaded" ? state.verse : undefined;

  async function loadRef(book: string, chap: string, verse: string) {
    const formatted = formatRef(book, chap, verse);
    setState({ kind: "loading", ref: formatted });
    setAnswers({});
    setPhase("parse");
    setMiss(null);
    setWhyOpen(false);
    setTutorReply(null);
    confettiTriggered.current = false;
    try {
      const loaded = await loadVerse(formatted);
      const lemmas = loaded.words.map((word) => word.lemma).filter(Boolean) as string[];
      const lexicon = await prefetchLemmas(lemmas).catch(
        () => new Map<string, LexiconEntry>()
      );
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
      setState({ kind: "loaded", verse: withGlosses });
      setSelectedWordIds(new Set(withGlosses.words.map((word) => word.id)));
      setActiveId(withGlosses.words[0]?.id ?? null);
    } catch (error) {
      setState({
        kind: "error",
        msg: error instanceof Error ? error.message : "error",
      });
    }
  }

  useEffect(() => {
    loadRef(start.book, start.chapter, start.verse);
    // Load the verse from the URL once. Later loads go through the selector.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const wordsToShow = verseData?.words.filter((word) => selectedWordIds.has(word.id)) ?? [];
  const active = wordsToShow.find((word) => word.id === activeId) ?? wordsToShow[0];
  const activeIndex = active ? wordsToShow.findIndex((word) => word.id === active.id) : -1;

  const allFilled = wordsToShow.length > 0 && wordsToShow.every((word) => {
    const goldPos = normalizeMissing(word.parse?.pos);
    const selectedPos = normalizeMissing(answers[word.id]?.pos);
    if (goldPos && selectedPos !== goldPos) return false;
    const fields = visibleFields(word, answers[word.id]);
    if (fields.length === 0) return !word.parse;
    return fields.every((field) => normalizeMissing(answers[word.id]?.[field.key]));
  });

  const allCorrect = wordsToShow.length > 0 && wordsToShow.every((word) => {
    const score = scoreParse(word.parse, answers[word.id] ?? {});
    return score.total > 0 && score.correct === score.total;
  });

  useEffect(() => {
    if (allCorrect && !confettiTriggered.current) {
      celebrateWithConfetti();
      confettiTriggered.current = true;
    }
  }, [allCorrect]);

  const cueDisplay = active ? findCue(verseData?.words ?? [], active.parse)?.display : undefined;

  const note = useMemo(() => {
    if (!active || !verseData) return null;
    if (miss && miss.field) {
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
    const visible = visibleFields(active, answers[active.id]);
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
  }, [active, answers, verseData, whyOpen]);

  async function choose(word: Word, field: keyof ParseFields, value: string) {
    if (answers[word.id]?.[field] === value) return;
    setAnswers((prev) => ({ ...prev, [word.id]: { ...prev[word.id], [field]: value } }));
    setWhyOpen(false);
    setTutorReply(null);
    const gold = normalizeMissing(word.parse?.[field]);
    const guess = normalizeMissing(value);
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
    setTutorLoading(true);
    setTutorError(null);
    try {
      const result = await askTutor("/api/explain", {
        verseRef: verseData.ref,
        surface: active.surface,
        lemma: active.lemma,
        gold: `${miss?.field}: ${normalizeMissing(active.parse?.[miss?.field ?? "pos"])}`,
        guess: `${miss?.field}: ${normalizeMissing(answers[active.id]?.[miss?.field ?? "pos"])}`,
        clause: verseData.words.map((word) => word.surface).join(" "),
        signal: signalText(note),
        turnstileToken: token,
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

        {verseData && wordsToShow.length > 0 && phase === "parse" && active && (
          <>
            <div className="font-greek text-2xl leading-relaxed flex flex-wrap gap-x-2 gap-y-2">
              {verseData.words.map((word) => {
                const selected = selectedWordIds.has(word.id);
                const isActive = word.id === active.id;
                const marked = cueDisplay && foldGreek(word.surface) === foldGreek(cueDisplay) && note;
                return (
                  <button
                    key={word.id}
                    type="button"
                    onClick={() => {
                      setActiveId(word.id);
                      setSelectedWordIds((prev) => new Set(prev).add(word.id));
                      setMiss(null);
                      setPhase("parse");
                    }}
                    className={`min-h-11 px-1 rounded-md ${
                      isActive
                        ? "bg-slate-900 text-white"
                        : selected
                          ? "text-slate-900"
                          : "text-slate-400"
                    } ${marked ? "underline decoration-amber-500 decoration-2" : ""}`}
                  >
                    {word.surface}
                  </button>
                );
              })}
            </div>

            <div className="card w-fit max-w-full space-y-2 p-3">
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
              {visibleFields(active, answers[active.id]).map((field) => {
                const value = answers[active.id]?.[field.key] ?? "";
                const gold = normalizeMissing(active.parse?.[field.key]);
                const guess = normalizeMissing(value);
                const status = !guess || !gold ? "neutral" : guess === gold ? "correct" : "incorrect";
                return (
                  <fieldset key={field.key}>
                    <legend className="text-xs text-slate-600 mb-1">{field.label}</legend>
                    <div className="flex flex-wrap gap-1.5">
                      {field.options.filter((option) => option !== "—").map((option) => (
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
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="text-sm text-slate-600 underline py-1"
                  onClick={() => {
                    setSelectedWordIds((prev) => {
                      const next = new Set(prev);
                      next.delete(active.id);
                      return next;
                    });
                    const remaining = wordsToShow.filter((word) => word.id !== active.id);
                    setActiveId(remaining[0]?.id ?? null);
                  }}
                >
                  Skip this word
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn"
                    disabled={activeIndex <= 0}
                    onClick={() => showWord(activeIndex - 1)}
                  >
                    Previous
                  </button>
                  {activeIndex < wordsToShow.length - 1 && (
                    <button type="button" className="btn" onClick={() => showWord(activeIndex + 1)}>
                      Next
                    </button>
                  )}
                </div>
              </div>
            </div>

            {note && (
              <SignalCard note={note} priorMisses={miss?.priorMisses}>
                {approved ? (
                  <>
                    <TurnstileField siteKey={turnstileSiteKey} onToken={setToken} />
                    <button
                      type="button"
                      className="btn"
                      disabled={tutorLoading || (Boolean(turnstileSiteKey) && !token)}
                      onClick={explainFurther}
                    >
                      {tutorLoading ? "Asking…" : "Explain further"}
                    </button>
                  </>
                ) : (
                  <button type="button" className="btn opacity-60" disabled>
                    {user?.status === "pending"
                      ? "Waiting for approval"
                      : user?.status === "denied"
                        ? "Tutor notes are off for this account"
                        : "Sign in to ask the tutor"}
                  </button>
                )}
                {tutorError && <p className="text-sm text-red-700">{tutorError}</p>}
                {tutorReply && <p className="whitespace-pre-wrap">{tutorReply}</p>}
              </SignalCard>
            )}

            {!note && (
              <button type="button" className="text-sm underline min-h-11" onClick={() => setWhyOpen((open) => !open)}>
                {whyOpen ? "Hide why" : "Why this form"}
              </button>
            )}
            {correctNotes.length > 1 && (
              <p className="text-sm font-medium text-slate-800">The whole parse</p>
            )}
            {correctNotes.map((item) => (
              <SignalCard key={item.title} note={item} />
            ))}
          </>
        )}

        {verseData && phase === "translate" && (
          <TranslateStep verse={verseData} words={wordsToShow} />
        )}

        {verseData && <Footer />}
      </div>

      {verseData && wordsToShow.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 border-t bg-white">
          <div className="w-full px-4 py-3 flex items-center justify-between gap-2">
            <div className="text-sm text-slate-600">
              {score.total > 0 ? `${score.correct}/${score.total}` : "Parse"}
            </div>
            {phase === "translate" ? (
              <button type="button" className="btn" onClick={() => setPhase("parse")}>
                Back to parsing
              </button>
            ) : (
              <button
                type="button"
                className="btn"
                disabled={!allFilled}
                onClick={() => setPhase("translate")}
              >
                {allFilled ? "Translate" : "Finish the words"}
              </button>
            )}
          </div>
        </div>
      )}

      <Modal
        isOpen={Boolean(definitionWord)}
        onClose={() => setDefinitionWord(null)}
        title={definitionWord?.lemma ?? "Lexicon"}
      >
        <p className="text-sm">{definitionWord?.definition?.full || definitionWord?.definition?.brief || "No lexicon entry."}</p>
      </Modal>
    </>
  );
}
