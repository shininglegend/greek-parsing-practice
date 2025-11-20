import { useEffect, useMemo, useState, useRef } from "react";
import { loadVerse } from "../api";
import { formatRef, FIELD_SPECS, celebrateWithConfetti } from "../utils";
import { prefetchLemmas } from "../lexicon";
import {
  Footer,
  Header,
  VerseSelector,
} from "./";
import type { Verse, Word } from "../types";

type State =
  | { kind: "idle" }
  | { kind: "loading"; ref: string }
  | { kind: "loaded"; verse: Verse }
  | { kind: "error"; msg: string };

export function ReverseParser() {
  const [selectedBook, setSelectedBook] = useState("Jn");
  const [chapter, setChapter] = useState("1");
  const [verse, setVerse] = useState("1");
  const [state, setState] = useState<State>({ kind: "idle" });
  const [userInputs, setUserInputs] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState(false);
  const [ignoreAccents, setIgnoreAccents] = useState(false);
  const [ignoreBreathing, setIgnoreBreathing] = useState(false);
  const [ignoreCase, setIgnoreCase] = useState(false);
  const [lexiconLoaded, setLexiconLoaded] = useState(false);
  const [loadingLexicon, setLoadingLexicon] = useState(false);
  const verseData = state.kind === "loaded" ? state.verse : undefined;

  async function load() {
    const formatted = formatRef(selectedBook, chapter, verse);
    setState({ kind: "loading", ref: formatted });
    setUserInputs({});
    setRevealed(false);
    setLexiconLoaded(false);
    try {
      const v = await loadVerse(formatted);
      setState({ kind: "loaded", verse: v });
    } catch (e: any) {
      setState({ kind: "error", msg: e.message || "error" });
    }
  }

  async function handleNavigate(direction: 'prev' | 'next') {
    const currentVerse = parseInt(verse);
    if (isNaN(currentVerse)) return;
    
    const newVerse = direction === 'prev' ? currentVerse - 1 : currentVerse + 1;
    if (newVerse < 1) return;
    
    setVerse(newVerse.toString());
    const formatted = formatRef(selectedBook, chapter, newVerse.toString());
    setState({ kind: "loading", ref: formatted });
    setUserInputs({});
    setRevealed(false);
    setLexiconLoaded(false);
    try {
      const v = await loadVerse(formatted);
      setState({ kind: "loaded", verse: v });
    } catch (e: any) {
      setState({ kind: "error", msg: e.message || "error" });
    }
  }

  async function loadLexiconForCurrentVerse() {
    if (!verseData || lexiconLoaded || loadingLexicon) return;
    
    setLoadingLexicon(true);
    try {
      const lemmas = verseData.words.map(w => w.lemma).filter(Boolean) as string[];
      const lexiconMap = await prefetchLemmas(lemmas);
      
      // Update verse data with definitions
      const updatedVerse = {
        ...verseData,
        words: verseData.words.map(w => {
          if (w.lemma) {
            const entry = lexiconMap.get(w.lemma);
            if (entry) {
              return {
                ...w,
                definition: {
                  brief: entry.definitions.find(d => d.role === "brief")?.text,
                  full: entry.definitions.find(d => d.role === "full")?.text,
                }
              };
            }
          }
          return w;
        })
      };
      
      setState({ kind: "loaded", verse: updatedVerse });
      setLexiconLoaded(true);
    } catch (e: any) {
      console.error("Failed to load lexicon:", e);
    } finally {
      setLoadingLexicon(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const surfaceLine = useMemo(
    () => verseData?.words.map((w) => w.surface).join(" ") ?? "",
    [verseData]
  );

  // Round word length up to nearest multiple of 3 to prevent guessing
  function getBoxWidth(word: Word): number {
    const len = word.surface.length;
    return Math.ceil(len / 3) * 3;
  }

  function handleInputChange(wordId: string, value: string) {
    setUserInputs((prev) => ({ ...prev, [wordId]: value }));
  }

  function normalizeForComparison(text: string): string {
    // Start with NFD normalization to decompose precomposed characters
    let normalized = text.normalize("NFD");

    if (ignoreAccents) {
      // Remove accent marks
      normalized = normalized.replace(
        /[\u0300-\u0304\u0308\u0340-\u0344\u0345]/g,
        ""
      );
    }
    if (ignoreBreathing) {
      // Remove breathing marks
      normalized = normalized.replace(/[\u0313\u0314]/g, "");
    }

    // Recompose to NFC for consistent comparison
    normalized = normalized.normalize("NFC");

    if (ignoreCase) {
      // Convert to lowercase for case-insensitive comparison
      normalized = normalized.toLowerCase();
    }

    // Always remove punctuation
    normalized = normalized.replace(/[.,;:!?·—\-\s]/g, "");

    return normalized;
  }

  function isCorrect(word: Word): boolean {
    const input = userInputs[word.id]?.trim() || "";
    if (!input) return false;

    const normalizedInput = normalizeForComparison(input);
    const normalizedSurface = normalizeForComparison(word.surface);

    return normalizedInput === normalizedSurface;
  }

  function getInputClassName(word: Word): string {
    const input = userInputs[word.id]?.trim() || "";
    if (!input) return "input text-center";
    if (isCorrect(word))
      return "input text-center !border-green-500 !bg-green-50";
    return "input text-center";
  }

  // Get all parse fields to display for a word
  function getDisplayFields(word: Word) {
    const fields: { label: string; value: string }[] = [];

    FIELD_SPECS.forEach((spec) => {
      const value = word.parse?.[spec.key];
      if (value !== undefined) {
        fields.push({ label: spec.label, value });
      }
    });

    return fields;
  }

  // Track if confetti has been triggered for this verse
  const confettiTriggered = useRef(false);

  // Check if all words are correctly typed
  useEffect(() => {
    if (!verseData || verseData.words.length === 0 || confettiTriggered.current || revealed) return;

    // Check if all words are correct
    const allCorrect = verseData.words.every((w) => isCorrect(w));

    if (allCorrect) {
      celebrateWithConfetti();
      confettiTriggered.current = true;
    }
  }, [userInputs, verseData, revealed]);

  // Reset confetti trigger when verse changes
  useEffect(() => {
    confettiTriggered.current = false;
  }, [verseData]);

  return (
    <>
      <Header currentMode="reverse" />
      <div className="mx-auto max-w-7xl p-4 space-y-4">
        <VerseSelector
        selectedBook={selectedBook}
        chapter={chapter}
        verse={verse}
        onBookChange={setSelectedBook}
        onChapterChange={setChapter}
        onVerseChange={setVerse}
        onLoad={load}
        surfaceLine={surfaceLine}
        loading={state.kind === "loading"}
        error={state.kind === "error" ? state.msg : undefined}
        hideVerse={true}
        onNavigate={handleNavigate}
        lexiconLoaded={lexiconLoaded}
        onLoadLexicon={loadLexiconForCurrentVerse}
        loadingLexicon={loadingLexicon}
      />

      {/* Toggles for ignoring diacritics */}
      <div className="card">
        <div className="flex gap-4 items-center flex-wrap">
          <span className="text-sm font-medium text-slate-700">Options:</span>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={ignoreAccents}
              onChange={(e) => setIgnoreAccents(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm">Ignore accents (΄ ` ῀)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={ignoreBreathing}
              onChange={(e) => setIgnoreBreathing(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm">Ignore breathing marks (᾿ ῾)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={ignoreCase}
              onChange={(e) => setIgnoreCase(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm">Ignore case (Α vs α)</span>
          </label>
        </div>
      </div>

      {verseData && (
        <div className="space-y-4">
          {/* Progress indicator */}
          {(() => {
            const totalWords = verseData.words.length;
            const correctWords = verseData.words.filter((w) =>
              isCorrect(w)
            ).length;
            const percentage =
              totalWords > 0
                ? Math.round((correctWords / totalWords) * 100)
                : 0;

            return (
              <div className="card">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-700">
                    Progress:
                  </span>
                  <div className="flex-1 bg-slate-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-green-500 h-full transition-all duration-300 ease-out"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 min-w-[4rem]">
                    {correctWords} / {totalWords}
                  </span>
                  <span className="text-sm text-slate-600">
                    ({percentage}%)
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Row 1: Revealed verse text */}
          <div className="card">
            <div className="flex items-center justify-between gap-4">
              <div className="text-lg font-medium">
                {revealed ? (
                  <span className="text-green-700">{surfaceLine}</span>
                ) : (
                  <span className="text-slate-400 italic">
                    Type the words below or reveal to see the verse
                  </span>
                )}
              </div>
              <button
                className="btn"
                onClick={() => setRevealed(true)}
                disabled={revealed}
              >
                {revealed ? "Revealed" : "Reveal Verse"}
              </button>
            </div>
          </div>

          {/* Row 2+: Word input boxes with morphology below */}
          <div className="overflow-x-auto">
            <div className="flex pb-4" style={{ minWidth: "max-content" }}>
              {verseData.words.map((word) => {
                const boxWidth = getBoxWidth(word);
                const displayFields = getDisplayFields(word);
                const correct = isCorrect(word);

                return (
                  <div
                    key={word.id}
                    className="flex flex-col gap-1 border-r border-slate-300 px-1 first:pl-0 last:border-r-0"
                    style={{ minWidth: `${boxWidth * 0.75}rem` }}
                  >
                    {/* Input box for the word */}
                    <input
                      type="text"
                      className={getInputClassName(word)}
                      value={userInputs[word.id] || ""}
                      onChange={(e) =>
                        handleInputChange(word.id, e.target.value)
                      }
                      placeholder="..."
                      style={{ width: "100%" }}
                      disabled={revealed}
                    />

                    {/* Show checkmark if correct */}
                    {correct && (
                      <div className="text-center text-green-600 font-bold text-sm">
                        ✓
                      </div>
                    )}

                    {/* Lemma */}
                    {word.lemma && (
                      <div className="text-center">
                        <div className="text-xs font-semibold text-slate-700 break-words">
                          Lemma: {word.lemma}
                        </div>
                      </div>
                    )}

                    {/* Parse fields */}
                    <div className="space-y-0.5">
                      {displayFields.map((field, idx) => (
                        <div
                          key={idx}
                          className="text-xs text-center p-0.5 bg-slate-100 rounded"
                        >
                          <div className="font-medium text-slate-600 text-[10px] leading-tight">
                            {field.label}
                          </div>
                          <div className="text-slate-900 text-[11px] leading-tight break-words">
                            {field.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="text-xs text-slate-500">
            <p>
              <strong>How to use:</strong> Type the Greek word in each box. When
              correct, the box will turn green. Use the morphological details
              below each box to help you construct the correct form from the
              lemma.
            </p>
          </div>
        </div>
      )}
      <Footer />
      </div>
    </>
  );
}
