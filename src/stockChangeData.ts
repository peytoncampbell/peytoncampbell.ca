import { normalizeDate, normalizeFactor, normalizeScoreStamp } from './stockInsights';
import type { ChangeSnapshot, SnapshotEntity, SelectedOrder, NormalizedFunding } from './stockInsights';

export type ChangeSource = 'book' | 'plan' | 'weekly';
export interface PlanAuthorityResult { selectedOrders: SelectedOrder[]; normalizedFunding: NormalizedFunding | null }
export type PublishedRecord = Record<string, unknown>;
export type PlanAuthority = (row: PublishedRecord) => PlanAuthorityResult;
export interface ChangePair {
  state: 'ready' | 'loading' | 'unavailable';
  source: ChangeSource;
  previous: ChangeSnapshot | null;
  current: ChangeSnapshot | null;
  previousDate: string | null;
  currentDate: string | null;
  notices: string[];
}
const record = (v: unknown): v is PublishedRecord => v !== null && typeof v === 'object' && !Array.isArray(v);
const identity = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && !/\s/.test(v);
const optionalText = (v: unknown) => v == null || typeof v === 'string';
function entities(v: unknown): v is (PublishedRecord & { ticker: string })[] {
  return Array.isArray(v) && v.every(r => record(r) && identity(r.ticker)) && new Set(v.map(r => r.ticker)).size === v.length;
}
function scoreEntity(r: PublishedRecord & { ticker: string }, scope: 'book' | 'universe'): SnapshotEntity {
  const stamp = normalizeScoreStamp(r.score_meta);
  const verified = stamp?.subjectId === r.ticker && stamp.scope === scope;
  return { subjectId: r.ticker, call: typeof r.call === 'string' ? r.call : null, reason: typeof r.reason === 'string' ? r.reason : null,
    scoreStamp: verified ? stamp : null, rating: verified ? normalizeFactor(r.rating) : null,
    readings: verified && record(r.pillars) ? Object.fromEntries(['growth', 'revisions', 'momentum', 'valuation', 'quality'].filter(k => k in (r.pillars as PublishedRecord)).map(k => [k, normalizeFactor((r.pillars as PublishedRecord)[k])])) : {} };
}
const finiteOrNull = (v: unknown) => v === null || (typeof v === 'number' && Number.isFinite(v));
function availability(r: PublishedRecord): string {
  return JSON.stringify({ broker: r.broker_ok === true ? true : r.broker_ok === false ? false : null, note: typeof r.broker_note === 'string' ? r.broker_note : null });
}
function validAuthority(value: unknown): value is PlanAuthorityResult {
  if (!record(value) || !Array.isArray(value.selectedOrders)) return false;
  const orders = value.selectedOrders;
  if (!orders.every(o => record(o) && identity(o.id) && identity(o.subjectId) && identity(o.action)
    && ['route', 'currency', 'reason'].every(k => optionalText(o[k]))
    && ['amountCad', 'qty', 'localLimit'].every(k => !(k in o) || finiteOrNull(o[k])))
    || new Set(orders.map(o => o.id)).size !== orders.length) return false;
  const f = value.normalizedFunding;
  return f === null || (record(f) && ['raised', 'needed', 'gap'].every(k => finiteOrNull(f[k])));
}
type ValidPlan = PublishedRecord & { holdings: (PublishedRecord & { ticker: string })[]; entries: (PublishedRecord & { ticker: string })[]; today: PublishedRecord & { watch: (PublishedRecord & { ticker: string })[]; not_fillable: (PublishedRecord & { ticker: string })[] } };
function validPlan(raw: PublishedRecord, date: string): raw is ValidPlan {
  if (!entities(raw.holdings) || !entities(raw.entries) || !record(raw.today)) return false;
  const today = raw.today, meta = today.comparison_meta;
  const validLine = (r: unknown) => record(r) && identity(r.ticker)
    && ['action', 'name', 'currency', 'why', 'kind', 'reason_kind', 'region', 'session_et', 'session_state', 'next_open'].every(k => optionalText(r[k]))
    && ['qty', 'limit_local', 'limit_cad', 'est_cad', 'rating', 'revisions', 'weeks_needed'].every(k => !(k in r) || finiteOrNull(r[k]))
    && ['whole_shares', 'funded', 'market_order'].every(k => r[k] == null || typeof r[k] === 'boolean')
    && (r.readings == null || finiteOrNull(r.readings) || (Array.isArray(r.readings) && r.readings.every(finiteOrNull)));
  return record(meta) && meta.schema_version === 1 && meta.ticket_status === 'ok' && meta.watch_status === 'ok'
    && today.as_of === date && today.ticket_as_of === date && meta.source_as_of === date
    && ['sells', 'trims', 'buys', 'watch', 'unfunded', 'not_fillable'].every(k => Array.isArray(today[k]) && today[k].every(validLine))
    && entities(today.watch) && entities(today.not_fillable) && raw.holdings.every(r => identity(r.action));
}
function snapshot(source: ChangeSource, raw: unknown, cutoff: string, authority?: PlanAuthority): ChangeSnapshot | null {
  if (!record(raw)) return null;
  const date = normalizeDate(raw.as_of);
  if (!date || date > cutoff) return null;
  const base: ChangeSnapshot = { source, asOf: date, status: 'ok', holdings: [], candidates: [], selectedOrders: [], normalizedFunding: null };
  if (source === 'book') {
    if (!entities(raw.holdings) || raw.holdings.some(r => !optionalText(r.call) || !optionalText(r.reason))) return null;
    return { ...base, holdings: raw.holdings.map(r => scoreEntity(r, 'book')) };
  }
  if (source === 'weekly') {
    if (raw.gate !== 'PASSED' || !entities(raw.actionable)) return null;
    return { ...base, candidates: raw.actionable.map(r => ({ ...scoreEntity(r, 'universe'), call: null, reason: null, availability: availability(r) })) };
  }
  if (source !== 'plan' || !validPlan(raw, date) || !authority) return null;
  const today = raw.today;
  // Lists may contain alternative order routes for one ticker. Only the injected authority selects orders.
  const watch = new Map(today.watch.map(r => [r.ticker, r]));
  const blocked = new Map(today.not_fillable.map(r => [r.ticker, r]));
  const entity = (r: PublishedRecord & { ticker: string }, held: boolean): SnapshotEntity => {
    const w = watch.get(r.ticker), nf = blocked.get(r.ticker);
    return { subjectId: r.ticker, call: held ? r.action as string : null, rating: null, scoreStamp: null,
      watch: w ? JSON.stringify({ status: 'published watch', why: typeof w.why === 'string' ? w.why : null }) : null,
      availability: nf ? JSON.stringify({ broker: false, note: typeof nf.why === 'string' ? nf.why : null }) : availability(r) };
  };
  try {
    const selected = authority(raw);
    if (!validAuthority(selected)) return null;
    return { ...base, holdings: raw.holdings.map(r => entity(r, true)), candidates: raw.entries.map(r => entity(r, false)), selectedOrders: selected.selectedOrders, normalizedFunding: selected.normalizedFunding };
  } catch { return null; }
}
/** Request order is authoritative: never skip an invalid predecessor. Cutoff must be trusted by caller. */
export function changePair(source: ChangeSource, rows: unknown, sourceState: 'ok' | 'loading' | 'failed', cutoffDate: string, _planAuthority?: PlanAuthority): ChangePair {
  const result: ChangePair = { state: sourceState === 'loading' ? 'loading' : 'unavailable', source, previous: null, current: null, previousDate: null, currentDate: null, notices: [] };
  const fail = (message: string) => { result.notices.push(`${source}: ${message}`); return result; };
  if (sourceState !== 'ok') return fail(sourceState === 'loading' ? 'Published snapshots loading.' : 'Published snapshot read failed; retained rows are not compared.');
  if (!normalizeDate(cutoffDate)) return fail('Trusted cutoff date unavailable.');
  if (!Array.isArray(rows) || !rows.length) return fail('No complete published snapshot.');
  result.currentDate = record(rows[0]) ? normalizeDate(rows[0].as_of) : null;
  result.previousDate = record(rows[1]) ? normalizeDate(rows[1].as_of) : null;
  if (!result.currentDate || result.currentDate > cutoffDate || (rows.length > 1 && (!result.previousDate || result.previousDate >= result.currentDate))) return fail('Invalid or non-decreasing publication dates.');
  if (source === 'plan' && rows.slice(0, 2).some(r => !record(r) || !validPlan(r, r.as_of as string))) return fail('Incomplete published ticket or watch coverage.');
  const current = snapshot(source, rows[0], cutoffDate, _planAuthority);
  const previous = rows.length > 1 ? snapshot(source, rows[1], cutoffDate, _planAuthority) : null;
  if (!current || (rows.length > 1 && !previous) || (previous && previous.asOf >= current.asOf)) return fail('Complete, strictly chronological published snapshots unavailable.');
  return { ...result, state: 'ready', current, previous };
}

