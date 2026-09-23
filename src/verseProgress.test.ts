import { describe, expect, it } from "vitest";
import { progressForVerse, readProgress, writeProgress, type VerseProgress } from "./verseProgress";

function memory(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

const saved: VerseProgress = {
  phase: "translate",
  answers: { a: { pos: "verb" }, gone: { pos: "noun" } },
  selectedWordIds: ["a"],
  activeId: "a",
  english: "wept",
  translateWordIds: ["a", "b"],
  showCompare: true,
};

describe("verse progress", () => {
  it("keeps each verse in the same window store", () => {
    const storage = memory();
    writeProgress("Jn 11:35", saved, storage);
    writeProgress("Jn 1:1", { ...saved, english: "in the beginning", phase: "parse" }, storage);
    expect(readProgress("Jn 11:35", storage)?.english).toBe("wept");
    expect(readProgress("Jn 1:1", storage)?.phase).toBe("parse");
    expect(readProgress("Jn 3:16", storage)).toBeNull();
  });

  it("ignores a broken record", () => {
    const storage = memory();
    storage.setItem("greekparser.progress", "{");
    expect(readProgress("Jn 11:35", storage)).toBeNull();
    storage.setItem("greekparser.progress", JSON.stringify({ "Jn 11:35": { phase: "elsewhere" } }));
    expect(readProgress("Jn 11:35", storage)).toBeNull();
  });

  it("restores a verse and drops word ids that are no longer in it", () => {
    const progress = progressForVerse(saved, ["a", "b"]);
    expect(progress.phase).toBe("translate");
    expect(progress.answers).toEqual({ a: { pos: "verb" } });
    expect(progress.selectedWordIds).toEqual(["a"]);
    expect(progress.english).toBe("wept");
    expect(progress.showCompare).toBe(true);
  });

  it("keeps an explicit empty selection", () => {
    const progress = progressForVerse({ ...saved, selectedWordIds: [], translateWordIds: [] }, ["a", "b"]);
    expect(progress.selectedWordIds).toEqual([]);
    expect(progress.translateWordIds).toEqual([]);
    expect(progress.activeId).toBeNull();
  });

  it("starts over when every saved word id is stale", () => {
    const progress = progressForVerse(saved, ["x", "y"]);
    expect(progress.selectedWordIds).toEqual(["x", "y"]);
    expect(progress.translateWordIds).toEqual(["x", "y"]);
    expect(progress.answers).toEqual({});
    expect(progress.activeId).toBe("x");
  });

  it("starts a verse that has no saved progress on the first word", () => {
    expect(progressForVerse(null, ["a", "b"])).toMatchObject({
      phase: "parse",
      selectedWordIds: ["a", "b"],
      activeId: "a",
      english: "",
      showCompare: false,
    });
  });
});
