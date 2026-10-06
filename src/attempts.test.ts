import { describe, expect, it } from "vitest";
import { type Attempt, groupWeakSpots, priorMisses, weakSpotsFrom } from "./attempts";

const miss = (field: string, gold: string, verseRef: string, createdAt: string): Attempt => ({
  verseRef,
  wordId: "w",
  field,
  guess: "wrong",
  gold,
  createdAt,
});

describe("priorMisses", () => {
  it("counts earlier misses of the same gold value and cue", () => {
    const list: Attempt[] = [
      miss("case", "dative", "Jn 1:1", "2026-01-01"),
      { ...miss("case", "dative", "Jn 1:2", "2026-01-02"), guess: "dative" },
      { ...miss("case", "dative", "Jn 1:3", "2026-01-03"), cue: "ἐν" },
    ];
    expect(
      priorMisses(list, {
        verseRef: "Jn 1:4",
        wordId: "w",
        field: "case",
        guess: "x",
        gold: "dative",
      })
    ).toBe(1);
    expect(
      priorMisses(list, {
        verseRef: "Jn 1:4",
        wordId: "w",
        field: "case",
        guess: "x",
        gold: "dative",
        cue: "ἐν",
      })
    ).toBe(1);
  });
});

describe("weakSpotsFrom", () => {
  it("groups by field and gold, most missed first, with the latest verse", () => {
    const list: Attempt[] = [
      miss("case", "dative", "Jn 1:1", "2026-01-01"),
      miss("case", "dative", "Jn 1:5", "2026-01-05"),
      { ...miss("case", "dative", "Jn 1:6", "2026-01-06"), guess: "dative" },
      miss("mood", "subjunctive", "Jn 3:16", "2026-01-02"),
      { ...miss("tense", "aorist", "Jn 1:1", "2026-01-01"), guess: "aorist" },
    ];
    const blank = {
      surface: null,
      lemma: null,
      cue: null,
      guesses: [{ guess: "wrong", count: 1 }],
    };
    expect(weakSpotsFrom(list)).toEqual([
      {
        field: "case",
        gold: "dative",
        misses: 2,
        total: 3,
        recent: [
          { verseRef: "Jn 1:5", ...blank },
          { verseRef: "Jn 1:1", ...blank },
        ],
      },
      {
        field: "mood",
        gold: "subjunctive",
        misses: 1,
        total: 1,
        recent: [{ verseRef: "Jn 3:16", ...blank }],
      },
    ]);
  });

  it("keeps the word, the wrong guess, and the cue, newest first", () => {
    const list: Attempt[] = [
      {
        ...miss("case", "accusative", "Phil 3:18", "2026-01-01"),
        wordId: "a",
        surface: "τὰ",
        lemma: "ὁ",
        guess: "genitive",
      },
      {
        ...miss("case", "accusative", "Phil 3:18", "2026-01-02"),
        wordId: "b",
        surface: "ἐπίγεια",
        lemma: "ἐπίγειος",
        guess: "nominative",
      },
      {
        ...miss("case", "accusative", "Phil 3:18", "2026-01-03"),
        wordId: "a",
        surface: "τὰ",
        lemma: "ὁ",
        guess: "genitive",
      },
      {
        ...miss("mood", "subjunctive", "Jn 16:1", "2026-01-04"),
        surface: "μείνητε",
        lemma: "μένω",
        guess: "indicative",
        cue: "ἵνα",
      },
    ];
    expect(weakSpotsFrom(list)).toEqual([
      {
        field: "case",
        gold: "accusative",
        misses: 3,
        total: 3,
        recent: [
          {
            verseRef: "Phil 3:18",
            surface: "τὰ",
            lemma: "ὁ",
            cue: null,
            guesses: [{ guess: "genitive", count: 2 }],
          },
          {
            verseRef: "Phil 3:18",
            surface: "ἐπίγεια",
            lemma: "ἐπίγειος",
            cue: null,
            guesses: [{ guess: "nominative", count: 1 }],
          },
        ],
      },
      {
        field: "mood",
        gold: "subjunctive",
        misses: 1,
        total: 1,
        recent: [
          {
            verseRef: "Jn 16:1",
            surface: "μείνητε",
            lemma: "μένω",
            cue: "ἵνα",
            guesses: [{ guess: "indicative", count: 1 }],
          },
        ],
      },
    ]);
  });

  it("lists every wrong guess for one word, most frequent first", () => {
    const list: Attempt[] = [
      {
        ...miss("case", "accusative", "Phil 3:18", "2026-01-01"),
        wordId: "a",
        surface: "τὰ",
        guess: "genitive",
      },
      {
        ...miss("case", "accusative", "Phil 3:18", "2026-01-02"),
        wordId: "a",
        surface: "τὰ",
        guess: "nominative",
      },
      {
        ...miss("case", "accusative", "Phil 3:18", "2026-01-03"),
        wordId: "a",
        surface: "τὰ",
        guess: "genitive",
      },
      {
        ...miss("case", "accusative", "Phil 3:18", "2026-01-04"),
        wordId: "a",
        surface: "τὰ",
        guess: "genitive",
      },
    ];
    expect(weakSpotsFrom(list)[0]?.recent).toEqual([
      {
        verseRef: "Phil 3:18",
        surface: "τὰ",
        lemma: null,
        cue: null,
        guesses: [
          { guess: "genitive", count: 3 },
          { guess: "nominative", count: 1 },
        ],
      },
    ]);
  });

  it("keeps five distinct verses, newest miss first", () => {
    const list: Attempt[] = [
      miss("case", "dative", "v1", "2026-01-01"),
      miss("case", "dative", "v2", "2026-01-02"),
      miss("case", "dative", "v3", "2026-01-03"),
      miss("case", "dative", "v4", "2026-01-04"),
      miss("case", "dative", "v5", "2026-01-05"),
      miss("case", "dative", "v6", "2026-01-06"),
      miss("case", "dative", "v7", "2026-01-07"),
      miss("case", "dative", "v1", "2026-01-08"),
    ];
    expect(weakSpotsFrom(list)[0]?.recent.map((item) => item.verseRef)).toEqual([
      "v1",
      "v7",
      "v6",
      "v5",
      "v4",
    ]);
  });
});

describe("groupWeakSpots", () => {
  it("follows field order and sorts each field by miss rate", () => {
    const groups = groupWeakSpots([
      { field: "case", gold: "genitive", misses: 6, total: 12, recent: [] },
      { field: "case", gold: "accusative", misses: 10, total: 18, recent: [] },
      { field: "number", gold: "plural", misses: 7, total: 19, recent: [] },
      { field: "pos", gold: "adverb", misses: 1, total: 2, recent: [] },
      { field: "pos", gold: "preposition", misses: 2, total: 4, recent: [] },
      { field: "dialect", gold: "ionic", misses: 3, total: 3, recent: [] },
    ]);
    expect(groups.map((group) => group.field)).toEqual(["pos", "case", "number", "dialect"]);
    expect(groups[0]?.spots.map((spot) => spot.gold)).toEqual(["preposition", "adverb"]);
    expect(groups[1]?.spots.map((spot) => spot.gold)).toEqual(["accusative", "genitive"]);
  });
});
