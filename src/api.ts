import type { Verse, Word, ParseFields } from "./types";

// MorphGNT verse lookup + verse JSON.
// If the service is unavailable, a tiny fallback for Jn 1:1 is provided.
const BASE = "https://api.morphgnt.org/v0";

async function fetchJSON<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json() as Promise<T>;
}

type MorphWord = {
  surface: string;
  lemma?: string;
  parse?: Partial<ParseFields> | string; // some feeds use compact codes
  id?: string;
};

type MorphVerse = {
  id: string;
  ref: string;
  words: MorphWord[];
};

function decodeParse(p: unknown): Partial<ParseFields> | undefined {
  if (!p) return undefined;
  if (typeof p === "object" && p !== null) return p as Partial<ParseFields>;
  if (typeof p !== "string") return undefined;
  // naive decoder for compact tags like "noun,nom,sg,masc"
  const parts = p.split(/[.,;:/ ]+/).map(s => s.trim().toLowerCase());
  const fields: Partial<ParseFields> = {};
  for (const token of parts) {
    if (["noun","verb","adj","adv","prep","pron","conj","part","article"].includes(token)) fields.pos = token;
    else if (["nom","gen","dat","acc","voc"].includes(token)) fields.case = token;
    else if (["sg","pl"].includes(token)) fields.number = token;
    else if (["masc","fem","neut"].includes(token)) fields.gender = token;
    else if (["pres","impf","fut","aor","perf","plup"].includes(token)) fields.tense = token;
    else if (["act","mid","pass","mp"].includes(token)) fields.voice = token;
    else if (["ind","impv","subj","opt","inf","part"].includes(token)) fields.mood = token;
    else if (["1","2","3"].includes(token)) fields.person = token;
  }
  return fields;
}

function mapVerse(mv: MorphVerse): Verse {
  const words: Word[] = mv.words.map((w, i) => ({
    surface: w.surface,
    lemma: w.lemma,
    parse: decodeParse(w.parse),
    id: w.id ?? `${mv.id}-${i}`
  }));
  return { ref: mv.ref, words };
}

export async function loadVerse(ref: string): Promise<Verse> {
  // 1) lookup verse id
  const q = encodeURIComponent(ref);
  try {
    const ids = await fetchJSON<string[]>(`${BASE}/verse-lookup/?${q}`);
    if (!ids?.length) throw new Error("verse id not found");
    const vjson = await fetchJSON<MorphVerse>(`${BASE}/verse/${ids[0]}.json`);
    return mapVerse(vjson);
  } catch {
    // fallback: Jn 1:1 minimal demo
    if (/^jn\s*1[:.]1$/i.test(ref)) {
      const fallback: MorphVerse = {
        id: "Jn.1.1",
        ref: "Jn 1:1",
        words: [
          { surface: "Ἐν", lemma: "ἐν", parse: "prep" },
          { surface: "ἀρχῇ", lemma: "ἀρχή", parse: "noun,dat,sg,fem" },
          { surface: "ἦν", lemma: "εἰμί", parse: "verb,impf,act,ind,3" },
          { surface: "ὁ", lemma: "ὁ", parse: "article,nom,sg,masc" },
          { surface: "λόγος", lemma: "λόγος", parse: "noun,nom,sg,masc" }
        ]
      };
      return mapVerse(fallback);
    }
    throw new Error("Lookup failed");
  }
}
