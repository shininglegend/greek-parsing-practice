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
  
  // Check if this word has any gold answers at all
  const hasAnyGoldAnswers = w.parse && FIELD_SPECS.some(f => 
    normalizeMissing(w.parse?.[f.key]) !== undefined
  );
  
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
            // Check if this field is relevant for the selected POS and other context
            const selectedPos = answer?.pos;
            // Build a ParseFields object from the current answer for context
            const currentParse: ParseFields = {
              pos: answer?.pos,
              case: answer?.case,
              number: answer?.number,
              gender: answer?.gender,
              tense: answer?.tense,
              voice: answer?.voice,
              mood: answer?.mood,
              person: answer?.person,
            };
            const relevant = f.key === "pos" || isFieldRelevant(selectedPos, f.key, currentParse);
            
            // Don't render irrelevant fields at all
            if (!relevant) return null;
            
            // If gold answers exist for this word, hide fields with no gold answer
            // (unless it's the POS field, which is always shown)
            if (hasAnyGoldAnswers && f.key !== "pos") {
              const goldValue = normalizeMissing(w.parse?.[f.key]);
              if (goldValue === undefined) return null;
            }
            
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
