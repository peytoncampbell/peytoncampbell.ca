import { useEffect, useState } from 'react';
import { AUTH_CONFIGURED, useNoIndex, useOwnerSession } from './ownerAuth';

/**
 * The owner's way in.
 *
 * A separate route rather than a section of the public site: the console behind it is a different
 * page entirely, and this one exists only to establish the session. It is deliberately not linked
 * from the navigation - the only pointer is a quiet line in the desk section and the footer.
 */
export default function OwnerLogin({ onSignedIn, onHome }: { onSignedIn: () => void; onHome: () => void }) {
  const { session, ready, error, signIn, requestLink } = useOwnerSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  useNoIndex();

  useEffect(() => {
    document.title = 'Sign in | Peyton Campbell';
  }, []);

  useEffect(() => {
    if (ready && session) onSignedIn();
  }, [ready, session, onSignedIn]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    const ok = await signIn(email.trim(), password);
    setBusy(false);
    if (ok) {
      setPassword('');
      onSignedIn();
    }
  };

  const sendLink = async () => {
    setBusy(true);
    setNotice(null);
    const ok = await requestLink(email.trim());
    setBusy(false);
    if (ok) setNotice('Check that inbox for a sign-in link - it comes back to this site.');
  };

  return (
    <div className="own-gate">
      <div className="own-gate-card">
        <div className="own-gate-head">
          <span className="own-mark">PC</span>
          <div>
            <h1>Owner sign-in</h1>
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
