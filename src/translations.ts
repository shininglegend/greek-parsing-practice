/**
 * Public-domain English versions, fetched straight from bible-api.com. The browser asks the
 * API itself, so the Worker is not a relay anyone can drive.
 *
 * bible-api.com allows 15 requests every 30 seconds per IP. Every request goes through one
 * token bucket that stays a little under that, verses already seen are answered from memory,
 * and a 429 pauses the queue for the window instead of retrying into it.
 */

export type VersionInfo = { id: string; label: string; name: string };

/** In display and fetch order. The first three are the ones the tutor prompt always sees. */
export const VERSIONS: VersionInfo[] = [
  { id: "web", label: "WEB", name: "World English Bible" },
  { id: "kjv", label: "KJV", name: "King James Version" },
  { id: "asv", label: "ASV", name: "American Standard Version" },
  { id: "ylt", label: "YLT", name: "Young's Literal Translation" },
  { id: "darby", label: "Darby", name: "Darby Bible" },
  { id: "dra", label: "DRA", name: "Douay-Rheims 1899 American Edition" },
  { id: "bbe", label: "BBE", name: "Bible in Basic English" },
  { id: "oeb-us", label: "OEB", name: "Open English Bible, US Edition" },
  { id: "webbe", label: "WEBBE", name: "World English Bible, British Edition" },
];

const BOOKS: Record<string, string> = {
  Mt: "Matthew",
  Mk: "Mark",
  Lk: "Luke",
  Jn: "John",
  Acts: "Acts",
  Rom: "Romans",
  "1Cor": "1 Corinthians",
  "2Cor": "2 Corinthians",
  Gal: "Galatians",
  Eph: "Ephesians",
  Phil: "Philippians",
  Col: "Colossians",
  "1Thess": "1 Thessalonians",
  "2Thess": "2 Thessalonians",
  "1Tim": "1 Timothy",
  "2Tim": "2 Timothy",
  Titus: "Titus",
  Phlm: "Philemon",
  Heb: "Hebrews",
  Jas: "James",
  "1Pet": "1 Peter",
  "2Pet": "2 Peter",
  "1Jn": "1 John",
  "2Jn": "2 John",
  "3Jn": "3 John",
  Jude: "Jude",
  Rev: "Revelation",
};

export type VersionStatus =
  /** Queued or in flight. */
  | "loading"
  /** Queued, but the rate limit is holding it back for a while. */
  | "waiting"
  | "ready"
  /** The version does not have this verse, or the request failed for good. */
  | "missing";

export type VersionText = VersionInfo & { status: VersionStatus; text: string | null };

/** "John 1.2", "Jn 1:1", or "Jn 1.1" → "John 1:2", the form bible-api.com accepts in the path. */
export function passageName(ref: string): string | null {
  const normalized = ref.trim().replace(/(\d)\.(\d+)$/, "$1:$2");
  const match = normalized.match(/^(.+?)\s+(\d+:\d+)$/);
  if (!match) return null;
  // MorphGNT titles already use full names ("John 1.2"); abbreviations are expanded.
  const book = BOOKS[match[1]] ?? match[1];
  return `${book} ${match[2]}`;
}

// Verse text by "version/passage". Empty string means the version lacks the verse.
const texts = new Map<string, string>();

function textKey(id: string, passage: string): string {
  return `${id}/${passage}`;
}

// ---------- rate-limited request queue ----------

/** bible-api.com publishes 15 per 30 s. Stay under it so other tabs and retries have room. */
export const RATE_LIMIT = { requests: 12, windowMs: 30_000 };
const RETRY_AFTER_DEFAULT_MS = 30_000;
const MAX_ATTEMPTS = 3;

type Job = {
  key: string;
  id: string;
  passage: string;
  attempts: number;
  /** Subscriptions still interested in this text. Empty means the job can be dropped. */
  wanted: Set<symbol>;
  waiting: Set<() => void>;
};

export type Scheduler = {
  enqueue: (id: string, passage: string, owner: symbol, onChange: () => void) => void;
  release: (owner: symbol) => void;
  /** True when the queue is paused, or this job sits past what the current window allows. */
  isDelayed: (key: string) => boolean;
};

