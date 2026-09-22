import { asRecord, asString, json, readJson } from "./http";
import {
  consumeMagicLink,
  ensureSession,
  isAdminEmail,
  logout,
  monthStartIso,
  publicUser,
  sendMagicLink,
  type UserRow,
} from "./session";
import { englishVersions } from "./translations";
import { aiBlock, explainPrompt, runTutor, translationPrompt } from "./tutor";

const FIELDS = new Set([
  "pos",
  "case",
  "number",
  "gender",
  "tense",
  "voice",
  "mood",
  "person",
]);

async function requireAdmin(request: Request, env: Env) {
  const session = await ensureSession(request, env);
  if (session.user.role !== "admin" && !isAdminEmail(env, session.user.email ?? "")) {
    return { session, denied: json({ error: "forbidden", message: "Admin only." }, { status: 403, cookies: session.cookies }) };
  }
  return { session, denied: null };
}

async function verifyTurnstile(request: Request, env: Env, token: unknown): Promise<boolean> {
  const secret = env.TURNSTILE_SECRET;
  if (!secret) return true;
  if (typeof token !== "string" || !token) return false;
  const body = new FormData();
  body.set("secret", secret);
  body.set("response", token);
  const ip = request.headers.get("CF-Connecting-IP");
  if (ip) body.set("remoteip", ip);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
  });
  const data = (await response.json()) as { success?: boolean };
  return data.success === true;
}

