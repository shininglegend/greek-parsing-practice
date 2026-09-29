import { describe, expect, it } from "vitest";
import {
  createScheduler,
  passageName,
  RATE_LIMIT,
  type VersionText,
  versionsForTutor,
} from "./translations";

type Pending = { url: string; resolve: (response: Response) => void };

function harness() {
  let clock = 0;
  const timers: { at: number; fn: () => void }[] = [];
  const pending: Pending[] = [];
  const fetchImpl = ((url: string) =>
    new Promise<Response>((resolve) => pending.push({ url, resolve }))) as typeof fetch;
  const sched = createScheduler(
    fetchImpl,
    () => clock,
    (fn, ms) => void timers.push({ at: clock + ms, fn })
  );
  async function advance(ms: number) {
    clock += ms;
    for (const timer of [...timers].sort((a, b) => a.at - b.at)) {
      if (timer.at > clock) continue;
      timers.splice(timers.indexOf(timer), 1);
      timer.fn();
    }
    await Promise.resolve();
  }
  async function respond(status: number, body = "{}", headers: Record<string, string> = {}) {
    const next = pending.shift();
    if (!next) throw new Error("nothing in flight");
    next.resolve(new Response(body, { status, headers }));
    await new Promise((r) => setTimeout(r, 0));
  }
  return { sched, pending, advance, respond, timers };
}

function fill(sched: ReturnType<typeof createScheduler>, count: number, owner = Symbol("x")) {
  const changes: string[] = [];
  for (let i = 0; i < count; i++) {
    sched.enqueue("web", `John 1:${i + 1}`, owner, () => changes.push(`John 1:${i + 1}`));
  }
  return changes;
}

describe("passageName", () => {
  it("expands MorphGNT abbreviations and accepts dotted references", () => {
    expect(passageName("Jn 1:1")).toBe("John 1:1");
    expect(passageName("1Cor 13.4")).toBe("1 Corinthians 13:4");
    expect(passageName("Genesis 1:1")).toBeNull();
    expect(passageName("Jn 1")).toBeNull();
  });
});

describe("scheduler", () => {
  it("sends at most the window's worth of requests at once", async () => {
    const h = harness();
    fill(h.sched, RATE_LIMIT.requests + 5);
    expect(h.pending).toHaveLength(RATE_LIMIT.requests);
    expect(h.sched.isDelayed(`web/John 1:${RATE_LIMIT.requests + 1}`)).toBe(true);
    expect(h.timers).toHaveLength(1);
    await h.advance(RATE_LIMIT.windowMs);
    expect(h.pending).toHaveLength(RATE_LIMIT.requests + 5);
  });

  it("pauses the queue after a 429 and retries the same request", async () => {
    const h = harness();
    fill(h.sched, 2);
    await h.respond(429, "{}", { "Retry-After": "7" });
    expect(h.pending).toHaveLength(1);
    expect(h.sched.isDelayed("web/John 1:1")).toBe(true);
    await h.advance(6_000);
    expect(h.pending).toHaveLength(1);
    await h.advance(1_000);
    expect(h.pending).toHaveLength(2);
    expect(h.pending[1].url).toContain(encodeURIComponent("John 1:1"));
  });

  it("drops queued requests once nobody wants them", async () => {
    const h = harness();
    const owner = Symbol("verse");
    fill(h.sched, RATE_LIMIT.requests + 2, owner);
    h.sched.release(owner);
    await h.advance(RATE_LIMIT.windowMs);
    expect(h.pending).toHaveLength(RATE_LIMIT.requests);
  });

  it("dedupes the same text for two watchers", () => {
    const h = harness();
    h.sched.enqueue("web", "John 1:1", Symbol("a"), () => {});
    h.sched.enqueue("web", "John 1:1", Symbol("b"), () => {});
    expect(h.pending).toHaveLength(1);
  });
});

describe("versionsForTutor", () => {
  it("lists ready versions only and stays under the limit", () => {
    const list: VersionText[] = [
      { id: "web", label: "WEB", name: "", status: "ready", text: "In the beginning" },
      { id: "kjv", label: "KJV", name: "", status: "loading", text: null },
      { id: "asv", label: "ASV", name: "", status: "ready", text: "x".repeat(50) },
    ];
    expect(versionsForTutor(list)).toBe(`WEB: In the beginning\nASV: ${"x".repeat(50)}`);
    expect(versionsForTutor(list, 30)).toBe("WEB: In the beginning");
  });
});
