import { useCallback, useEffect, useMemo, useState } from 'react';
import { ownerFetch, useNoIndex, useOwnerSession } from './ownerAuth';

/**
 * The owner console: a different page from the portfolio site, for one signed-in account.
 *
 * Everything it renders comes from Postgres through pc_digest_private, whose WHERE clause checks
 * auth.uid() against an allowlist that browsers cannot read. A signed-in visitor who is not on that
 * list gets a valid, empty result - which is what the "not on the list" state below is for.
 */

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

type PublicRow = {
  as_of: string;
  account_return_pct: number | null;
  day_change_pct: number | null;
  positions_held: number | null;
  positions_stocks: number | null;
  names_up: number | null;
  names_down: number | null;
  calls_sell: number | null;
  calls_hold: number | null;
  rules_triggered: number | null;
  automations_ok: number | null;
  automations_total: number | null;
};

const money = (value: number | null | undefined, digits = 2) =>
  value === null || value === undefined
    ? '--'
    : value.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: digits });

const pct = (value: number | null | undefined, digits = 1) =>
  value === null || value === undefined ? '--' : `${value >= 0 ? '+' : ''}${value.toFixed(digits)}%`;

const tone = (value: number | null | undefined) => (value === null || value === undefined ? 'flat' : value > 0 ? 'up' : value < 0 ? 'down' : 'flat');

const dayName = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });

