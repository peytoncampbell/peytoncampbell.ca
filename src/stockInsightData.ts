import { normalizeDate, normalizeTimestamp, normalizeHistory } from './stockInsights';
import type { HistoryIdentity, NormalizedHistory } from './stockInsights';

export type InsightSnapshot = { as_of: string; generated_at: string };
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const isSnapshot = (value: unknown): value is InsightSnapshot => {
  const row = object(value);
  return Boolean(normalizeDate(row.as_of) && normalizeTimestamp(row.generated_at));
};

/** Called only when advanced History opens; never add this column to the overview request. */
export function insightsPath(snapshot: unknown): string | null {
  if (!isSnapshot(snapshot)) return null;
  const query = new URLSearchParams({ select: 'as_of,generated_at,insights', as_of: `eq.${snapshot.as_of}`, generated_at: `eq.${snapshot.generated_at}`, limit: '1' });
  return `pc_playbook?${query}`;
}

export interface PublishedPrice {
  state: 'ready' | 'unavailable';
  history: NormalizedHistory | null;
  identity: HistoryIdentity | null;
  message?: string;
}

/** Compare validated ISO instants without rounding their fractional seconds. */
function compareTimestamps(left: string, right: string): number {
  const parts = (stamp: string) => {
    const fraction = /\.(\d+)/.exec(stamp)?.[1] || '';
    return { second: Date.parse(stamp.replace(/\.\d+/, '')), fraction };
  };
  const a = parts(left), b = parts(right);
  if (a.second !== b.second) return a.second < b.second ? -1 : 1;
  const width = Math.max(a.fraction.length, b.fraction.length);
  const x = a.fraction.padEnd(width, '0'), y = b.fraction.padEnd(width, '0');
  return x === y ? 0 : x < y ? -1 : 1;
}

/** The publisher owns the explicit listing map; the caller supplies this selection's quote currency.
 * No ticker aliases, currency guesses or legacy underlying cache are used here. */
export function publishedPrice(rows: unknown, expected: unknown, ticker: string, currency: string | null, now = Date.now()): PublishedPrice {
  const fail = (message: string): PublishedPrice => ({ state: 'unavailable', history: null, identity: null, message });
  if (!isSnapshot(expected)) return fail('Published plan identity unavailable.');
  if (!Array.isArray(rows) || rows.length !== 1) return fail('History for this published snapshot is unavailable. Refresh the desk to check for a newer snapshot.');
  const row = object(rows[0]);
  // Preserve full database timestamp precision, not just JavaScript milliseconds.
  if (row.as_of !== expected.as_of || row.generated_at !== expected.generated_at) return fail('History response belongs to a different published snapshot.');
  const envelope = object(row.insights);
  const generatedAt = normalizeTimestamp(envelope.generated_at);
  if (envelope.schema_version !== 1 || envelope.as_of !== expected.as_of || !generatedAt) return fail('History envelope missing, unsupported or mismatched.');
  // Primary upserts preserve the optional column; its own financial version must still match.
  if (envelope.snapshot_generated_at !== expected.generated_at) return fail('History belongs to an older or unverified financial snapshot.');
  const series = object(envelope.series);
  if (typeof ticker !== 'string' || !Object.prototype.hasOwnProperty.call(series, ticker)) return fail('History was not published for this exact ticker.');
  const entry = object(series[ticker]);
  if (Array.isArray(entry.observations) && entry.observations.length > 400) return fail('Published history exceeds the 400-observation contract.');
  if (!currency || entry.currency !== currency || typeof entry.listing_symbol !== 'string' || typeof entry.instrument_id !== 'string'
    || !(entry.underlying_symbol === null || typeof entry.underlying_symbol === 'string')) return fail('Published listing identity or quote currency is unavailable or mismatched.');
  const identity: HistoryIdentity = { instrumentId: entry.instrument_id, listingSymbol: entry.listing_symbol, underlyingSymbol: entry.underlying_symbol, currency };
  const history = normalizeHistory(entry, identity);
  if (history.status === 'unavailable') return fail(history.reason || 'History observations unavailable.');
  if (!Number.isFinite(now) || !Number.isFinite(new Date(now).getTime())) return fail('History build or fetch chronology is inconsistent.');
  const nowAt = new Date(now).toISOString(), fetchedAt = history.fetchedAt!;
  if (compareTimestamps(generatedAt, expected.generated_at) < 0 || compareTimestamps(generatedAt, nowAt) > 0
    || compareTimestamps(fetchedAt, generatedAt) < 0 || compareTimestamps(fetchedAt, nowAt) > 0) return fail('History build or fetch chronology is inconsistent.');
  const fetched = Date.parse(fetchedAt);
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en', { timeZone: history.timezone!, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date(fetched)).map(part => [part.type, part.value]));
  const fetchDate = `${parts.year}-${parts.month}-${parts.day}`;
  if (history.observations.some(point => point.date > fetchDate)) return fail('History contains observations after its provider-local fetch date.');
  return { state: 'ready', history, identity };
}
