import { useEffect, useMemo, useState } from 'react';
import { AUTH_CONFIGURED, ownerFetch, useNoIndex, useOwnerSession } from './ownerAuth';
import './ReaderDesk.css';

/**
 * The reader desk: one person's own page, behind their own sign-in.
 *
 * Everything it renders comes from pc_reader_view, whose WHERE clause keeps only the row keyed to
 * the signed-in account - the database withholds everyone else's data, not this page. A valid
 * session with no row is the normal "nothing published here yet" state, not an error.
 */

type ReaderModel = {
  in_universe?: boolean;
  rank_global?: number | null;
  universe_size?: number | null;
  band?: string | null;
  composite?: number | null;
  exp_return_12m?: number | null;
  peak_margin_flag?: boolean | null;
};

type ReaderPosition = {
  ticker: string;
  name: string;
  account: string;
  cur: string;
  qty: number | null;
  price: number | null;
  value: number | null;
  pl: number | null;
  ret_pct: number | null;
  value_cad: number | null;
  weight_account_pct?: number | null;
  model?: ReaderModel | null;
};

type ReaderAccount = { name: string; value_cad: number; pl_cad: number; positions: number; scored: number };

type ReaderRead = {
  scored_count: number;
  unscored_count: number;
  note?: string | null;
  strongest: { ticker: string; name: string; composite: number; rank_global?: number | null }[];
  weakest: { ticker: string; name: string; composite: number; rank_global?: number | null }[];
  flags: { ticker: string; name: string }[];
};

type ReaderPayload = {
  schema: string;
  generated_at?: string;
  as_of?: string;
  fx_usd_cad?: number;
  model?: { universe_size?: number | null } | null;
  accounts: ReaderAccount[];
  totals: { value_cad: number; pl_cad: number; ret_pct: number | null };
  positions: ReaderPosition[];
  read?: ReaderRead | null;
};

