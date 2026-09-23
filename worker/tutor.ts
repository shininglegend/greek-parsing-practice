import { asString, sha256 } from "./http";
import { monthStartIso, type UserRow } from "./session";

const SYSTEM_BASE = [
  "You tutor Koine Greek for someone who has already been shown a signal card.",
  "The gold morphological parse is from MorphGNT and is correct.",
  "Do not offer a different parse, and do not treat any English version as the only right translation.",
  "Explain from the signal notes and the verse word parses. Address the student as you.",
];

const SYSTEM = [...SYSTEM_BASE, "Be concise: one short paragraph."].join(" ");

const TRANSLATION_SYSTEM = [
  ...SYSTEM_BASE,
  "Write exactly two sections, in this order.",
  "Put each heading on its own line, spelled exactly:",
  "What you got wrong",
  "What you got right",
  "Under each heading, write a few sentences.",
  "If a section has nothing to say, write None under that heading.",
].join(" ");

export function aiBlock(user: UserRow): "sign_in" | "pending" | "denied" | null {
  if (user.role === "admin" || user.status === "approved") return null;
  if (user.status === "guest") return "sign_in";
  if (user.status === "pending") return "pending";
  return "denied";
}

export function explainPrompt(body: Record<string, unknown>): string | null {
  const verseRef = asString(body.verseRef, 40);
  const surface = asString(body.surface, 80);
  const signal = asString(body.signal, 4000);
  const verseParses = asString(body.verseParses, 4000);
  if (!verseRef || !surface || !signal || !verseParses) return null;
  const lemma = asString(body.lemma, 80) ?? "unknown";
  const gold = asString(body.gold, 500) ?? "";
  const guess = asString(body.guess, 500) ?? "";
  const task = body.whole
    ? [
        "Address the student as you. Write one short paragraph.",
        "Explain the morphological reason the gold parse has these values:",
        "endings, agreement with a nearby word (use the verse parses), an irregular lemma, or other cues.",
        "Do not define the grammatical categories, and do not say what nominative, singular, masculine,",
        "or similar labels mean in English or for the word's role in the sentence.",
        "The signal cards already teach those definitions; use them only as morphological cues.",
        "Do not change the gold parse.",
      ].join(" ")
    : [
        "Address the student as you. Write one short paragraph.",
        "Explain why the gold value is morphologically correct and your guess is not:",
        "ending, paradigm, agreement, irregular lemma, or a verse cue.",
        "If your guessed parse would spell the same Greek surface as the actual word, say that once,",
        "then explain the cue from another word in the verse (agreement) using the verse parses.",
        "If your guessed parse would spell a different surface, name that Greek form once",
        "and contrast it with the actual surface.",
        "For every grammatical label you use, such as indicative or infinitive, add a brief plain-English gloss of what it means.",
        "Then say how the context of this verse informs the choice:",
        "agreement, the word's job in the sentence, or another cue from the verse parses.",
        "Do not repeat the signal card word for word. Do not ramble. Do not say coincidence.",
        "Do not change the gold parse.",
      ].join(" ");
  return [
    `Verse: ${verseRef}`,
    `Word: ${surface} (lemma ${lemma})`,
    `Gold parse: ${gold}`,
    `Student chose: ${guess}`,
    `Verse parses: ${verseParses}`,
    `Signal card: ${signal}`,
    task,
  ].join("\n");
}

export function translationPrompt(body: Record<string, unknown>): string | null {
  const verseRef = asString(body.verseRef, 40);
  const greek = asString(body.greek, 1000);
  const english = asString(body.english, 2000);
  const checklist = asString(body.checklist, 4000);
  const versions = asString(body.versions, 4000);
  const translating = asString(body.translating, 1000);
  if (!verseRef || !greek || !english || !checklist || !versions || !translating) return null;
  const scope =
    translating === "the whole verse"
      ? "The student is translating the whole verse."
      : `The student is translating only these words: ${translating}. Judge the English against those words and the checklist. The other Greek words are context; do not require the English to cover them.`;
  return [
    `Verse: ${verseRef}`,
    `Greek: ${greek}`,
    `Translating: ${translating}`,
    `Student English: ${english}`,
    `Parse checklist:\n${checklist}`,
    `Public-domain versions:\n${versions}`,
    [
      scope,
      "Under What you got wrong, name the checklist items the English misses",
      "and what the parse commits the sentence to (subject, object, ongoing action, and similar).",
      "Under What you got right, name the checklist items the English already shows.",
      "Do not grade the English as wrong against one version. Note where the versions themselves differ.",
    ].join(" "),
  ].join("\n");
}

const PARAGRAPH_TOKENS = 1024;
// Room for a reasoning trace plus the finished paragraph.
const TRANSLATION_TOKENS = 8192;

type Usage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  input_tokens?: number;
  output_tokens?: number;
};

