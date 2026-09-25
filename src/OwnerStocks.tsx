import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
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

type WeeklyPick = {
  ticker: string;
  name: string;
  country: string;
  exchange: string;
  us_listed: boolean;
  gate_passed: boolean;
  median_gap_pct: number | null;
  targets: number | null;
  rank_in_screen: number;
  score: number;
  expected_return_pct: number;
  target_upside_pct: number;
  fwd_pe: number | null;
  vol_pct: number;
  analysts: number;
};

type WeeklyMove = { ticker: string; name: string; was: number; now: number; change: number };

type WeeklyRow = {
  as_of: string;
  generated_at: string;
  gate: string | null;
  universe_size: number | null;
  resolved: number | null;
  picks: WeeklyPick[];
  moves: WeeklyMove[];
  report_md: string | null;
  weekly_md: string | null;
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

type View = 'grid' | 'list' | 'full';

const VIEW_LABELS: Record<View, string> = { grid: 'Cards', list: 'List', full: 'Detailed' };

const readView = (): View => {
  try {
    const saved = localStorage.getItem('pc-desk-view');
    return saved === 'list' || saved === 'full' ? saved : 'grid';
  } catch {
    return 'grid';
  }
};

type BookRow = {
  holding: Holding;
  entry: NewsTicker | undefined;
  cited: NewsStory | undefined;
  more: NewsStory[];
};

/**
 * Enough markdown for the weekly report: headings, bold/italic/code, tables, bullets, quotes, rules
 * and fenced blocks. The site carries no markdown dependency and the input is a document this repo
 * generates, so the subset is known rather than guessed.
 */
const inline = (text: string, prefix: string): ReactNode[] =>
  text
    .split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g)
    .filter(Boolean)
    .map((part, index) => {
      const key = `${prefix}-${index}`;
      if (part.startsWith('**') && part.endsWith('**')) return <strong key={key}>{part.slice(2, -2)}</strong>;
      if (part.startsWith('`') && part.endsWith('`')) return <code key={key}>{part.slice(1, -1)}</code>;
      if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <em key={key}>{part.slice(1, -1)}</em>;
      return <span key={key}>{part}</span>;
    });

const isTableRule = (line: string) => /^\|?[\s:|-]+\|?$/.test(line) && line.includes('-');