/** C$ / US$ with a fixed two decimals; the symbol is explicit so the locale cannot surprise it. */
const amount = (value: number | null | undefined, currency: string): string => {
  if (value === null || value === undefined) return '--';
  const prefix = currency === 'USD' ? 'US$' : 'C$';
  return prefix + value.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const signedPct = (value: number | null | undefined): string =>
  value === null || value === undefined ? '--' : `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;

const tone = (value: number | null | undefined): string =>
  value === null || value === undefined || value === 0 ? 'flat' : value > 0 ? 'up' : 'down';

function PositionRow({ position }: { position: ReaderPosition }) {
  const model = position.model && position.model.in_universe ? position.model : null;
  return (
    <li className="rd-row" title={position.pl !== null ? `P/L ${amount(position.pl, position.cur)}` : undefined}>
      <div className="rd-row-name">
        <span className="rd-row-line">
          <span className="rd-ticker">{position.ticker}</span>
          {model && model.composite !== null && model.composite !== undefined && (
            <span
              className="rd-badge"
              title={model.rank_global ? `desk model: rank ${model.rank_global} of ${model.universe_size ?? '--'}` : 'desk model score'}
            >
              {Math.round(model.composite)}
            </span>
          )}
        </span>
        <span className="rd-sub">{position.name}</span>
      </div>
      <div className="rd-row-value">{amount(position.value, position.cur)}</div>
      <div className={`rd-row-gain ${tone(position.ret_pct)}`}>{signedPct(position.ret_pct)}</div>
      <div className="rd-row-weight">
        {position.weight_account_pct !== null && position.weight_account_pct !== undefined
          ? `${position.weight_account_pct.toFixed(1)}%`
          : ''}
      </div>
    </li>
  );
}

export default function ReaderDesk({ onHome }: { onHome: () => void }) {
  const { session, ready, error, signIn, requestLink, signOut, ensureFresh } = useOwnerSession();
  useNoIndex();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [payload, setPayload] = useState<ReaderPayload | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'empty' | 'error'>('idle');
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Your desk';
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!session) {
      setPayload(null);
      setStatus('idle');
      return;
    }
    let cancelled = false;
    setStatus('loading');
    setLoadError(null);
    (async () => {
      const res = await ownerFetch('pc_reader_view?select=payload,updated_at&limit=1', ensureFresh);
      if (cancelled) return;
      if (!res.ok) {
        setStatus('error');
        setLoadError(res.status === 401 ? 'Your session ended. Sign in again.' : `Could not load the desk (HTTP ${res.status}).`);
        return;
      }
      const row = res.rows[0];
      const data = row && row.payload && row.payload.schema === 'reader-digest/1' ? (row.payload as ReaderPayload) : null;
      setPayload(data);
      setStatus(data ? 'ready' : 'empty');
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, session, ensureFresh]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    const ok = await signIn(email.trim(), password);
    setBusy(false);
    if (ok) {
      setPassword('');
    }
  };

  const sendLink = async () => {
    setBusy(true);
    setNotice(null);
    const ok = await requestLink(email.trim(), '/mydesk');
    setBusy(false);
    if (ok) setNotice('Check that inbox for a sign-in link - it comes back to this page.');
  };

  const grouped = useMemo(() => {
    if (!payload) return [];
    return payload.accounts.map((account) => ({
      account,
      rows: payload.positions
        .filter((position) => position.account === account.name)
        .sort((a, b) => (b.value_cad ?? 0) - (a.value_cad ?? 0)),
    }));
  }, [payload]);

  if (!ready) {
    return (
      <div className="rd-root rd-centered">
        <p className="rd-quiet">Opening your desk...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="rd-root rd-centered">
        <div className="rd-gate-card">
          <div className="rd-gate-head">
            <span className="rd-mark" aria-hidden="true" />
            <div>
              <h1>Your desk</h1>
              <p>Sign in to see your portfolio.</p>
            </div>
          </div>

          {!AUTH_CONFIGURED && (
            <p className="rd-note warn">This build has no Supabase URL or anon key, so there is nothing to sign in to.</p>
          )}

          <form onSubmit={submit} className="rd-form">
            <label className="rd-field">
              <span>Email</span>
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                disabled={!AUTH_CONFIGURED || busy}
              />
            </label>
            <label className="rd-field">
              <span>Password</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                disabled={!AUTH_CONFIGURED || busy}
              />
            </label>

            <div className="rd-actions">
              <button type="submit" className="rd-btn primary" disabled={!AUTH_CONFIGURED || busy}>
                {busy ? 'Working...' : 'Sign in'}
              </button>
              <button type="button" className="rd-btn ghost" disabled={!AUTH_CONFIGURED || busy} onClick={sendLink}>
                Email me a link
              </button>
            </div>
          </form>

          {error && <p className="rd-note warn">{error}</p>}
          {notice && <p className="rd-note">{notice}</p>}

          <div className="rd-gate-foot">
            <a
              href="/"
              onClick={(event) => {
                event.preventDefault();
                onHome();
              }}
            >
              Back to the site
            </a>
            <span className="rd-quiet">Private to your account - the data is withheld by the database, not by this page.</span>
          </div>
        </div>
      </div>
    );
  }

  const read = payload?.read ?? null;

  return (
    <div className="rd-root">
      <header className="rd-bar">
        <div className="rd-bar-left">
          <span className="rd-mark small" aria-hidden="true" />
          <div className="rd-bar-title">
            <strong>Your desk</strong>
            <span>Private to your account</span>
          </div>
        </div>
        <div className="rd-bar-right">
          {payload?.as_of && <span className="rd-quiet">Prices {payload.as_of}</span>}
          <button type="button" className="rd-btn ghost small" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      <main className="rd-main">
        {status === 'loading' && <p className="rd-quiet">Loading...</p>}

        {status === 'error' && (
          <section className="rd-panel">
            <p className="rd-note warn">{loadError}</p>
          </section>
        )}

        {status === 'empty' && (
          <section className="rd-panel">
            <p className="rd-note">Nothing is published to this account yet.</p>
          </section>
        )}

        {status === 'ready' && payload && (
          <>
            <section className="rd-hero">
              <p className="rd-hero-label">Portfolio value</p>
              <p className="rd-total">{amount(payload.totals.value_cad, 'CAD')}</p>
              <p className={`rd-gain ${tone(payload.totals.pl_cad)}`}>
                {payload.totals.pl_cad >= 0 ? '\u25B2' : '\u25BC'} {amount(payload.totals.pl_cad, 'CAD')} &middot;{' '}
                {signedPct(payload.totals.ret_pct)} <span className="rd-quiet">total gain</span>
              </p>
              <div className="rd-chips">
                {payload.accounts.map((account) => (
                  <span key={account.name} className="rd-chip">
                    <b>{account.name}</b> {amount(account.value_cad, 'CAD')}
                  </span>
                ))}
              </div>
            </section>

            <section className="rd-panel">
              <div className="rd-panel-head">
                <h2>Your stocks</h2>
                <span className="rd-quiet">
                  {read ? `${read.scored_count} of ${payload.positions.length} carry a desk score` : `${payload.positions.length} positions`}
                </span>
              </div>
              {grouped.map(({ account, rows }) => (
                <div key={account.name} className="rd-group">
                  <h3 className="rd-group-head">
                    {account.name} <span className="rd-quiet">{rows.length}</span>
                  </h3>
                  <ul className="rd-rows">
                    {rows.map((position) => (
                      <PositionRow key={`${position.account}-${position.ticker}`} position={position} />
                    ))}
                  </ul>
                </div>
              ))}
            </section>

            {read && (
              <section className="rd-panel">
                <div className="rd-panel-head">
                  <h2>What the desk sees</h2>
                  <span className="rd-quiet">research view, not advice</span>
                </div>
                {read.note && <p className="rd-note">{read.note}</p>}
                <div className="rd-read-grid">
                  <div className="rd-read-list">
                    <h4>Standing out</h4>
                    <ul>
                      {read.strongest.map((entry) => (
                        <li key={entry.ticker}>
                          <span className="rd-read-name">
                            <span className="rd-ticker">{entry.ticker}</span>
                            <span className="rd-sub">{entry.name}</span>
                          </span>
                          <span className="rd-read-score">{entry.composite.toFixed(1)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="rd-read-list">
                    <h4>Needs watching</h4>
                    <ul>
                      {read.weakest.map((entry) => (
                        <li key={entry.ticker}>
                          <span className="rd-read-name">
                            <span className="rd-ticker">{entry.ticker}</span>
                            <span className="rd-sub">{entry.name}</span>
                          </span>
                          <span className="rd-read-score">{entry.composite.toFixed(1)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                {read.flags.length > 0 && (
                  <p className="rd-note">
                    Peak-margin flags: {read.flags.map((flag) => flag.ticker).join(' \u00b7 ')}
                  </p>
                )}
                <p className="rd-quiet">
                  {read.unscored_count} of {payload.positions.length} positions are outside the desk&apos;s model - mostly
                  ETFs and smaller listings.
                </p>
              </section>
            )}

            <footer className="rd-foot">
              <span>Prices from your app &middot; {payload.as_of ?? 'n/a'}</span>
              {payload.fx_usd_cad ? <span>FX C${payload.fx_usd_cad}/US$</span> : null}
              {payload.model?.universe_size ? <span>Desk model covers {payload.model.universe_size} names</span> : null}
            </footer>
          </>
        )}
      </main>
    </div>
  );
}
