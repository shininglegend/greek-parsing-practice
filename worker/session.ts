import { clearSessionCookie, readCookie, sessionCookie, sha256 } from "./http";

const SESSION_SECONDS = 60 * 24 * 60 * 60;

export type UserRow = {
  id: string;
  email: string | null;
  status: string;
  role: string;
  token_cap: number;
  created_at: string;
};

export type SessionResult = {
  user: UserRow;
  cookies: string[];
};

export function publicUser(user: UserRow) {
  return {
    id: user.id,
    email: user.email,
    status: user.status,
    role: user.role,
    tokenCap: user.token_cap,
  };
}

export function isAdminEmail(env: Env, email: string): boolean {
  const allowlist: string = env.ADMIN_EMAILS;
  return allowlist.split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.trim().toLowerCase());
}

export function monthStartIso(): string {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  return start.toISOString();
}

async function insertSession(env: Env, userId: string, request: Request): Promise<string> {
  const id = crypto.randomUUID();
  const expires = new Date(Date.now() + SESSION_SECONDS * 1000).toISOString();
  await env.DB.prepare(
    "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)"
  )
    .bind(id, userId, expires)
    .run();
  return sessionCookie(id, request, SESSION_SECONDS);
}

async function createGuest(env: Env): Promise<UserRow> {
  const id = crypto.randomUUID();
  const created = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO users (id, email, status, role, token_cap, created_at) VALUES (?, NULL, 'guest', 'user', 20000, ?)"
  )
    .bind(id, created)
    .run();
  const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?")
    .bind(id)
    .first<UserRow>();
  if (!user) throw new Error("guest user missing");
  return user;
}

export async function ensureSession(request: Request, env: Env): Promise<SessionResult> {
  const existing = readCookie(request.headers.get("Cookie"), "session");
  if (existing) {
    const user = await env.DB.prepare(
      `SELECT users.* FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.id = ? AND sessions.expires_at > ?`
    )
      .bind(existing, new Date().toISOString())
      .first<UserRow>();
    if (user) return { user, cookies: [] };
  }
  const user = await createGuest(env);
  const cookie = await insertSession(env, user.id, request);
  return { user, cookies: [cookie] };
}

export async function logout(request: Request, env: Env): Promise<string> {
  const existing = readCookie(request.headers.get("Cookie"), "session");
  if (existing) {
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(existing).run();
  }
  return clearSessionCookie(request);
}

export async function sendMagicLink(
  request: Request,
  env: Env,
  email: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const from: string = env.EMAIL_FROM;
  if (!from) {
    return {
      ok: false,
      message: "Email sending is not configured yet. Set EMAIL_FROM on the Worker.",
    };
  }
  const tokenBytes = new Uint8Array(32);
  crypto.getRandomValues(tokenBytes);
  const token = [...tokenBytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const tokenHash = await sha256(token);
  const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  await env.DB.prepare(
    "INSERT INTO magic_links (token_hash, email, expires_at) VALUES (?, ?, ?)"
  )
    .bind(tokenHash, email.toLowerCase(), expires)
    .run();

  const link = new URL("/api/auth/verify", request.url);
  link.searchParams.set("token", token);
  const text = `Sign in to Koine Parser:\n${link.href}\n\nThis link expires in 30 minutes.`;
  await env.EMAIL.send({
    to: email,
    from,
    subject: "Your Koine Parser sign-in link",
    text,
    html: `<p><a href="${link.href}">Sign in to Koine Parser</a></p><p>This link expires in 30 minutes.</p>`,
  });
  return { ok: true };
}

export async function consumeMagicLink(
  request: Request,
  env: Env,
  token: string
): Promise<string | null> {
  const tokenHash = await sha256(token);
  const link = await env.DB.prepare(
    "SELECT email, expires_at FROM magic_links WHERE token_hash = ?"
  )
    .bind(tokenHash)
    .first<{ email: string; expires_at: string }>();
  if (!link || link.expires_at < new Date().toISOString()) return null;
  await env.DB.prepare("DELETE FROM magic_links WHERE token_hash = ?")
    .bind(tokenHash)
    .run();

  const current = await ensureSession(request, env);
  let account = await env.DB.prepare("SELECT * FROM users WHERE email = ?")
    .bind(link.email)
    .first<UserRow>();

  if (!account) {
    const admin = isAdminEmail(env, link.email);
    const id = crypto.randomUUID();
    const created = new Date().toISOString();
    await env.DB.prepare(
      "INSERT INTO users (id, email, status, role, token_cap, created_at) VALUES (?, ?, ?, ?, 20000, ?)"
    )
      .bind(id, link.email, admin ? "approved" : "pending", admin ? "admin" : "user", created)
      .run();
    account = await env.DB.prepare("SELECT * FROM users WHERE id = ?")
      .bind(id)
      .first<UserRow>();
  } else if (isAdminEmail(env, link.email) && account.role !== "admin") {
    await env.DB.prepare(
      "UPDATE users SET role = 'admin', status = 'approved' WHERE id = ?"
    )
      .bind(account.id)
      .run();
  }

  if (!account) return null;

  if (current.user.id !== account.id && current.user.status === "guest") {
    await env.DB.batch([
      env.DB.prepare("UPDATE attempts SET user_id = ? WHERE user_id = ?").bind(
        account.id,
        current.user.id
      ),
      env.DB.prepare("UPDATE ai_log SET user_id = ? WHERE user_id = ?").bind(
        account.id,
        current.user.id
      ),
      env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(current.user.id),
      env.DB.prepare("DELETE FROM users WHERE id = ? AND status = 'guest'").bind(
        current.user.id
      ),
    ]);
  }

  return insertSession(env, account.id, request);
}
