import { describe, expect, it } from "vitest";
import { readTutorResult, tutorRequest } from "./tutor";

const PROMPT = "Explain ἦν.";

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
