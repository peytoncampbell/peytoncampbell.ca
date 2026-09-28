import { useEffect, useState } from 'react';
import { AUTH_CONFIGURED, resolveDeskHome, useNoIndex, useOwnerSession, type DeskHome } from './ownerAuth';

/**
 * The way in.
 *
 * A separate route rather than a section of the public site: the console behind it is a different
 * page entirely, and this one exists only to establish the session and hand the account to its own
 * desk - the owner console for the allowlisted account, the reader desk for everyone else. The
 * navigation carries one accent-coloured "Log in" item pointing here, with the desk section's
 * quiet line kept as the contextual shortcut.
 */
export default function OwnerLogin({ onSignedIn, onHome }: { onSignedIn: (path: DeskHome) => void; onHome: () => void }) {
  const { session, ready, error, signIn, requestLink, ensureFresh } = useOwnerSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  useNoIndex();

  useEffect(() => {
    document.title = 'Sign in | Peyton Campbell';
  }, []);

  // Every signed-in account goes to the desk its own identity can actually read - the resolver
  // asks the same auth.uid()-gated view the console reads, so routing and data cannot disagree.
  // This is the one routing path: a password sign-in and a returned emailed link both settle here.
  useEffect(() => {
    if (!ready || !session) return;
    let active = true;
    void resolveDeskHome(ensureFresh).then((path) => { if (active) onSignedIn(path); });
    return () => { active = false; };
  }, [ready, session, ensureFresh, onSignedIn]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    const ok = await signIn(email.trim(), password);
    setBusy(false);
    // No navigate here: the session effect above resolves the desk once the sign-in settles.
    if (ok) setPassword('');
  };

  const sendLink = async () => {
    setBusy(true);
    setNotice(null);
    // The link returns to this gate, where the session effect sends the account to its desk.
    const ok = await requestLink(email.trim(), '/login');
    setBusy(false);
    if (ok) setNotice('Check that inbox for a sign-in link - it comes back to this site.');
  };

  return (
    <div className="own-gate">
      <div className="own-gate-card">
        <div className="own-gate-head">
          <span className="own-mark">PC</span>
          <div>
            <h1>Sign in</h1>
            <p>One account. The book, the calls and the history live behind it.</p>
          </div>
        </div>

        {!AUTH_CONFIGURED && (
          <p className="own-note own-note-warn">
            This build has no Supabase URL or anon key, so there is nothing to sign in to.
          </p>
        )}

        <form onSubmit={submit} className="own-form">
          <label className="own-field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={!AUTH_CONFIGURED || busy}
            />
          </label>
          <label className="own-field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={!AUTH_CONFIGURED || busy}
            />
          </label>

          <div className="own-form-actions">
            <button type="submit" className="own-btn primary" disabled={!AUTH_CONFIGURED || busy}>
              {busy ? 'Working...' : 'Sign in'}
            </button>
            <button type="button" className="own-btn ghost" disabled={!AUTH_CONFIGURED || busy} onClick={sendLink}>
              Email me a link
            </button>
          </div>
        </form>

        {error && <p className="own-note own-note-warn">{error}</p>}
        {notice && <p className="own-note">{notice}</p>}

        <div className="own-gate-foot">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onHome();
            }}
          >
            Back to the site
          </a>
          <span className="own-quiet">Private account - the data is withheld by the database, not by this page.</span>
        </div>
      </div>
    </div>
  );
}
