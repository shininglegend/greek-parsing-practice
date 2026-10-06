import { describe, expect, it } from "vitest";
import {
  explainPrompt,
  loggedFailure,
  readTutorResult,
  translationPrompt,
  tutorBudget,
  tutorRequest,
} from "./tutor";

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
    expect(prompt).toContain(
      "For every grammatical label you use, such as indicative or infinitive, add a brief plain-English gloss"
    );
    expect(prompt).toContain("how the context of this verse informs the choice");
    expect(prompt).toContain("Do not repeat the signal card word for word");
    expect(prompt).toContain("Do not say coincidence");
    expect(prompt).not.toContain("Explain this miss or this form.");
    expect(prompt).not.toContain("Clause:");
  });

  it("asks why the gold form has those morphological values", () => {
    const prompt = explainPrompt({ ...body, whole: true }) ?? "";
    expect(prompt).toContain("Verse parses:");
    expect(prompt).toContain("Address the student as you. Write one short paragraph.");
    expect(prompt).toContain("Explain the morphological reason the gold parse has these values");
    expect(prompt).toContain("Wrong guesses before correcting:");
    expect(prompt).toContain("do not congratulate them on it");
    expect(prompt).not.toContain("Student chose:");
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
      translating: "the whole verse",
      english: "In the beginning was the Word",
      checklist: "λόγος, nominative: subject",
      versions: "WEB: In the beginning was the Word.",
    });
    expect(prompt).toContain("The student is translating the whole verse.");
    expect(prompt).toContain("Under What you got wrong");
    expect(prompt).toContain("Under What you got right");
    expect(prompt).toContain("what the parse commits the sentence to");
  });

  it("limits the judgment to the words the student chose", () => {
    const prompt = translationPrompt({
      verseRef: "Jn 11:35",
      greek: "ἐδάκρυσεν ὁ Ἰησοῦς",
      translating: "ἐδάκρυσεν",
      english: "wept",
      checklist: "ἐδάκρυσεν, aorist: a single past action",
      versions: "WEB: Jesus wept.",
    });
    expect(prompt).toContain("The student is translating only these words: ἐδάκρυσεν.");
    expect(prompt).toContain("do not require the English to cover them");
  });

  it("rejects a note that does not say which words are being translated", () => {
    expect(
      translationPrompt({
        verseRef: "Jn 1:1",
        greek: "Ἐν ἀρχῇ ἦν ὁ λόγος",
        english: "In the beginning was the Word",
        checklist: "λόγος, nominative: subject",
        versions: "WEB: In the beginning was the Word.",
      })
    ).toBeNull();
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

  it("asks Kimi K2.5 for the answer without a reasoning trace", () => {
    const body = tutorRequest("@cf/moonshotai/kimi-k2.5", PROMPT);
    const messages = body.messages as { role: string; content: string }[];
    expect(messages.map((message) => message.role)).toEqual(["system", "user"]);
    expect(messages[1]?.content).toBe(PROMPT);
    expect(body.max_tokens).toBe(1024);
    expect(body.thinking).toEqual({ type: "disabled" });
    expect(body.chat_template_kwargs).toEqual({ enable_thinking: false, thinking: false });
  });

  it("keeps a translation review out of reasoning mode and leaves room for two sections", () => {
    const body = tutorRequest("@cf/moonshotai/kimi-k2.5", PROMPT, "translation");
    expect(body.max_tokens).toBe(1536);
    expect(body.max_completion_tokens).toBe(1536);
    expect(body.thinking).toEqual({ type: "disabled" });
    expect(body.chat_template_kwargs).toEqual({ enable_thinking: false, thinking: false });
    const messages = body.messages as { role: string; content: string }[];
    expect(messages[0]?.content).toContain("What you got wrong");
    expect(messages[0]?.content).toContain("What you got right");
    expect(messages[0]?.content).not.toContain("one short paragraph");
  });

  it("sends Haiku a system field and a user message with no effort setting", () => {
    const body = tutorRequest("anthropic/claude-haiku-4-5", PROMPT);
    expect(body.system).toEqual(expect.any(String));
    expect(body.max_tokens).toBe(1024);
    expect(body.output_config).toBeUndefined();
    expect(body.thinking).toBeUndefined();
    expect(body.messages).toEqual([{ role: "user", content: PROMPT }]);
  });

  it("gives a thinking Claude model low effort and room for its trace", () => {
    const body = tutorRequest("anthropic/claude-opus-5-5", PROMPT, "translation");
    expect(body.max_tokens).toBe(1536 + 2048);
    expect(body.output_config).toEqual({ effort: "low" });
    expect(body.thinking).toBeUndefined();
    expect(body.system).toContain("What you got wrong");
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

  it("reads a Kimi answer and leaves the reasoning trace out", () => {
    expect(
      readTutorResult({
        choices: [
          {
            message: {
              content: "This form is indicative.",
              reasoning_content: "The ending is ουσι.",
            },
          },
        ],
        usage: { prompt_tokens: 50, completion_tokens: 30 },
      })
    ).toEqual({ text: "This form is indicative.", input: 50, output: 30 });
  });

  it("drops a reasoning trace wrapped in think tags", () => {
    expect(
      readTutorResult({
        choices: [
          {
            message: {
              content: "<think>The ending is ουσι.</think>This form is indicative.",
            },
          },
        ],
      })
    ).toEqual({ text: "This form is indicative.", input: 0, output: 0 });
  });

  it("reads text parts inside a chat message and skips a thinking part", () => {
    expect(
      readTutorResult({
        choices: [
          {
            message: {
              content: [
                { type: "thinking", thinking: "hidden" },
                { type: "text", text: "The article agrees." },
              ],
            },
          },
        ],
      })
    ).toEqual({ text: "The article agrees.", input: 0, output: 0 });
  });
});

describe("loggedFailure", () => {
  it("keeps the error name, message, stack, and extra fields", () => {
    const error = new Error("gateway rejected the call", { cause: new Error("402") });
    error.name = "AiError";
    (error as Error & { status: number }).status = 402;
    const text = loggedFailure("error", error);
    expect(text.startsWith("Model error:\n")).toBe(true);
    const record = JSON.parse(text.slice("Model error:\n".length)) as {
      name: string;
      message: string;
      stack: string;
      status: number;
      cause: { message: string };
    };
    expect(record.name).toBe("AiError");
    expect(record.message).toBe("gateway rejected the call");
    expect(record.stack).toContain("AiError");
    expect(record.status).toBe(402);
    expect(record.cause.message).toBe("402");
  });

  it("stores the raw model payload when the answer is empty", () => {
    const text = loggedFailure("empty", {
      content: [{ type: "thinking", thinking: "still working" }],
      usage: { input_tokens: 12, output_tokens: 400 },
    });
    expect(text.startsWith("Empty model response:\n")).toBe(true);
    expect(JSON.parse(text.slice("Empty model response:\n".length))).toEqual({
      content: [{ type: "thinking", thinking: "still working" }],
      usage: { input_tokens: 12, output_tokens: 400 },
    });
  });

  it("truncates a payload that would not fit in a D1 statement", () => {
    const text = loggedFailure("empty", "x".repeat(90_000));
    expect(text.endsWith("\n…[truncated]")).toBe(true);
    expect(text.length).toBeLessThan(90_000);
  });
});

describe("tutorBudget", () => {
  it("charges the prompt and the whole output allowance up front", () => {
    const kimi = "@cf/moonshotai/kimi-k2.5";
    expect(tutorBudget(kimi, "a".repeat(300), "explain")).toEqual({ input: 150, output: 1024 });
    expect(tutorBudget(kimi, "a".repeat(301), "translation")).toEqual({
      input: 151,
      output: 1536,
    });
  });

  it("reserves the thinking room a Claude model gets", () => {
    expect(tutorBudget("anthropic/claude-opus-5-5", "a".repeat(300), "translation")).toEqual({
      input: 150,
      output: 1536 + 2048,
    });
    expect(tutorBudget("anthropic/claude-haiku-4-5", "a".repeat(300), "translation")).toEqual({
      input: 150,
      output: 1536,
    });
  });
});
