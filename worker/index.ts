import { asRecord, asString, json, readJson, sha256 } from "./http";
import {
  anonymousUser,
  consumeMagicLink,
  isAdminEmail,
  logout,
  magicLinkEmail,
  monthStartIso,
  publicUser,
  readSession,
  sendMagicLink,
  signedInDocument,
  signInConfirmPage,
  type UserRow,
} from "./session";
import { aiBlock, explainPrompt, runTutor, translationPrompt } from "./tutor";

const FIELDS = new Set(["pos", "case", "number", "gender", "tense", "voice", "mood", "person"]);

async function requireAdmin(request: Request, env: Env) {
  const user = await readSession(request, env);
  if (!user || (user.role !== "admin" && !isAdminEmail(env, user.email ?? ""))) {
    return { denied: json({ error: "forbidden", message: "Admin only." }, { status: 403 }) };
  }
  return { denied: null };
}

/** Attempts are stored only for accounts. A guest keeps them in the browser. */
async function requireAccount(request: Request, env: Env) {
  const user = await readSession(request, env);
  if (!user?.email) {
    return {
      user: null,
      denied: json({ error: "sign_in", message: "Sign in to save attempts." }, { status: 401 }),
    };
  }
  return { user, denied: null };
}

type AttemptRow = {
  verseRef: string;
  wordId: string;
  surface: string | null;
  lemma: string | null;
  field: string;
  guess: string;
  gold: string;
  cue: string | null;
};

function readAttempt(body: Record<string, unknown> | null): AttemptRow | null {
  const verseRef = asString(body?.verseRef, 40);
  const wordId = asString(body?.wordId, 80);
  const field = asString(body?.field, 20);
  const gold = asString(body?.gold, 40);
  const guess = asString(body?.guess, 40);
  if (!verseRef || !wordId || !field || !gold || !guess || !FIELDS.has(field)) return null;
  return {
    verseRef,
    wordId,
    surface: asString(body?.surface, 80),
    lemma: asString(body?.lemma, 80),
    field,
    guess,
    gold,
    cue: asString(body?.cue, 40),
  };
}

