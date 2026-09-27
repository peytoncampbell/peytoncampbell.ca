import type { OutcomeReport, OutcomeDecision, OutcomeMetric } from './stockOutcomeData';
import './StockOutcomes.css';

export type OutcomeLoadState =
  | { status: 'loading' | 'no-report' | 'no-owner' }
  | { status: 'error'; reason: string; onRetry: () => void }
  | { status: 'ready'; report: OutcomeReport };
export interface StockOutcomesProps { view: 'decisions' | 'performance'; state: OutcomeLoadState }
const shown = (value: string | number | null) => value ?? 'Unknown';
const money = (value: string | null, currency: string | null) => value === null ? 'Unavailable' : `${value} ${currency ?? '(currency unknown)'}`;
const intent = {unrecorded: 'Unrecorded', considering: 'Considering', skipped: 'Skipped', reported_submitted: 'Reported submitted — user intent, not broker evidence'};
const publication = {generated: 'Generated', published: 'Published', observed_existing: 'Observed existing — not backdated into evaluation'};
const reconciliation = {not_imported: 'Broker data not imported', incomplete: 'Broker evidence incomplete', discrepancy: 'Reconciliation discrepancy', reconciled: 'Reconciled period reported', reconciled_with_rounding: 'Reconciled with rounding reported'};
function Notes({items}: {items: readonly string[]}) { return items.length ? <ul>{items.map((item, index) => <li key={index}>{item}</li>)}</ul> : null; }
function Decision({item}: {item: OutcomeDecision}) {
  const e = item.execution;
  return <article>
    <h4>{item.ticker} · {item.action}</h4>
    <p>Original proposal: {item.quantity === null ? 'Quantity unavailable' : `${item.quantity} units`}; {item.order_type ?? 'order type unknown'}{item.limit_native !== null && <> at {money(item.limit_native, item.currency)}</>}{item.amount_cad !== null && <>; amount {money(item.amount_cad, 'CAD')}</>}.</p>
    <p>Intent: {intent[item.intent]}.</p>
    <p>{e.status === 'broker_confirmed' ? 'Broker-confirmed execution (reported by ledger)' : e.status === 'ambiguous' ? 'Execution ambiguous' : 'Execution unconfirmed'}.</p>
    <details><summary>Original decision and evidence</summary>
      <p>{item.reason ?? 'Original reason unavailable.'}</p>
      <dl><dt>Publication state</dt><dd>{publication[item.publication_state]}</dd><dt>Original as-of</dt><dd>{item.as_of}</dd><dt>Original publication</dt><dd>{item.generated_at}</dd><dt>Captured</dt><dd>{item.captured_at}</dd><dt>Listing</dt><dd>{shown(item.listing_symbol)}</dd><dt>Native currency</dt><dd>{shown(item.currency)}</dd><dt>Model</dt><dd>{item.model_version ?? 'Model unknown'}</dd><dt>Cohort</dt><dd>{item.cohort_id ?? 'Cohort unknown'}</dd></dl>
      <table><caption>Original proposal — exact values</caption><tbody><tr><th scope="row">Quantity</th><td>{shown(item.quantity)}</td></tr><tr><th scope="row">Limit, native</th><td>{money(item.limit_native, item.currency)}</td></tr><tr><th scope="row">Amount, CAD</th><td>{money(item.amount_cad, 'CAD')}</td></tr></tbody></table>
      {e.status === 'broker_confirmed' && <table><caption>Execution — exact ledger-reported values</caption><tbody><tr><th scope="row">Quantity</th><td>{shown(e.quantity)}</td></tr><tr><th scope="row">Average price</th><td>{money(e.average_price, e.currency)}</td></tr><tr><th scope="row">Fees</th><td>{money(e.fees, e.currency)}</td></tr></tbody></table>}
      <p>{e.reason ?? 'Execution evidence reason unavailable.'}</p>
      <p className="so-meta">Broker evidence is attested by the report producer, not verified by this browser.</p>
    </details>
  </article>;
}
// Presentation-only decimal point shift; no floating-point rounding or finance recomputation.
function percent(fraction: string) {
  const negative = fraction.startsWith('-'), [whole, fractionDigits = ''] = fraction.replace(/^-/, '').split('.');
  const padded = fractionDigits.padEnd(2, '0');
  const integer = (whole + padded.slice(0, 2)).replace(/^0+(?=\d)/, '');
  const remainder = padded.slice(2).replace(/0+$/, '');
  return `${negative ? '-' : ''}${integer}${remainder ? `.${remainder}` : ''}%`;
}
function Metric({label, metric}: {label: string; metric: OutcomeMetric | null}) {
  return <section><h4>{label}</h4>{metric?.status === 'available' && metric.value !== null ? <>
    <p>{percent(metric.value)} for the supported period; not annualized.</p>
    <details><summary>Method and exact return</summary><dl><dt>Return fraction</dt><dd>{metric.value}</dd><dt>Method</dt><dd>{metric.method}</dd><dt>Period</dt><dd>{metric.period_start} to {metric.period_end}</dd><dt>Currency</dt><dd>{metric.currency}</dd></dl></details>
  </> : <p>Unavailable. {metric?.reason ?? 'No supported metric supplied.'}</p>}</section>;
}
function Performance({report}: {report: OutcomeReport}) {
  const p = report.performance, b = p.bridge, m = report.model_evidence;
  return <>
    <section><h4>{reconciliation[report.reconciliation.status]}</h4><Notes items={report.reconciliation.issues}/>
      {p.status === 'unavailable' ? <p>Performance unavailable. {p.reason}</p> : <>
        <p>Supported period: {p.period_start} to {p.period_end}. Values reported in {report.reporting_currency}; no currency conversion is performed here.</p>
        {b && <table><caption>Account value bridge — exact {b.currency} amounts</caption><tbody>{([
          ['Opening equity', b.opening_equity], ['Net external flows', b.net_external_flows], ['Investment result', b.investment_result], ['Closing equity', b.closing_equity],
        ]).map(([label, value]) => <tr key={label}><th scope="row">{label}</th><td>{value} {b.currency}</td></tr>)}</tbody></table>}
        <Metric label="Money-weighted return" metric={p.money_weighted}/><Metric label="Time-weighted return" metric={p.time_weighted}/>
      </>}
    </section>
    <section><h4>Comparison unavailable</h4><p>No validated compatible comparison contract or approved policy is supplied. No benchmark has been selected here.</p></section>
    <section><h4>Model evidence: {m.status}</h4><p>{m.reason}</p><p>Captures: {shown(m.capture_count)}. Captured files are not mature outcomes.</p>
      <details><summary>Capture dates and horizon coverage</summary><p className="so-meta">First capture: {shown(m.first_capture)}. Last capture: {shown(m.last_capture)}.</p>
        <table><caption>Declared trading-session horizons</caption><thead><tr><th scope="col">Sessions</th><th scope="col">Matured</th><th scope="col">Pending</th><th scope="col">Excluded</th></tr></thead><tbody>{m.horizons.map(h => <tr key={h.sessions}><th scope="row">{h.sessions}</th><td>{shown(h.matured)}</td><td>{shown(h.pending)}</td><td>{shown(h.excluded)}</td></tr>)}</tbody></table><Notes items={m.limitations}/>
      </details>
    </section>
  </>;
}
/** Standalone read-only presentation. Parent owns authentication, request lifecycle and selected subview. */
export function StockOutcomes({view, state}: StockOutcomesProps) {
  return <section className="stock-outcomes" aria-label={view === 'decisions' ? 'Decisions' : 'Performance'}>
    {state.status !== 'ready' ? state.status === 'error' ? <><p role="alert">Outcome report unavailable. {state.reason}</p><button type="button" onClick={state.onRetry}>Retry</button></> : <p role="status">{state.status === 'loading' ? 'Loading outcomes…' : state.status === 'no-owner' ? 'Owner access required. No outcome data is shown.' : 'No outcome report has been published.'}</p> : <>
      {view === 'decisions' ? <><p>{state.report.decision_window.returned} of {state.report.decision_window.total} decisions in this source scope. {state.report.decision_window.has_more ? 'Recent window only; more records remain in the local archive.' : 'Complete reported window.'}</p>{state.report.decision_window.items.length === 0 && <p>No decisions captured in this source scope.</p>}{state.report.decision_window.items.map(item => <Decision key={item.decision_id} item={item}/>)}</> : <Performance report={state.report}/>}
      <details className="so-provenance"><summary>Report provenance and limitations</summary><dl className="so-meta"><dt>Report as-of</dt><dd>{state.report.as_of}</dd><dt>Generated</dt><dd>{state.report.generated_at}</dd><dt>Source cutoff</dt><dd>{state.report.source_cutoff}</dd><dt>Broker data as-of</dt><dd>{shown(state.report.reconciliation.broker_data_as_of)}</dd><dt>Evidence verified at</dt><dd>{shown(state.report.reconciliation.verified_at)}</dd></dl><Notes items={state.report.limitations}/><p className="so-meta">Source cutoff and report dates do not establish broker completeness. The producer remains the evidence authority.</p></details>
    </>}
  </section>;
}
export default StockOutcomes;