async function route(request: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname;

  if (path === "/api/me" && request.method === "GET") {
    const session = await ensureSession(request, env);
    return json(
      {
        user: publicUser(session.user),
        turnstileSiteKey: (env.TURNSTILE_SITE_KEY as string) || "",
      },
      { cookies: session.cookies }
    );
  }

  if (path === "/api/auth/magic-link" && request.method === "POST") {
    const body = asRecord(await readJson(request));
    const email = asString(body?.email, 200)?.toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "email", message: "Enter a valid email address." }, { status: 400 });
    }
    if (!(await verifyTurnstile(request, env, body?.turnstileToken))) {
      return json({ error: "turnstile", message: "The check failed. Try again." }, { status: 400 });
    }
    try {
      const sent = await sendMagicLink(request, env, email);
      if (!sent.ok) return json({ error: "email", message: sent.message }, { status: 503 });
      return json({ ok: true });
    } catch (error) {
      console.error(error);
      return json(
        { error: "email", message: "The sign-in email could not be sent." },
        { status: 502 }
      );
    }
  }

  if (path === "/api/auth/verify" && request.method === "GET") {
    const token = url.searchParams.get("token") ?? "";
    const cookie = token ? await consumeMagicLink(request, env, token) : null;
    const next = new URL(cookie ? "/" : "/?auth=invalid", request.url);
    const headers = new Headers({ location: next.href });
    if (cookie) headers.append("Set-Cookie", cookie);
    return new Response(null, { status: 302, headers });
  }

  if (path === "/api/auth/logout" && request.method === "POST") {
    const cookie = await logout(request, env);
    return json({ ok: true }, { cookies: [cookie] });
  }

  if (path === "/api/attempts" && request.method === "POST") {
    const session = await ensureSession(request, env);
    const body = asRecord(await readJson(request));
    const verseRef = asString(body?.verseRef, 40);
    const wordId = asString(body?.wordId, 80);
    const field = asString(body?.field, 20);
    const gold = asString(body?.gold, 40);
    const guess = asString(body?.guess, 40);
    if (!verseRef || !wordId || !field || !gold || !guess || !FIELDS.has(field)) {
      return json({ error: "attempt", message: "Incomplete attempt." }, { status: 400, cookies: session.cookies });
    }
    const id = crypto.randomUUID();
    const cue = asString(body?.cue, 40);
    await env.DB.prepare(
      `INSERT INTO attempts
        (id, user_id, verse_ref, word_id, surface, lemma, field, guess, gold, cue, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        id,
        session.user.id,
        verseRef,
        wordId,
        asString(body?.surface, 80),
        asString(body?.lemma, 80),
        field,
        guess,
        gold,
        cue,
        new Date().toISOString()
      )
      .run();
    const prior = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM attempts
       WHERE user_id = ? AND field = ? AND gold = ? AND guess != gold
         AND IFNULL(cue, '') = ? AND id != ?`
    )
      .bind(session.user.id, field, gold, cue ?? "", id)
      .first<{ n: number }>();
    return json(
      { priorMisses: Number(prior?.n ?? 0) },
      { cookies: session.cookies }
    );
  }

  if (path === "/api/weak-spots" && request.method === "GET") {
    const session = await ensureSession(request, env);
    const groups = await env.DB.prepare(
      `SELECT field, gold,
              SUM(CASE WHEN guess != gold THEN 1 ELSE 0 END) AS misses,
              COUNT(*) AS total
       FROM attempts
       WHERE user_id = ?
       GROUP BY field, gold
       ORDER BY misses DESC
       LIMIT 40`
    )
      .bind(session.user.id)
      .all<{ field: string; gold: string; misses: number; total: number }>();

    const spots = [];
    for (const row of groups.results) {
      if (Number(row.misses) <= 0) continue;
      const sample = await env.DB.prepare(
        `SELECT verse_ref FROM attempts
         WHERE user_id = ? AND field = ? AND gold = ? AND guess != gold
         ORDER BY created_at DESC LIMIT 1`
      )
        .bind(session.user.id, row.field, row.gold)
        .first<{ verse_ref: string }>();
      spots.push({
        field: row.field,
        gold: row.gold,
        misses: Number(row.misses),
        total: Number(row.total),
        verseRef: sample?.verse_ref ?? null,
      });
    }
    return json({ spots }, { cookies: session.cookies });
  }

  if (path === "/api/translations" && request.method === "GET") {
    const ref = url.searchParams.get("ref") ?? "";
    try {
      const versions = await englishVersions(env, ref);
      return json({ versions });
    } catch (error) {
      console.error(error);
      return json(
        { error: "translations", message: "The English versions could not be loaded." },
        { status: 502 }
      );
    }
  }

  if (
    (path === "/api/explain" || path === "/api/translation-note") &&
    request.method === "POST"
  ) {
    const session = await ensureSession(request, env);
    const block = aiBlock(session.user);
    if (block) {
      const message =
        block === "sign_in"
          ? "Sign in to ask the tutor."
          : block === "pending"
            ? "This account is waiting for approval."
            : "AI explanations are turned off for this account.";
      return json({ error: block, message }, { status: 403, cookies: session.cookies });
    }
    const body = asRecord(await readJson(request));
    if (!(await verifyTurnstile(request, env, body?.turnstileToken))) {
      return json({ error: "turnstile", message: "The check failed. Try again." }, { status: 400, cookies: session.cookies });
    }
    const kind = path === "/api/explain" ? "explain" : "translation";
    const prompt = body
      ? kind === "explain"
        ? explainPrompt(body)
        : translationPrompt(body)
      : null;
    if (!prompt) {
      return json({ error: "prompt", message: "The tutor request was incomplete." }, { status: 400, cookies: session.cookies });
    }
    const result = await runTutor(env, session.user, kind, prompt);
    if ("error" in result) {
      return json(
        { error: result.error, message: result.message },
        { status: result.error === "cap" ? 429 : 502, cookies: session.cookies }
      );
    }
    return json({ reply: result.reply }, { cookies: session.cookies });
  }

  const adminMatch = path.match(/^\/api\/admin\/users(?:\/([^/]+))?(?:\/(logs))?$/);
  if (adminMatch) {
    const { session, denied } = await requireAdmin(request, env);
    if (denied) return denied;
    const userId = adminMatch[1] ? decodeURIComponent(adminMatch[1]) : null;
    const logs = adminMatch[2] === "logs";

    if (!userId && request.method === "GET") {
      const since = monthStartIso();
      const rows = await env.DB.prepare(
        `SELECT id, email, status, role, token_cap, created_at,
                (SELECT COUNT(*) FROM ai_log WHERE ai_log.user_id = users.id AND created_at >= ?) AS calls,
                (SELECT COALESCE(SUM(input_tokens), 0) FROM ai_log WHERE user_id = users.id AND cache_hit = 0 AND created_at >= ?) AS input_tokens,
                (SELECT COALESCE(SUM(output_tokens), 0) FROM ai_log WHERE user_id = users.id AND cache_hit = 0 AND created_at >= ?) AS output_tokens
         FROM users
         WHERE status != 'guest'
         ORDER BY created_at DESC
         LIMIT 200`
      )
        .bind(since, since, since)
        .all();
      return json({ users: rows.results }, { cookies: session.cookies });
    }

    if (userId && logs && request.method === "GET") {
      const rows = await env.DB.prepare(
        `SELECT id, kind, prompt, reply, input_tokens, output_tokens, cache_hit, created_at
         FROM ai_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`
      )
        .bind(userId)
        .all();
      return json({ logs: rows.results }, { cookies: session.cookies });
    }

    if (userId && request.method === "POST") {
      const body = asRecord(await readJson(request));
      const status = asString(body?.status, 20);
      const tokenCap = body?.tokenCap;
      if (status && !["pending", "approved", "denied"].includes(status)) {
        return json({ error: "status", message: "Unknown status." }, { status: 400, cookies: session.cookies });
      }
      if (status) {
        await env.DB.prepare("UPDATE users SET status = ? WHERE id = ? AND status != 'guest'")
          .bind(status, userId)
          .run();
      }
      if (typeof tokenCap === "number" && tokenCap >= 0 && tokenCap <= 5_000_000) {
        await env.DB.prepare("UPDATE users SET token_cap = ? WHERE id = ?")
          .bind(Math.floor(tokenCap), userId)
          .run();
      }
      const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?")
        .bind(userId)
        .first<UserRow>();
      return json({ user: user ? publicUser(user) : null }, { cookies: session.cookies });
    }
  }

  return json({ error: "not_found", message: "No such API route." }, { status: 404 });
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }
    try {
      return await route(request, env, url);
    } catch (error) {
      console.error(error);
      return json({ error: "server", message: "Something went wrong." }, { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;
