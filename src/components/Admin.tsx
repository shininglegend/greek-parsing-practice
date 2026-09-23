import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useSession } from "../session";
import {
  type AdminUser,
  type AiLogRow,
  getAdminLogs,
  getAdminUsers,
  updateAdminUser,
} from "../studyApi";
import { Footer, Header } from "./";

export function Admin() {
  const { userId } = useParams();
  const { user, loading } = useSession();
  if (loading) {
    return (
      <>
        <Header />
        <p className="p-4 text-sm">Loading…</p>
      </>
    );
  }
  if (user?.role !== "admin") {
    return (
      <>
        <Header />
        <p className="p-4">This page is for the admin account.</p>
      </>
    );
  }
  return (
    <>
      <Header />
      <div className="mx-auto max-w-3xl p-4 space-y-4">
        {userId ? <AdminLogs userId={userId} /> : <AdminList />}
        <Footer />
      </div>
    </>
  );
}

function AdminList() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await getAdminUsers();
    setUsers(data.users);
  }, []);

  useEffect(() => {
    load().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Could not load users.");
    });
  }, [load]);

  async function setStatus(id: string, status: string) {
    await updateAdminUser(id, { status });
    await load();
  }

  async function setCap(id: string, tokenCap: number) {
    await updateAdminUser(id, { tokenCap });
    await load();
  }

  return (
    <>
      <h2 className="text-xl font-bold">Accounts</h2>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <ul className="space-y-3">
        {users?.map((account) => (
          <li key={account.id} className="card space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <div className="font-semibold">{account.email}</div>
                <div className="text-sm text-slate-600">
                  {account.status}
                  {account.role === "admin" ? " · admin" : ""} · joined{" "}
                  {account.created_at.slice(0, 10)}
                </div>
              </div>
              <Link
                className="text-sm text-blue-700 underline min-h-11 inline-flex items-center"
                to={`/admin/${account.id}`}
              >
                Tutor log
              </Link>
            </div>
            <p className="text-sm">
              This month: {account.calls} calls, {account.input_tokens} in, {account.output_tokens}{" "}
              out. Cap {account.token_cap}.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn"
                onClick={() => setStatus(account.id, "approved")}
              >
                Approve
              </button>
              <button type="button" className="btn" onClick={() => setStatus(account.id, "denied")}>
                Revoke
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setStatus(account.id, "pending")}
              >
                Mark pending
              </button>
            </div>
            <CapForm current={account.token_cap} onSave={(value) => setCap(account.id, value)} />
          </li>
        ))}
      </ul>
      {users && users.length === 0 && <p className="text-sm">No signed-in accounts yet.</p>}
    </>
  );
}

function CapForm({ current, onSave }: { current: number; onSave: (value: number) => void }) {
  const [value, setValue] = useState(String(current));
  return (
    <form
      className="flex gap-2 items-center"
      onSubmit={(event) => {
        event.preventDefault();
        const next = Number(value);
        if (Number.isFinite(next)) onSave(next);
      }}
    >
      <label className="text-sm flex items-center gap-2">
        Monthly token cap
        <input
          className="input w-28"
          inputMode="numeric"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
      <button type="submit" className="btn">
        Save
      </button>
    </form>
  );
}

function AdminLogs({ userId }: { userId: string }) {
  const [logs, setLogs] = useState<AiLogRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAdminLogs(userId)
      .then((data) => setLogs(data.logs))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not load the log.");
      });
  }, [userId]);

  return (
    <>
      <Link to="/admin" className="text-sm text-blue-700 underline">
        All accounts
      </Link>
      <h2 className="text-xl font-bold">Tutor log</h2>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {logs && logs.length === 0 && <p className="text-sm">No tutor requests yet.</p>}
      <ul className="space-y-3">
        {logs?.map((row) => (
          <li key={row.id} className="card space-y-2 text-sm">
            <div className="text-slate-600">
              {row.created_at} · {row.kind} ·{" "}
              {row.cache_hit ? "cache" : `${row.input_tokens} in / ${row.output_tokens} out`}
            </div>
            <div>
              <div className="font-semibold">Query</div>
              <pre className="whitespace-pre-wrap font-sans">{row.prompt}</pre>
            </div>
            <div>
              <div className="font-semibold">Reply</div>
              <pre className="whitespace-pre-wrap font-sans">{row.reply}</pre>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
