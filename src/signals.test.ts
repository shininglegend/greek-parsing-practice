import { describe, expect, it } from "vitest";
import { buildChecklist } from "./checklist";
import { explainMiss, fieldsToExplain, findCue, foldGreek } from "./signals";
import type { Word } from "./types";

describe("foldGreek", () => {
  it("strips accents and final sigma", () => {
    expect(foldGreek("ἵνα")).toBe("ινα");
    expect(foldGreek("λόγος")).toBe("λογοσ");
  });
});

describe("explainMiss", () => {
  const verse = [{ surface: "ἵνα" }, { surface: "λέγωμεν" }];

  it("points at ἵνα and the lengthened vowel for a subjunctive miss", () => {
    const note = explainMiss({
      surface: "λέγωμεν",
      lemma: "λέγω",
      field: "mood",
      guess: "indicative",
      gold: "subjunctive",
      parse: { pos: "verb", tense: "present", voice: "active", mood: "subjunctive", person: "first", number: "plural" },
      verseWords: verse,
    });
    expect(note.cue).toBe("ἵνα");
    expect(note.contrast).toContain("indicative");
    expect(note.english).toContain("so that");
    expect(note.evidence.some((line) => line.includes("ἵνα"))).toBe(true);
    expect(note.evidence.some((line) => line.includes("This form shows that lengthened vowel."))).toBe(true);
    expect(note.chartKey).toBe("presentActive");
  });

  it("does not treat μή as a cue unless the subjunctive is aorist", () => {
    const words = [{ surface: "μὴ" }, { surface: "λέγῃ" }];
    expect(
      findCue(words, { pos: "verb", mood: "subjunctive", tense: "present" })
    ).toBeUndefined();
    expect(
      findCue(words, { pos: "verb", mood: "subjunctive", tense: "aorist" })?.display
    ).toBe("μή");
  });

  it("flags an irregular lemma instead of forcing an ending", () => {
    const note = explainMiss({
      surface: "ἦν",
      lemma: "εἰμί",
      field: "tense",
      guess: "aorist",
      gold: "imperfect",
      parse: { pos: "verb", tense: "imperfect", mood: "indicative" },
      verseWords: [{ surface: "ἦν" }],
    });
    expect(note.irregular).toBe(true);
    expect(note.evidence.some((line) => line.includes("This form shows that lengthened vowel."))).toBe(false);
    expect(note.evidence.some((line) => line.includes("irregular"))).toBe(true);
  });
});

describe("buildChecklist", () => {
  it("turns a genitive and a purpose clause into English jobs", () => {
    const words: Word[] = [
      { id: "1", surface: "ἵνα", parse: { pos: "conjunction" } },
      {
        id: "2",
        surface: "θεοῦ",
        parse: { pos: "noun", case: "genitive", number: "singular", gender: "masculine" },
      },
      {
        id: "3",
        surface: "λέγωμεν",
        parse: {
          pos: "verb",
          tense: "present",
          voice: "active",
          mood: "subjunctive",
          person: "first",
          number: "plural",
        },
      },
    ];
    const lines = buildChecklist(words).map((line) => line.text);
    expect(lines.some((line) => line.includes("θεοῦ, genitive") && line.includes("of"))).toBe(true);
    expect(lines.some((line) => line.includes("λέγωμεν, subjunctive") && line.includes("so that"))).toBe(true);
  });
});

describe("fieldsToExplain", () => {
  const fields = ["pos", "tense", "mood"];

  it("explains only the latest correct field until the form is complete", () => {
    expect(fieldsToExplain(fields, (field) => field !== "mood")).toEqual(["tense"]);
  });

  it("explains every field once the form is complete", () => {
    expect(fieldsToExplain(fields, () => true)).toEqual(fields);
  });
});
