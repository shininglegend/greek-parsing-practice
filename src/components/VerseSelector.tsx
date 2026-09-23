import { useRef } from "react";
import type { Word } from "../types";
import { NT_BOOKS } from "../utils";

function isPositiveInteger(value: string): boolean {
  return /^[1-9]\d*$/.test(value.trim());
}

interface VerseSelectorProps {
  selectedBook: string;
  chapter: string;
  verse: string;
  onBookChange: (book: string) => void;
  onChapterChange: (chapter: string) => void;
  onVerseChange: (verse: string) => void;
  onLoad: () => void;
  surfaceLine: string;
  loading?: boolean;
  error?: string;
  hideVerse?: boolean;
  words?: Word[];
  selectedWordIds?: Set<string>;
  onWordToggle?: (wordId: string) => void;
  onNavigate?: (direction: "prev" | "next") => void;
  lexiconLoaded?: boolean;
  onLoadLexicon?: () => void;
  loadingLexicon?: boolean;
  hideSurface?: boolean;
}

export function VerseSelector({
  selectedBook,
  chapter,
  verse,
  onBookChange,
  onChapterChange,
  onVerseChange,
  onLoad,
  surfaceLine,
  loading,
  error,
  hideVerse,
  words,
  selectedWordIds,
  onWordToggle,
  onNavigate,
  lexiconLoaded,
  onLoadLexicon,
  loadingLexicon,
  hideSurface,
}: VerseSelectorProps) {
  const hasWords = words && words.length > 0;
  const showWordSelection = hasWords && onWordToggle && selectedWordIds;

  const currentVerse = parseInt(verse, 10) || 1;
  const canGoBack = currentVerse > 1;
  const focusedValue = useRef({ chapter, verse });

  function onFieldFocus() {
    focusedValue.current = { chapter, verse };
  }

  function commitFields() {
    const previous = focusedValue.current;
    const next = { chapter, verse };
    focusedValue.current = next;
    if (previous.chapter === next.chapter && previous.verse === next.verse) return;
    // An incomplete reference waits for Load or another edit.
    if (!isPositiveInteger(chapter) || !isPositiveInteger(verse)) return;
    onLoad();
  }

  function onFieldKeyDown(event: { key: string; preventDefault: () => void }) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    commitFields();
  }
  const longestBookName = NT_BOOKS.reduce(
    (longest, book) => (book.name.length > longest.length ? book.name : longest),
    ""
  );

  return (
    <div className="card mx-auto w-fit max-w-full flex flex-col gap-3">
      <div className="flex gap-2 flex-wrap">
        {/* Size the book select to the longest option, not the selected one */}
        <div className="relative inline-grid max-w-full">
          <span
            className="invisible col-start-1 row-start-1 whitespace-pre px-2 py-1 pr-8"
            aria-hidden
          >
            {longestBookName}
          </span>
          <select
            className="select col-start-1 row-start-1 w-full min-w-0"
            value={selectedBook}
            onChange={(e) => onBookChange(e.target.value)}
          >
            {NT_BOOKS.map((b) => (
              <option key={b.abbrev} value={b.abbrev}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <input
          className="input w-20"
          type="number"
          min="1"
          value={chapter}
          onChange={(e) => onChapterChange(e.target.value)}
          onFocus={onFieldFocus}
          onBlur={commitFields}
          onKeyDown={onFieldKeyDown}
          placeholder="Ch"
        />
        <span className="flex items-center">:</span>
        <input
          className="input w-20"
          type="number"
          min="1"
          value={verse}
          onChange={(e) => onVerseChange(e.target.value)}
          onFocus={onFieldFocus}
          onBlur={commitFields}
          onKeyDown={onFieldKeyDown}
          placeholder="Vs"
        />
        <button type="button" className="btn" onClick={onLoad}>
          Load
        </button>

        {onNavigate && (
          <>
            <button
              type="button"
              className="btn"
              onClick={() => onNavigate("prev")}
              disabled={!canGoBack || loading}
              title="Previous verse"
            >
              ← Back
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => onNavigate("next")}
              disabled={loading}
              title="Next verse"
            >
              Next →
            </button>
          </>
        )}
      </div>

      {onLoadLexicon && hasWords && !lexiconLoaded && (
        <button
          type="button"
          className="btn"
          onClick={onLoadLexicon}
          disabled={loadingLexicon || loading}
        >
          {loadingLexicon ? "Loading definitions..." : "Load Lexicon Definitions"}
        </button>
      )}

      {lexiconLoaded && (
        <div className="text-sm text-green-700">
          ✓ Lexicon loaded - hover over lemmas for brief definitions, click for full
        </div>
      )}

      {!hideVerse && showWordSelection && (
        <>
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-600 font-medium">
              Click words to select/deselect for parsing:
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  words.forEach((w) => {
                    if (!selectedWordIds.has(w.id)) onWordToggle(w.id);
                  })
                }
                className="text-xs px-2 py-1 rounded-sm border border-slate-300 hover:bg-slate-50"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={() =>
                  words.forEach((w) => {
                    if (selectedWordIds.has(w.id)) onWordToggle(w.id);
                  })
                }
                className="text-xs px-2 py-1 rounded-sm border border-slate-300 hover:bg-slate-50"
              >
                Clear All
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xl leading-relaxed">
            {words.map((w) => {
              const isSelected = selectedWordIds.has(w.id);
              return (
                <button
                  type="button"
                  key={w.id}
                  onClick={() => onWordToggle(w.id)}
                  className={`px-2 py-1 rounded-md transition-colors cursor-pointer border-2 ${
                    isSelected
                      ? "bg-blue-100 border-blue-500 text-blue-900 font-semibold"
                      : "bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100"
                  }`}
                  title={`${w.surface} (${w.lemma || "unknown"})`}
                >
                  {w.surface}
                </button>
              );
            })}
          </div>
          <div className="text-xs text-slate-500">
            {selectedWordIds.size} of {words.length} words selected
          </div>
        </>
      )}

      {!hideVerse && !hideSurface && !showWordSelection && (
        <div className="text-base text-slate-700">
          <span className="font-mono text-lg">{surfaceLine}</span>
        </div>
      )}

      {loading && <div className="text-sm">Loading…</div>}
      {error && <div className="text-sm text-red-700">Error: {error}</div>}
    </div>
  );
}
