import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { isSignedIn, loadWeakSpots } from "../attempts";
import { useSession } from "../session";
import type { WeakSpot } from "../studyApi";
import { Footer, Header } from "./";

const FIELD_LABEL: Record<string, string> = {
  pos: "Part of speech",
  case: "Case",
  number: "Number",
  gender: "Gender",
  tense: "Tense",
  voice: "Voice",
  mood: "Mood",
  person: "Person",
};

export function WeakSpots() {
  const { user, loading } = useSession();
  const [spots, setSpots] = useState<WeakSpot[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    loadWeakSpots(user)
      .then(setSpots)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not load weak spots.");
      });
  }, [user, loading]);

  return (
    <>
      <Header />
      <div className="mx-auto max-w-lg p-4 space-y-3">
        <h2 className="text-xl font-bold">Weak spots</h2>
        <p className="text-sm text-slate-600">
          {isSignedIn(user)
            ? "Counts of graded fields on your account."
            : "Counts of graded fields saved in this browser. Sign in to keep them on an account."}{" "}
          Open a verse that contains a recent miss.
        </p>
        {error && <p className="text-sm text-red-700">{error}</p>}
        {spots && spots.length === 0 && (
          <p className="text-sm">No misses yet. Parse a verse and the counts will show up here.</p>
        )}
        <ul className="space-y-2">
          {spots?.map((spot) => (
            <li key={`${spot.field}-${spot.gold}`} className="card">
              <div className="font-semibold">
                {FIELD_LABEL[spot.field] ?? spot.field}: {spot.gold}
              </div>
              <p className="text-sm text-slate-600">
                Missed {spot.misses} of {spot.total}
              </p>
              {spot.verseRef && (
                <Link
                  className="text-sm text-blue-700 underline min-h-11 inline-flex items-center"
                  to={`/?ref=${encodeURIComponent(spot.verseRef)}`}
                >
                  Open {spot.verseRef}
                </Link>
              )}
            </li>
          ))}
        </ul>
        <Footer />
      </div>
    </>
  );
}
