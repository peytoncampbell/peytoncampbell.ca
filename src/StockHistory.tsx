import { useEffect, useRef, useState } from 'react';
import './StockHistory.css';
import { normalizeDate, normalizeFactor, normalizeScoreStamp, scoreCompatibility } from './stockInsights';
import type { NormalizedHistory, HistoryIdentity, ScoreStamp } from './stockInsights';

export interface HistoryPoint { date: string; value: number | null; note: string; stamp?: ScoreStamp | null }
export function ratingSeries(input: StockHistoryProps['ratings'], ticker: string, scope: StockHistoryProps['scope']) {
  const malformed = input.some(row => !normalizeDate(row.date));
  const grouped = new Map<string, typeof input[number][]>();
  for (const row of input) {
    const date = normalizeDate(row.date);
    if (date) grouped.set(date, [...(grouped.get(date) || []), row]);
  }
  const sorted = [...grouped].sort(([a], [b]) => a.localeCompare(b));
  const start = sorted.length ? windowStart(sorted[sorted.length - 1][0], 12) : '';
  const bounded = sorted.filter(([date]) => date >= start).slice(-400);
  const rows: HistoryPoint[] = bounded.map(([date, group]) => {
    const row = group[0], stamp = normalizeScoreStamp(row.scoreMeta);
    const raw = row.scoreMeta && typeof row.scoreMeta === 'object' ? row.scoreMeta as Record<string, unknown> : {};
    const identityMatches = raw.subject_id === ticker && raw.scope === scope;
    const value = group.length === 1 && identityMatches ? normalizeFactor(row.rating) : null;
    return { date, value, stamp, note: group.length !== 1 ? 'Duplicate date; unavailable' : !identityMatches ? 'Subject or scope unverified; unavailable' : value === null ? 'Invalid or unavailable rating' : !stamp ? 'Legacy observation; incomplete provenance, no continuity' : `Model ${stamp.modelVersion}; ${stamp.scope}; cohort ${stamp.cohortId} (${stamp.cohortSize})` };
  });
  const segments: HistoryPoint[][] = [];
  let previous: HistoryPoint | undefined;
  for (const row of rows) {
    const compatible = previous?.value !== null && previous && scoreCompatibility(previous.stamp, row.stamp) === 'compatible';
    if (row.value !== null) {
      if (!malformed && compatible) segments[segments.length - 1].push(row);
      else {
        if (previous && row.stamp && previous.stamp && !compatible) row.note += '; model/cohort boundary or unavailable predecessor';
        segments.push([row]);
      }
    }
    previous = row;
  }
  return { rows, segments, notice: [malformed ? 'Malformed date omitted; continuity disabled because its position is unknown.' : '', bounded.length < sorted.length ? 'Display limited to one year and 400 observations.' : ''].filter(Boolean).join(' ') };
}

