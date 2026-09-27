import { useEffect, useMemo, useState } from 'react';
import { AUTH_CONFIGURED, ownerFetch, useNoIndex, useOwnerSession } from './ownerAuth';
import './StockDashboard.css';
import './ReaderDesk.css';

/**
 * The reader desk: one person's own page, behind their own sign-in.
 *
 * Everything it renders comes from pc_reader_view, whose WHERE clause keeps only the row keyed to
 * the signed-in account - the database withholds everyone else's data, not this page. A valid
 * session with no row is the normal "nothing published here yet" state, not an error.
 *
 * The signed-in view is the stock desk's console composition (StockDashboard.css) under a
 * reader-pink token set: KPI strip, the portfolio table with the desk's call per name, today's
 * plan (sell / trim, the add band, the exit watch), the attention rail, the gated candidates,
 * and the desk's read of the book.
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
  day_cad?: number | null;
  day_pct?: number | null;
  weight_account_pct?: number | null;
  model?: ReaderModel | null;
  call?: string | null;
  call_why?: string | null;
  rating_book?: number | null;
};

type ReaderAccount = { name: string; value_cad: number; pl_cad: number; day_cad?: number; positions: number; scored: number };

type ReaderRead = {
  scored_count: number;
  unscored_count: number;
  note?: string | null;
  strongest: { ticker: string; name: string; composite: number; rank_global?: number | null }[];
  weakest: { ticker: string; name: string; composite: number; rank_global?: number | null }[];
  flags: { ticker: string; name: string }[];
};

type ReaderPlan = {
  exits: { ticker: string; why: string }[];
  trims: { ticker: string; weight_pct: number; rating: number | null }[];
  adds: { ticker: string; rating: number | null }[];
  watch: { ticker: string; weeks: number; rating: number }[];
};

type ReaderCandidate = {
  ticker: string;
  name?: string | null;
  rating?: number | null;
  timing?: string | null;
  currency?: string | null;
  region?: string | null;
  price?: number | null;
  targets?: number | null;
  value_trap?: boolean | null;
};

type ReaderTicketLine = {
  action: string;
  kind_label?: string | null;
  kind?: string | null;
  ticker: string;
  name?: string | null;
  account?: string | null;
  qty?: number | null;
  limit_local?: number | null;
  currency?: string | null;
  limit_cad?: number | null;
  est_cad?: number | null;
  rating?: number | null;
  why?: string | null;
  reason_kind?: string | null;
  funded?: boolean | null;
  funded_via?: string | null;
  market_order?: boolean | null;
  price_protection?: boolean | null;
};

type ReaderTicket = {
  schema: string;
  as_of?: string;
  lines: ReaderTicketLine[];
  counts: { sells?: number; buys?: number };
  funding: {
    needed_cad?: number | null;
    raised_cad?: number | null;
    cash_cad?: number | null;
    cash_source?: string | null;
    unfunded: { ticker: string; name?: string | null; reason: string; est_cad?: number | null }[];
  };
  notes?: string[];
  unavailable?: string | null;
};

type ReaderPayload = {
  schema: string;
  generated_at?: string;
  as_of?: string;
  fx_usd_cad?: number;
  model?: { universe_size?: number | null } | null;
  accounts: ReaderAccount[];
  totals: { value_cad: number; pl_cad: number; cost_cad?: number; day_cad?: number; day_pct?: number | null; ret_pct: number | null };
  positions: ReaderPosition[];
  plan?: ReaderPlan | null;
  plan_counts?: { exits?: number; trims?: number; adds?: number; holds?: number; watch?: number } | null;
  plan_as_of?: string | null;
  plan_note?: string | null;
  candidates?: ReaderCandidate[];
  notes?: string[];
  ticket?: ReaderTicket | null;
  read?: ReaderRead | null;
};

/** C$ / US$ with a fixed two decimals; the symbol is explicit so the locale cannot surprise it. */
const amount = (value: number | null | undefined, currency: string): string => {
  if (value === null || value === undefined) return '--';
  const prefix = currency === 'USD' ? 'US$' : 'C$';
  return prefix + value.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const signedAmount = (value: number | null | undefined, currency: string): string => {
  if (value === null || value === undefined) return '--';
  return `${value > 0 ? '+' : value < 0 ? '\u2212' : ''}${amount(Math.abs(value), currency)}`;
};

const signedPct = (value: number | null | undefined): string =>
  value === null || value === undefined ? '--' : `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;

const tone = (value: number | null | undefined): string =>
  value === null || value === undefined || value === 0 ? 'flat' : value > 0 ? 'up' : 'down';

const ratingOf = (position: ReaderPosition): number | null => {
  if (position.rating_book !== null && position.rating_book !== undefined) return position.rating_book;
  if (position.model?.composite !== null && position.model?.composite !== undefined) return position.model.composite;
  return null;
};

const ratingTitle = (position: ReaderPosition): string | undefined => {
  const parts: string[] = [];
  if (position.rating_book !== null && position.rating_book !== undefined) {
    parts.push(`Book rating ${position.rating_book.toFixed(1)}`);
  }
  if (position.model?.composite !== null && position.model?.composite !== undefined) {
    parts.push(
      `Universe composite ${position.model.composite.toFixed(1)}` +
        (position.model.rank_global ? ` (rank ${position.model.rank_global} of ${position.model.universe_size ?? '?'})` : ''),
    );
  }
  parts.push(position.call_why ? `${position.call ?? 'Call'}: ${position.call_why}` : 'Research view, not advice');
  return parts.join(' \u00b7 ');
};

const fmtQty = (qty: number | null | undefined): string => {
  if (qty === null || qty === undefined) return '--';
  return Number.isInteger(qty) ? String(qty) : String(Number(qty.toFixed(4)));
};

const UNFUNDED_LABELS: Record<string, string> = {
  'no cash or sale proceeds left': 'Needs cash',
  'not fillable from this broker': 'Not fillable here',
  'extended - wait for a pullback': 'Waiting for a pullback',
  'add flag only - below the universe median': 'Add flag only (below median)',
};

const groupUnfunded = (ticket: ReaderTicket): { label: string; tickers: string[] }[] => {
  const groups = new Map<string, string[]>();
  for (const item of ticket.funding.unfunded || []) {
    const label = UNFUNDED_LABELS[item.reason] || item.reason;
    const list = groups.get(label) || [];
    list.push(item.ticker);
    groups.set(label, list);
  }
  return [...groups.entries()].map(([label, tickers]) => ({ label, tickers }));
};

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
  const [bump, setBump] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

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
    setStatus((prev) => (prev === 'ready' ? prev : 'loading'));
    setLoadError(null);
    (async () => {
      const res = await ownerFetch('pc_reader_view?select=payload,updated_at&limit=1', ensureFresh);
      if (cancelled) return;
      setRefreshing(false);
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
  }, [ready, session, ensureFresh, bump]);

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

  const ordered = useMemo(() => {
    if (!payload) return [];
    return payload.positions.slice().sort((a, b) => (b.value_cad ?? 0) - (a.value_cad ?? 0));
  }, [payload]);

  const accountMix = useMemo(() => {
    if (!payload || payload.accounts.length === 0) return null;
    const top = payload.accounts.slice().sort((a, b) => b.value_cad - a.value_cad)[0];
    const total = payload.totals.value_cad || 1;
    return { top, sharePct: (top.value_cad / total) * 100, rest: payload.accounts.filter((a) => a.name !== top.name) };
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
  const plan = payload?.plan ?? null;
  const sellTrim = plan ? plan.exits.length + plan.trims.length : 0;
  const ticket = payload?.ticket && payload.ticket.schema === 'reader-ticket/1' ? payload.ticket : null;
  const ticketSells = ticket ? ticket.lines.filter((line) => line.action === 'SELL' || line.action === 'TRIM') : [];
  const ticketBuys = ticket ? ticket.lines.filter((line) => line.action === 'BUY') : [];

  return (
    <div className="stock-dashboard rd-desk">
      <header className="sd-header">
        <strong className="sd-brand">PC <span>Stock desk</span></strong>
        <button
          type="button"
          className="sd-refresh"
          onClick={() => {
            setRefreshing(true);
            setBump((value) => value + 1);
          }}
          disabled={refreshing}
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
        <details className="sd-account">
          <summary>Account</summary>
          <div>
            <span className="rd-account-email">{session.email}</span>
            {payload?.as_of && <span className="rd-quiet">Prices {payload.as_of}</span>}
            <button type="button" onClick={onHome}>
              Site
            </button>
            <button type="button" className="rd-signout" onClick={signOut}>
              Sign out
            </button>
          </div>
        </details>
      </header>

      {status === 'loading' && (
        <section className="sd-panel rd-pad">
          <p className="rd-note">Loading...</p>
        </section>
      )}

      {status === 'error' && (
        <section className="sd-panel rd-pad">
          <p className="rd-note warn">{loadError}</p>
        </section>
      )}

      {status === 'empty' && (
        <section className="sd-panel rd-pad rd-empty">
          <p className="rd-note">Nothing is published to this account yet.</p>
        </section>
      )}

      {status === 'ready' && payload && (
        <>
          <section className="sd-kpis">
            <div>
              <span>Book value</span>
              <strong>{amount(payload.totals.value_cad, 'CAD')}</strong>
              <small>Cost basis {amount(payload.totals.cost_cad ?? payload.totals.value_cad - payload.totals.pl_cad, 'CAD')}</small>
            </div>
            <div>
              <span>Account return</span>
              <strong className={tone(payload.totals.ret_pct)}>{signedPct(payload.totals.ret_pct)}</strong>
              <small>Broker cost basis &middot; not time-weighted</small>
            </div>
            <div>
              <span>Day change</span>
              <strong className={tone(payload.totals.day_cad)}>{signedAmount(payload.totals.day_cad, 'CAD')}</strong>
              <small>{signedPct(payload.totals.day_pct)}</small>
            </div>
            <div>
              <span>{accountMix ? `${accountMix.top.name} share` : 'Accounts'}</span>
              <strong>{accountMix ? `${accountMix.sharePct.toFixed(1)}%` : '--'}</strong>
              <small>
                {accountMix
                  ? [...accountMix.rest.map((a) => `${a.name} ${amount(a.value_cad, 'CAD')}`), `${payload.positions.length} holdings`].join(' \u00b7 ')
                  : `${payload.positions.length} holdings`}
              </small>
            </div>
          </section>

          <main className="sd-workspace">
            <section className="sd-panel">
              <div className="sd-panel-head">
                <h2>
                  Portfolio <span>{payload.positions.length}</span>
                </h2>
                <span className="rd-quiet">{read ? `${read.scored_count} scored` : ''}</span>
              </div>
              <div className="sd-portfolio-columns">
                <span>Ticker</span>
                <span>CAD value</span>
                <span>Weight</span>
                <span>Day</span>
                <span>Rating</span>
                <span>Call</span>
              </div>
              <div className="rd-table-body">
                {ordered.map((position) => {
                  const rating = ratingOf(position);
                  return (
                    <div
                      className="sd-portfolio-row"
                      key={`${position.account}-${position.ticker}`}
                      title={ratingTitle(position)}
                    >
                      <span className="rd-cell-name">
                        <span className="rd-cell-line">
                          <strong>{position.ticker}</strong>
                          <em className="rd-acct">{position.account}</em>
                        </span>
                        <small>{position.name}</small>
                      </span>
                      <span>{amount(position.value_cad, 'CAD')}</span>
                      <span>{position.weight_account_pct !== null && position.weight_account_pct !== undefined ? `${position.weight_account_pct.toFixed(1)}%` : '--'}</span>
                      <span className={tone(position.day_pct)}>{signedPct(position.day_pct)}</span>
                      <span>{rating !== null ? rating.toFixed(1) : '--'}</span>
                      <span className={position.call ? `rd-call rd-call-${position.call.toLowerCase()}` : 'rd-call rd-call-none'}>
                        {position.call ?? ''}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="sd-portfolio-foot">
                Research view, not advice. Ratings are the desk&apos;s own for this book; &quot;--&quot; means the
                equity model does not score it{payload.model?.universe_size ? ` (its universe has ${payload.model.universe_size} names)` : ''}.
              </p>
            </section>

            <section className="sd-panel">
              <div className="sd-panel-head">
                <h2>Today&apos;s plan</h2>
                <span className="rd-quiet">proposals only &middot; no orders</span>
              </div>
              {ticket ? (
                <div className="rd-plan-body">
                  <div className="sd-order-columns">
                    <div className="sd-order-side">
                      <h3>
                        Sell / trim <span>{ticketSells.length}</span>
                      </h3>
                      {ticketSells.length === 0 && <p className="sd-empty">Nothing to sell or trim today.</p>}
                      {ticketSells.map((line) => (
                        <div className="sd-order-row" key={`${line.ticker}-${line.kind_label}`}>
                          <div className="sd-order-top">
                            <strong>{line.ticker}</strong>
                            <span className={`rd-call ${line.reason_kind === 'exit_rule' || line.reason_kind === 'etf-rule' ? 'rd-call-sell' : 'rd-call-trim'}`}>
                              {line.kind_label}
                            </span>
                          </div>
                          <small className="rd-row-why">
                            qty {fmtQty(line.qty)} @ {line.limit_local ?? '--'} {line.currency} &middot; est {amount(line.est_cad, 'CAD')}
                          </small>
                          {line.why && <small className="rd-row-why">{line.why}</small>}
                        </div>
                      ))}
                    </div>
                    <div className="sd-order-side">
                      <h3>
                        Buy <span>{ticketBuys.length}</span>
                      </h3>
                      {ticketBuys.length === 0 && <p className="sd-empty">No funded buys today.</p>}
                      {ticketBuys.map((line) => (
                        <div className="sd-order-row" key={`${line.ticker}-${line.kind_label}`}>
                          <div className="sd-order-top">
                            <strong>{line.ticker}</strong>
                            <span className="rd-call rd-call-add">{line.kind_label}</span>
                          </div>
                          <small className="rd-row-why">
                            qty {fmtQty(line.qty)} @ {line.limit_local ?? '--'} {line.currency} &middot; est {amount(line.est_cad, 'CAD')}
                            {line.funded_via ? ` \u00b7 ${line.funded_via}` : ''}
                          </small>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rd-watch">
                    <h3>
                      Funding <span>{ticket.counts.buys}</span>
                    </h3>
                    <p className="rd-fund-line">
                      needed {amount(ticket.funding.needed_cad, 'CAD')} &middot; raised from sales {amount(ticket.funding.raised_cad, 'CAD')} &middot; cash{' '}
                      {amount(ticket.funding.cash_cad, 'CAD')}
                      {ticket.funding.cash_source === 'none on file' ? ' (not on file)' : ticket.funding.cash_source ? ` (${ticket.funding.cash_source})` : ''}
                    </p>
                    {groupUnfunded(ticket).map((group) => (
                      <p className="rd-row-why" key={group.label}>
                        <strong>{group.label}</strong>: {group.tickers.join(', ')}
                      </p>
                    ))}
                  </div>
                  <div className="rd-watch">
                    <h3>
                      Exit watch <span>{plan ? plan.watch.length : 0}</span>
                    </h3>
                    {plan && plan.watch.length > 0 ? (
                      <ul className="sd-attention">
                        {plan.watch.map((entry) => (
                          <li key={entry.ticker}>
                            <strong>{entry.ticker}</strong> - {entry.weeks} of 2 weekly readings below the floor (rating{' '}
                            {entry.rating.toFixed(1)})
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="sd-empty">Clear - no name is reading below the floor right now.</p>
                    )}
                  </div>
                  {(ticket.notes ?? []).concat(payload.notes ?? []).map((note) => (
                    <p className="rd-plan-note" key={note}>
                      {note}
                    </p>
                  ))}
                  <p className="sd-portfolio-foot">
                    The desk&apos;s ticket{payload.plan_as_of ? ` (as of ${payload.plan_as_of})` : ''} - limits and sizes only; place orders
                    in your broker, and nothing here is advice.
                  </p>
                </div>
              ) : payload.plan_note ? (
                <p className="sd-empty rd-plan-body">{payload.plan_note}</p>
              ) : plan ? (
                <div className="rd-plan-body">
                  <div className="sd-order-columns">
                    <div className="sd-order-side">
                      <h3>
                        Sell / trim <span>{sellTrim}</span>
                      </h3>
                      {sellTrim === 0 && <p className="sd-empty">Nothing to sell or trim today.</p>}
                      {plan.exits.map((entry) => (
                        <div className="sd-order-row" key={entry.ticker}>
                          <div className="sd-order-top">
                            <strong>{entry.ticker}</strong>
                            <span className="rd-call rd-call-sell">SELL</span>
                          </div>
                          <small className="rd-row-why">{entry.why}</small>
                        </div>
                      ))}
                      {plan.trims.map((entry) => (
                        <div className="sd-order-row" key={entry.ticker}>
                          <div className="sd-order-top">
                            <strong>{entry.ticker}</strong>
                            <span className="rd-call rd-call-trim">TRIM</span>
                          </div>
                          <small className="rd-row-why">weight {entry.weight_pct.toFixed(1)}% is above the desk&apos;s cap</small>
                        </div>
                      ))}
                    </div>
                    <div className="sd-order-side">
                      <h3>
                        Add <span>{plan.adds.length}</span>
                      </h3>
                      {plan.adds.length === 0 && <p className="sd-empty">No names in the add band today.</p>}
                      {plan.adds.map((entry) => (
                        <div className="sd-order-row" key={entry.ticker}>
                          <div className="sd-order-top">
                            <strong>{entry.ticker}</strong>
                            <span>{entry.rating !== null ? entry.rating.toFixed(1) : ''}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rd-watch">
                    <h3>
                      Exit watch <span>{plan.watch.length}</span>
                    </h3>
                    {plan.watch.length === 0 ? (
                      <p className="sd-empty">Clear - no name is reading below the floor right now.</p>
                    ) : (
                      <ul className="sd-attention">
                        {plan.watch.map((entry) => (
                          <li key={entry.ticker}>
                            <strong>{entry.ticker}</strong> - {entry.weeks} of 2 weekly readings below the floor
                            (rating {entry.rating.toFixed(1)})
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {payload.notes?.map((note) => (
                    <p className="rd-plan-note" key={note}>
                      {note}
                    </p>
                  ))}
                  <p className="sd-portfolio-foot">
                    The desk&apos;s own calls for this book{payload.plan_as_of ? ` (as of ${payload.plan_as_of})` : ''}; sizes
                    and funding need your cash balance, so nothing here is an order.
                  </p>
                </div>
              ) : (
                <p className="sd-empty rd-plan-body">The plan has not been computed for this desk yet.</p>
              )}
            </section>

            <div className="rd-rail">
              <section className="sd-panel sd-context">
                <div className="sd-panel-head">
                  <h2>
                    Attention <span>{read ? read.flags.length : 0}</span>
                  </h2>
                </div>
                {read && read.flags.length > 0 ? (
                  <ul className="sd-attention">
                    {read.flags.map((flag) => (
                      <li key={flag.ticker}>
                        <strong>{flag.ticker}</strong> - peak-margin flag on the desk model
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="sd-empty">No flags on the scored holdings.</p>
                )}
                {read?.note && <p className="sd-empty">{read.note}</p>}
              </section>

              <section className="sd-panel">
                <div className="sd-panel-head">
                  <h2>
                    Candidates <span>{payload.candidates?.length ?? 0}</span>
                  </h2>
                </div>
                {payload.candidates && payload.candidates.length > 0 ? (
                  <div className="rd-plan-body">
                    {payload.candidates.map((candidate) => (
                      <div className="sd-order-row" key={candidate.ticker}>
                        <div className="sd-order-top">
                          <span className="rd-cand-line">
                            <strong>{candidate.ticker}</strong>
                            {candidate.name && <small className="rd-cand-name">{candidate.name}</small>}
                          </span>
                          <span>{candidate.rating !== null && candidate.rating !== undefined ? candidate.rating.toFixed(1) : '--'}</span>
                        </div>
                        {candidate.timing && (
                          <small className="rd-row-why">
                            {candidate.timing}
                            {candidate.currency ? ` \u00b7 ${candidate.currency}` : ''}
                          </small>
                        )}
                      </div>
                    ))}
                    <p className="sd-portfolio-foot">The desk&apos;s gated buy list - names only, no sizes; research, not advice.</p>
                  </div>
                ) : (
                  <p className="sd-empty">No gated names on the desk list right now.</p>
                )}
              </section>
            </div>

            {read && (
              <section className="sd-panel rd-span">
                <div className="sd-panel-head">
                  <h2>What the desk sees</h2>
                  <span className="rd-quiet">research view, not advice</span>
                </div>
                <div className="sd-order-columns rd-read-body">
                  <div className="sd-order-side">
                    <h3>
                      Standing out <span>{read.strongest.length}</span>
                    </h3>
                    {read.strongest.map((entry) => (
                      <div className="sd-order-row" key={entry.ticker}>
                        <div className="sd-order-top">
                          <span className="rd-cell-name">
                            <strong>{entry.ticker}</strong>
                            <small>{entry.name}</small>
                          </span>
                          <span>{entry.composite.toFixed(1)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="sd-order-side">
                    <h3>
                      Needs watching <span>{read.weakest.length}</span>
                    </h3>
                    {read.weakest.map((entry) => (
                      <div className="sd-order-row" key={entry.ticker}>
                        <div className="sd-order-top">
                          <span className="rd-cell-name">
                            <strong>{entry.ticker}</strong>
                            <small>{entry.name}</small>
                          </span>
                          <span>{entry.composite.toFixed(1)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="sd-portfolio-foot">
                  {read.unscored_count} of {payload.positions.length} positions are outside the desk&apos;s model - mostly ETFs
                  and smaller listings.
                </p>
              </section>
            )}
          </main>

          <footer className="sd-status">
            <span>
              Prices {payload.as_of ?? 'n/a'}
              {payload.fx_usd_cad ? ` \u00b7 FX C$${payload.fx_usd_cad}/US$` : ''}
            </span>
            <span>Research view - not advice</span>
          </footer>
        </>
      )}
    </div>
  );
}
