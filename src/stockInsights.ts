export interface ScoreMeta {
  schema_version: 1;
  model_version: string;
  scope: 'book' | 'universe';
  subject_id: string;
  cohort_id: string;
  cohort_size: number;
  source_file_modified_at?: string;
  inputs_present?: unknown;
  thin_inputs?: unknown;
  pillar_inputs?: unknown;
}
export interface ScoreStamp {
  modelVersion: string;
  scope: 'book' | 'universe';
  subjectId: string;
  cohortId: string;
  cohortSize: number;
}
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown): string => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
// Identity is opaque: never trim or collapse distinct identifiers into equality.
const identifier = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && !/\s/.test(value);
export function normalizeScoreStamp(value: unknown): ScoreStamp | null {
  const m = record(value);
  if (m.schema_version !== 1 || !identifier(m.model_version) || !identifier(m.subject_id) || !identifier(m.cohort_id)
    || (m.scope !== 'book' && m.scope !== 'universe') || !Number.isInteger(m.cohort_size) || Number(m.cohort_size) <= 0) return null;
  return { modelVersion: m.model_version, scope: m.scope, subjectId: m.subject_id, cohortId: m.cohort_id, cohortSize: Number(m.cohort_size) };
}
export function scoreCompatibility(a: ScoreStamp | null | undefined, b: ScoreStamp | null | undefined): 'compatible' | 'unknown' | 'boundary' {
  const valid = (s: ScoreStamp | null | undefined) => s && identifier(s.modelVersion) && identifier(s.subjectId) && identifier(s.cohortId)
    && (s.scope === 'book' || s.scope === 'universe') && Number.isInteger(s.cohortSize) && s.cohortSize > 0;
  if (!valid(a) || !valid(b)) return 'unknown';
  return (['modelVersion', 'scope', 'subjectId', 'cohortId', 'cohortSize'] as const).every(k => a![k] === b![k]) ? 'compatible' : 'boundary';
}

/** Strict daily dates; timestamps never silently become market dates. */
export function normalizeDate(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? value : null;
}
export function safeEvidenceUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
/** ISO publication/fetch timestamps require a real calendar date and explicit zone. Preserve the input. */
export function normalizeTimestamp(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(value);
  return match && normalizeDate(match[1]) && Number.isFinite(Date.parse(value)) ? value : null;
}
export interface NewsEvidence { title: string; url: string | null; date: string | null; published: string | null; source: string | null }
/** Explicit publication dates only, never fetched_at. Stable newest representative per URL OR headline component. */
export function normalizeNews(value: unknown): NewsEvidence[] {
  if (!Array.isArray(value)) return [];
  const rows: NewsEvidence[] = value.flatMap(raw => {
    const row = record(raw), title = text(row.title);
    if (!title) return [];
    const published = normalizeTimestamp(row.published);
    return [{ title, url: safeEvidenceUrl(row.url), published, source: text(row.source) || null, date: published ? published.slice(0, 10) : normalizeDate(row.date) }];
  });
  const time = (row: NewsEvidence) => row.published ? Date.parse(row.published) : row.date ? Date.parse(`${row.date}T00:00:00Z`) : -Infinity;
  rows.sort((a, b) => time(b) - time(a));
  const groups: { keys: Set<string>; representative: NewsEvidence }[] = [];
  for (const row of rows) {
    const keys = new Set([`title:${row.title.toLowerCase()}`, ...(row.url ? [`url:${row.url}`] : [])]);
    const matches = groups.filter(group => [...keys].some(key => group.keys.has(key)));
    if (!matches.length) { groups.push({ keys, representative: row }); continue; }
    const first = matches[0];
    for (const key of keys) first.keys.add(key);
    for (const other of matches.slice(1)) {
      for (const key of other.keys) first.keys.add(key);
      groups.splice(groups.indexOf(other), 1);
    }
  }
  return groups.map(group => group.representative);
}

export interface HistoryIdentity { instrumentId: string; listingSymbol: string; underlyingSymbol: string | null; currency: string }
export interface HistoryObservation { date: string; value: number | null }
export interface NormalizedHistory {
  status: 'ready' | 'empty' | 'single' | 'unavailable';
  observations: HistoryObservation[];
  pointCount: number;
  reason: string | null;
  source: string | null;
  adjustmentBasis: string | null;
  fetchedAt: string | null;
  coverageStart: string | null;
  coverageEnd: string | null;
  timezone: string | null;
}
/** One series entry only. Caller validates envelope schema/as_of/generated_at and displays freshness.
 * Partial/weekend histories remain useful; coverage describes the full input, not the bounded tail. */
