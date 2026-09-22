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

function passage(ref: string): string | null {
  const normalized = ref.trim().replace(/(\d)\.(\d+)/, "$1:$2");
  const match = normalized.match(/^(.+)\s+(\d+:\d+)$/);
  if (!match) return null;
  const book = BOOKS[match[1]] ?? match[1];
  return `${book} ${match[2]}`;
}

async function fetchVersion(passageName: string, translation: string): Promise<string> {
  const url = `https://bible-api.com/${encodeURIComponent(passageName)}?translation=${translation}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${translation} ${response.status}`);
  const body = (await response.json()) as { text?: string };
  const text = body.text?.trim();
  if (!text) throw new Error(`${translation} empty`);
  return text;
}

export async function englishVersions(env: Env, ref: string): Promise<EnglishVersions> {
  const key = `tr:${ref.trim()}`;
  const cached = await env.CACHE.get(key, "json");
  if (cached && typeof cached === "object") return cached as EnglishVersions;

  const name = passage(ref);
  if (!name) throw new Error("Unknown verse reference");

  const [web, kjv, asv] = await Promise.all([
    fetchVersion(name, "web"),
    fetchVersion(name, "kjv"),
    fetchVersion(name, "asv"),
  ]);
  const versions = { web, kjv, asv };
  await env.CACHE.put(key, JSON.stringify(versions), {
    expirationTtl: 60 * 60 * 24 * 30,
  });
  return versions;
}
