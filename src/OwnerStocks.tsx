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

type NewsStory = {
  ticker: string;
  title: string;
  url: string;
  source: string;
  published: string | null;
  image: string | null;
};

type NewsTicker = {
  ticker: string;
  read: string;
  sentiment: string;
  story_url?: string;
  story_source?: string;
  story_image?: string | null;
};

type NewsRow = {
  as_of: string;
  generated_at: string;
  summary: string | null;
  watch: string[];
  tickers: NewsTicker[];
  stories: NewsStory[];
  model: { model?: string; seconds?: number; prompt_tokens?: number; completion_tokens?: number } | null;
};

const money = (value: number | null | undefined, digits = 2) =>
  value === null || value === undefined
    ? '--'
    : value.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: digits });

const pct = (value: number | null | undefined, digits = 1) =>
  value === null || value === undefined ? '--' : `${value >= 0 ? '+' : ''}${value.toFixed(digits)}%`;

const tone = (value: number | null | undefined) => (value === null || value === undefined ? 'flat' : value > 0 ? 'up' : value < 0 ? 'down' : 'flat');

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' });

const dayName = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });

export default function OwnerStocks({ onSignedOut, onHome }: { onSignedOut: () => void; onHome: () => void }) {
  const { session, ready, error, setError, signOut, ensureFresh } = useOwnerSession();
  const [priv, setPriv] = useState<PrivateRow[] | null>(null);
  const [pub, setPub] = useState<PublicRow[]>([]);
  const [news, setNews] = useState<NewsRow[]>([]);
  useNoIndex();

  useEffect(() => {
    document.title = 'Desk | Peyton Campbell';
  }, []);

  // No session on a page that only exists to show one: hand back to the gate.
  useEffect(() => {
    if (ready && !session) onSignedOut();
  }, [ready, session, onSignedOut]);

  const load = useCallback(async () => {
    const [privateRes, publicRes, newsRes] = await Promise.all([
      ownerFetch('pc_digest_private?select=*&order=as_of.desc&limit=30', ensureFresh),
      ownerFetch('pc_digest_public?select=*&order=as_of.desc&limit=30', ensureFresh),
      ownerFetch('pc_news?select=*&order=as_of.desc&limit=5', ensureFresh),
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
    // The brief is a separate table and may not exist yet (first run of the day); an empty list
    // simply means the panel is not rendered.
    setNews(((newsRes.ok ? newsRes.rows : []) ?? []) as NewsRow[]);
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

  const newsLatest = news[0] ?? null;

  // The brief and the book are two tables; the cards are where they meet.
  const newsByTicker = useMemo(
    () => new Map((newsLatest?.tickers ?? []).map((entry) => [entry.ticker, entry])),
    [newsLatest],
  );

  const storiesByTicker = useMemo(() => {
    const groups = new Map<string, NewsStory[]>();
    for (const story of newsLatest?.stories ?? []) {
      groups.set(story.ticker, [...(groups.get(story.ticker) ?? []), story]);
    }
    return groups;
  }, [newsLatest]);

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
                <h2>The book</h2>
                <span className="own-quiet">
                  {today?.positions_held ?? holdings.length} positions ·{' '}
                  {today?.positions_stocks ?? holdings.filter((h) => !h.is_etf).length} names + ETF · as of {latest.as_of}
                  {newsLatest?.model?.seconds ? ` · brief read in ${newsLatest.model.seconds}s` : ''}
                </span>
              </div>

              {newsLatest?.summary && <p className="own-brief-summary">{newsLatest.summary}</p>}

              {newsLatest && newsLatest.watch.length > 0 && (
                <ul className="own-brief-watch">
                  {newsLatest.watch.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}

              <div className="own-cards">
                {holdings.map((holding) => {
                  const entry = newsByTicker.get(holding.ticker);
                  // the headline the editor cited is already on the card; only the rest go below
                  const more = (storiesByTicker.get(holding.ticker) ?? []).filter(
                    (story) => story.url !== entry?.story_url,
                  );
                  return (
                    <article key={holding.ticker} className="own-card">
                      <div className="own-card-head">
                        <span className="own-ticker">{holding.ticker}</span>
                        <span className="own-card-tags">
                          {entry && <span className={`own-sent own-sent-${entry.sentiment}`}>{entry.sentiment}</span>}
                          <span
                            className={`own-call ${
                              holding.call === 'SELL' ? 'sell' : holding.call === 'HOLD' ? 'hold' : 'na'
                            }`}
                          >
                            {holding.call}
                          </span>
                        </span>
                      </div>

                      <dl className="own-card-metrics">
                        <div>
                          <dt>Value</dt>
                          <dd>{money(value(holding.weight_pct), 0)}</dd>
                        </div>
                        <div>
                          <dt>Weight</dt>
                          <dd>{holding.weight_pct.toFixed(2)}%</dd>
                        </div>
                        <div>
                          <dt>Day</dt>
                          <dd className={tone(holding.day_pct)}>{pct(holding.day_pct, 2)}</dd>
                        </div>
                        <div>
                          <dt>Gap</dt>
                          <dd className={tone(holding.gap_pct)}>{pct(holding.gap_pct, 1)}</dd>
                        </div>
                      </dl>

                      {entry?.read && <p className="own-card-read">{entry.read}</p>}

                      {entry?.story_url && (
                        <a
                          className="own-card-story"
                          href={entry.story_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {entry.story_image ? (
                            <img
                              src={entry.story_image}
                              alt=""
                              loading="lazy"
                              onError={(event) => {
                                event.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : (
                            <span className="own-brief-tile">{holding.ticker}</span>
                          )}
                          <span>
                            <b>{entry.story_source ?? 'the story'}</b>
                            <em>Open</em>
                          </span>
                        </a>
                      )}

                      {holding.reason && <p className="own-card-why">{holding.reason}</p>}

                      {more.length > 0 && (
                        <details className="own-card-more">
                          <summary>
                            {more.length} more headline{more.length === 1 ? '' : 's'}
                          </summary>
                          <ul>
                            {more.map((story) => (
                              <li key={story.url}>
                                <a href={story.url} target="_blank" rel="noopener noreferrer">
                                  {story.title}
                                </a>
                                <em>
                                  {story.source}
                                  {story.published ? ` · ${clock(story.published)}` : ''}
                                </em>
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </article>
                  );
                })}
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
