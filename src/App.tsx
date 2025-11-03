import { useEffect, useMemo, useState } from "react";
import { loadVerse } from "./api";
import { FIELD_SPECS, formatRef, scoreParse } from "./utils";
import type { DrillAnswer, Verse, Word } from "./types";

type State =
  | { kind: "idle" }
  | { kind: "loading"; ref: string }
  | { kind: "loaded"; verse: Verse }
  | { kind: "error"; msg: string };

function WordCard({
  w,
  onChange,
  disabled
}: {
  w: Word;
  onChange: (id: string, key: string, val: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card space-y-2">
      <div className="flex items-center gap-3">
        <button className="badge" onClick={() => setOpen(!open)} type="button">
          {open ? "−" : "+"}
        </button>
        <div className="text-xl font-semibold">{w.surface}</div>
        {w.lemma && <div className="badge">lemma: {w.lemma}</div>}
      </div>
      {open && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {FIELD_SPECS.map(f => (
            <label key={f.key} className="flex flex-col gap-1">
              <span className="text-xs text-slate-600">{f.label}</span>
              <select
                className="select"
                disabled={disabled}
                onChange={e => onChange(w.id, f.key, e.target.value)}
                defaultValue=""
              >
                <option value="">— choose —</option>
                {f.options.map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function Results({
  verse,
  answers
}: {
  verse: Verse;
  answers: Record<string, DrillAnswer>;
}) {
  const rows = verse.words.map(w => {
    const a = answers[w.id] ?? {};
    const s = scoreParse(w.parse, a);
    return { w, s };
  });
  const sum = rows.reduce(
    (acc, r) => ({ correct: acc.correct + r.s.correct, total: acc.total + r.s.total }),
    { correct: 0, total: 0 }
  );
  
  // Check if any answers have been provided
  const hasAnswers = Object.keys(answers).some(id => 
    Object.values(answers[id] ?? {}).some(v => v !== undefined && v !== "")
  );
  
  if (!hasAnswers) {
    return null; // Don't show results until user makes selections
  }
  
  return (
    <div className="card">
      <div className="font-semibold mb-2">Score</div>
      <div className="mb-4">
        {sum.total > 0 ? (
          <span className="text-lg">{sum.correct} / {sum.total}</span>
        ) : (
          <span className="text-slate-600">No gradable fields chosen yet.</span>
        )}
      </div>
      <div className="space-y-3">
        {rows.map(({ w, s }) => (
          <div key={w.id} className="border-t pt-2">
            <div className="font-semibold">{w.surface}</div>
            <div className="text-sm">
              {s.details.map(d => {
                let bgColor = "bg-white";
                if (d.guess === undefined) {
                  bgColor = "bg-white border border-slate-300";
                } else if (d.ok) {
                  bgColor = "bg-green-100 text-green-800";
                } else {
                  bgColor = "bg-red-100 text-red-800";
                }
                return (
                  <span key={String(d.key)} className={`badge mr-1 ${bgColor}`}>
                    {String(d.key)}: {d.guess === undefined ? "—" : d.ok ? "✓" : `✗ (${d.guess} → ${d.gold})`}
                  </span>
                );
              })}
              {s.details.length === 0 && <span className="text-slate-500 text-xs">No gold fields available.</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [refInput, setRefInput] = useState("Jn 1:1");
  const [state, setState] = useState<State>({ kind: "idle" });
  const [answers, setAnswers] = useState<Record<string, DrillAnswer>>({});
  const verse = (state.kind === "loaded" ? state.verse : undefined);

  function load(ref: string) {
    const formatted = formatRef(ref);
    setState({ kind: "loading", ref: formatted });
    setAnswers({});
    loadVerse(formatted)
      .then(v => setState({ kind: "loaded", verse: v }))
      .catch(e => setState({ kind: "error", msg: e.message || "error" }));
  }

  useEffect(() => { load(refInput); /* initial load */ }, []);

  const surfaceLine = useMemo(
    () => verse?.words.map(w => w.surface).join(" ") ?? "",
    [verse]
  );

  function setAnswer(id: string, key: string, val: string) {
    setAnswers(prev => ({ ...prev, [id]: { ...prev[id], [key]: val } }));
  }

  return (
    <div className="mx-auto max-w-5xl p-4 space-y-4">
      <h1 className="text-2xl font-bold">Koine Parser Drill</h1>

      <div className="card flex flex-col gap-3">
        <div className="flex gap-2">
          <input
            className="input"
            value={refInput}
            onChange={e => setRefInput(e.target.value)}
            placeholder="e.g., Jn 3:16"
          />
          <button className="btn" onClick={() => load(refInput)}>Load</button>
        </div>
        <div className="text-sm text-slate-700">
          Verse: <span className="font-mono">{surfaceLine}</span>
        </div>
        {state.kind === "loading" && <div className="text-sm">Loading…</div>}
        {state.kind === "error" && <div className="text-sm text-red-700">Error: {state.msg}</div>}
      </div>

      {verse && (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            {verse.words.map(w => (
              <WordCard key={w.id} w={w} onChange={setAnswer} />
            ))}
          </div>
          <Results verse={verse} answers={answers} />
          <div className="text-xs text-slate-500">
            Notes: fields marked “—” are intentionally ignored in grading; only gold fields present in the data are counted.
          </div>
        </>
      )}
    </div>
  );
}
