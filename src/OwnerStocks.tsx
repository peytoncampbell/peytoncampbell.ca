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
  call: string;
  reason: string | null;
  buys: number | null;
  ratings: number | null;
  /** the five-pillar composite, as a percentile inside the book (null for the ETF / unscored) */
  rating: number | null;
  rating_scope: 'book' | 'universe' | null;
  /** the same name's percentile in the ~1,100-name universe the weekly screen ranks */
  rating_universe: number | null;
  pillars: Record<string, number | null> | null;
  model_version: string | null;
};

/**
 * The pillars the composite is built from, in weight order, with the weights the desk's quant review
 * settled on (QUANT_REVIEW.md, 2026-09-25). Five of them, and the cards show these because they are
 * what the desk rates on - the target-derived sixth pillar was retired, so the list is five long and
 * no chip slot is reserved for a pillar that is gone.
 */
const PILLAR_META: { key: string; label: string; weight: number }[] = [
  { key: 'growth', label: 'Growth', weight: 27.2 },
  { key: 'revisions', label: 'Revisions', weight: 21.7 },
  { key: 'momentum', label: 'Momentum', weight: 21.7 },
  { key: 'valuation', label: 'Valuation', weight: 16.3 },
  { key: 'quality', label: 'Quality', weight: 13.0 },
];

const pillarScore = (value: number | null | undefined) =>
  value === null || value === undefined ? '--' : value.toFixed(0);

type WeeklyPick = {
  ticker: string;
  name: string;
  country: string;
  exchange: string;
  us_listed: boolean;
  gate_passed: boolean;
  targets: number | null;
  rank_in_screen: number;
  score: number;
  fwd_pe: number | null;
  vol_pct: number;
  analysts: number;
};

type WeeklyMove = { ticker: string; name: string; was: number; now: number; change: number };

/**
 * A pc_weekly.actionable row: the gate-passed names the weekly screen ranks. The desk's composite
 * rating orders them now, so the fields the median-target gap was rendered from (price, median_target,
 * spread) are gone from the payload rather than merely unused here.
 */
type WeeklyTarget = {
  ticker: string;
  name: string;
  market: string;
  rating: number;
  revisions_net: number;
  px_vs_200d: number;
  targets: number | null;
  fwd_pe: number | null;
};

type PlaybookHolding = {
  ticker: string;
  action: 'HOLD' | 'ADD' | 'TRIM' | 'EXIT';
  weight: number | null;
  pl: number | null;
  revisions: number | null;
  price: number | null;
  ma200: number | null;
  rating: number | null;
  is_etf: boolean;
  flags: string[];
};

type PlaybookEntry = {
  ticker: string;
  market: string;
  score: number;
  revisions: number;
  px_vs_200d: number;
  px_vs_50d: number | null;
  buy_to: number | null;
  rating: number;
  fwd_pe: number | null;
  timing: string;
};

type PlaybookRow = { as_of: string; holdings: PlaybookHolding[]; entries: PlaybookEntry[] };

type QuantPillar = {
  name: string;
  weight: number;
  status: string;
  inputs: string;
  influence: number | null;
  influence_before: number | null;
};
type QuantCell = { ic: number; t: number; n: number } | null;
type QuantSignal = { signal: string; cells: QuantCell[]; spread: (number | null)[] };
type QuantSurprise = {
  events: number;
  names: number;
  window: string;
  buckets: { label: string; n: number; f63: number; f126: number; up_rate: number }[];
};
type QuantPit = {
  captures: number;
  rows: number;
  ladders: number;
  days: number;
  next: { label: string; in_days: number } | null;
};
type QuantRow = {
  as_of: string;
  pillars: QuantPillar[];
  measured: { names: number; anchors: number; horizons: string[]; rows: QuantSignal[] } | null;
  surprise: QuantSurprise | null;
  pit: QuantPit | null;
  top: { symbol: string; score: number }[];
  headline: string;
  drift_warning: string | null;
};

