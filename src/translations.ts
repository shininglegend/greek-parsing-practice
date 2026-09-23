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

export type EnglishVersions = {
  web: string | null;
  kjv: string | null;
  asv: string | null;
};

const memory = new Map<string, Promise<EnglishVersions>>();

function passage(ref: string): string | null {
  const normalized = ref.trim().replace(/(\d)\.(\d+)/, "$1:$2");
  const match = normalized.match(/^(.+)\s+(\d+:\d+)$/);
  if (!match) return null;
  const book = BOOKS[match[1]] ?? match[1];
  return `${book} ${match[2]}`;
}

async function fetchVersion(passageName: string, translation: string): Promise<string | null> {
  const url = `https://bible-api.com/${encodeURIComponent(passageName)}?translation=${translation}`;
  const response = await fetch(url);
  if (!response.ok) return null;
  const body = (await response.json()) as { text?: string };
  return body.text?.trim() || null;
}

/**
 * Public-domain English versions, fetched straight from bible-api.com. The browser
 * asks the API itself, so the Worker is not a relay anyone can drive.
 */
export function englishVersions(ref: string): Promise<EnglishVersions> {
  const key = ref.trim();
  const pending = memory.get(key);
  if (pending) return pending;
  const name = passage(key);
  if (!name) return Promise.reject(new Error("Unknown verse reference"));
  const task = Promise.all([
    fetchVersion(name, "web"),
    fetchVersion(name, "kjv"),
    fetchVersion(name, "asv"),
  ]).then(([web, kjv, asv]) => {
    if (!web && !kjv && !asv) throw new Error("The English versions could not be loaded.");
    return { web, kjv, asv };
  });
  task.catch(() => memory.delete(key));
  memory.set(key, task);
  return task;
}
