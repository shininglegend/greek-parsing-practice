import { useEffect, useRef, useState } from "react";
import { articlePairs, verseSegments } from "../articlePairs";
import { buildChecklist } from "../checklist";
import { useSession } from "../session";
import { ApiError, askTutor, getTranslations, type EnglishVersions } from "../studyApi";
import type { Verse, Word } from "../types";
import { FIELD_SPECS, normalizeMissing } from "../utils";
import { TurnstileField } from "./TurnstileField";

function parseLines(word: Word): { label: string; value: string; greek?: boolean }[] {
  const lines: { label: string; value: string; greek?: boolean }[] = [];
  if (word.lemma) lines.push({ label: "Lemma", value: word.lemma, greek: true });
  if (word.definition?.brief) lines.push({ label: "Translation", value: word.definition.brief });
  for (const spec of FIELD_SPECS) {
    const value = normalizeMissing(word.parse?.[spec.key]);
    if (value) lines.push({ label: spec.label, value });
  }
  return lines;
}

function TranslateWord({
  word,
  open,
  onToggle,
}: {
  word: Word;
  open: boolean;
  onToggle: () => void;
}) {
  const lines = parseLines(word);
  return (
    <button
      type="button"
      className="group relative text-left"
      aria-expanded={open}
      onClick={(event) => {
        const native = event.nativeEvent;
        const pointerType = "pointerType" in native ? String(native.pointerType) : "";
        // Desktop hover already reveals the parse; tap is for touch and keyboard.
        if (pointerType === "mouse") return;
        onToggle();
      }}
    >
      <span className="font-greek text-xl">{word.surface}</span>
      <span
        role="tooltip"
        className={`absolute left-0 top-full z-20 mt-1 w-max max-w-xs rounded-md bg-slate-800 px-2.5 py-1.5 text-left text-xs leading-relaxed text-white shadow-lg ${
          open ? "block" : "hidden group-hover:block group-focus-visible:block"
        }`}
      >
        {lines.length > 0 ? (
          lines.map((line) => (
            <span key={line.label} className="block">
              <span className="text-slate-300">{line.label}: </span>
              <span className={line.greek ? "font-greek text-sm" : undefined}>{line.value}</span>
            </span>
          ))
        ) : (
          <span className="block">No parse recorded</span>
        )}
      </span>
    </button>
  );
}

export function TranslateStep({ verse, words }: { verse: Verse; words: Word[] }) {
  const { user, turnstileSiteKey } = useSession();
  const [versions, setVersions] = useState<EnglishVersions | null>(null);
  const [versionError, setVersionError] = useState<string | null>(null);
  const [english, setEnglish] = useState("");
  const [showCompare, setShowCompare] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [noteLoading, setNoteLoading] = useState(false);
  const [token, setToken] = useState("");
  const checklist = buildChecklist(words);
  const approved = user?.status === "approved" || user?.role === "admin";
  const [openWordId, setOpenWordId] = useState<string | null>(null);
  const wordRowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openWordId) return;
    function closeOnOutside(event: PointerEvent) {
      if (wordRowRef.current?.contains(event.target as Node)) return;
      setOpenWordId(null);
    }
    document.addEventListener("pointerdown", closeOnOutside);
    return () => document.removeEventListener("pointerdown", closeOnOutside);
  }, [openWordId]);

  useEffect(() => {
    let cancelled = false;
    getTranslations(verse.ref)
      .then((data) => {
        if (!cancelled) setVersions(data.versions);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setVersionError(error instanceof Error ? error.message : "Could not load English versions.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [verse.ref]);

  async function requestNote() {
    if (!approved || !versions) return;
    setNoteLoading(true);
    setNoteError(null);
    try {
      const result = await askTutor("/api/translation-note", {
        verseRef: verse.ref,
        greek: words.map((word) => word.surface).join(" "),
        english,
        checklist: checklist.map((line) => line.text).join("\n"),
        versions: ["WEB", "KJV", "ASV"]
          .map((name) => {
            const key = name.toLowerCase() as keyof EnglishVersions;
            return `${name}: ${versions[key] ?? "unavailable"}`;
          })
          .join("\n"),
        turnstileToken: token,
      });
      setNote(result.reply);
    } catch (error) {
      setNoteError(error instanceof ApiError ? error.message : "The tutor could not answer.");
    } finally {
      setNoteLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <div className="font-semibold">Write what it says</div>
          <p className="text-sm font-normal text-slate-600">
            Hover or tap a word to see its translation, morphology, and parse
          </p>
        </div>
        <div ref={wordRowRef} className="flex flex-wrap items-baseline gap-x-3 gap-y-3">
          {verseSegments(words, articlePairs(words)).map((segment) => {
            const tokens = (segment.kind === "pair" ? segment.words : [segment.word]).map((word) => (
              <TranslateWord
                key={word.id}
                word={word}
                open={openWordId === word.id}
                onToggle={() => setOpenWordId((current) => (current === word.id ? null : word.id))}
              />
            ));
            if (segment.kind === "pair") {
              return (
                <div key={segment.pair.articleId} className="flex gap-x-3">
                  {tokens}
                </div>
              );
            }
            return tokens;
          })}
        </div>
        <textarea
          className="input w-full min-h-28"
          value={english}
          onChange={(event) => setEnglish(event.target.value)}
          placeholder="Your English"
        />
        <button type="button" className="btn" onClick={() => setShowCompare(true)}>
          Compare
        </button>
      </div>

      {showCompare && (
        <>
          <div className="card space-y-2">
            <div className="font-semibold">Tutor note</div>
            <p className="text-sm text-slate-600">
              Optional. Asks whether your English shows the checklist, and what the parse
              commits you to in the sentence.
            </p>
            {approved ? (
              <>
                <TurnstileField siteKey={turnstileSiteKey} onToken={setToken} />
                <button
                  type="button"
                  className="btn"
                  disabled={noteLoading || !english.trim() || (Boolean(turnstileSiteKey) && !token)}
                  onClick={requestNote}
                >
                  {noteLoading ? "Asking…" : "Ask about my English and the parse"}
                </button>
              </>
            ) : (
              <button type="button" className="btn opacity-60" disabled>
                {user?.status === "pending"
                  ? "Waiting for approval"
                  : user?.status === "denied"
                    ? "Tutor notes are off for this account"
                    : "Sign in to ask the tutor"}
              </button>
            )}
            {noteError && <p className="text-sm text-red-700">{noteError}</p>}
            {note && <p className="text-sm whitespace-pre-wrap">{note}</p>}
          </div>
          <div className="space-y-2">
            {versionError && <p className="text-sm text-red-700">{versionError}</p>}
            {(["web", "kjv", "asv"] as const).map((key) => (
              <div key={key} className="card">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {key}
                </div>
                <p className="mt-1">{versions?.[key] ?? "Loading…"}</p>
              </div>
            ))}
          </div>
          <div className="card space-y-2">
            <div className="font-semibold">What the parse commits you to</div>
            <ul className="text-sm space-y-1">
              {checklist.map((line) => (
                <li key={`${line.wordId}-${line.text}`}>{line.text}</li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
