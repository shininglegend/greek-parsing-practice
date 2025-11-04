import { NT_BOOKS } from "../utils";

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
  hideVerse
}: VerseSelectorProps) {
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
      {!hideVerse && (
        <div className="text-sm text-slate-700">
          Verse: <span className="font-mono">{surfaceLine}</span>
        </div>
      )}
      {loading && <div className="text-sm">Loading…</div>}
      {error && <div className="text-sm text-red-700">Error: {error}</div>}
    </div>
  );
}
