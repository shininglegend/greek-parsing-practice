import { useState, type ReactNode } from "react";
import type { SignalExplanation } from "../signals";
import { Modal } from "./Modal";
import { MorphologyCharts } from "./MorphologyCharts";

export function SignalCard({
  note,
  priorMisses,
  action,
  children,
}: {
  note: SignalExplanation;
  priorMisses?: number;
  action?: ReactNode;
  children?: ReactNode;
}) {
  const [chartOpen, setChartOpen] = useState(false);
  return (
    <div className="flex h-full flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
      <div className="font-semibold text-slate-900">{note.title}</div>
      {priorMisses && priorMisses > 0 ? (
        <p className="font-medium text-amber-950">
          {note.cue
            ? `${capitalize(note.title.split(": ").pop() ?? "")} after ${note.cue} again.`
            : `${capitalize(note.title.split(": ").pop() ?? "")} again.`}
        </p>
      ) : null}
      <p>{note.contrast}</p>
      <ul className="list-disc pl-5 space-y-1">
        {note.evidence.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p>
        <span className="font-medium">In English: </span>
        {note.english}
      </p>
      {note.grammar ? (
        <p className="text-slate-700">
          {note.grammar.definition}
          {note.grammar.example ? ` ${note.grammar.example}` : ""}
        </p>
      ) : null}
      {note.chartKey || action ? (
        <div className="mt-auto flex flex-wrap items-center gap-2 self-start">
          {note.chartKey ? (
            <button type="button" className="btn w-fit" onClick={() => setChartOpen(true)}>
              Open {note.chartLabel ?? "paradigm"}
            </button>
          ) : null}
          {action}
        </div>
      ) : null}
      {children}
      {note.chartKey ? (
        <Modal
          isOpen={chartOpen}
          onClose={() => setChartOpen(false)}
          title={note.chartLabel ?? "Paradigm"}
        >
          <MorphologyCharts initialChart={note.chartKey} />
        </Modal>
      ) : null}
    </div>
  );
}

function capitalize(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}
