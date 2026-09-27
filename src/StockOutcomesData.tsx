import { useEffect, useRef, useState } from 'react';
import { StockOutcomes } from './StockOutcomes';
import { parseOutcomeReportRow } from './stockOutcomeData';
import type { OutcomeReport } from './stockOutcomeData';
import type { ReactNode } from 'react';

export interface StockOutcomesDataProps {
  ownerKey: string | null;
  snapshots: ReactNode;
  fetchRows: (path: string) => Promise<{ ok: boolean; status: number; rows: unknown }>;
  onAccessCheck: () => void;
}
export function StockOutcomesData({ snapshots, ownerKey, fetchRows, onAccessCheck }: StockOutcomesDataProps) {
  const [view, setView] = useState<'snapshots' | 'decisions' | 'performance'>('snapshots');
  const [entered, setEntered] = useState(false);
  const fetchRef = useRef(fetchRows);
  fetchRef.current = fetchRows;
  const currentOwner = useRef(ownerKey);
  currentOwner.current = ownerKey;
  const accessRef = useRef(onAccessCheck);
  accessRef.current = onAccessCheck;
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{key: string; report: OutcomeReport | null; pending: boolean; error: string} | null>(null);
  useEffect(() => {
    let active = true;
    if (!entered || ownerKey === null) { setResult(null); return; }
    setResult(old => ({key: ownerKey, report: old?.key === ownerKey ? old.report : null, pending: true, error: ''}));
    const fail = (error: string, clear = true) => {
      if (active && currentOwner.current === ownerKey) setResult(old => ({key: ownerKey, report: !clear && old?.key === ownerKey ? old.report : null, pending: false, error}));
    };
    let timedOut = false;
    const timer = window.setTimeout(() => {
      timedOut = true;
      fail('Outcome report request timed out after 12 seconds. Retry.', false);
    }, 12000);
    // StrictMode cancels its rehearsal before this microtask starts I/O.
    void Promise.resolve().then(() => active && currentOwner.current === ownerKey ? fetchRef.current('pc_outcome_reports?select=report_id,as_of,generated_at,schema_version,payload&order=generated_at.desc,report_id.desc&limit=1') : null).then(response => {
      if (!active || currentOwner.current !== ownerKey || !response) return;
      window.clearTimeout(timer);
      // A current late denial still invalidates cache; superseded requests cannot.
      if (response.status === 401 || response.status === 403) {
        fail('Rechecking owner access.');
        accessRef.current();
        return;
      }
      if (timedOut) return;
      if (!response.ok) { fail(`Request failed (HTTP ${response.status}).`, response.status < 500); return; }
      if (!Array.isArray(response.rows) || response.rows.length > 1) { fail('Invalid or unsupported report contract.'); return; }
      if (response.rows.length === 0) {
        setResult({key: ownerKey, report: null, pending: false, error: ''});
        accessRef.current();
        return;
      }
      const parsed = parseOutcomeReportRow(response.rows[0]);
      if (!parsed.ok) { fail(parsed.reason); return; }
      setResult({key: ownerKey, report: parsed.report, pending: false, error: ''});
    }, () => { window.clearTimeout(timer); if (!timedOut) fail('Check the connection and retry.', false); });
    return () => { active = false; window.clearTimeout(timer); };
  }, [entered, ownerKey, retry]);
  const matching = ownerKey !== null && result?.key === ownerKey ? result : null;
  const report = matching?.report;
  const pending = ownerKey !== null && (!matching || matching.pending);
  return <div>
    <nav className="sd-research-nav" aria-label="History views">
      {(['snapshots', 'decisions', 'performance'] as const).map(item => <button type="button" key={item} aria-pressed={view === item} onClick={() => { setView(item); if (item !== 'snapshots') setEntered(true); }}>{item[0].toUpperCase() + item.slice(1)}</button>)}
    </nav>
    {view === 'snapshots' ? snapshots : <>
      <StockOutcomes view={view} state={ownerKey === null ? {status: 'no-owner'} : report ? {status: 'ready', report} : pending ? {status: 'loading'} : matching?.error ? {status: 'error', reason: matching.error, onRetry: () => setRetry(n => n + 1)} : {status: 'no-report'}} />
      {report && pending && <p role="status">Refreshing outcomes; showing the last successful report with its original source dates.</p>}
      {report && matching?.error && <p role="status">{matching.error} Stale: showing the last successful report; freshness could not be confirmed. Original as-of, generated and source cutoff dates remain unchanged.</p>}
      {(!matching?.error || report) && <button type="button" disabled={ownerKey === null || pending} onClick={() => setRetry(n => n + 1)}>Refresh outcomes</button>}
    </>}
  </div>;
}
