import { describe, expect, it } from "vitest";
import { articlePairs, explainAgreement, headNominalKnown } from "./articlePairs";
import type { ParseFields, Word } from "./types";

function word(id: string, surface: string, lemma: string, parse: ParseFields): Word {
  return { id, surface, lemma, parse };
}

describe("articlePairs", () => {
  it("pairs an article with the following noun", () => {
    const words = [
      word("a", "τὸν", "ὁ", {
        pos: "article",
        case: "accusative",
        number: "singular",
        gender: "masculine",
      }),
      word("n", "θεόν", "θεός", {
        pos: "noun",
        case: "accusative",
        number: "singular",
        gender: "masculine",
      }),
    ];
    expect(articlePairs(words)).toEqual([{ articleId: "a", headId: "n", from: 0, to: 1 }]);
  });

  it("pairs across a postpositive and keeps an agreeing adjective inside the span", () => {
    const words = [
      word("a", "ὁ", "ὁ", {
        pos: "article",
        case: "nominative",
        number: "singular",
        gender: "masculine",
      }),
      word("d", "δὲ", "δέ", { pos: "conjunction" }),
      word("j", "ἀγαθὸς", "ἀγαθός", {
        pos: "adjective",
        case: "nominative",
        number: "singular",
        gender: "masculine",
      }),
      word("n", "ἄνθρωπος", "ἄνθρωπος", {
        pos: "noun",
        case: "nominative",
        number: "singular",
        gender: "masculine",
      }),
    ];
    expect(articlePairs(words)).toEqual([{ articleId: "a", headId: "n", from: 0, to: 3 }]);
  });

  it("uses a participle as the head when no noun follows", () => {
    const words = [
      word("a", "ὁ", "ὁ", {
        pos: "article",
        case: "nominative",
        number: "singular",
        gender: "masculine",
      }),
      word("p", "πιστεύων", "πιστεύω", {
        pos: "verb",
        mood: "participle",
        case: "nominative",
        number: "singular",
        gender: "masculine",
      }),
    ];
    expect(articlePairs(words)[0]?.headId).toBe("p");
  });

  it("does not pair when the next content word disagrees", () => {
    const words = [
      word("a", "ὁ", "ὁ", {
        pos: "article",
        case: "nominative",
        number: "singular",
        gender: "masculine",
      }),
      word("n", "ἀρχῇ", "ἀρχή", {
        pos: "noun",
        case: "dative",
        number: "singular",
        gender: "feminine",
      }),
    ];
    expect(articlePairs(words)).toEqual([]);
  });

  it("pairs only the inner article when another article stands in between", () => {
    const words = [
      word("a1", "τῆς", "ὁ", {
        pos: "article",
        case: "genitive",
        number: "singular",
        gender: "feminine",
      }),
      word("a2", "τοῦ", "ὁ", {
        pos: "article",
        case: "genitive",
        number: "singular",
        gender: "masculine",
      }),
      word("n", "θεοῦ", "θεός", {
        pos: "noun",
        case: "genitive",
        number: "singular",
        gender: "masculine",
      }),
    ];
    expect(articlePairs(words)).toEqual([{ articleId: "a2", headId: "n", from: 1, to: 2 }]);
  });

  it("keeps the head's case, number, and gender out of the note until that word is parsed", () => {
    const article = word("a", "ὁ", "ὁ", {
      pos: "article",
      case: "nominative",
      number: "singular",
      gender: "masculine",
    });
    const head = word("n", "λόγος", "λόγος", {
      pos: "noun",
      case: "nominative",
      number: "singular",
      gender: "masculine",
    });
    expect(headNominalKnown(head, {})).toBe(false);
    expect(explainAgreement(article, head, false).contrast).not.toMatch(/nominative/);
    expect(
      headNominalKnown(head, { case: "nominative", number: "singular", gender: "masculine" })
    ).toBe(true);
    expect(explainAgreement(article, head, true).contrast).toContain(
      "nominative singular masculine"
    );
  });
});
