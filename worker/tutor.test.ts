import { describe, expect, it } from "vitest";
import { explainPrompt, readTutorResult, translationPrompt, tutorRequest } from "./tutor";

const PROMPT = "Explain ἦν.";

describe("explainPrompt", () => {
  const body = {
    verseRef: "Jn 1:1",
    surface: "ἦν",
    lemma: "εἰμί",
    gold: "tense: imperfect; mood: indicative",
    guess: "tense: imperfect; mood: indicative",
    verseParses:
      "Ἐν (pos: preposition) ἀρχῇ (pos: noun; case: dative; number: singular; gender: feminine) ἦν (pos: verb; tense: imperfect; mood: indicative)",
    signal: "This form is imperfect.",
  };

  it("asks why gold is morphologically correct on a miss", () => {
    const prompt = explainPrompt(body) ?? "";
    expect(prompt).toContain("Verse parses:");
    expect(prompt).toContain(body.verseParses);
    expect(prompt).toContain("Address the student as you. Write one short paragraph.");
    expect(prompt).toContain(
      "Explain why the gold value is morphologically correct and your guess is not"
    );
    expect(prompt).toContain("ending, paradigm, agreement");
    expect(prompt).toContain("If your guessed parse would spell the same Greek surface");
    expect(prompt).toContain("If your guessed parse would spell a different surface");
    expect(prompt).toContain("Do not define the grammatical category");
    expect(prompt).toContain("Do not repeat the signal card");
    expect(prompt).toContain("Do not say coincidence");
    expect(prompt).not.toContain("Explain this miss or this form.");
    expect(prompt).not.toContain("Clause:");
  });

  it("asks why the gold form has those morphological values", () => {
    const prompt = explainPrompt({ ...body, whole: true }) ?? "";
    expect(prompt).toContain("Verse parses:");
    expect(prompt).toContain("Address the student as you. Write one short paragraph.");
    expect(prompt).toContain("Explain the morphological reason the gold parse has these values");
    expect(prompt).toContain("agreement with a nearby word (use the verse parses)");
    expect(prompt).not.toContain("how these fields work together");
    expect(prompt).toContain("Do not define the grammatical categories");
    expect(prompt).not.toContain(
      "Explain why the gold value is morphologically correct and your guess is not"
    );
  });

  it("rejects a body without verseParses", () => {
    const { verseParses: _omit, ...rest } = body;
    expect(explainPrompt(rest)).toBeNull();
  });
});

describe("translationPrompt", () => {
  it("asks for checklist coverage and what the parse commits English to", () => {
    const prompt = translationPrompt({
      verseRef: "Jn 1:1",
      greek: "Ἐν ἀρχῇ ἦν ὁ λόγος",
      english: "In the beginning was the Word",
      checklist: "λόγος, nominative: subject",
      versions: "WEB: In the beginning was the Word.",
    });
    expect(prompt).toContain("Say whether the student's English shows the checklist items.");
    expect(prompt).toContain("what this parse commits the English to in the sentence");
  });
});

describe("tutorRequest", () => {
  it("sends Workers AI a system message in the list", () => {
    const body = tutorRequest("@cf/meta/llama-3.3-70b-instruct-fp8-fast", PROMPT);
    const messages = body.messages as { role: string; content: string }[];
    expect(messages.map((message) => message.role)).toEqual(["system", "user"]);
    expect(messages[1]?.content).toBe(PROMPT);
    expect(body.system).toBeUndefined();
  });

  it("sends Anthropic a system field and a user message", () => {
    const body = tutorRequest("anthropic/claude-sonnet-5", PROMPT);
    expect(body.system).toEqual(expect.any(String));
    expect(body.max_tokens).toBe(1024);
    expect(body.messages).toEqual([{ role: "user", content: PROMPT }]);
  });
});

describe("readTutorResult", () => {
  it("reads a Workers AI response string and token usage", () => {
    expect(
      readTutorResult({
        response: " This form is indicative. ",
        usage: { prompt_tokens: 80, completion_tokens: 12 },
      })
    ).toEqual({ text: "This form is indicative.", input: 80, output: 12 });
  });

  it("reads Anthropic text blocks and ignores a thinking block", () => {
    expect(
      readTutorResult({
        content: [
          { type: "thinking", thinking: "hidden" },
          { type: "text", text: "The clause uses ἵνα." },
        ],
        usage: { input_tokens: 90, output_tokens: 20 },
      })
    ).toEqual({ text: "The clause uses ἵνα.", input: 90, output: 20 });
  });

  it("reads an OpenAI-style choice", () => {
    expect(
      readTutorResult({
        choices: [{ message: { content: "Jesus wept." } }],
        usage: { prompt_tokens: 40, completion_tokens: 3 },
      })
    ).toEqual({ text: "Jesus wept.", input: 40, output: 3 });
  });
});
