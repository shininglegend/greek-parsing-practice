import { useState } from "react";
import { FIELD_SPECS, normalizeMissing, isFieldRelevant } from "../utils";
import type { DrillAnswer, ParseFields, Word } from "../types";

interface WordCardProps {
  w: Word;
  answer?: DrillAnswer;
  onChange: (id: string, key: string, val: string) => void;
  disabled?: boolean;
}

export function WordCard({ w, answer, onChange, disabled }: WordCardProps) {
  const [open, setOpen] = useState(false);
  
  // Helper to determine field status
  const getFieldStatus = (key: keyof ParseFields): "correct" | "incorrect" | "neutral" => {
    const userValue = normalizeMissing(answer?.[key]);
    const goldValue = normalizeMissing(w.parse?.[key]);
    
    // If no answer yet, neutral
    if (userValue === undefined) return "neutral";
    // If no gold value (field not applicable), neutral
    if (goldValue === undefined) return "neutral";
    // Compare values
    return userValue === goldValue ? "correct" : "incorrect";
  };
  
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
          {FIELD_SPECS.map(f => {
            // Check if this field is relevant for the selected POS
            const selectedPos = answer?.pos;
            const relevant = f.key === "pos" || isFieldRelevant(selectedPos, f.key);
            
            // Don't render irrelevant fields at all
            if (!relevant) return null;
            
            const status = getFieldStatus(f.key);
            let selectClassName = "select";
            if (status === "correct") {
              selectClassName += " !border-green-500 !bg-green-50";
            } else if (status === "incorrect") {
              selectClassName += " !border-red-500 !bg-red-50";
            }
            
            return (
              <label key={f.key} className="flex flex-col gap-1">
                <span className="text-xs text-slate-600">{f.label}</span>
                <select
                  className={selectClassName}
                  disabled={disabled}
                  onChange={e => onChange(w.id, f.key, e.target.value)}
                  value={answer?.[f.key] ?? ""}
                >
                  <option value="">— choose —</option>
                  {f.options.map(o => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
