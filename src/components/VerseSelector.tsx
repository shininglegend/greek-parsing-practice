import { NT_BOOKS } from "../utils";
import type { Word } from "../types";

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
  onWordToggle
}: VerseSelectorProps) {
  const hasWords = words && words.length > 0;
  const showWordSelection = hasWords && onWordToggle && selectedWordIds;
  
  return (
    <div className="card flex flex-col gap-3">
      <div className="flex gap-2 flex-wrap">
        <select
          className="select flex-2 min-w-[180px]"
          value={selectedBook}
          onChange={e => onBookChange(e.target.value)}
        >
          {NT_BOOKS.map(b => (
            <option key={b.abbrev} value={b.abbrev}>{b.name}</option>
          ))}
        </select>
        <input
          className="input w-20"
          type="number"
          min="1"
          value={chapter}
          onChange={e => onChapterChange(e.target.value)}
          placeholder="Ch"
        />
        <span className="flex items-center">:</span>
        <input
          className="input w-20"
          type="number"
          min="1"
          value={verse}
          onChange={e => onVerseChange(e.target.value)}
          placeholder="Vs"
        />
        <button className="btn" onClick={onLoad}>Load</button>
      </div>
      
      {!hideVerse && showWordSelection && (
        <>
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-600 font-medium">
              Click words to select/deselect for parsing:
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => words.forEach(w => !selectedWordIds.has(w.id) && onWordToggle(w.id))}
                className="text-xs px-2 py-1 rounded border border-slate-300 hover:bg-slate-50"
              >
                Select All
              </button>
              <button 
                onClick={() => words.forEach(w => selectedWordIds.has(w.id) && onWordToggle(w.id))}
                className="text-xs px-2 py-1 rounded border border-slate-300 hover:bg-slate-50"
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
      
      {!hideVerse && !showWordSelection && (
        <div className="text-base text-slate-700">
          <span className="font-mono text-lg">{surfaceLine}</span>
        </div>
      )}
      
      {loading && <div className="text-sm">Loading…</div>}
      {error && <div className="text-sm text-red-700">Error: {error}</div>}
    </div>
  );
}