export function tutorRequest(
  model: string,
  prompt: string,
  think = false
): Record<string, unknown> {
  const system = think ? TRANSLATION_SYSTEM : SYSTEM;
  // Anthropic Messages puts the system prompt beside the messages and requires max_tokens.
  if (model.startsWith("anthropic/")) {
    return {
      max_tokens: think ? TRANSLATION_TOKENS : PARAGRAPH_TOKENS,
      system,
      messages: [{ role: "user", content: prompt }],
    };
  }
  const messages = [
    { role: "system", content: system },
    { role: "user", content: prompt },
  ];
  const tokens = think ? TRANSLATION_TOKENS : PARAGRAPH_TOKENS;
  if (model.includes("kimi-")) {
    return {
      max_tokens: tokens,
      max_completion_tokens: tokens,
      thinking: { type: think ? "enabled" : "disabled" },
      chat_template_kwargs: think
        ? { enable_thinking: true, thinking: true }
        : { enable_thinking: false, thinking: false },
      messages,
    };
  }
  return { max_tokens: tokens, messages };
}

function partsText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((block) => {
      if (!block || typeof block !== "object") return "";
      const item = block as { type?: string; text?: string };
      if (item.type && item.type !== "text") return "";
      return item.text ?? "";
    })
    .join("");
}

function textFrom(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  const record = value as {
    response?: unknown;
    result?: unknown;
    content?: unknown;
    choices?: unknown;
  };
  if (Array.isArray(record.choices)) {
    const first = record.choices[0] as
      | { text?: unknown; message?: { content?: unknown } }
      | undefined;
    const fromChoice =
      typeof first?.text === "string" ? first.text : partsText(first?.message?.content);
    if (fromChoice.trim()) return fromChoice;
  }
  const fromParts = partsText(record.content);
  if (fromParts.trim()) return fromParts;
  if (typeof record.response === "string" && record.response.trim()) return record.response;
  if (typeof record.result === "string") return record.result;
  return "";
}

function visibleAnswer(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<think>[\s\S]*$/i, "")
    .trim();
}

export function readTutorResult(result: unknown): { text: string; input: number; output: number } {
  if (typeof result === "string") return { text: visibleAnswer(result), input: 0, output: 0 };
  if (!result || typeof result !== "object") return { text: "", input: 0, output: 0 };
  const usage = (result as { usage?: Usage }).usage;
  return {
    text: visibleAnswer(textFrom(result)),
    input: usage?.prompt_tokens ?? usage?.input_tokens ?? 0,
    output: usage?.completion_tokens ?? usage?.output_tokens ?? 0,
  };
}

async function tokensUsed(env: Env, userId: string): Promise<number> {
  const row = await env.DB.prepare(
    `SELECT COALESCE(SUM(input_tokens + output_tokens), 0) AS n
     FROM ai_log
     WHERE user_id = ? AND cache_hit = 0 AND created_at >= ?`
  )
    .bind(userId, monthStartIso())
    .first<{ n: number }>();
  return Number(row?.n ?? 0);
}

async function logCall(
  env: Env,
  userId: string,
  kind: string,
  prompt: string,
  reply: string,
  input: number,
  output: number,
  cacheHit: boolean
) {
  await env.DB.prepare(
    `INSERT INTO ai_log
      (id, user_id, kind, prompt, reply, input_tokens, output_tokens, cache_hit, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      crypto.randomUUID(),
      userId,
      kind,
      prompt,
      reply,
      input,
      output,
      cacheHit ? 1 : 0,
      new Date().toISOString()
    )
    .run();
}

export async function runTutor(
  env: Env,
  user: UserRow,
  kind: "explain" | "translation",
  prompt: string
): Promise<{ reply: string } | { error: "cap" | "model"; message: string }> {
  const model = kind === "translation" ? env.AI_TRANSLATION_MODEL : env.AI_MODEL;
  // v2 drops replies cached while Kimi was still spending the token cap on a reasoning trace.
  const cacheKey = `ai:${await sha256(`v2\n${model}\n${kind}\n${prompt}`)}`;
  const cached = await env.CACHE.get(cacheKey);
  if (cached) {
    await logCall(env, user.id, kind, prompt, cached, 0, 0, true);
    return { reply: cached };
  }

  const used = await tokensUsed(env, user.id);
  if (used >= user.token_cap) {
    return {
      error: "cap",
      message: "This account has reached its monthly token cap.",
    };
  }

  let result: unknown;
  try {
    result = await env.AI.run(model, tutorRequest(model, prompt, kind === "translation"), {
      gateway: { id: env.AI_GATEWAY_ID || "default" },
    });
  } catch (error) {
    console.error(error);
    return { error: "model", message: "The tutor could not answer just now." };
  }

  const read = readTutorResult(result);
  if (!read.text) {
    return { error: "model", message: "The tutor returned an empty answer." };
  }
  await env.CACHE.put(cacheKey, read.text, { expirationTtl: 60 * 60 * 24 * 14 });
  await logCall(env, user.id, kind, prompt, read.text, read.input, read.output, false);
  return { reply: read.text };
}
