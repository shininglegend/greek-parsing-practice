import {
  getWeakSpots,
  importAttempts,
  recordAttempt,
  type SessionUser,
  type WeakSpot,
} from "./studyApi";

/** One graded field. Guests keep these in the browser; accounts keep them on the server. */
export type Attempt = {
  verseRef: string;
  wordId: string;
  surface?: string;
  lemma?: string;
  field: string;
  guess: string;
  gold: string;
  cue?: string;
  createdAt: string;
};

const KEY = "attempts";
const LOCAL_MAX = 5000;

export function isSignedIn(user: SessionUser | null): boolean {
  return Boolean(user?.email);
}

export function localAttempts(): Attempt[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown;
    return Array.isArray(parsed) ? (parsed as Attempt[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(list: Attempt[]) {
  localStorage.setItem(KEY, JSON.stringify(list.slice(-LOCAL_MAX)));
}

export function clearLocalAttempts() {
  localStorage.removeItem(KEY);
}

export function priorMisses(list: Attempt[], attempt: Omit<Attempt, "createdAt">): number {
  return list.filter(
    (a) =>
      a.field === attempt.field &&
      a.gold === attempt.gold &&
      a.guess !== a.gold &&
      (a.cue ?? "") === (attempt.cue ?? "")
  ).length;
}

export function weakSpotsFrom(list: Attempt[]): WeakSpot[] {
  const groups = new Map<string, WeakSpot & { latest: string }>();
  for (const a of list) {
    const key = `${a.field}\n${a.gold}`;
    const spot = groups.get(key) ?? {
      field: a.field,
      gold: a.gold,
      misses: 0,
      total: 0,
      verseRef: null,
      latest: "",
    };
    spot.total += 1;
    if (a.guess !== a.gold) {
      spot.misses += 1;
      if (a.createdAt >= spot.latest) {
        spot.latest = a.createdAt;
        spot.verseRef = a.verseRef;
      }
    }
    groups.set(key, spot);
  }
  return [...groups.values()]
    .filter((spot) => spot.misses > 0)
    .sort((a, b) => b.misses - a.misses)
    .slice(0, 40)
    .map(({ latest: _latest, ...spot }) => spot);
}

/** Save one attempt where this visitor's history lives, and say how often this miss came up before. */
export async function saveAttempt(
  user: SessionUser | null,
  attempt: Omit<Attempt, "createdAt">
): Promise<{ priorMisses: number }> {
  if (isSignedIn(user)) return recordAttempt(attempt);
  const list = localAttempts();
  const prior = priorMisses(list, attempt);
  list.push({ ...attempt, createdAt: new Date().toISOString() });
  writeLocal(list);
  return { priorMisses: prior };
}

export async function loadWeakSpots(user: SessionUser | null): Promise<WeakSpot[]> {
  if (isSignedIn(user)) return (await getWeakSpots()).spots;
  return weakSpotsFrom(localAttempts());
}

/** After a sign-in, move what the browser saved onto the account. */
export async function uploadLocalAttempts(user: SessionUser | null): Promise<void> {
  if (!isSignedIn(user)) return;
  const list = localAttempts();
  if (list.length === 0) return;
  await importAttempts(list);
  clearLocalAttempts();
}
