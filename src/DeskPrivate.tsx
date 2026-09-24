import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Signed-in view of the private desk: book value, cost basis, day change and every holding.
 *
 * WHY A SIGN-IN AND NOT A HIDDEN SECTION. The digest publishes its private columns to the same
 * Postgres row as the public ones, but the only way to read them over REST is through
 * `pc_digest_private`, a view whose WHERE clause checks `auth.uid()` against an allowlist table
 * that browsers cannot read. This component can therefore do nothing clever: it signs in,
 * fetches, and shows whatever the database decides to return. Hiding the UI would protect
 * nothing, because the REST endpoint is reachable regardless.
 *
 * Auth uses the Supabase REST endpoints directly (no supabase-js): password sign-in, an
 * emailed link as the fallback, refresh-token renewal, and the link's hash session on return.
 * The anon key here is public by design; the session token is what carries identity.
 */

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/+$/, '');
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const STORE_KEY = 'pc-desk-session';
const PRIVATE_VIEW = 'pc_digest_private';

type Session = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  email: string;
};

type Holding = {
  ticker: string;
  is_etf: boolean;
  weight_pct: number;
  day_pct: number | null;
  gap_pct: number | null;
  call: string;
  reason: string | null;
  buys: number | null;
  ratings: number | null;
};

type PrivateRow = {
  id: number;
  as_of: string;
  book_value_cad: number | null;
  true_cost_cad: number | null;
  day_change_cad: number | null;
  etf_weight_pct: number | null;
  holdings: Holding[] | null;
};

function money(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined) return '--';
  return value.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: digits });
}

function pct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined) return '--';
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}%`;
}

function tone(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'flat';
  if (value > 0) return 'up';
  if (value < 0) return 'down';
  return 'flat';
}

function readStore(): Session | null {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function writeStore(session: Session | null): void {
  try {
    if (session) window.localStorage.setItem(STORE_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(STORE_KEY);
  } catch {
    /* private mode: the session simply does not persist */
  }
}

async function authPost(path: string, body: unknown, token?: string) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY as string,
      Authorization: `Bearer ${token ?? SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  return { ok: res.ok, status: res.status, data };
}

function sessionFrom(payload: any, email: string): Session {
  return {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    expires_at: Date.now() + (payload.expires_in ?? 3600) * 1000,
    email,
  };
}

