import { useEffect, useMemo, useState } from "react";
import { loadVerse } from "../api";
import { formatRef } from "../utils";
import { WordCard, Results, VerseSelector } from "./";
import type { DrillAnswer, Verse } from "../types";

type State =
  | { kind: "idle" }
  | { kind: "loading"; ref: string }
  | { kind: "loaded"; verse: Verse }
  | { kind: "error"; msg: string };

export function ParserDrill() {
  const [selectedBook, setSelectedBook] = useState("Jn");
  const [chapter, setChapter] = useState("1");
  const [verse, setVerse] = useState("1");
  const [state, setState] = useState<State>({ kind: "idle" });
  const [answers, setAnswers] = useState<Record<string, DrillAnswer>>({});
  const [selectedWordIds, setSelectedWordIds] = useState<Set<string>>(new Set());
  const verseData = (state.kind === "loaded" ? state.verse : undefined);

  function load() {
    const formatted = formatRef(selectedBook, chapter, verse);
    setState({ kind: "loading", ref: formatted });
    setAnswers({});
    loadVerse(formatted)
      .then(v => {
        setState({ kind: "loaded", verse: v });
        // Initially select all words
        setSelectedWordIds(new Set(v.words.map(w => w.id)));
      })
      .catch(e => setState({ kind: "error", msg: e.message || "error" }));
  }

  useEffect(() => { load(); /* initial load */ }, []);

  const surfaceLine = useMemo(
    () => verseData?.words.map(w => w.surface).join(" ") ?? "",
    [verseData]
  );

  function setAnswer(id: string, key: string, val: string) {
    setAnswers(prev => ({ ...prev, [id]: { ...prev[id], [key]: val } }));
  }

  function toggleWord(wordId: string) {
    setSelectedWordIds(prev => {
      const next = new Set(prev);
      if (next.has(wordId)) {
        next.delete(wordId);
      } else {
        next.add(wordId);
      }
      return next;
    });
  }

  // Filter words to only show selected ones
  const wordsToShow = verseData?.words.filter(w => selectedWordIds.has(w.id)) ?? [];

  return (
    <div className="mx-auto max-w-5xl p-4 space-y-4">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold">Koine Parser Drill</h1>
        <a 
          href="#/reverse" 
          className="text-sm text-blue-600 hover:underline"
          onClick={(e) => {
            e.preventDefault();
            window.history.pushState({}, '', '#/reverse');
            window.dispatchEvent(new Event('locationchange'));
          }}
        >
          Try Reverse Parser →
        </a>
      </div>

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
        words={verseData?.words}
        selectedWordIds={selectedWordIds}
        onWordToggle={toggleWord}
      />

      {verseData && wordsToShow.length > 0 && (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            {wordsToShow.map(w => (
              <WordCard key={w.id} w={w} answer={answers[w.id]} onChange={setAnswer} />
            ))}
          </div>
          <Results 
            verse={{ ...verseData, words: wordsToShow }} 
            answers={answers} 
          />
          <div className="text-xs text-slate-500">
            Notes: fields marked "—" are intentionally ignored in grading; only gold fields present in the data are counted.
          </div>
          <hr/>
          <div className="text-xs text-slate-500 p5">
            Morphology data provided by <a className="text-blue-500" href="https://github.com/morphgnt/morphgnt-api">MorphGNT</a>
            <hr/>
            Copyright 2025 Titus Murphy. All rights reserved. 
          </div>
        </>
      )}
    </div>
  );
}
