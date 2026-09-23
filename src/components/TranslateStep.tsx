import { useEffect, useMemo, useRef, useState } from "react";
import { articlePairs, verseSegments } from "../articlePairs";
import { buildChecklist } from "../checklist";
import { useSession } from "../session";
import { ApiError, askTutor } from "../studyApi";
import { type EnglishVersions, englishVersions } from "../translations";
import { splitTutorNote } from "../tutorNote";
import type { Verse, Word } from "../types";
import { FIELD_SPECS, normalizeMissing } from "../utils";

function TutorWait() {
  const [progress, setProgress] = useState(6);
  useEffect(() => {
    const started = Date.now();
    const id = window.setInterval(() => {
      const seconds = (Date.now() - started) / 1000;
      setProgress(6 + 88 * (1 - Math.exp(-seconds / 45)));
    }, 200);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="space-y-2">
      <div
        className="h-2 overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
        aria-label="Asking the tutor"
      >
        <div className="h-full rounded-full bg-slate-900" style={{ width: `${progress}%` }} />
      </div>
      <p className="text-sm text-slate-600">
        Working through the parse. This often takes a minute.
      </p>
    </div>
  );
}

function TutorNote({ note }: { note: string }) {
  const parts = splitTutorNote(note);
  if (!parts) return <p className="text-sm whitespace-pre-wrap">{note}</p>;
  return (
    <div className="space-y-3 text-sm">
      <section className="space-y-1">
        <h3 className="font-semibold">What you got wrong</h3>
        <p className="whitespace-pre-wrap">{parts.wrong}</p>
      </section>
      <section className="space-y-1">
        <h3 className="font-semibold">What you got right</h3>
        <p className="whitespace-pre-wrap">{parts.right}</p>
      </section>
    </div>
  );
}

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

const FINE_POINTER = "(hover: hover) and (pointer: fine) and (min-width: 640px)";

function useFinePointer() {
  const [fine, setFine] = useState(
    () => typeof window !== "undefined" && window.matchMedia(FINE_POINTER).matches
  );
  useEffect(() => {
    const media = window.matchMedia(FINE_POINTER);
    const update = () => setFine(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return fine;
}

function TranslateWord({
  word,
  open,
  chosen,
  selectable,
  onToggle,
  onChoose,
}: {
  word: Word;
  open: boolean;
  chosen: boolean;
  selectable: boolean;
  onToggle: () => void;
  onChoose: () => void;
}) {
  const lines = parseLines(word);
  return (
    <button
      type="button"
      className={`group relative rounded-md px-0.5 text-left ${
        !selectable || chosen ? "text-slate-900" : "text-slate-400"
      } ${selectable && chosen ? "underline decoration-slate-800 decoration-2 underline-offset-4" : ""}`}
      aria-expanded={open}
      aria-pressed={selectable ? chosen : undefined}
      onClick={(event) => {
        const native = event.nativeEvent;
        const pointerType = "pointerType" in native ? String(native.pointerType) : "";
        // A mouse click chooses which words to translate. Hover, and tap on a phone, show the parse.
        if (selectable && pointerType === "mouse") {
          onChoose();
          return;
        }
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

export function TranslateStep({
  verse,
  english,
  onEnglish,
  translateWordIds,
  onTranslateWordIds,
  showCompare,
  onShowCompare,
}: {
  verse: Verse;
  english: string;
  onEnglish: (value: string) => void;
  translateWordIds: string[];
  onTranslateWordIds: (ids: string[]) => void;
  showCompare: boolean;
  onShowCompare: (show: boolean) => void;
}) {
  const { user } = useSession();
  const [versions, setVersions] = useState<EnglishVersions | null>(null);
  const [versionError, setVersionError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [noteLoading, setNoteLoading] = useState(false);
  const chosenIds = useMemo(() => new Set(translateWordIds), [translateWordIds]);
  const canSelect = useFinePointer();
  const chosen = canSelect ? verse.words.filter((word) => chosenIds.has(word.id)) : verse.words;
  const checklist = buildChecklist(verse.words).filter((line) =>
    chosen.some((word) => word.id === line.wordId)
  );
  const translating =
    chosen.length === verse.words.length
      ? "the whole verse"
      : chosen.map((word) => word.surface).join(", ");
  const approved = user?.status === "approved" || user?.role === "admin";
  const [openWordId, setOpenWordId] = useState<string | null>(null);
  const wordRowRef = useRef<HTMLDivElement>(null);

  function toggleChosen(id: string) {
    const next = new Set(translateWordIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onTranslateWordIds([...next]);
    setNote(null);
  }

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
    englishVersions(verse.ref)
      .then((data) => {
        if (!cancelled) setVersions(data);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setVersionError(
            error instanceof Error ? error.message : "Could not load English versions."
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [verse.ref]);

  async function requestNote() {
    if (!approved || !versions || chosen.length === 0) return;
    setNoteLoading(true);
    setNote(null);
    setNoteError(null);
    try {
      const result = await askTutor("/api/translation-note", {
        verseRef: verse.ref,
        greek: verse.words.map((word) => word.surface).join(" "),
        translating,
        english,
        checklist:
          checklist.map((line) => line.text).join("\n") ||
          "No parse is recorded for the words the student chose.",
        versions: ["WEB", "KJV", "ASV"]
          .map((name) => {
            const key = name.toLowerCase() as keyof EnglishVersions;
            return `${name}: ${versions[key] ?? "unavailable"}`;
          })
          .join("\n"),
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
            {canSelect
              ? "Translate underlined words. Hover or tap a word to see its translation, morphology, and parse."
              : "Tap a word to see its translation, morphology, and parse."}
          </p>
        </div>
        {canSelect && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>
              {chosen.length} of {verse.words.length} words
            </span>
            <button
              type="button"
              className="underline"
              onClick={() => {
                onTranslateWordIds(verse.words.map((word) => word.id));
                setNote(null);
              }}
            >
              All
            </button>
            <button
              type="button"
              className="underline"
              onClick={() => {
                onTranslateWordIds([]);
                setNote(null);
              }}
            >
              None
            </button>
          </div>
        )}
        <div ref={wordRowRef} className="flex flex-wrap items-baseline gap-x-3 gap-y-3">
          {verseSegments(verse.words, articlePairs(verse.words)).map((segment) => {
            const tokens = (segment.kind === "pair" ? segment.words : [segment.word]).map(
              (word) => (
                <TranslateWord
                  key={word.id}
                  word={word}
                  open={openWordId === word.id}
                  chosen={chosenIds.has(word.id)}
                  selectable={canSelect}
                  onChoose={() => toggleChosen(word.id)}
                  onToggle={() =>
                    setOpenWordId((current) => (current === word.id ? null : word.id))
                  }
                />
              )
            );
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
          onChange={(event) => onEnglish(event.target.value)}
          placeholder="Your English"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn" onClick={() => onShowCompare(true)}>
            Compare
          </button>
        </div>
      </div>

      {showCompare && (
        <>
          <div className="card space-y-2">
            <div className="font-semibold">Tutor note</div>
            <p className="text-sm text-slate-600">
              Optional. Asks whether your English shows the checklist
              {canSelect ? " for the words you chose" : ""}, and what their parse commits you to.
            </p>
            {noteLoading && <TutorWait />}
            {noteError && <p className="text-sm text-red-700">{noteError}</p>}
            {note && <TutorNote note={note} />}
            {approved ? (
              <button
                type="button"
                className="btn"
                disabled={noteLoading || !english.trim() || chosen.length === 0}
                onClick={requestNote}
              >
                {noteLoading ? "Asking…" : "Ask about my English and the parse"}
              </button>
            ) : (
              <button type="button" className="btn opacity-60" disabled>
                {user?.status === "pending"
                  ? "Waiting for approval"
                  : user?.status === "denied"
                    ? "Tutor notes are off for this account"
                    : "Sign in to ask the tutor"}
              </button>
            )}
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
            {chosen.length === 0 ? (
              <p className="text-sm text-slate-600">Select at least one word to translate.</p>
            ) : checklist.length === 0 ? (
              <p className="text-sm text-slate-600">
                No parse is recorded for the words you chose.
              </p>
            ) : (
              <ul className="text-sm space-y-1">
                {checklist.map((line) => (
                  <li key={`${line.wordId}-${line.text}`}>{line.text}</li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