function insertAttempt(env: Env, userId: string, id: string, a: AttemptRow, createdAt: string) {
  return env.DB.prepare(
    `INSERT INTO attempts
      (id, user_id, verse_ref, word_id, surface, lemma, field, guess, gold, cue, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    userId,
    a.verseRef,
    a.wordId,
    a.surface,
    a.lemma,
    a.field,
    a.guess,
    a.gold,
    a.cue,
    createdAt
  );
}

const IMPORT_MAX = 5000;

function tooMany(message: string, cookies: string[] = []) {
  return json({ error: "rate", message }, { status: 429, cookies });
}

async function verifyTurnstile(
  request: Request,
  env: Env,
  token: unknown,
  check?: { action: string; hostname: string }
): Promise<boolean> {
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
  const data = (await response.json()) as { success?: boolean; action?: string; hostname?: string };
  if (data.success !== true) return false;
  if (check && (data.action !== check.action || data.hostname !== check.hostname)) return false;
  return true;
}

async function route(request: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname;

  if (path === "/api/me" && request.method === "GET") {
    const user = (await readSession(request, env)) ?? anonymousUser();
    return json({
      user: publicUser(user),
      turnstileSiteKey: (env.TURNSTILE_SITE_KEY as string) || "",
    });
  }

  if (path === "/api/auth/magic-link" && request.method === "POST") {
    const body = asRecord(await readJson(request));
    const email = asString(body?.email, 200)?.toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "email", message: "Enter a valid email address." }, { status: 400 });
    }
    const turnstileOk = await verifyTurnstile(request, env, body?.turnstileToken, {
      action: "signin",
      hostname: url.hostname,
    });
    if (!turnstileOk) {
      return json({ error: "turnstile", message: "The check failed. Try again." }, { status: 400 });
    }
    // One sign-in email per address per minute, so nobody can flood an inbox from our sender.
    const { success } = await env.MAGIC_LINK_LIMIT.limit({ key: await sha256(email) });
    if (!success) {
      return tooMany("A sign-in link was sent a moment ago. Check your inbox or wait a minute.");
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

  if (path === "/api/auth/verify" && request.method === "HEAD") {
    return new Response(null, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  if (path === "/api/auth/verify" && (request.method === "GET" || request.method === "POST")) {
    const home = new URL("/", request.url);
    const invalid = new URL("/?auth=invalid", request.url);
    const siteKey = (env.TURNSTILE_SITE_KEY as string) || "";
    const action = new URL("/api/auth/verify", request.url).href;
    const pageHeaders = {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
    };
    const form = request.method === "POST" ? await request.formData() : null;
    const token = form ? String(form.get("token") ?? "") : (url.searchParams.get("token") ?? "");
    const email = token ? await magicLinkEmail(env, token) : null;
    if (!email) {
      return new Response(null, { status: 303, headers: { location: invalid.href } });
    }
    if (form) {
      const turnstileOk = await verifyTurnstile(request, env, form.get("cf-turnstile-response"), {
        action: "signin",
        hostname: url.hostname,
      });
      if (!turnstileOk) {
        return new Response(
          signInConfirmPage(action, token, email, siteKey, "The check failed. Try again."),
          { headers: pageHeaders }
        );
      }
      const cookie = await consumeMagicLink(request, env, token);
      if (!cookie) {
        return new Response(null, { status: 303, headers: { location: invalid.href } });
      }
      const headers = new Headers({
        location: home.href,
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        refresh: `0;url=${home.href}`,
      });
      headers.append("Set-Cookie", cookie);
      return new Response(signedInDocument(home.href), { status: 303, headers });
    }
    return new Response(signInConfirmPage(action, token, email, siteKey), { headers: pageHeaders });
  }

  if (path === "/api/auth/logout" && request.method === "POST") {
    const cookie = await logout(request, env);
    return json({ ok: true }, { cookies: [cookie] });
  }

  if (path === "/api/attempts" && request.method === "POST") {
    const { user, denied } = await requireAccount(request, env);
    if (denied) return denied;
    const paced = await env.ATTEMPTS_LIMIT.limit({ key: user.id });
    if (!paced.success) return tooMany("Attempts are being saved too quickly. Wait a minute.");
    const attempt = readAttempt(asRecord(await readJson(request)));
    if (!attempt)
      return json({ error: "attempt", message: "Incomplete attempt." }, { status: 400 });
    const id = crypto.randomUUID();
    await insertAttempt(env, user.id, id, attempt, new Date().toISOString()).run();
    const prior = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM attempts
       WHERE user_id = ? AND field = ? AND gold = ? AND guess != gold
         AND IFNULL(cue, '') = ? AND id != ?`
    )
      .bind(user.id, attempt.field, attempt.gold, attempt.cue ?? "", id)
      .first<{ n: number }>();
    return json({ priorMisses: Number(prior?.n ?? 0) });
  }

  // What a browser saved before there was an account, sent once after sign-in.
  if (path === "/api/attempts/import" && request.method === "POST") {
    const { user, denied } = await requireAccount(request, env);
    if (denied) return denied;
    const paced = await env.ATTEMPTS_LIMIT.limit({ key: user.id });
    if (!paced.success) return tooMany("Attempts are being saved too quickly. Wait a minute.");
    const body = asRecord(await readJson(request));
    const list = Array.isArray(body?.attempts) ? body.attempts : null;
    if (!list || list.length > IMPORT_MAX) {
      return json({ error: "attempts", message: "Send a list of attempts." }, { status: 400 });
    }
    const now = Date.now();
    const statements = [];
    for (const entry of list) {
      const record = asRecord(entry);
      const attempt = readAttempt(record);
      if (!attempt) continue;
      const stamp = Date.parse(asString(record?.createdAt, 40) ?? "");
      const createdAt = new Date(
        Number.isFinite(stamp) && stamp <= now ? stamp : now
      ).toISOString();
      statements.push(insertAttempt(env, user.id, crypto.randomUUID(), attempt, createdAt));
    }
    if (statements.length > 0) await env.DB.batch(statements);
    return json({ imported: statements.length });
  }

  if (path === "/api/weak-spots" && request.method === "GET") {
    const { user, denied } = await requireAccount(request, env);
    if (denied) return denied;
    const session = { user, cookies: [] as string[] };
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

  if ((path === "/api/explain" || path === "/api/translation-note") && request.method === "POST") {
    const user = (await readSession(request, env)) ?? anonymousUser();
    const session = { user, cookies: [] as string[] };
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
    // Signed-in, approved accounts are already vetted and token-capped; no Turnstile here.
    const body = asRecord(await readJson(request));
    const kind = path === "/api/explain" ? "explain" : "translation";
    const prompt = body
      ? kind === "explain"
        ? explainPrompt(body)
        : translationPrompt(body)
      : null;
    if (!prompt) {
      return json(
        { error: "prompt", message: "The tutor request was incomplete." },
        { status: 400, cookies: session.cookies }
      );
    }
    const result = await runTutor(env, session.user, kind, prompt);
    if ("error" in result) {
      return json(
        { error: result.error, message: result.message },
        {
          status: result.error === "cap" || result.error === "rate" ? 429 : 502,
          cookies: session.cookies,
        }
      );
    }
    return json({ reply: result.reply }, { cookies: session.cookies });
  }

  const adminMatch = path.match(/^\/api\/admin\/users(?:\/([^/]+))?(?:\/(logs))?$/);
  if (adminMatch) {
    const { denied } = await requireAdmin(request, env);
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
         ORDER BY created_at DESC
         LIMIT 200`
      )
        .bind(since, since, since)
        .all();
      return json({ users: rows.results });
    }

    if (userId && logs && request.method === "GET") {
      const rows = await env.DB.prepare(
        `SELECT id, kind, prompt, reply, input_tokens, output_tokens, cache_hit, created_at
         FROM ai_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`
      )
        .bind(userId)
        .all();
      return json({ logs: rows.results });
    }

    if (userId && request.method === "POST") {
      const body = asRecord(await readJson(request));
      const status = asString(body?.status, 20);
      const tokenCap = body?.tokenCap;
      if (status && !["pending", "approved", "denied"].includes(status)) {
        return json({ error: "status", message: "Unknown status." }, { status: 400 });
      }
      if (status) {
        await env.DB.prepare("UPDATE users SET status = ? WHERE id = ?").bind(status, userId).run();
      }
      if (typeof tokenCap === "number" && tokenCap >= 0 && tokenCap <= 5_000_000) {
        await env.DB.prepare("UPDATE users SET token_cap = ? WHERE id = ?")
          .bind(Math.floor(tokenCap), userId)
          .run();
      }
      const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?")
        .bind(userId)
        .first<UserRow>();
      return json({ user: user ? publicUser(user) : null });
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