export interface PublishedRating { date: string; rating: number | null; scoreMeta: unknown }
/** Actual published dates only. An empty-date null sentinel deliberately activates StockHistory's
 * malformed-date notice and disables continuity: inventing a position for an undated gap is unsafe.
 * Future dates are discarded before bounding; one-year display selection belongs to StockHistory. */
export function ratingsFor(source: 'book' | 'weekly', rows: unknown, ticker: string, scope: 'book' | 'universe', cutoffDate: string): PublishedRating[] {
  const unavailable = (): PublishedRating => ({ date: '', rating: null, scoreMeta: null });
  if (!normalizeDate(cutoffDate) || !identity(ticker) || !Array.isArray(rows)) return [unavailable()];
  const dated = new Map<string, PublishedRating>();
  let malformed = false;
  for (const raw of rows) {
    if (!record(raw)) { malformed = true; continue; }
    const date = normalizeDate(raw.as_of);
    if (!date) { malformed = true; continue; }
    if (date > cutoffDate) continue;
    if (dated.has(date)) { dated.set(date, { date, rating: null, scoreMeta: null }); continue; }
    const list = source === 'book' ? raw.holdings : raw.actionable;
    const validSource = (source === 'book' && scope === 'book') || (source === 'weekly' && scope === 'universe' && raw.gate === 'PASSED');
    const selected = validSource && entities(list) ? list.find(r => r.ticker === ticker) : undefined;
    const stamp = normalizeScoreStamp(selected?.score_meta);
    const validIdentity = stamp?.subjectId === ticker && stamp.scope === scope;
    dated.set(date, { date, rating: validIdentity ? normalizeFactor(selected?.rating) : null, scoreMeta: selected?.score_meta ?? null });
  }
  const points = [...dated.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-(malformed ? 399 : 400));
  return malformed ? [unavailable(), ...points] : points;
}
