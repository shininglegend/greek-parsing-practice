export type SessionUser = {
  id: string;
  email: string | null;
  status: string;
  role: string;
  tokenCap: number;
};

export type WeakSpot = {
  field: string;
  gold: string;
  misses: number;
  total: number;
  verseRef: string | null;
};

export class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const body = (await response.json().catch(() => null)) as
    | { error?: string; message?: string }
    | T
    | null;
  if (!response.ok) {
    const record = body && typeof body === "object" ? body : {};
    const error = "error" in record ? record.error : undefined;
    const message = "message" in record ? record.message : undefined;
    throw new ApiError(error || "request", message || "Request failed.");
  }
  return body as T;
}

export function getMe() {
  return request<{ user: SessionUser; turnstileSiteKey: string }>("/api/me");
}

export function sendMagicLink(email: string, turnstileToken?: string) {
  return request<{ ok: true }>("/api/auth/magic-link", {
    method: "POST",
    body: JSON.stringify({ email, turnstileToken }),
  });
}

export function logout() {
  return request<{ ok: true }>("/api/auth/logout", { method: "POST" });
}

export function recordAttempt(attempt: {
  verseRef: string;
  wordId: string;
  surface?: string;
  lemma?: string;
  field: string;
  guess: string;
  gold: string;
  cue?: string;
}) {
  return request<{ priorMisses: number }>("/api/attempts", {
    method: "POST",
    body: JSON.stringify(attempt),
  });
}

export function importAttempts(
  attempts: Array<Parameters<typeof recordAttempt>[0] & { createdAt: string }>
) {
  return request<{ imported: number }>("/api/attempts/import", {
    method: "POST",
    body: JSON.stringify({ attempts }),
  });
}

export function getWeakSpots() {
  return request<{ spots: WeakSpot[] }>("/api/weak-spots");
}

export function askTutor(
  path: "/api/explain" | "/api/translation-note",
  body: Record<string, unknown>
) {
  return request<{ reply: string }>(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export type AdminUser = {
  id: string;
  email: string | null;
  status: string;
  role: string;
  token_cap: number;
  created_at: string;
  calls: number;
  input_tokens: number;
  output_tokens: number;
};

export type AiLogRow = {
  id: string;
  kind: string;
  prompt: string;
  reply: string;
  input_tokens: number;
  output_tokens: number;
  cache_hit: number;
  created_at: string;
};

export function getAdminUsers() {
  return request<{ users: AdminUser[] }>("/api/admin/users");
}

export function updateAdminUser(id: string, patch: { status?: string; tokenCap?: number }) {
  return request<{ user: SessionUser | null }>(`/api/admin/users/${encodeURIComponent(id)}`, {
    method: "POST",
    body: JSON.stringify(patch),
  });
}

export function getAdminLogs(id: string) {
  return request<{ logs: AiLogRow[] }>(`/api/admin/users/${encodeURIComponent(id)}/logs`);
}