export function normalizeHistory(value: unknown, expected: HistoryIdentity, maxPoints = 400): NormalizedHistory {
  const fail = (reason: string): NormalizedHistory => ({ status: 'unavailable', observations: [], pointCount: 0, reason, source: null, adjustmentBasis: null, fetchedAt: null, coverageStart: null, coverageEnd: null, timezone: null });
  const row = record(value);
  if (!Number.isInteger(maxPoints) || maxPoints < 1 || maxPoints > 400) return fail('Invalid history bound');
  if (row.status !== 'ok') return fail(text(row.reason) || 'History unavailable');
  const keys = { listing_symbol: expected.listingSymbol, currency: expected.currency };
  if (Object.entries(keys).some(([key, target]) => !identifier(target) || row[key] !== target)
    || row.instrument_id !== expected.instrumentId
    || (expected.underlyingSymbol !== null && !identifier(expected.underlyingSymbol)) || row.underlying_symbol !== expected.underlyingSymbol
    || expected.instrumentId !== `Yahoo Finance:${expected.listingSymbol}:${expected.currency}`
    || row.source !== 'Yahoo Finance' || row.adjustment_basis !== 'provider-adjusted close') return fail('History identity or basis mismatch');
  const fetchedAt = normalizeTimestamp(row.fetched_at);
  if (!fetchedAt || !identifier(row.timezone) || /^[+-]/.test(row.timezone)) return fail('History provenance missing or malformed');
  try { new Intl.DateTimeFormat('en', { timeZone: row.timezone }); } catch { return fail('Invalid history timezone'); }
  if (!Array.isArray(row.observations)) return fail('History observations missing');
  const observations: HistoryObservation[] = [];
  let previous = '';
  for (const item of row.observations) {
    const point = record(item);
    const date = normalizeDate(point.date);
    if (!date || date <= previous || (point.value !== null && (typeof point.value !== 'number' || !Number.isFinite(point.value) || point.value < 0))) return fail('Malformed or unordered history');
    observations.push({ date, value: point.value as number | null });
    previous = date;
  }
  const coverageStart = observations[0]?.date ?? null;
  const coverageEnd = observations[observations.length - 1]?.date ?? null;
  if (row.coverage_start !== coverageStart || row.coverage_end !== coverageEnd) return fail('History coverage mismatch');
  const bounded = observations.slice(-maxPoints);
  const pointCount = bounded.filter(point => point.value !== null).length;
  return { status: pointCount > 1 ? 'ready' : pointCount === 1 ? 'single' : 'empty', observations: bounded, pointCount, reason: null,
    source: row.source, adjustmentBasis: row.adjustment_basis, fetchedAt, coverageStart, coverageEnd, timezone: row.timezone };
}

export interface SnapshotEntity {
  subjectId: string;
  call?: string | null;
  reason?: string | null;
  rating?: number | null;
  scoreStamp?: ScoreStamp | null;
  availability?: string | null;
  watch?: string | null;
  readings?: Record<string, number | string | boolean | null>;
}
export interface SelectedOrder {
  /** Stable proposal identity supplied by caller; do not include mutable route or price. */
  id: string;
  subjectId: string;
  action: string;
  route?: string | null;
  amountCad?: number | null;
  qty?: number | null;
  localLimit?: number | null;
  currency?: string | null;
  reason?: string | null;
}
export interface NormalizedFunding { raised: number | null; needed: number | null; gap: number | null }
export interface ChangeSnapshot {
  source: 'book' | 'plan' | 'weekly';
  asOf: string;
  status: 'ok' | 'missing' | 'failed' | 'incomplete';
  holdings: readonly SnapshotEntity[];
  candidates: readonly SnapshotEntity[];
  /** Only rows already selected by OwnerStocks orderGroups; never alternate/raw queues. */
  selectedOrders: readonly SelectedOrder[];
  /** The exact fundingSummary result; no totals are recomputed here. */
  normalizedFunding: NormalizedFunding | null;
}
export interface ChangeEvent { id: string; entity: string; field: string; before: unknown; after: unknown }
export interface SnapshotComparison { status: 'ready' | 'baseline' | 'unavailable'; events: ChangeEvent[]; notices: string[] }
/** Caller supplies validated typed rows and truthful completeness status. Native SHA-256 can reject;
 * callers must show comparison unavailable on failure and ignore stale resolutions after cleanup.
 * No storage or network access. */