export function createScheduler(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
  now: () => number = () => Date.now(),
  schedule: (fn: () => void, ms: number) => void = (fn, ms) => void setTimeout(fn, ms)
): Scheduler {
  const queue: Job[] = [];
  const byKey = new Map<string, Job>();
  const sent: number[] = [];
  let pausedUntil = 0;
  let timerSet = false;

  function tokensLeft(): number {
    const cutoff = now() - RATE_LIMIT.windowMs;
    while (sent.length && sent[0] <= cutoff) sent.shift();
    return RATE_LIMIT.requests - sent.length;
  }

  function nextOpening(): number {
    if (pausedUntil > now()) return pausedUntil - now();
    if (tokensLeft() > 0) return 0;
    return Math.max(1, sent[0] + RATE_LIMIT.windowMs - now());
  }

  function notify(job: Job) {
    for (const fn of job.waiting) fn();
  }

  function finish(job: Job, text: string) {
    byKey.delete(job.key);
    texts.set(job.key, text);
    notify(job);
    pump();
  }

  function retry(job: Job, delay: number) {
    job.attempts++;
    if (job.attempts >= MAX_ATTEMPTS) {
      byKey.delete(job.key);
      texts.set(job.key, "");
      notify(job);
    } else {
      pausedUntil = Math.max(pausedUntil, now() + delay);
      queue.unshift(job);
      for (const j of queue) notify(j);
    }
    pump();
  }

  async function run(job: Job) {
    sent.push(now());
    const url = `https://bible-api.com/${encodeURIComponent(job.passage)}?translation=${job.id}`;
    try {
      const response = await fetchImpl(url);
      if (response.status === 429) {
        const header = Number(response.headers.get("Retry-After"));
        retry(job, header > 0 ? header * 1000 : RETRY_AFTER_DEFAULT_MS);
        return;
      }
      if (response.status === 404) {
        finish(job, "");
        return;
      }
      if (!response.ok) {
        retry(job, 5_000);
        return;
      }
      const body = (await response.json()) as { text?: string };
      finish(job, body.text?.trim() ?? "");
    } catch {
      retry(job, 5_000);
    }
  }

  function pump() {
    while (queue.length && queue[0].wanted.size === 0) {
      const dropped = queue.shift();
      if (dropped) byKey.delete(dropped.key);
    }
    if (!queue.length) return;
    const wait = nextOpening();
    if (wait > 0) {
      for (const job of queue) notify(job);
      if (!timerSet) {
        timerSet = true;
        schedule(() => {
          timerSet = false;
          pump();
        }, wait);
      }
      return;
    }
    const job = queue.shift();
    if (!job) return;
    void run(job);
    pump();
  }

  return {
    enqueue(id, passage, owner, onChange) {
      const key = textKey(id, passage);
      let job = byKey.get(key);
      if (!job) {
        job = { key, id, passage, attempts: 0, wanted: new Set(), waiting: new Set() };
        byKey.set(key, job);
        queue.push(job);
      }
      job.wanted.add(owner);
      job.waiting.add(onChange);
      pump();
    },
    release(owner) {
      for (const job of byKey.values()) job.wanted.delete(owner);
    },
    isDelayed(key) {
      if (!byKey.has(key)) return false;
      if (nextOpening() > 0) return true;
      const position = queue.findIndex((job) => job.key === key);
      return position >= tokensLeft();
    },
  };
}

let shared: Scheduler | null = null;
function scheduler(): Scheduler {
  if (!shared) shared = createScheduler();
  return shared;
}

// ---------- public API ----------

export function versionTexts(ref: string, sched: Scheduler = scheduler()): VersionText[] {
  const passage = passageName(ref);
  return VERSIONS.map((version) => {
    if (!passage) return { ...version, status: "missing", text: null };
    const key = textKey(version.id, passage);
    const text = texts.get(key);
    if (text !== undefined) {
      return text
        ? { ...version, status: "ready", text }
        : { ...version, status: "missing", text: null };
    }
    return { ...version, status: sched.isDelayed(key) ? "waiting" : "loading", text: null };
  });
}

/**
 * Subscribe to the English versions for a verse. `onChange` fires whenever any version's
 * status may have changed; read the current state with `versionTexts`. The returned function
 * unsubscribes and lets the scheduler drop requests nobody is waiting on any more.
 */
export function watchVersions(
  ref: string,
  onChange: () => void,
  sched: Scheduler = scheduler()
): () => void {
  const passage = passageName(ref);
  if (!passage) return () => {};
  const owner = Symbol(ref);
  for (const version of VERSIONS) {
    if (texts.has(textKey(version.id, passage))) continue;
    sched.enqueue(version.id, passage, owner, onChange);
  }
  return () => sched.release(owner);
}

/** The versions block for the tutor prompt. Bounded so the Worker accepts it. */
export function versionsForTutor(list: VersionText[], max = 3800): string {
  const lines: string[] = [];
  let length = 0;
  for (const version of list) {
    if (version.status !== "ready" || !version.text) continue;
    const line = `${version.label}: ${version.text}`;
    if (length + line.length + 1 > max) break;
    lines.push(line);
    length += line.length + 1;
  }
  return lines.join("\n");
}