const signed = (v: number | null) => (v === null ? '\u2014' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}`);

type WeeklyRow = {
  as_of: string;
  generated_at: string;
  gate: string | null;
  universe_size: number | null;
  resolved: number | null;
  picks: WeeklyPick[];
  actionable: WeeklyTarget[];
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
  const [playbook, setPlaybook] = useState<PlaybookRow | null>(null);
  const [quant, setQuant] = useState<QuantRow | null>(null);
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
    const [privateRes, publicRes, newsRes, weeklyRes, playbookRes, quantRes] = await Promise.all([
      ownerFetch('pc_digest_private?select=*&order=as_of.desc&limit=30', ensureFresh),
      ownerFetch('pc_digest_public?select=*&order=as_of.desc&limit=30', ensureFresh),
      ownerFetch('pc_news?select=*&order=as_of.desc&limit=5', ensureFresh),
      ownerFetch('pc_weekly?select=*&order=as_of.desc&limit=1', ensureFresh),
      ownerFetch('pc_playbook?select=*&order=as_of.desc&limit=1', ensureFresh),
      ownerFetch('pc_quant?select=*&order=as_of.desc&limit=1', ensureFresh),
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
    setPlaybook((((playbookRes.ok ? playbookRes.rows : []) ?? []) as PlaybookRow[])[0] ?? null);
    setQuant((((quantRes.ok ? quantRes.rows : []) ?? []) as QuantRow[])[0] ?? null);
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

  // The weekly table is the desk's ranking now: highest composite rating first. Sorting a copy here
  // means the payload's own row order never has to be trusted.
  const weeklyRanking = useMemo(
    () => (weekly?.actionable ?? []).slice().sort((a, b) => b.rating - a.rating),
    [weekly],
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

              <p className="own-note">
                The cards lead with the rating the desk ranks on: the five-pillar composite, a 0–100
                percentile weighted growth 27.2 · revisions 21.7 · momentum 21.7 · valuation 16.3 ·
                quality 13.0. Percentiles sit inside the book, so they compare between holdings; the
                detailed view adds each name&apos;s percentile in the 1,100-name universe.
              </p>

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
                          <dt>Rating</dt>
                          <dd className="own-rating">
                            {holding.rating !== null ? holding.rating.toFixed(1) : '--'}
                          </dd>
                        </div>
                      </dl>

                      {holding.pillars && holding.rating !== null ? (
                        <ul className="own-pillars" aria-label="Model pillar percentiles">
                          {PILLAR_META.map(({ key, label, weight }) => (
                            <li key={key} title={`${weight}% pillar weight`}>
                              <span>{label}</span>
                              <b>{pillarScore(holding.pillars?.[key])}</b>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="own-card-read own-card-quiet own-pillars-note">
                          {holding.is_etf
                            ? 'ETF — the equity model does not score a basket.'
                            : 'Outside the scored universe — no model rating.'}
                        </p>
                      )}

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
                    <span className="own-num">Rating</span>
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
                      <span className="own-num own-rating">
                        {holding.rating !== null ? holding.rating.toFixed(1) : '--'}
                      </span>
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
                            <em>Rating</em>{' '}
                            <b className="own-rating">
                              {holding.rating !== null ? holding.rating.toFixed(1) : '--'}
                            </b>
                            {holding.rating_universe !== null && (
                              <em className="own-quiet"> · universe {holding.rating_universe.toFixed(1)}</em>
                            )}
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

                      {holding.pillars && holding.rating !== null && (
                        <ul className="own-pillars" aria-label="Model pillar percentiles">
                          {PILLAR_META.map(({ key, label, weight }) => (
                            <li key={key} title={`${weight}% pillar weight`}>
                              <span>{label}</span>
                              <b>{pillarScore(holding.pillars?.[key])}</b>
                            </li>
                          ))}
                        </ul>
                      )}

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

              {playbook && (
                <section className="own-panel">
                  <div className="own-panel-head">
                    <h2>Playbook — what to do today</h2>
                    <span className="own-quiet">
                      {playbook.holdings.filter((h) => h.action === 'ADD').length} add ·{' '}
                      {playbook.holdings.filter((h) => h.action === 'TRIM').length} trim ·{' '}
                      {playbook.holdings.filter((h) => h.action === 'EXIT').length} exit ·{' '}
                      {playbook.holdings.filter((h) => h.action === 'HOLD').length} hold · {playbook.as_of}
                    </span>
                  </div>

                  <p className="own-brief-summary">
                    No stop-losses. Twenty-one mechanical exit rules were backtested on 487 names over 2.4
                    years and every one lost to buy-and-hold — a trailing −20% stop cut MU 16 points on the
                    way to +734%. A position leaves only when the situation is unambiguous: catastrophic
                    (50%+ below cost <em>and</em> 50%+ behind SPY over six months) or the thesis broken
                    (two or more firms cutting the rating within 90 days). A drawdown is not a reason to
                    sell: MU fell 58% on its way to +734%.
                  </p>

                  <div className="own-rank-wrap">
                    <table className="own-rank">
                      <thead>
                        <tr>
                          <th>ticker</th><th>action</th><th>weight</th><th>P/L</th>
                          <th>revisions</th><th>vs 200d</th><th>rating</th>
                        </tr>
                      </thead>
                      <tbody>
                        {playbook.holdings.map((h) => (
                          <tr key={h.ticker}>
                            <td className="own-rank-sym">{h.ticker}</td>
                            <td><span className={`own-call own-call-${h.action.toLowerCase()}`}>{h.action}</span></td>
                            <td>{h.weight !== null ? `${(h.weight * 100).toFixed(1)}%` : '--'}</td>
                            <td className={tone(h.pl)}>{h.pl !== null ? pct(h.pl * 100, 1) : '--'}</td>
                            <td className={tone(h.revisions)}>{h.revisions !== null ? h.revisions.toFixed(2) : '--'}</td>
                            <td>{h.ma200 && h.price ? pct((h.price / h.ma200 - 1) * 100, 1) : '--'}</td>
                            <td className="own-rating">{h.rating !== null ? h.rating.toFixed(1) : '--'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <details className="own-report" open>
                    <summary>What to buy — gated, tradeable, revisions rising, trend intact</summary>
                    <div className="own-rank-wrap">
                      <table className="own-rank">
                        <thead>
                          <tr>
                            <th>#</th><th>ticker</th><th>mkt</th><th>score</th><th>rev</th>
                            <th>vs 200d</th><th>rating</th><th>P/E</th><th>when</th>
                          </tr>
                        </thead>
                        <tbody>
                          {playbook.entries.map((e, i) => (
                            <tr key={e.ticker}>
                              <td>{i + 1}</td>
                              <td className="own-rank-sym">{e.ticker}</td>
                              <td><span className="own-mkt">{e.market}</span></td>
                              <td>{e.score.toFixed(1)}</td>
                              <td className={tone(e.revisions)}>{e.revisions.toFixed(2)}</td>
                              <td>{pct(e.px_vs_200d * 100, 1)}</td>
                              <td className="own-rating">{e.rating.toFixed(1)}</td>
                              <td>{e.fwd_pe ? `${e.fwd_pe.toFixed(1)}x` : '--'}</td>
                              <td className="own-rank-name">{e.timing}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="own-card-why">
                      Entry is ranked on net estimate revisions and price momentum — the two pillars with
                      evidence behind them. It refuses to chase a name more than 15% above its 50-day
                      average, and it sizes a new position to match the smallest existing holding. If these
                      cluster in one industry, treat them as one bet.
                    </p>
                  </details>
                </section>
              )}

              {weekly && (
                <section className="own-panel">
                  <div className="own-panel-head">
                    <h2>Best gate-passed names by composite rating</h2>
                    <span className="own-quiet">
                      US + CAD combined · {weeklyRanking.length} shown · as of {weekly.as_of} · gate{' '}
                      {weekly.gate ?? 'unknown'}
                    </span>
                  </div>

                  <p className="own-brief-summary">
                    Ranked on the desk&apos;s composite rating — a 0–100 percentile blend of five pillars:
                    growth, revisions, momentum, valuation, quality — and no longer on the gap between the price
                    and a median analyst target. Every name here cleared the buy list&apos;s gates; net estimate
                    revisions and the move against the 200-day average sit beside the rating so the order can be
                    read rather than taken on faith.
                  </p>

                  <div className="own-rank-wrap">
                    <table className="own-rank">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Name</th>
                          <th>Mkt</th>
                          <th>Rating</th>
                          <th>Revisions</th>
                          <th>vs 200d</th>
                          <th>P/E</th>
                        </tr>
                      </thead>
                      <tbody>
                        {weeklyRanking.map((row, index) => (
                          <tr key={row.ticker}>
                            <td className="own-rank-rank">{index + 1}</td>
                            <td>
                              <span className="own-rank-sym">{row.ticker}</span>{' '}
                              <span className="own-rank-name">{row.name}</span>
                            </td>
                            <td>
                              <span className="own-mkt">{row.market}</span>
                            </td>
                            <td className="own-rating">{row.rating.toFixed(1)}</td>
                            <td className={tone(row.revisions_net)}>{row.revisions_net.toFixed(2)}</td>
                            <td>{pct(row.px_vs_200d * 100, 1)}</td>
                            <td>{row.fwd_pe ? `${row.fwd_pe.toFixed(1)}x` : '--'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <details className="own-report">
                    <summary>The screen&apos;s own composite ranking — 5 names we do not own</summary>
                    <p className="own-brief-summary">
                      The composite is a five-pillar blend, each pillar a 0–100 cross-sectional percentile:{' '}
                      <strong>25% growth</strong>, <strong>20% net estimate revisions</strong>,{' '}
                      <strong>20% momentum</strong>, 15% valuation, 12% quality — then
                      damped toward 50 by how thin the analyst coverage is (
                      <code>composite = 50 + (base − 50) × (0.55 + 0.45 × coverage)</code>). Momentum is built
                      on the 12-1 return (the most recent month measures as noise) and no longer counts the
                      52-week range position, which measured as carrying no information. A cheap multiple on
                      peak margins is flagged on each name but no longer penalised: reconstructed over 726
                      company-years those names returned <em>more</em>, not less, and the flag is kept as
                      information rather than a cost. Size carries no weight: the
                      universe is already the largest companies, so ranking inside it is not the size
                      premium. The weights were revised on 25 Sep 2026 from the audit in{' '}
                      <code>QUANT_REVIEW.md</code> — momentum held 15% despite being the only pillar with a
                      real forward test behind it; net revisions were fetched every week and never used. The
                      target-derived sixth pillar has since been retired. It ranks a 1,100-name
                      universe - the global
                      top 500 plus the next tranche of US and TSX names by market cap, added 25 Sep 2026 -
                      so it will happily lead with a Korean listing you cannot buy. This is the ranking the
                      weekly write-up refers to.
                    </p>
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
                              <dt>P/E</dt>
                              <dd>{pick.fwd_pe ? `${pick.fwd_pe.toFixed(1)}x` : '--'}</dd>
                            </div>
                          </dl>

                          <div className="own-card-foot">
                            <p className="own-card-why">
                              {pick.analysts} analysts · {pick.vol_pct.toFixed(0)}% vol ·{' '}
                              {pick.gate_passed ? 'passes the buy gates' : 'outside the gated buy list'}
                            </p>
                          </div>
                        </article>
                      ))}
                    </div>
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
                  </details>

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

            {quant && (
              <section className="own-panel">
                <div className="own-panel-head">
                  <h2>Quant research — what is measured, what is argued</h2>
                  <span className="own-quiet">
                    {quant.pillars.filter((p) => p.status === 'measured').length} of{' '}
                    {quant.pillars.filter((p) => p.weight > 0).length} weighted pillars measured ·{' '}
                    {quant.as_of}
                  </span>
                </div>

                <p className="own-brief-summary">{quant.headline}</p>
                {quant.drift_warning && <p className="own-card-why">{quant.drift_warning}</p>}

                <div className="own-rank-wrap">
                  <table className="own-rank">
                    <thead>
                      <tr>
                        <th>pillar</th>
                        <th>weight</th>
                        <th>evidence</th>
                        <th>influence</th>
                        <th>before</th>
                        <th>built from</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quant.pillars.map((p) => (
                        <tr key={p.name}>
                          <td className="own-rank-sym">{p.name}</td>
                          <td>{p.weight > 0 ? `${p.weight}%` : '\u2014'}</td>
                          <td>
                            <span
                              className={`own-call own-call-${
                                p.status === 'measured' ? 'add' : p.status === 'argued' ? 'hold' : 'trim'
                              }`}
                            >
                              {p.status}
                            </span>
                          </td>
                          <td>{signed(p.influence)}</td>
                          <td className="own-quiet">{signed(p.influence_before)}</td>
                          <td className="own-rank-name own-quiet">{p.inputs}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {quant.measured && (
                  <details className="own-report" open>
                    <summary>
                      Rank correlation with the following returns — {quant.measured.names} names,{' '}
                      {quant.measured.anchors} rolling anchors
                    </summary>
                    <div className="own-rank-wrap">
                      <table className="own-rank">
                        <thead>
                          <tr>
                            <th>signal</th>
                            {quant.measured.horizons.map((h) => (
                              <th key={h}>{h}</th>
                            ))}
                            <th>t (12m)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {quant.measured.rows.map((r) => {
                            const last = r.cells[r.cells.length - 1];
                            return (
                              <tr key={r.signal}>
                                <td className="own-rank-sym">{r.signal}</td>
                                {r.cells.map((c, i) => (
                                  <td key={i} className={c ? tone(c.ic) : ''}>
                                    {c ? `${c.ic >= 0 ? '+' : ''}${c.ic.toFixed(3)}` : '\u2014'}
                                  </td>
                                ))}
                                <td className="own-quiet">{last ? last.t.toFixed(1) : '\u2014'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <p className="own-card-why">
                      The strongest signal in the table is not scored. Volatility measured best of all, but
                      it paid inside one AI/memory upcycle and scoring it would be a bet on that regime
                      repeating; range position measured as empty, which is why it lost its place in the
                      momentum pillar.
                    </p>
                  </details>
                )}

                {quant.surprise && (
                  <details className="own-report">
                    <summary>
                      The street&apos;s error — {quant.surprise.events} past reports across{' '}
                      {quant.surprise.names} names ({quant.surprise.window})
                    </summary>
                    <div className="own-rank-wrap">
                      <table className="own-rank">
                        <thead>
                          <tr>
                            <th>the report</th>
                            <th>n</th>
                            <th>next 63d</th>
                            <th>next 126d</th>
                            <th>up-rate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {quant.surprise.buckets.map((b) => (
                            <tr key={b.label}>
                              <td className="own-rank-name">{b.label}</td>
                              <td>{b.n}</td>
                              <td className={tone(b.f63)}>{b.f63.toFixed(1)}%</td>
                              <td className={tone(b.f126)}>{b.f126.toFixed(1)}%</td>
                              <td>{b.up_rate.toFixed(1)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="own-card-why">
                      The closest available test of the revisions pillar&apos;s mechanism: the size of a beat
                      orders the return that follows it, which is what an under-reacting street looks like.
                      The gradient runs the right way but the spread is small, so it supports the 20% weight
                      rather than a larger one.
                    </p>
                  </details>
                )}

                {quant.pit && (
                  <p className="own-card-why">
                    Point-in-time record: {quant.pit.captures} capture{quant.pit.captures === 1 ? '' : 's'},{' '}
                    {quant.pit.rows.toLocaleString()} rows, {quant.pit.ladders} full estimate ladders.{' '}
                    {quant.pit.next
                      ? `${quant.pit.next.label} becomes measurable in ${quant.pit.next.in_days} days — until then those pillars are argued, not proven.`
                      : 'The forward study runs on captured history rather than argument.'}
                  </p>
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