export interface StockHistoryProps {
  ticker: string;
  scope: 'book' | 'universe';
  price: { state: 'loading' | 'ready' | 'unavailable'; history: NormalizedHistory | null; identity: HistoryIdentity | null; message?: string };
  ratings: readonly { date: string; rating: unknown; scoreMeta?: unknown }[];
  isEtf?: boolean;
}
export type HistoryPeriod = '1M' | '3M' | '1Y';
// Calendar arithmetic is only for selecting windows; trading-date strings stay unchanged.
function windowStart(end: string, months: number) {
  const date = new Date(`${end}T00:00:00Z`), day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - months);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, last));
  return date.toISOString().slice(0, 10);
}
export function priceSeries(history: NormalizedHistory, requested: HistoryPeriod) {
  const end = history.observations.at(-1)?.date;
  if (!end) return { rows: [] as HistoryPoint[], segments: [] as HistoryPoint[][], periods: [] as HistoryPeriod[], period: requested, partial: true };
  const yearStart = windowStart(end, 12);
  const bounded = history.observations.filter(row => row.date >= yearStart).slice(-400);
  const usable = bounded.filter(row => row.value !== null);
  const periods: HistoryPeriod[] = [];
  if (usable.some(row => row.date >= windowStart(end, 1))) periods.push('1M');
  if (usable.some(row => row.date >= windowStart(end, 3)) && usable.some(row => row.date < windowStart(end, 1))) periods.push('3M');
  if (usable.some(row => row.date < windowStart(end, 3))) periods.push('1Y');
  const period = periods.includes(requested) ? requested : periods.at(-1) || requested;
  const start = windowStart(end, period === '1M' ? 1 : period === '3M' ? 3 : 12);
  const rows: HistoryPoint[] = bounded.filter(row => row.date >= start).map(row => ({ ...row, note: row.value === null ? 'Unavailable; gap' : 'Observed provider-adjusted close' }));
  const segments: HistoryPoint[][] = [];
  let segment: HistoryPoint[] = [];
  for (const row of rows) {
    if (row.value === null) segment = [];
    else { if (!segment.length) { segment = []; segments.push(segment); } segment.push(row); }
  }
  return { rows, segments, periods, period, partial: !rows.length || rows[0].date > start || rows.some(row => row.value === null) };
}
function HistoryChart({ rows, segments, rating }: { rows: HistoryPoint[]; segments: HistoryPoint[][]; rating: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  useEffect(() => {
    if (!ref.current || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, entry.contentRect.width)));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [rows.some(row => row.value !== null)]);
  const values = rows.flatMap(row => row.value === null ? [] : [row.value]);
  if (!values.length) return null;
  const lo = rating ? 0 : Math.min(...values), hi = rating ? 100 : Math.max(...values);
  const first = Date.parse(rows[0].date), last = Date.parse(rows.at(-1)!.date);
  const x = (row: HistoryPoint) => first === last ? (width + 52) / 2 : 64 + (Date.parse(row.date) - first) / (last - first) * (width - 80);
  const y = (row: HistoryPoint) => hi === lo ? 100 : 180 - (row.value! - lo) / (hi - lo) * 156;
  return <div ref={ref} className="sd-history-chart"><svg width="100%" height="220" viewBox={`0 0 ${width} 220`} role="img" aria-label={`${rating ? 'Rating, fixed 0 to 100' : 'Historical adjusted close'}; exact observations and boundaries in the table below`}>
    {[lo, ...(hi === lo ? [] : [hi])].map(value => <g key={value}><line x1="64" x2={width - 16} y1={hi === lo ? 100 : value === lo ? 180 : 24} y2={hi === lo ? 100 : value === lo ? 180 : 24} className="sd-history-axis"/><text x="2" y={(hi === lo ? 100 : value === lo ? 180 : 24) + 5}>{Number(value.toPrecision(4))}</text></g>)}
    {segments.map((segment, index) => <g key={index}>{segment.length > 1 && <polyline className="sd-history-line" points={segment.map(row => `${x(row)},${y(row)}`).join(' ')}/ >}{segment.map(row => <circle key={row.date} className="sd-history-point" cx={x(row)} cy={y(row)} r="3"/>)}</g>)}
    <text x="64" y="212">{rows[0].date}</text>{rows.length > 1 && <text x={width - 16} y="212" textAnchor="end">{rows.at(-1)!.date}</text>}
  </svg></div>;
}
function ObservationTable({ rows, rating, currency }: { rows: HistoryPoint[]; rating: boolean; currency?: string }) {
  return <details className="sd-history-observations"><summary>Show observations ({rows.length})</summary><table><caption>{rating ? 'Published rating observations; exact values' : `Displayed price observations; exact ${currency} values`}</caption><thead><tr><th scope="col">Date</th><th scope="col">{rating ? 'Rating / 100' : currency}</th><th scope="col">Source / boundary</th></tr></thead><tbody>{rows.map(row => <tr key={row.date}><th scope="row">{row.date}</th><td>{row.value === null ? 'Unavailable' : String(row.value)}</td><td>{row.note}</td></tr>)}</tbody></table></details>;
}
export function StockHistory({ ticker, scope, price, ratings, isEtf }: StockHistoryProps) {
  const [view, setView] = useState<'price' | 'rating'>('price');
  const [period, setPeriod] = useState<HistoryPeriod>('1Y');
  const history = price.history;
  const priced = history ? priceSeries(history, period) : null;
  const rated = ratingSeries(isEtf ? [] : ratings, ticker, scope);
  const lastObserved = history?.observations.filter(row => row.value !== null).at(-1);
  const ready = price.state === 'ready' && history && history.status !== 'unavailable' && price.identity;
  const rows = view === 'rating' ? rated.rows : priced?.rows || [];
  const segments = view === 'rating' ? rated.segments : priced?.segments || [];
  const count = rows.filter(row => row.value !== null).length;
  let age: number | null = null;
  if (lastObserved && history?.timezone) {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: history.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    age = Math.floor((Date.parse(today) - Date.parse(lastObserved.date)) / 86400000);
  }
  return <section className="sd-history" aria-label={`${ticker} ${scope} history`}>
    <div className="sd-history-controls" aria-label="History chart"><button type="button" aria-pressed={view === 'price'} onClick={() => setView('price')}>Price</button><button type="button" aria-pressed={view === 'rating'} onClick={() => setView('rating')}>Rating</button></div>
    {isEtf && <p>ETF: not scored by the equity model.</p>}
    {view === 'price' ? <>
      {!ready ? <p role="status">{price.state === 'loading' ? 'Loading price history…' : `Price history unavailable. ${price.message || history?.reason || ''}`}</p> : <>
        <p><strong>{price.identity!.listingSymbol} · {price.identity!.currency}</strong> — {history!.source}, {history!.adjustmentBasis}. Not live or an execution value.</p>
        <p className="sd-history-meta">Fetched {history!.fetchedAt}. Trading dates: {history!.timezone}. Coverage {history!.coverageStart || 'unavailable'} to {history!.coverageEnd || 'unavailable'}.</p>
        <p>{lastObserved ? `Last observed valid close: ${lastObserved.date}, ${lastObserved.value} ${price.identity!.currency}.` : 'No usable price observations.'} {age !== null && Number.isFinite(age) && age >= 0 ? `${age} calendar days old as of today in ${history!.timezone}; calendar age is not a trading-session count.` : ''}</p>
        {history!.observations.at(-1)?.value === null && <p>Coverage-end gap: {history!.coverageEnd} is unavailable, not the last priced close.</p>}
        <div className="sd-history-controls" aria-label="Price period">{priced!.periods.map(option => <button type="button" key={option} aria-pressed={priced!.period === option} onClick={() => setPeriod(option)}>{option}</button>)}</div>
        <p>{priced!.partial ? 'Partial coverage' : 'Available coverage'} for the trailing {priced!.period} window ending {history!.observations.at(-1)?.date || 'unavailable'}. At most one year and 400 observations; gaps stay unavailable.</p>
        {!count && lastObserved && <p>No usable price observations in this window.</p>}
      </>}
    </> : <><p>{ticker} · {scope} rating history. Published observations only; no backfilled fundamentals.</p><p>Model/cohort boundaries and missing provenance break the line. Legacy observations require a matching subject and scope.</p>{rated.notice && <p>{rated.notice}</p>}{!count && <p>{isEtf ? 'Equity rating unavailable for this ETF.' : 'Collecting rating history; no usable published observations.'}</p>}</>}
    {(view === 'rating' || ready) && <>{count === 1 && <p>One observation — a dated point, not a trend.</p>}{count > 1 && <p>{count} observed values; lines connect only compatible observations within each segment.</p>}<HistoryChart rows={rows} segments={segments} rating={view === 'rating'}/><ObservationTable rows={rows} rating={view === 'rating'} currency={price.identity?.currency}/></>}
  </section>;
}
