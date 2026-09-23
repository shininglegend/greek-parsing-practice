import { describe, expect, it } from "vitest";
import { type Attempt, priorMisses, weakSpotsFrom } from "./attempts";

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
    expect(weakSpotsFrom(list)).toEqual([
      { field: "case", gold: "dative", misses: 2, total: 3, verseRef: "Jn 1:5" },
      { field: "mood", gold: "subjunctive", misses: 1, total: 1, verseRef: "Jn 3:16" },
    ]);
  });
});