export default function OwnerStocks({ onSignedOut, onHome }: { onSignedOut: () => void; onHome: () => void }) {
  const { session, ready, error, setError, signOut, ensureFresh } = useOwnerSession();
  const [priv, setPriv] = useState<PrivateRow[] | null>(null);
  const [pub, setPub] = useState<PublicRow[]>([]);
  useNoIndex();

  useEffect(() => {
    document.title = 'Desk | Peyton Campbell';
  }, []);

  // No session on a page that only exists to show one: hand back to the gate.
  useEffect(() => {
    if (ready && !session) onSignedOut();
  }, [ready, session, onSignedOut]);

  const load = useCallback(async () => {
    const [privateRes, publicRes] = await Promise.all([
      ownerFetch('pc_digest_private?select=*&order=as_of.desc&limit=30', ensureFresh),
      ownerFetch('pc_digest_public?select=*&order=as_of.desc&limit=30', ensureFresh),
    ]);
    if (!privateRes.ok && privateRes.status === 401) {
      setError('Your session is no longer valid. Sign in again.');
      onSignedOut();
      return;
    }
    if (!privateRes.ok) {
      setError(`Could not load the private desk (HTTP ${privateRes.status}).`);
      return;
    }
    setPriv(privateRes.rows as PrivateRow[]);
    setPub((publicRes.rows ?? []) as PublicRow[]);
  }, [ensureFresh, onSignedOut, setError]);

  useEffect(() => {
    if (session) void load();
  }, [session, load]);

  const latest = priv && priv.length > 0 ? priv[0] : null;
  const today = pub[0] ?? null;

  const accountReturn = useMemo(() => {
    if (!latest?.book_value_cad || !latest?.true_cost_cad) return null;
    return (latest.book_value_cad / latest.true_cost_cad - 1) * 100;
  }, [latest]);

  const holdings = useMemo(
    () => (latest?.holdings ?? []).slice().sort((a, b) => b.weight_pct - a.weight_pct),
    [latest],
  );

  const value = useCallback(
    (weight: number) => ((latest?.book_value_cad ?? 0) * weight) / 100,
    [latest],
  );

  const onSignOut = async () => {
    await signOut();
    onSignedOut();
  };

  return (
    <div className="own-shell">
      <header className="own-bar">
        <div className="own-bar-left">
          <span className="own-mark">PC</span>
          <div className="own-bar-title">
            <strong>Owner console</strong>
            <span>Published weekdays by the 07:45 automation</span>
          </div>
        </div>
        <div className="own-bar-right">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onHome();
            }}
          >
            Site
          </a>
          <span className="own-quiet">{session?.email}</span>
          <button type="button" className="own-btn ghost small" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <main className="own-main">
        {error && <p className="own-note own-note-warn">{error}</p>}

        {!priv && !error && <p className="own-note">Loading the book...</p>}

        {priv && !latest && (
          <p className="own-note own-note-warn">
            Signed in, but this account is not on the desk allowlist — the database returned no rows
            on purpose.
          </p>
        )}

        {latest && (
          <>
            <section className="own-stats">
              <div className="own-stat">
                <span>Book value</span>
                <b>{money(latest.book_value_cad)}</b>
              </div>
              <div className="own-stat">
                <span>Cost basis</span>
                <b className="sm">{money(latest.true_cost_cad)}</b>
              </div>
              <div className="own-stat">
                <span>Account</span>
                <b className={tone(accountReturn)}>{pct(accountReturn, 2)}</b>
              </div>
              <div className="own-stat">
                <span>Today</span>
                <b className={tone(latest.day_change_cad)}>{money(latest.day_change_cad)}</b>
              </div>
              <div className="own-stat">
                <span>Today %</span>
                <b className={tone(today?.day_change_pct ?? null)}>{pct(today?.day_change_pct ?? null, 2)}</b>
              </div>
              <div className="own-stat">
                <span>ETF weight</span>
                <b className="sm">{latest.etf_weight_pct?.toFixed(1) ?? '--'}%</b>
              </div>
            </section>

            <section className="own-panel">
              <div className="own-panel-head">
                <h2>Holdings</h2>
                <span className="own-quiet">
                  {today?.positions_held ?? holdings.length} positions ·{' '}
                  {today?.positions_stocks ?? holdings.filter((h) => !h.is_etf).length} names + ETF · as of {latest.as_of}
                </span>
              </div>
              <div className="own-table-wrap">
                <table className="own-table">
                  <thead>
                    <tr>
                      <th scope="col">Holding</th>
                      <th scope="col">Value</th>
                      <th scope="col">Weight</th>
                      <th scope="col">Day</th>
                      <th scope="col">Gap to median</th>
                      <th scope="col">Call</th>
                    </tr>
                  </thead>
                  <tbody>
                    {holdings.map((h) => (
                      <tr key={h.ticker}>
                        <td className="own-name">
                          <span className="own-ticker">{h.ticker}</span>
                          {h.reason && <span className="own-why">{h.reason}</span>}
                        </td>
                        <td>{money(value(h.weight_pct), 0)}</td>
                        <td>{h.weight_pct.toFixed(2)}%</td>
                        <td className={tone(h.day_pct)}>{pct(h.day_pct, 2)}</td>
                        <td className={tone(h.gap_pct)}>{pct(h.gap_pct, 1)}</td>
                        <td>
                          <span className={`own-call ${h.call === 'SELL' ? 'sell' : h.call === 'HOLD' ? 'hold' : 'na'}`}>
                            {h.call}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="own-split">
              <section className="own-panel">
                <div className="own-panel-head">
                  <h2>Today's read</h2>
                </div>
                <dl className="own-facts">
                  <div>
                    <dt>Breadth</dt>
                    <dd>
                      {today?.names_up ?? '--'} up / {today?.names_down ?? '--'} down
                    </dd>
                  </div>
                  <div>
                    <dt>Calls</dt>
                    <dd>
                      {today?.calls_hold ?? '--'} hold / {today?.calls_sell ?? '--'} sell
                    </dd>
                  </div>
                  <div>
                    <dt>Exit rules fired</dt>
                    <dd>{today?.rules_triggered ?? '--'}</dd>
                  </div>
                  <div>
                    <dt>Automations</dt>
                    <dd>
                      <span className={today && today.automations_ok === today.automations_total ? 'own-ok' : 'own-warn'}>
                        {today?.automations_ok ?? '--'}/{today?.automations_total ?? '--'} clean
                      </span>
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="own-panel">
                <div className="own-panel-head">
                  <h2>History</h2>
                  <span className="own-quiet">newest first</span>
                </div>
                <div className="own-table-wrap">
                  <table className="own-table compact">
                    <thead>
                      <tr>
                        <th scope="col">Day</th>
                        <th scope="col">Book</th>
                        <th scope="col">Account</th>
                        <th scope="col">Day %</th>
                        <th scope="col">Calls</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(priv ?? []).map((row) => {
                        const metrics = pub.find((p) => p.as_of === row.as_of);
                        const ret = row.book_value_cad && row.true_cost_cad ? (row.book_value_cad / row.true_cost_cad - 1) * 100 : null;
                        return (
                          <tr key={row.as_of}>
                            <td className="own-date">{dayName(row.as_of)}</td>
                            <td>{money(row.book_value_cad, 0)}</td>
                            <td className={tone(ret)}>{pct(ret, 2)}</td>
                            <td className={tone(metrics?.day_change_pct ?? null)}>{pct(metrics?.day_change_pct ?? null, 2)}</td>
                            <td>
                              {metrics ? `${metrics.calls_hold ?? 0}h / ${metrics.calls_sell ?? 0}s` : '--'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <p className="own-note">
              Private figures are readable only by an allowlisted account. The rest of the site shows
              the public numbers only.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
