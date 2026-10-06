import {
  getWeakSpots,
  importAttempts,
  type RecentMiss,
  recordAttempt,
  type SessionUser,
  type WeakSpot,
} from "./studyApi";
import { FIELD_SPECS } from "./utils";

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

const RECENT_MISSES = 5;

type RecentAcc = {
  verseRef: string;
  wordId: string;
  surface: string | null;
  lemma: string | null;
  guess: string;
  cue: string | null;
  createdAt: string;
};

function byNewest(a: string, b: string): number {
  return a < b ? 1 : a > b ? -1 : 0;
}

function recentMisses(misses: RecentAcc[]): RecentMiss[] {
  const byWord = new Map<
    string,
    {
      verseRef: string;
      surface: string | null;
      lemma: string | null;
      cue: string | null;
      latest: string;
      guesses: Map<string, { count: number; latest: string }>;
    }
  >();
  for (const miss of misses) {
    const key = `${miss.verseRef}\n${miss.wordId}`;
    const word = byWord.get(key) ?? {
      verseRef: miss.verseRef,
      surface: miss.surface,
      lemma: miss.lemma,
      cue: miss.cue,
      latest: miss.createdAt,
      guesses: new Map(),
    };
    if (miss.createdAt >= word.latest) {
      word.latest = miss.createdAt;
      word.surface = miss.surface;
      word.lemma = miss.lemma;
      word.cue = miss.cue;
    }
    const guess = word.guesses.get(miss.guess) ?? { count: 0, latest: miss.createdAt };
    guess.count += 1;
    if (miss.createdAt >= guess.latest) guess.latest = miss.createdAt;
    word.guesses.set(miss.guess, guess);
    byWord.set(key, word);
  }
  return [...byWord.values()]
    .sort((a, b) => byNewest(a.latest, b.latest))
    .slice(0, RECENT_MISSES)
    .map((word) => ({
      verseRef: word.verseRef,
      surface: word.surface,
      lemma: word.lemma,
      cue: word.cue,
      guesses: [...word.guesses.entries()]
        .sort((a, b) => b[1].count - a[1].count || byNewest(a[1].latest, b[1].latest))
        .map(([guess, info]) => ({ guess, count: info.count })),
    }));
}

export function weakSpotsFrom(list: Attempt[]): WeakSpot[] {
  const groups = new Map<
    string,
    {
      field: string;
      gold: string;
      misses: number;
      total: number;
      missesDetail: RecentAcc[];
    }
  >();
  for (const a of list) {
    const key = `${a.field}\n${a.gold}`;
    const spot = groups.get(key) ?? {
      field: a.field,
      gold: a.gold,
      misses: 0,
      total: 0,
      missesDetail: [],
    };
    spot.total += 1;
    if (a.guess !== a.gold) {
      spot.misses += 1;
      spot.missesDetail.push({
        verseRef: a.verseRef,
        wordId: a.wordId,
        surface: a.surface ?? null,
        lemma: a.lemma ?? null,
        guess: a.guess,
        cue: a.cue ?? null,
        createdAt: a.createdAt,
      });
    }
    groups.set(key, spot);
  }
  return [...groups.values()]
    .filter((spot) => spot.misses > 0)
    .sort((a, b) => b.misses - a.misses)
    .slice(0, 40)
    .map(({ missesDetail, ...spot }) => ({
      ...spot,
      recent: recentMisses(missesDetail),
    }));
}

export type WeakSpotGroup = {
  field: string;
  spots: WeakSpot[];
};

function missRate(spot: WeakSpot): number {
  return spot.total === 0 ? 0 : spot.misses / spot.total;
}

/** Group spots by grammar field. Rows inside a group are worst miss rate first. */
export function groupWeakSpots(spots: WeakSpot[]): WeakSpotGroup[] {
  const byField = new Map<string, WeakSpot[]>();
  for (const spot of spots) {
    const list = byField.get(spot.field) ?? [];
    list.push(spot);
    byField.set(spot.field, list);
  }
  const sortSpots = (list: WeakSpot[]) =>
    [...list].sort((a, b) => missRate(b) - missRate(a) || b.misses - a.misses);

  const groups: WeakSpotGroup[] = [];
  const seen = new Set<string>();
  for (const spec of FIELD_SPECS) {
    const list = byField.get(spec.key);
    if (!list) continue;
    seen.add(spec.key);
    groups.push({ field: spec.key, spots: sortSpots(list) });
  }
  for (const [field, list] of byField) {
    if (seen.has(field)) continue;
    groups.push({ field, spots: sortSpots(list) });
  }
  return groups;
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
