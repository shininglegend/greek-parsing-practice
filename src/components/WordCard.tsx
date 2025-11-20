import { useState } from "react";
import { FIELD_SPECS, normalizeMissing, isFieldRelevant } from "../utils";
import { Modal } from "./Modal";
import type { DrillAnswer, ParseFields, Word } from "../types";

interface WordCardProps {
  w: Word;
  answer?: DrillAnswer;
  onChange: (id: string, key: string, val: string) => void;
  disabled?: boolean;
}

export function WordCard({ w, answer, onChange, disabled }: WordCardProps) {
  const [open, setOpen] = useState(false);
  const [showFullDefinition, setShowFullDefinition] = useState(false);
  
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
        {w.lemma && (
          <div 
            className="badge cursor-pointer hover:bg-slate-200 transition-colors relative group"
            onClick={() => setShowFullDefinition(true)}
            title={w.definition?.brief || "lemma"}
          >
            lemma: {w.lemma}
            {w.definition?.brief && (
              <div className="absolute left-0 top-full mt-1 hidden group-hover:block bg-slate-800 text-white text-xs rounded px-2 py-1 whitespace-normal max-w-xs z-10 shadow-lg">
                {w.definition.brief}
              </div>
            )}
          </div>
        )}
      </div>
      {open && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {FIELD_SPECS.map(f => {
            // Always show POS field
            if (f.key === "pos") {
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
            }
            
            // For all other fields: only show them if POS is correct
            const selectedPos = answer?.pos;
            const goldPos = normalizeMissing(w.parse?.pos);
            const isPosCorrect = selectedPos && goldPos && normalizeMissing(selectedPos) === goldPos;
            
            // Hide all other fields until POS is correct
            if (!isPosCorrect) return null;
            
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
            const relevant = isFieldRelevant(selectedPos, f.key, currentParse);
            
            // Don't render irrelevant fields at all
            if (!relevant) return null;
            
            // If gold answers exist for this word, hide fields with no gold answer
            if (hasAnyGoldAnswers) {
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
      
      {/* Full definition modal */}
      {w.definition?.full && (
        <Modal 
          isOpen={showFullDefinition} 
          onClose={() => setShowFullDefinition(false)}
          title={`${w.lemma} - Full Definition`}
        >
          <div className="text-sm leading-relaxed">
            {w.definition.full}
          </div>
        </Modal>
      )}
    </div>
  );
}