export default function DeskPrivate() {
  const [session, setSession] = useState<Session | null>(null);
  const [rows, setRows] = useState<PrivateRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const configured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

  /** Fetches the private rows, renewing the token once if it has expired. */
  const loadPrivate = useCallback(async (active: Session) => {
    let current = active;
    if (current.expires_at - 30_000 < Date.now()) {
      const refreshed = await authPost('token?grant_type=refresh_token',
        { refresh_token: current.refresh_token });
      if (!refreshed.ok) {
        writeStore(null);
        setSession(null);
        setRows(null);
        setError('Your session expired. Sign in again.');
        return;
      }
      current = sessionFrom(refreshed.data, refreshed.data.user?.email ?? current.email);
      writeStore(current);
      setSession(current);
    }

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${PRIVATE_VIEW}?select=*&order=as_of.desc&limit=5`,
      {
        headers: { apikey: SUPABASE_ANON_KEY as string, Authorization: `Bearer ${current.access_token}` },
        cache: 'no-store',
      });
    if (res.status === 401) {
      writeStore(null);
      setSession(null);
      setError('Your session is no longer valid. Sign in again.');
      return;
    }
    if (!res.ok) {
      setError(`Could not load the private desk (HTTP ${res.status}).`);
      return;
    }
    setRows((await res.json()) as PrivateRow[]);
    setError(null);
  }, []);

  // Adopt a session from an emailed link (#access_token=...) or from storage.
  useEffect(() => {
    if (!configured) return;
    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
    const params = new URLSearchParams(hash);
    const access = params.get('access_token');
    if (access && params.get('refresh_token')) {
      const adopted = sessionFrom(
        { access_token: access, refresh_token: params.get('refresh_token'), expires_in: Number(params.get('expires_in') ?? 3600) },
        params.get('email') ?? '');
      writeStore(adopted);
      setSession(adopted);
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      void loadPrivate(adopted);
      return;
    }
    const stored = readStore();
    if (stored) {
      setSession(stored);
      void loadPrivate(stored);
    }
  }, [configured, loadPrivate]);

  const onSignIn = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    if (!configured) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const res = await authPost('token?grant_type=password', { email, password });
    setBusy(false);
    if (!res.ok) {
      setError(res.status === 400 ? 'That email and password do not match.' : `Sign-in failed (HTTP ${res.status}).`);
      return;
    }
    const next = sessionFrom(res.data, res.data.user?.email ?? email);
    writeStore(next);
    setSession(next);
    setPassword('');
    await loadPrivate(next);
  }, [configured, email, password, loadPrivate]);

  const onEmailLink = useCallback(async () => {
    if (!configured || !email) {
      setError('Enter your email first, then ask for the link.');
      return;
    }
    setBusy(true);
    setError(null);
    const res = await authPost('otp', {
      email,
      // The public OTP endpoint reads its options from here - `should_create_user: false` keeps a
      // typo'd address from silently creating an account, and email_redirect_to is what decides
      // whether the link comes back to this site or to the project's fallback URL.
      options: { email_redirect_to: window.location.origin + window.location.pathname, should_create_user: false },
    });
    setBusy(false);
    if (!res.ok) {
      setError(`Could not send the link (HTTP ${res.status}).`);
      return;
    }
    setNotice('Check that inbox for a sign-in link.');
  }, [configured, email]);

  const onSignOut = useCallback(async () => {
    const active = session;
    writeStore(null);
    setSession(null);
    setRows(null);
    setError(null);
    setNotice('Signed out.');
    if (active && SUPABASE_URL) {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: { apikey: SUPABASE_ANON_KEY as string, Authorization: `Bearer ${active.access_token}` },
      }).catch(() => undefined);
    }
  }, [session]);

  const latest = rows && rows.length > 0 ? rows[0] : null;
  const holdings = useMemo(
    () => (latest?.holdings ?? []).slice().sort((a, b) => b.weight_pct - a.weight_pct),
    [latest]);

  if (!configured) {
    return (
      <div className="desk-shell desk-private">
        <p className="desk-note">
          Private desk is not configured for this build (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).
        </p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="desk-shell desk-private">
        <form className="desk-signin" onSubmit={onSignIn}>
          <div className="desk-signin-head">
            <h3>Your holdings</h3>
            <p className="desk-note">
              Book value, cost basis and every position. Sign in with the account that is on the
              desk allowlist - the data is withheld by the database, not by this page.
            </p>
          </div>
          <label className="desk-field">
            <span>Email</span>
            <input type="email" autoComplete="username" value={email}
              onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="desk-field">
            <span>Password</span>
            <input type="password" autoComplete="current-password" value={password}
              onChange={(e) => setPassword(e.target.value)} required />
          </label>
          <div className="desk-signin-actions">
            <button type="submit" className="button-primary compact" disabled={busy}>
              {busy ? 'Signing in...' : 'Sign in'}
            </button>
            <button type="button" className="button-secondary compact" disabled={busy} onClick={onEmailLink}>
              Email me a link instead
            </button>
          </div>
          {error && <p className="desk-note desk-note-warn">{error}</p>}
          {notice && <p className="desk-note">{notice}</p>}
        </form>
      </div>
    );
  }

  return (
    <div className="desk-shell desk-private">
      <div className="desk-meta desk-meta-signed">
        <span className="desk-pill live">Signed in</span>
        <span>{session.email || 'account'}</span>
        <button type="button" className="desk-link" onClick={onSignOut}>Sign out</button>
      </div>

      {error && <p className="desk-note desk-note-warn">{error}</p>}

      {!latest && !error && (
        <p className="desk-note">
          Signed in, but this account is not on the private desk allowlist - the database returned
          no rows on purpose.
        </p>
      )}

      {latest && (
        <>
          <div className="desk-grid">
            <div className="desk-stat">
              <span className="desk-stat-k">Book value</span>
              <span className="desk-stat-v">{money(latest.book_value_cad)}</span>
            </div>
            <div className="desk-stat">
              <span className="desk-stat-k">Cost basis</span>
              <span className="desk-stat-v sm">{money(latest.true_cost_cad)}</span>
            </div>
            <div className="desk-stat">
              <span className="desk-stat-k">Today</span>
              <span className={`desk-stat-v ${tone(latest.day_change_cad)}`}>{money(latest.day_change_cad)}</span>
            </div>
            <div className="desk-stat">
              <span className="desk-stat-k">ETF weight</span>
              <span className="desk-stat-v sm">{latest.etf_weight_pct?.toFixed(1) ?? '--'}%</span>
            </div>
          </div>

          <div className="desk-history">
            <table>
              <thead>
                <tr>
                  <th scope="col">Holding</th>
                  <th scope="col">Weight</th>
                  <th scope="col">Day</th>
                  <th scope="col">Gap to median</th>
                  <th scope="col">Call</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((h) => (
                  <tr key={h.ticker}>
                    <td className="desk-holding-cell">
                      <span className="desk-ticker">{h.ticker}</span>
                      {h.reason && <span className="desk-why">{h.reason}</span>}
                    </td>
                    <td>{h.weight_pct.toFixed(2)}%</td>
                    <td className={tone(h.day_pct)}>{pct(h.day_pct, 2)}</td>
                    <td className={tone(h.gap_pct)}>{pct(h.gap_pct, 1)}</td>
                    <td>
                      <span className={`desk-call ${h.call === 'SELL' ? 'sell' : h.call === 'HOLD' ? 'hold' : 'na'}`}>
                        {h.call}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="desk-note">
            Published {latest.as_of} by the 07:45 automation. Private rows are readable only by an
            allowlisted account; everyone else gets the public numbers above.
          </p>
        </>
      )}
    </div>
  );
}
