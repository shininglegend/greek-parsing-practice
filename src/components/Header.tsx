import { type FormEvent, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useSession } from "../session";
import { ApiError, logout, sendMagicLink } from "../studyApi";
import { GrammarGuide, Help, Modal, MorphologyCharts } from "./";
import { TurnstileField } from "./TurnstileField";

export function Header() {
  const [params] = useSearchParams();
  const { user, turnstileSiteKey, refresh } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(params.get("auth") === "invalid");
  const [showGrammarGuide, setShowGrammarGuide] = useState(false);
  const [showMorphologyCharts, setShowMorphologyCharts] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [authMessage, setAuthMessage] = useState<string | null>(
    params.get("auth") === "invalid" ? "That sign-in link has expired." : null
  );
  const [sending, setSending] = useState(false);

  function closeMenu() {
    setMenuOpen(false);
  }

  async function submitEmail(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setAuthMessage(null);
    try {
      await sendMagicLink(email, token);
      setAuthMessage("Check your email for a sign-in link.");
    } catch (error) {
      setAuthMessage(error instanceof ApiError ? error.message : "Could not send the link.");
    } finally {
      setSending(false);
    }
  }

  async function signOut() {
    await logout();
    await refresh();
    setAuthMessage(null);
  }

  const linkClass = "min-h-11 flex items-center text-sm";

  return (
    <>
      <header className="sticky top-0 z-50 bg-white border-b">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between gap-3">
          <Link to="/" className="text-lg font-bold" onClick={closeMenu}>
            Koine Parser
          </Link>
          <div className="flex items-center gap-2">
            {user?.email ? (
              <button type="button" className="btn" onClick={signOut}>
                Sign out
              </button>
            ) : (
              <button
                type="button"
                className="btn"
                aria-expanded={authOpen}
                onClick={() => {
                  setAuthOpen((open) => !open);
                  setMenuOpen(false);
                }}
              >
                Sign in
              </button>
            )}
            <button
              type="button"
              className="btn"
              aria-expanded={menuOpen}
              onClick={() => {
                setMenuOpen((open) => !open);
                setAuthOpen(false);
              }}
            >
              Menu
            </button>
          </div>
        </div>
        {authOpen && !user?.email && (
          <div className="mx-auto max-w-5xl px-4 pb-4 border-t">
            <form className="space-y-2 max-w-sm pt-3" onSubmit={submitEmail}>
              <label className="block text-sm">
                Email
                <input
                  className="input w-full mt-1"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                />
              </label>
              <TurnstileField siteKey={turnstileSiteKey} onToken={setToken} />
              <button
                type="submit"
                className="btn"
                disabled={sending || (Boolean(turnstileSiteKey) && !token)}
              >
                {sending ? "Sending…" : "Email me a sign-in link"}
              </button>
              {authMessage && <p className="text-sm text-slate-700">{authMessage}</p>}
            </form>
          </div>
        )}
        {menuOpen && (
          <nav className="mx-auto max-w-5xl px-4 pb-4 flex flex-col gap-1 border-t">
            <Link to="/" className={linkClass} onClick={closeMenu}>
              Study
            </Link>
            <Link to="/reverse" className={linkClass} onClick={closeMenu}>
              Reverse parser
            </Link>
            <Link to="/weak-spots" className={linkClass} onClick={closeMenu}>
              Weak spots
            </Link>
            <button
              type="button"
              className={`${linkClass} text-left`}
              onClick={() => {
                closeMenu();
                setShowHelp(true);
              }}
            >
              Help
            </button>
            <button
              type="button"
              className={`${linkClass} text-left`}
              onClick={() => {
                closeMenu();
                setShowMorphologyCharts(true);
              }}
            >
              Morphology charts
            </button>
            <button
              type="button"
              className={`${linkClass} text-left`}
              onClick={() => {
                closeMenu();
                setShowGrammarGuide(true);
              }}
            >
              Grammar guide
            </button>
            {user?.role === "admin" && (
              <Link to="/admin" className={linkClass} onClick={closeMenu}>
                Admin
              </Link>
            )}
            <div className="border-t pt-3 mt-2 space-y-2">
              {user?.email ? (
                <>
                  <p className="text-sm">
                    {user.email}
                    {user.status === "pending" ? " — waiting for approval" : ""}
                    {user.status === "denied" ? " — tutor off" : ""}
                    {user.status === "approved" ? " — approved" : ""}
                  </p>
                  <button type="button" className="btn" onClick={signOut}>
                    Sign out
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    closeMenu();
                    setAuthOpen(true);
                  }}
                >
                  Sign in
                </button>
              )}
              {authMessage && !authOpen && <p className="text-sm text-slate-700">{authMessage}</p>}
            </div>
          </nav>
        )}
      </header>

      <Modal isOpen={showHelp} onClose={() => setShowHelp(false)} title="Help">
        <Help />
      </Modal>
      <Modal
        isOpen={showMorphologyCharts}
        onClose={() => setShowMorphologyCharts(false)}
        title="Morphology Charts"
      >
        <MorphologyCharts />
      </Modal>
      <Modal
        isOpen={showGrammarGuide}
        onClose={() => setShowGrammarGuide(false)}
        title="Grammar Guide"
      >
        <GrammarGuide />
      </Modal>
    </>
  );
}