export async function compareSnapshots(previous: ChangeSnapshot | null, current: ChangeSnapshot): Promise<SnapshotComparison> {
  // Explicit absence is equivalent to no predecessor; failed/incomplete reads are not.
  if (previous?.status === 'missing' && previous.source === current.source) previous = null;
  const valid = (s: ChangeSnapshot) => s.status === 'ok' && ['book', 'plan', 'weekly'].includes(s.source) && normalizeDate(s.asOf)
    && Array.isArray(s.holdings) && Array.isArray(s.candidates) && Array.isArray(s.selectedOrders);
  if (!valid(current) || (previous && (!valid(previous) || previous.source !== current.source || previous.asOf >= current.asOf))) {
    return { status: 'unavailable', events: [], notices: ['Comparable complete daily snapshots unavailable.'] };
  }
  const unique = (rows: readonly { subjectId: string }[]) => rows.every(row => text(row.subjectId)) && new Set(rows.map(row => row.subjectId)).size === rows.length;
  const validOrders = (rows: readonly SelectedOrder[]) => rows.every(row => text(row.id) && text(row.subjectId) && text(row.action)) && new Set(rows.map(row => row.id)).size === rows.length;
  const snapshots = previous ? [previous, current] : [current];
  if (snapshots.some(s => !unique(s.holdings) || !unique(s.candidates) || !validOrders(s.selectedOrders))) return { status: 'unavailable', events: [], notices: ['Duplicate or missing entity/proposal identity.'] };
  if (!previous) return { status: 'baseline', events: [], notices: ['First complete snapshot; no previous daily baseline.'] };
  const events: ChangeEvent[] = [];
  const notices = new Set<string>();
  const emit = async (entity: string, field: string, before: unknown, after: unknown) => {
    if (JSON.stringify(before) === JSON.stringify(after)) return;
    const bytes = new TextEncoder().encode(JSON.stringify([current.source, previous.asOf, current.asOf, entity, field, before, after]));
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    const id = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
    events.push({ id, entity, field, before, after });
  };
  const reading = (v: unknown) => typeof v === 'number' ? (Number.isFinite(v) ? v : null) : typeof v === 'boolean' ? v : text(v) || null;
  const boundaryStamp = (s: ScoreStamp | null | undefined) => s ? { modelVersion: s.modelVersion, scope: s.scope, subjectId: s.subjectId, cohortId: s.cohortId, cohortSize: s.cohortSize } : null;
  const facts = (s: SnapshotEntity) => ({ subjectId: s.subjectId, call: text(s.call) || null, reason: text(s.reason) || null,
    availability: text(s.availability) || null, watch: text(s.watch) || null, rating: normalizeFactor(s.rating),
    scoreStamp: scoreCompatibility(s.scoreStamp, s.scoreStamp) === 'compatible' ? boundaryStamp(s.scoreStamp) : null,
    readings: Object.fromEntries(Object.keys(s.readings || {}).sort().map(key => [key, reading(s.readings?.[key])])) });
  for (const group of ['holdings', 'candidates'] as const) {
    const before = new Map(previous[group].map(row => [row.subjectId, row]));
    const after = new Map(current[group].map(row => [row.subjectId, row]));
    for (const id of [...new Set([...before.keys(), ...after.keys()])].sort()) {
      const a = before.get(id), b = after.get(id), entity = `${group}:${id}`;
      if (!a || !b) { await emit(entity, a ? 'removed' : 'added', a ? facts(a) : null, b ? facts(b) : null); continue; }
      for (const field of ['call', 'reason', 'availability', 'watch'] as const) await emit(entity, field, text(a[field]) || null, text(b[field]) || null);
      const compatibility = scoreCompatibility(a.scoreStamp, b.scoreStamp);
      if (compatibility === 'unknown') {
        notices.add('Ratings/readings cannot be compared: legacy or incomplete score metadata.');
      } else if (compatibility === 'boundary' || a.scoreStamp?.subjectId !== id || b.scoreStamp?.subjectId !== id) {
        notices.add('Score model, scope, subject or cohort boundary; no numeric rating deltas.');
        await emit(entity, 'scoreBoundary', boundaryStamp(a.scoreStamp), boundaryStamp(b.scoreStamp));
      } else {
        await emit(entity, 'rating', normalizeFactor(a.rating), normalizeFactor(b.rating));
        for (const key of [...new Set([...Object.keys(a.readings || {}), ...Object.keys(b.readings || {})])].sort()) {
          await emit(entity, `reading:${key}`, reading(a.readings?.[key]), reading(b.readings?.[key]));
        }
      }
    }
  }
  const number = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? v : null;
  const cents = (v: unknown) => { const n = number(v); return n === null ? null : Math.round((n + Number.EPSILON * Math.abs(n)) * 100) / 100; };
  const proposal = (o: SelectedOrder) => ({ subjectId: o.subjectId, action: text(o.action), route: text(o.route) || null, amountCad: cents(o.amountCad), qty: number(o.qty), localLimit: number(o.localLimit), currency: text(o.currency) || null, reason: text(o.reason) || null });
  const oldOrders = new Map(previous.selectedOrders.map(row => [row.id, proposal(row)]));
  const newOrders = new Map(current.selectedOrders.map(row => [row.id, proposal(row)]));
  for (const id of [...new Set([...oldOrders.keys(), ...newOrders.keys()])].sort()) {
    const a = oldOrders.get(id), b = newOrders.get(id), entity = `proposal:${id}`;
    if (!a || !b) { await emit(entity, a ? 'proposalRemoved' : 'proposalAdded', a || null, b || null); continue; }
    for (const field of Object.keys(a) as (keyof typeof a)[]) await emit(entity, field, a[field], b[field]);
  }
  for (const field of ['raised', 'needed', 'gap'] as const) {
    await emit('funding', `funding:${field}`, cents(previous.normalizedFunding?.[field]), cents(current.normalizedFunding?.[field]));
  }
  return { status: 'ready', events, notices: [...notices].sort() };
}

/** Missing, malformed and out-of-range factors remain unavailable, never zero. */
export function normalizeFactor(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
}
