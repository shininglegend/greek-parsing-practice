import { useEffect, useState } from "react";
import { buildChecklist } from "../checklist";
import { useSession } from "../session";
import { ApiError, askTutor, getTranslations, type EnglishVersions } from "../studyApi";
import type { Verse, Word } from "../types";
import { TurnstileField } from "./TurnstileField";

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
        <div className="font-semibold">Write what it says</div>
        <div className="flex flex-wrap gap-x-3 gap-y-2">
          {words.map((word) => (
            <div key={word.id} className="min-w-16">
              <div className="font-greek text-xl">{word.surface}</div>
              <div className="text-xs text-slate-600">{word.definition?.brief ?? "—"}</div>
            </div>
          ))}
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
            <div className="font-semibold">What the parse commits you to</div>
            <ul className="text-sm space-y-1">
              {checklist.map((line) => (
                <li key={`${line.wordId}-${line.text}`}>{line.text}</li>
              ))}
            </ul>
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
            <div className="font-semibold">Tutor note</div>
            <p className="text-sm text-slate-600">
              Optional. The checklist and the three versions are the comparison.
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
                  {noteLoading ? "Asking…" : "Ask whether my English shows the parse"}
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
        </>
      )}
    </div>
  );
}
