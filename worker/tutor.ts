import { asString, sha256 } from "./http";
import { monthStartIso, type UserRow } from "./session";

const SYSTEM = [
  "You tutor Koine Greek for someone who has already been shown a signal card.",
  "The gold morphological parse is from MorphGNT and is correct.",
  "Do not offer a different parse, and do not treat any English version as the only right translation.",
  "Explain from the signal notes and the clause. Be concise, about a short paragraph.",
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
  const clause = asString(body.clause, 500);
  if (!verseRef || !surface || !signal || !clause) return null;
  const lemma = asString(body.lemma, 80) ?? "unknown";
  const gold = asString(body.gold, 500) ?? "";
  const guess = asString(body.guess, 500) ?? "";
  return [
    `Verse: ${verseRef}`,
    `Word: ${surface} (lemma ${lemma})`,
    `Gold parse: ${gold}`,
    `Student chose: ${guess}`,
    `Clause: ${clause}`,
    `Signal card: ${signal}`,
    "Explain this miss or this form. Do not change the gold parse.",
  ].join("\n");
}

export function translationPrompt(body: Record<string, unknown>): string | null {
  const verseRef = asString(body.verseRef, 40);
  const greek = asString(body.greek, 1000);
  const english = asString(body.english, 2000);
  const checklist = asString(body.checklist, 4000);
  const versions = asString(body.versions, 4000);
  if (!verseRef || !greek || !english || !checklist || !versions) return null;
  return [
    `Verse: ${verseRef}`,
    `Greek: ${greek}`,
    `Student English: ${english}`,
    `Parse checklist:\n${checklist}`,
    `Public-domain versions:\n${versions}`,
    "Say whether the student's English shows the checklist items. Do not grade it as wrong against one version. Note where the versions themselves differ.",
  ].join("\n");
}

const PARAGRAPH_TOKENS = 1024;

type Usage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  input_tokens?: number;
  output_tokens?: number;
};

export function tutorRequest(model: string, prompt: string): Record<string, unknown> {
  // Anthropic Messages puts the system prompt beside the messages and requires max_tokens.
  if (model.startsWith("anthropic/")) {
    return {
      max_tokens: PARAGRAPH_TOKENS,
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    };
  }
  return {
    max_tokens: PARAGRAPH_TOKENS,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: prompt },
    ],
  };
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
  if (typeof record.response === "string") return record.response;
  if (typeof record.result === "string") return record.result;
  if (Array.isArray(record.content)) {
    return record.content
      .map((block) => {
        if (!block || typeof block !== "object") return "";
        const item = block as { type?: string; text?: string };
        if (item.type && item.type !== "text") return "";
        return item.text ?? "";
      })
      .join("");
  }
  if (Array.isArray(record.choices)) {
    const first = record.choices[0] as
      | { text?: unknown; message?: { content?: unknown } }
      | undefined;
    if (typeof first?.text === "string") return first.text;
    if (typeof first?.message?.content === "string") return first.message.content;
  }
  return "";
}

export function readTutorResult(result: unknown): { text: string; input: number; output: number } {
  if (typeof result === "string") return { text: result.trim(), input: 0, output: 0 };
  if (!result || typeof result !== "object") return { text: "", input: 0, output: 0 };
  const usage = (result as { usage?: Usage }).usage;
  return {
    text: textFrom(result).trim(),
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
  const model: string = env.AI_MODEL;
  const cacheKey = `ai:${await sha256(`${model}\n${kind}\n${prompt}`)}`;
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
    result = await env.AI.run(model, tutorRequest(model, prompt), {
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
