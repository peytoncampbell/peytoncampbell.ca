export interface OutcomeDecision {
  decision_id: string; batch_id: string; as_of: string; generated_at: string; captured_at: string;
  publication_state: 'generated' | 'published' | 'observed_existing'; ticker: string; listing_symbol: string | null; currency: string | null;
  action: string; order_type: string | null; quantity: string | null; amount_cad: string | null; limit_native: string | null;
  reason: string | null; model_version: string | null; cohort_id: string | null;
  intent: 'unrecorded' | 'considering' | 'skipped' | 'reported_submitted';
  execution: { status: 'unconfirmed' | 'ambiguous' | 'broker_confirmed'; quantity: string | null; average_price: string | null; currency: string | null; fees: string | null; reason: string | null };
}
export interface OutcomeMetric {
  status: 'available' | 'unavailable'; value: string | null; method: 'period_mwr_irr' | 'period_twr_exact_boundaries'; reason: string | null;
  period_start: string; period_end: string; currency: string; annualized: false;
}
export interface OutcomeReport {
  schema_version: 1; report_id: string; as_of: string; generated_at: string; reporting_currency: string; source_cutoff: string; ledger_revision: string | null;
  reconciliation: { status: 'not_imported' | 'incomplete' | 'discrepancy' | 'reconciled' | 'reconciled_with_rounding'; broker_data_as_of: string | null; period_start: string | null; period_end: string | null; verified_at: string | null; issues: string[] };
  decision_window: {total: number; returned: number; has_more: boolean; items: OutcomeDecision[]};
  performance: {status: 'available' | 'unavailable'; reason: string | null; period_start: string | null; period_end: string | null; bridge: {opening_equity: string; net_external_flows: string; investment_result: string; closing_equity: string; currency: string} | null; money_weighted: OutcomeMetric | null; time_weighted: OutcomeMetric | null; benchmark: null};
  model_evidence: {status: 'collecting' | 'exploratory' | 'unavailable'; reason: string; capture_count: number | null; first_capture: string | null; last_capture: string | null; horizons: {sessions: number; matured: number | null; pending: number | null; excluded: number | null}[]; limitations: string[]};
  limitations: string[];
}
export type OutcomeParseResult = {ok: true; report: OutcomeReport} | {ok: false; reason: string};
type RecordValue = Record<string, unknown>;
function check(value: unknown): asserts value { if (!value) throw Error('Invalid contract'); }
function object(value: unknown, keys: string): RecordValue {
  check(value !== null && typeof value === 'object' && !Array.isArray(value));
  check(Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
  const expected = keys.split(' '), actual = Object.keys(value);
  check(actual.length === expected.length && expected.every(key => Object.prototype.hasOwnProperty.call(value, key)));
  return value as RecordValue;
}
function text(value: unknown, max = 2000): asserts value is string {
  check(typeof value === 'string' && value.trim().length > 0 && value.length <= max);
  // Preserve original prose (including comparisons and line breaks). React renders it as text, never HTML.
  check(!/[\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]|[A-Za-z]:[\\/]|\\\\|\/(?:Users|home|private)\//.test(value));
}
function nullable(value: unknown, validate: (value: unknown) => void) { if (value !== null) validate(value); }
function identity(value: unknown) { text(value, 160); check(!/[<>\s]/.test(value)); }
function oneOf(value: unknown, choices: string) { check(typeof value === 'string' && choices.split(' ').includes(value)); }
function count(value: unknown) { check(Number.isSafeInteger(value) && (value as number) >= 0); }
function list(value: unknown, validate: (value: unknown) => void, max = 30) { check(Array.isArray(value) && value.length <= max); for (let i = 0; i < value.length; i++) { check(Object.prototype.hasOwnProperty.call(value, i)); validate(value[i]); } }
function date(value: unknown): asserts value is string {
  check(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= '1900-01-01' && value <= '9999-12-31');
  const parsed = new Date(`${value}T00:00:00Z`); check(Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value);
}
function timestamp(value: unknown): asserts value is string {
  check(typeof value === 'string');
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  check(match); date(match[1]); check(+match[2] < 24 && +match[3] < 60 && +match[4] < 60);
  if (match[6] !== 'Z') check(+match[6].slice(1, 3) <= 14 && +match[6].slice(4) < 60 && (+match[6].slice(1, 3) < 14 || +match[6].slice(4) === 0));
  check(Number.isFinite(Date.parse(value)));
}
// Compare all accepted fractional digits; Date.parse alone discards sub-millisecond identity.
function instant(value: string): bigint { return BigInt(Date.parse(value.replace(/\.\d+/, ''))) * 1000000n + BigInt((/\.(\d+)/.exec(value)?.[1] ?? '').padEnd(9, '0')); }
function before(left: unknown, right: unknown) { timestamp(left); timestamp(right); check(instant(left) <= instant(right)); }
const currencies = new Set((Intl as typeof Intl & {supportedValuesOf?: (key: string) => string[]}).supportedValuesOf?.('currency') ?? []);
function currency(value: unknown) { check(typeof value === 'string' && currencies.has(value)); }
function decimal(value: unknown, positive = false) {
  check(typeof value === 'string' && value.length <= 80 && /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value) && Number.isFinite(Number(value)));
  if (positive) check(!value.startsWith('-') && /[1-9]/.test(value));
}
function positive(value: unknown) { decimal(value, true); }
function nonnegative(value: unknown) { decimal(value); check(!(value as string).startsWith('-')); }
function pair(start: unknown, end: unknown) { nullable(start, date); nullable(end, date); check((start === null) === (end === null)); if (start !== null) check((start as string) <= (end as string)); }

/** Shape validation is not broker verification. Only the owner-authorized producer can attest ledger evidence.
 * v1 limits: 100 decisions, 30 prose entries/horizons, 2,000-char prose, 160-char IDs,
 * 80-char decimals and nanosecond timestamps. Unknown fields fail closed.
 */
export function parseOutcomeReportRow(value: unknown): OutcomeParseResult {
  try {
    const row = object(value, 'report_id as_of generated_at schema_version payload');
    const r = object(row.payload, 'schema_version report_id as_of generated_at reporting_currency source_cutoff ledger_revision reconciliation decision_window performance model_evidence limitations');
    check(row.schema_version === 1 && r.schema_version === 1);
    identity(r.report_id); date(r.as_of); timestamp(r.generated_at); check(r.as_of <= r.generated_at.slice(0, 10));
    check(row.report_id === r.report_id && row.as_of === r.as_of && row.generated_at === r.generated_at);
    before(r.source_cutoff, r.generated_at); currency(r.reporting_currency); nullable(r.ledger_revision, identity); list(r.limitations, text);
    const rec = object(r.reconciliation, 'status broker_data_as_of period_start period_end verified_at issues');
    oneOf(rec.status, 'not_imported incomplete discrepancy reconciled reconciled_with_rounding');
    nullable(rec.broker_data_as_of, date); pair(rec.period_start, rec.period_end); nullable(rec.verified_at, v => before(v, r.source_cutoff)); list(rec.issues, text);
    if (rec.period_end !== null) { check(rec.broker_data_as_of !== null && (rec.period_end as string) <= (rec.broker_data_as_of as string)); }
    if (rec.broker_data_as_of !== null) check((rec.broker_data_as_of as string) <= (r.source_cutoff as string).slice(0, 10));
    const reconciled = rec.status === 'reconciled' || rec.status === 'reconciled_with_rounding';
    if (reconciled) {
      check(r.ledger_revision !== null && rec.period_start !== null && rec.verified_at !== null && rec.broker_data_as_of !== null);
      check((rec.verified_at as string).slice(0, 10) >= (rec.period_end as string));
    }
    if (rec.status === 'not_imported') check(r.ledger_revision === null && rec.broker_data_as_of === null && rec.period_start === null && rec.verified_at === null);
    const w = object(r.decision_window, 'total returned has_more items'); count(w.total); count(w.returned);
    const ids = new Set();
    list(w.items, item => {
      const d = object(item, 'decision_id batch_id as_of generated_at captured_at publication_state ticker listing_symbol currency action order_type quantity amount_cad limit_native reason model_version cohort_id intent execution');
      identity(d.decision_id); identity(d.batch_id); check(!ids.has(d.decision_id)); ids.add(d.decision_id);
      date(d.as_of); timestamp(d.generated_at); check(d.as_of <= d.generated_at.slice(0, 10)); before(d.generated_at, d.captured_at); before(d.captured_at, r.source_cutoff);
      oneOf(d.publication_state, 'generated published observed_existing'); text(d.ticker, 40); nullable(d.listing_symbol, v => text(v, 80)); nullable(d.currency, currency);
      text(d.action, 120); nullable(d.order_type, v => text(v, 80)); nullable(d.reason, text); nullable(d.model_version, identity); nullable(d.cohort_id, identity);
      nullable(d.quantity, nonnegative); nullable(d.limit_native, nonnegative); nullable(d.amount_cad, decimal);
      oneOf(d.intent, 'unrecorded considering skipped reported_submitted');
      const e = object(d.execution, 'status quantity average_price currency fees reason'); oneOf(e.status, 'unconfirmed ambiguous broker_confirmed');
      nullable(e.quantity, positive); nullable(e.average_price, positive); nullable(e.currency, currency); nullable(e.fees, decimal); nullable(e.reason, text);
      if (e.status === 'broker_confirmed') check(rec.status !== 'not_imported' && r.ledger_revision !== null && e.quantity !== null && e.average_price !== null && e.currency !== null && (d.currency === null || d.currency === e.currency));
      else check(e.quantity === null && e.average_price === null && e.fees === null);
      if (rec.status === 'not_imported') check(e.status === 'unconfirmed');
    }, 100);
    check(w.returned === (w.items as unknown[]).length && (w.total as number) >= (w.returned as number) && w.has_more === ((w.total as number) > (w.returned as number)));
    const m = object(r.model_evidence, 'status reason capture_count first_capture last_capture horizons limitations');
    oneOf(m.status, 'collecting exploratory unavailable'); text(m.reason); nullable(m.capture_count, count); nullable(m.first_capture, v => before(v, r.source_cutoff)); nullable(m.last_capture, v => before(v, r.source_cutoff));
    check((m.first_capture === null) === (m.last_capture === null)); if (m.first_capture !== null) before(m.first_capture, m.last_capture);
    if (m.capture_count === 0) check(m.first_capture === null);
    if (typeof m.capture_count === 'number' && m.capture_count > 0) check(m.first_capture !== null);
    const horizons = new Set(); list(m.horizons, v => { const h = object(v, 'sessions matured pending excluded'); count(h.sessions); check((h.sessions as number) > 0 && (h.sessions as number) <= 10000 && !horizons.has(h.sessions)); horizons.add(h.sessions); nullable(h.matured, count); nullable(h.pending, count); nullable(h.excluded, count); }); list(m.limitations, text);
    const p = object(r.performance, 'status reason period_start period_end bridge money_weighted time_weighted benchmark');
    oneOf(p.status, 'available unavailable'); nullable(p.reason, text); pair(p.period_start, p.period_end);
    if (p.period_end !== null) check((p.period_end as string) <= (r.source_cutoff as string).slice(0, 10));
    // Benchmark has no explicit compatible v1 schema yet: accept null only, never arbitrary objects.
    check(p.benchmark === null);
    if (p.status === 'unavailable') { text(p.reason); check(p.bridge === null && p.money_weighted === null && p.time_weighted === null); }
    else {
      check(reconciled && p.period_start === rec.period_start && p.period_end === rec.period_end && p.bridge !== null);
      const b = object(p.bridge, 'opening_equity net_external_flows investment_result closing_equity currency');
      for (const key of ['opening_equity', 'net_external_flows', 'investment_result', 'closing_equity']) decimal(b[key]);
      currency(b.currency); check(b.currency === r.reporting_currency);
      for (const [key, method] of [['money_weighted', 'period_mwr_irr'], ['time_weighted', 'period_twr_exact_boundaries']]) {
        if (p[key] === null) continue;
        const metric = object(p[key], 'status value method reason period_start period_end currency annualized');
        oneOf(metric.status, 'available unavailable'); check(metric.method === method && metric.annualized === false);
        check(metric.period_start === p.period_start && metric.period_end === p.period_end && metric.currency === b.currency);
        nullable(metric.reason, text);
        if (metric.status === 'available') { decimal(metric.value); check(metric.reason === null); }
        else { check(metric.value === null); text(metric.reason); }
      }
    }
    return {ok: true, report: r as unknown as OutcomeReport};
  } catch { return {ok: false, reason: 'Outcome report unavailable: invalid or unsupported report contract.'}; }
}