const renderMarkdown = (md: string): ReactNode[] => {
  const out: ReactNode[] = [];
  const lines = md.split('\n');
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    if (/^```/.test(line)) {
      const buffer: string[] = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i])) buffer.push(lines[i++]);
      i += 1;
      out.push(
        <pre key={key++} className="own-md-pre">
          {buffer.join('\n')}
        </pre>,
      );
      continue;
    }

    if (/^#{1,3} /.test(line)) {
      const level = (line.match(/^#+/) ?? ['#'])[0].length;
      const heading = line.replace(/^#+ /, '');
      const Tag = (level === 1 ? 'h3' : level === 2 ? 'h4' : 'h5') as 'h3' | 'h4' | 'h5';
      out.push(
        <Tag key={key++} className="own-md-h">
          {inline(heading, `h${key}`)}
        </Tag>,
      );
      i += 1;
      continue;
    }

    if (/^>/.test(line)) {
      const buffer: string[] = [];
      while (i < lines.length && /^>/.test(lines[i])) buffer.push(lines[i++].replace(/^>\s?/, ''));
      out.push(
        <blockquote key={key++} className="own-md-quote">
          {buffer
            .filter((entry) => entry.trim())
            .map((entry, j) => (
              // the report puts a heading inside its callout ("> ## NVIDIA ..."), which would
              // otherwise print its hashes
              <p key={j} className={/^#{1,6} /.test(entry) ? 'own-md-quote-lead' : undefined}>
                {inline(entry.replace(/^#{1,6} /, ''), `q${key}-${j}`)}
              </p>
            ))}
        </blockquote>,
      );
      continue;
    }

    if (/^\|/.test(line)) {
      const rows: string[][] = [];
      while (i < lines.length && /^\|/.test(lines[i])) {
        if (!isTableRule(lines[i])) rows.push(lines[i].split('|').slice(1, -1).map((cell) => cell.trim()));
        i += 1;
      }
      const [head, ...body] = rows;
      out.push(
        <div key={key++} className="own-md-tablewrap">
          <table className="own-md-table">
            <thead>
              <tr>{(head ?? []).map((cell, j) => <th key={j}>{inline(cell, `th${key}-${j}`)}</th>)}</tr>
            </thead>
            <tbody>
              {body.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => <td key={ci}>{inline(cell, `td${key}-${ri}-${ci}`)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    if (/^[-*] /.test(line)) {
      const buffer: string[] = [];
      while (i < lines.length && /^[-*] /.test(lines[i])) buffer.push(lines[i++].replace(/^[-*] /, ''));
      out.push(
        <ul key={key++} className="own-md-ul">
          {buffer.map((item, j) => <li key={j}>{inline(item, `li${key}-${j}`)}</li>)}
        </ul>,
      );
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      out.push(<hr key={key++} className="own-md-hr" />);
      i += 1;
      continue;
    }

    const buffer: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#|>|\||[-*] |```|---)/.test(lines[i])) buffer.push(lines[i++]);
    out.push(
      <p key={key++} className="own-md-p">
        {inline(buffer.join(' '), `p${key}`)}
      </p>,
    );
  }

  return out;
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
  const [weekly, setWeekly] = useState<WeeklyRow | null>(null);
  // Three ways to read the same book. The choice is remembered: the grid is the default, the list
  // fits everything on one screen, the comprehensive view keeps nothing behind a disclosure.
  const [view, setView] = useState<View>(() => readView());
  useNoIndex();

  useEffect(() => {
    document.title = 'Desk | Peyton Campbell';
  }, []);

  // No session on a page that only exists to show one: hand back to the gate.
  useEffect(() => {
    if (ready && !session) onSignedOut();
  }, [ready, session, onSignedOut]);

  const load = useCallback(async () => {
    const [privateRes, publicRes, newsRes, weeklyRes] = await Promise.all([
      ownerFetch('pc_digest_private?select=*&order=as_of.desc&limit=30', ensureFresh),
      ownerFetch('pc_digest_public?select=*&order=as_of.desc&limit=30', ensureFresh),
      ownerFetch('pc_news?select=*&order=as_of.desc&limit=5', ensureFresh),
      ownerFetch('pc_weekly?select=*&order=as_of.desc&limit=1', ensureFresh),
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
    // The weekly screen is published every Sunday; an empty result just means the panel is absent.
    setWeekly((((weeklyRes.ok ? weeklyRes.rows : []) ?? []) as WeeklyRow[])[0] ?? null);
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

  const book = useMemo<BookRow[]>(
    () =>
      holdings.map((holding) => {
        const entry = newsByTicker.get(holding.ticker);
        const stories = storiesByTicker.get(holding.ticker) ?? [];
        const cited = entry?.story_url ? stories.find((story) => story.url === entry.story_url) : undefined;
        return {
          holding,
          entry,
          cited,
          // the cited headline is already quoted on the card; only the rest are "more"
          more: stories.filter((story) => story.url !== entry?.story_url),
        };
      }),
    [holdings, newsByTicker, storiesByTicker],
  );

  // The brief and the book are two tables; the cards are where they meet.

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
                <div className="own-head-right">
                  <span className="own-quiet">
                    {today?.positions_held ?? holdings.length} positions ·{' '}
                    {today?.positions_stocks ?? holdings.filter((h) => !h.is_etf).length} names + ETF · as of {latest.as_of}
                    {newsLatest?.model?.seconds ? ` · brief read in ${newsLatest.model.seconds}s` : ''}
                  </span>
                  <div className="own-views" role="group" aria-label="How to show the book">
                    {(Object.keys(VIEW_LABELS) as View[]).map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={`own-view${view === option ? ' is-on' : ''}`}
                        aria-pressed={view === option}
                        onClick={() => {
                          setView(option);
                          try {
                            localStorage.setItem('pc-desk-view', option);
                          } catch {
                            /* the choice just will not persist */
                          }
                        }}
                      >
                        {VIEW_LABELS[option]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {newsLatest?.summary && <p className="own-brief-summary">{newsLatest.summary}</p>}

              {newsLatest && newsLatest.watch.length > 0 && (
                <ul className="own-brief-watch">
                  {newsLatest.watch.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}

              {view === 'grid' && (
                <div className="own-cards">
                  {book.map(({ holding, entry, more }) => (
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

                      {entry?.read ? (
                        <p className="own-card-read">{entry.read}</p>
                      ) : (
                        // A holding with no coverage gets a line that says so, rather than the
                        // empty space an absent paragraph leaves in an equal-height card.
                        <p className="own-card-read own-card-quiet">No fresh headlines today.</p>
                      )}

                      <div className="own-card-foot">
                        {entry?.story_url && (
                          <a className="own-card-story" href={entry.story_url} target="_blank" rel="noopener noreferrer">
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
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {view === 'list' && (
                <div className="own-list">
                  <div className="own-row own-row-head">
                    <span>Holding</span>
                    <span className="own-num">Value</span>
                    <span className="own-num">Weight</span>
                    <span className="own-num">Day</span>
                    <span className="own-num">Gap</span>
                    <span>Call</span>
                    <span className="own-list-read">Today</span>
                    <span className="own-num-last" />
                  </div>
                  {book.map(({ holding, entry }) => (
                    <div key={holding.ticker} className="own-row">
                      <span className="own-row-ticker">
                        <span className="own-ticker">{holding.ticker}</span>
                        {entry && <span className={`own-dot own-sent-${entry.sentiment}`} aria-hidden="true" />}
                      </span>
                      <span className="own-num">{money(value(holding.weight_pct), 0)}</span>
                      <span className="own-num">{holding.weight_pct.toFixed(2)}%</span>
                      <span className={`own-num ${tone(holding.day_pct)}`}>{pct(holding.day_pct, 2)}</span>
                      <span className={`own-num ${tone(holding.gap_pct)}`}>{pct(holding.gap_pct, 1)}</span>
                      <span>
                        <span
                          className={`own-call ${
                            holding.call === 'SELL' ? 'sell' : holding.call === 'HOLD' ? 'hold' : 'na'
                          }`}
                        >
                          {holding.call}
                        </span>
                      </span>
                      <span className="own-list-read" title={entry?.read ?? ''}>
                        {entry?.read ?? ''}
                      </span>
                      <span className="own-num-last">
                        {entry?.story_url && (
                          <a className="own-list-link" href={entry.story_url} target="_blank" rel="noopener noreferrer">
                            {entry.story_source ?? 'story'}
                          </a>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {view === 'full' && (
                <div className="own-full">
                  {book.map(({ holding, entry, cited, more }) => (
                    <article key={holding.ticker} className="own-full-card">
                      <div className="own-full-head">
                        <span className="own-ticker">{holding.ticker}</span>
                        <span className="own-full-figs">
                          <span>
                            <em>Value</em> {money(value(holding.weight_pct), 0)}
                          </span>
                          <span>
                            <em>Weight</em> {holding.weight_pct.toFixed(2)}%
                          </span>
                          <span>
                            <em>Day</em> <b className={tone(holding.day_pct)}>{pct(holding.day_pct, 2)}</b>
                          </span>
                          <span>
                            <em>Gap to median</em>{' '}
                            <b className={tone(holding.gap_pct)}>{pct(holding.gap_pct, 1)}</b>
                          </span>
                        </span>
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

                      {entry?.read ? (
                        <p className="own-full-read">{entry.read}</p>
                      ) : (
                        <p className="own-full-read own-card-quiet">No fresh headlines today.</p>
                      )}
                      {holding.reason && <p className="own-card-why">{holding.reason}</p>}

                      {cited && (
                        <a className="own-full-story" href={cited.url} target="_blank" rel="noopener noreferrer">
                          {cited.image ? (
                            <img
                              src={cited.image}
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
                            <b>{cited.title}</b>
                            <em>
                              {cited.source}
                              {cited.published ? ` · ${clock(cited.published)}` : ''}
                            </em>
                          </span>
                        </a>
                      )}

                      {more.length > 0 && (
                        <ul className="own-full-more">
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
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>

              {weekly && (
                <section className="own-panel">
                  <div className="own-panel-head">
                    <h2>Weekly screen</h2>
                    <span className="own-quiet">
                      {weekly.picks.length} names worth owning that we do not · ranked on composite score · as of{' '}
                      {weekly.as_of} · gate {weekly.gate ?? 'unknown'}
                    </span>
                  </div>

                  <p className="own-brief-summary">
                    Everything the book holds is removed, then the screen&apos;s own ranking sets the order —
                    so this cannot disagree with the report it sits under.
                    {weekly.moves.length > 0
                      ? ` ${weekly.moves.length} composites moved at least two points this week.`
                      : ' Nothing moved two points or more this week.'}
                  </p>

                  {weekly.moves.length > 0 && (
                    <ul className="own-moves">
                      {weekly.moves.map((move) => (
                        <li key={move.ticker}>
                          <span className="own-ticker">{move.ticker}</span>
                          <span className={tone(move.change)}>
                            {move.change > 0 ? '+' : ''}
                            {move.change.toFixed(1)}
                          </span>
                          <em>
                            {move.was.toFixed(1)} → {move.now.toFixed(1)}
                          </em>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="own-cards">
                    {weekly.picks.map((pick) => (
                      <article key={pick.ticker} className="own-card">
                        <div className="own-card-head">
                          <span className="own-ticker">{pick.ticker}</span>
                          <span className="own-card-tags">
                            <span className="own-quiet">#{pick.rank_in_screen} in the screen</span>
                            {pick.us_listed ? (
                              <span className="own-sent own-sent-positive">US-listed</span>
                            ) : (
                              <span className="own-sent own-sent-neutral">{pick.exchange || pick.country}</span>
                            )}
                          </span>
                        </div>

                        <p className="own-pick-name">{pick.name}</p>

                        <dl className="own-card-metrics">
                          <div>
                            <dt>Score</dt>
                            <dd>{pick.score.toFixed(1)}</dd>
                          </div>
                          <div>
                            <dt>E[r]</dt>
                            <dd className={tone(pick.expected_return_pct)}>{pick.expected_return_pct.toFixed(1)}%</dd>
                          </div>
                          <div>
                            <dt>Target</dt>
                            <dd className={tone(pick.target_upside_pct)}>{pick.target_upside_pct.toFixed(1)}%</dd>
                          </div>
                          <div>
                            <dt>P/E</dt>
                            <dd>{pick.fwd_pe ? `${pick.fwd_pe.toFixed(1)}x` : '--'}</dd>
                          </div>
                        </dl>

                        <div className="own-card-foot">
                          <p className="own-card-why">
                            {pick.analysts} analysts · {pick.vol_pct.toFixed(0)}% vol ·{' '}
                            {pick.gate_passed
                              ? `passes the buy gates${
                                  pick.median_gap_pct !== null
                                    ? ` (median gap ${pick.median_gap_pct.toFixed(1)}%)`
                                    : ''
                                }`
                              : 'not in the screened buy list'}
                          </p>
                        </div>
                      </article>
                    ))}
                  </div>

                  {weekly.report_md && (
                    <details className="own-report">
                      <summary>
                        Full weekly report — gate {weekly.gate === 'PASSED' ? 'passed' : (weekly.gate ?? 'unknown')}
                      </summary>
                      <div className="own-md">{renderMarkdown(weekly.report_md)}</div>
                      {weekly.weekly_md && (
                        <details className="own-report">
                          <summary>This week&apos;s run log and gate</summary>
                          <pre className="own-md-pre">{weekly.weekly_md}</pre>
                        </details>
                      )}
                    </details>
                  )}
                </section>
              )}

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
