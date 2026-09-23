import { describe, expect, it } from "vitest";
import { splitTutorNote } from "./tutorNote";

describe("splitTutorNote", () => {
  it("splits the two headings and drops the labels", () => {
    const parts = splitTutorNote(
      "What you got wrong\nThe subject is the sea.\n\nWhat you got right\nThe wind is there."
    );
    expect(parts).toEqual({
      wrong: "The subject is the sea.",
      right: "The wind is there.",
    });
  });

  it("accepts markdown headings", () => {
    const parts = splitTutorNote("## What you got wrong\nNone.\n## What you got right\nThe verb.");
    expect(parts?.wrong).toBe("None.");
    expect(parts?.right).toBe("The verb.");
  });

  it("returns null when a heading is missing", () => {
    expect(splitTutorNote("The sea is the subject.")).toBeNull();
  });
});
