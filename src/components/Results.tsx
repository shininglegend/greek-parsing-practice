import type { DrillAnswer, Verse } from "../types";
import { scoreParse } from "../utils";

interface ResultsProps {
  verse: Verse;
  answers: Record<string, DrillAnswer>;
}

export function Results({ verse, answers }: ResultsProps) {
  const rows = verse.words.map((w) => {
    const a = answers[w.id] ?? {};
    const s = scoreParse(w.parse, a);
    return { w, s };
  });
  const sum = rows.reduce(
    (acc, r) => ({ correct: acc.correct + r.s.correct, total: acc.total + r.s.total }),
    { correct: 0, total: 0 }
  );

  // Check if any answers have been provided
  const hasAnswers = Object.keys(answers).some((id) =>
    Object.values(answers[id] ?? {}).some((v) => v !== undefined && v !== "")
  );

  if (!hasAnswers) {
    return null; // Don't show results until user makes selections
  }

  return (
    <>
      {/* Score card at the top */}
      <div className="card">
        <div className="font-semibold mb-2">Score</div>
        <div>
          {sum.total > 0 ? (
            <span className="text-2xl font-bold">
              {sum.correct} / {sum.total}
            </span>
          ) : (
            <span className="text-slate-600">No gradable fields chosen yet.</span>
          )}
          {sum.total > 0 && (
            <span className="text-slate-600 ml-3">
              ({Math.round((sum.correct / sum.total) * 100)}%)
            </span>
          )}
        </div>
      </div>

      {/* Detailed parsing breakdown */}
      <div className="card">
        <div className="font-semibold mb-3">Detailed Results</div>
        <div className="space-y-3">
          {rows.map(({ w, s }) => (
            <div key={w.id} className="border-t pt-2">
              <div className="font-semibold">{w.surface}</div>
              <div className="text-sm">
                {s.details.map((d) => {
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
                      {String(d.key)}:{" "}
                      {d.guess === undefined ? "—" : d.ok ? "✓" : `✗ (${d.guess} → ${d.gold})`}
                    </span>
                  );
                })}
                {s.details.length === 0 && (
                  <span className="text-slate-500 text-xs">No gold fields available.</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
