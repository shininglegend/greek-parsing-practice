import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { groupWeakSpots, isSignedIn, loadWeakSpots } from "../attempts";
import { useSession } from "../session";
import type { RecentMiss, WeakSpot } from "../studyApi";
import { FIELD_SPECS } from "../utils";
import { Footer, Header } from "./";

const FIELD_LABEL = new Map<string, string>(FIELD_SPECS.map((spec) => [spec.key, spec.label]));

function missPercent(spot: WeakSpot): number {
  if (spot.total === 0) return 0;
  return Math.round((spot.misses / spot.total) * 100);
}

function recentKey(miss: RecentMiss): string {
  const guesses = miss.guesses.map((item) => `${item.guess}:${item.count}`).join(",");
  return `${miss.verseRef}\n${miss.surface ?? ""}\n${guesses}\n${miss.cue ?? ""}`;
}

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

  const groups = spots ? groupWeakSpots(spots) : [];

  return (
    <>
      <Header />
      <div className="mx-auto max-w-6xl p-4 space-y-3">
        <h2 className="text-xl font-bold">Weak spots</h2>
        <p className="text-sm text-slate-600">
          {isSignedIn(user)
            ? "How often each form was missed."
            : "How often each form was missed, from grades saved in this browser. Sign in to keep them on an account."}{" "}
          The links open verses where it was recently missed.
        </p>
        {error && <p className="text-sm text-red-700">{error}</p>}
        {spots === null && !error && <p className="text-sm text-slate-600">Loading…</p>}
        {spots && spots.length === 0 && (
          <p className="text-sm">No misses yet. Parse a verse and the counts will show up here.</p>
        )}
        <div className="lg:columns-2 lg:gap-3 xl:columns-3">
          {groups.map((group) => (
            <section key={group.field} className="card mb-3 break-inside-avoid space-y-3">
              <h3 className="font-semibold">{FIELD_LABEL.get(group.field) ?? group.field}</h3>
              <ul className="divide-y">
                {group.spots.map((spot) => {
                  const percent = missPercent(spot);
                  return (
                    <li key={spot.gold} className="space-y-1 py-3 first:pt-0 last:pb-0">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-medium">{spot.gold}</span>
                        <span className="text-sm text-slate-600 tabular-nums">
                          {spot.misses} of {spot.total} · {percent}%
                        </span>
                      </div>
                      <div
                        className="h-1.5 overflow-hidden rounded-full bg-slate-200"
                        role="progressbar"
                        aria-valuenow={percent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${spot.gold} miss rate`}
                      >
                        <div
                          className="h-full rounded-full bg-red-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      {spot.recent.length > 0 && (
                        <ul>
                          {spot.recent.map((miss) => (
                            <li key={recentKey(miss)}>
                              <Link
                                className="min-h-11 inline-flex flex-wrap items-baseline gap-x-2 text-sm"
                                to={`/?ref=${encodeURIComponent(miss.verseRef)}`}
                              >
                                <span className="text-blue-700 underline">{miss.verseRef}</span>
                                {miss.surface && <span className="font-greek">{miss.surface}</span>}
                                {miss.lemma && miss.lemma !== miss.surface && (
                                  <span className="font-greek text-slate-500">{miss.lemma}</span>
                                )}
                                <span className="text-slate-600">
                                  guessed{" "}
                                  {miss.guesses.map((item, index) => (
                                    <span key={item.guess}>
                                      {index > 0 ? ", " : ""}
                                      {item.guess} (x {item.count})
                                    </span>
                                  ))}
                                </span>
                                {miss.cue && (
                                  <span className="text-slate-600">
                                    · cue <span className="font-greek">{miss.cue}</span>
                                  </span>
                                )}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
        <Footer />
      </div>
    </>
  );
}
