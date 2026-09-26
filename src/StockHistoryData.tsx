import { useEffect, useRef, useState } from 'react';
import { StockHistory } from './StockHistory';
import type { StockHistoryProps } from './StockHistory';
import { insightsPath, publishedPrice } from './stockInsightData';

export interface StockHistoryDataProps {
  ticker: string;
  scope: 'book' | 'universe';
  currency: string | null;
  snapshot: unknown;
  ownerKey: string | null;
  ratings: StockHistoryProps['ratings'];
  isEtf?: boolean;
  fetchRows: (path: string) => Promise<{ ok: boolean; status: number; rows: unknown }>;
  onAccessCheck: () => void;
}

export function StockHistoryData(props: StockHistoryDataProps) {
  const path = insightsPath(props.snapshot);
  const key = path && props.ownerKey !== null ? JSON.stringify([props.ownerKey, path]) : null;
  const currentKey = useRef(key);
  currentKey.current = key;
  const fetchRef = useRef(props.fetchRows);
  fetchRef.current = props.fetchRows;
  const accessRef = useRef(props.onAccessCheck);
  accessRef.current = props.onAccessCheck;
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ key: string; rows: unknown; pending: boolean; error: string } | null>(null);
  useEffect(() => {
    let active = true;
    if (!key || !path) { setResult(null); return; }
    setResult(old => ({ key, rows: old?.key === key ? old.rows : undefined, pending: true, error: '' }));
    const fail = (message: string, clear = false) => {
      if (active && currentKey.current === key) setResult(old => ({ key, rows: !clear && old?.key === key ? old.rows : undefined, pending: false, error: message }));
    };
    let timedOut = false;
    const timer = window.setTimeout(() => {
      timedOut = true;
      fail('Price history request timed out after 12 seconds. Retry price history.');
    }, 12000);
    // Deferring one microtask lets StrictMode cancel its rehearsal before any I/O.
    void Promise.resolve().then(() => active && currentKey.current === key ? fetchRef.current(path) : null).then(response => {
      if (!response || !active || currentKey.current !== key) return;
      window.clearTimeout(timer);
      // A secondary denial only asks the controller to revalidate its private gate.
      // It can still revoke this local cache after timeout, but never after retry/unmount.
      if (response.status === 401 || response.status === 403) {
        fail('Price history unavailable. Rechecking owner access.', true);
        accessRef.current();
        return;
      }
      if (timedOut) return;
      if (!response.ok) { fail(`Price history request failed (HTTP ${response.status}).`, response.status < 500); return; }
      setResult({ key, rows: response.rows, pending: false, error: '' });
    }, () => {
      window.clearTimeout(timer);
      if (!timedOut) fail('Price history request failed. Check the connection and retry.');
    });
    return () => { active = false; window.clearTimeout(timer); };
  }, [key, path, retry]);
  // Gate during render, before effect cleanup: a new owner/snapshot must never flash old data.
  const matching = key && result?.key === key ? result : null;
  const pending = Boolean(key && (!matching || matching.pending));
  const selected = matching && publishedPrice(matching.rows, props.snapshot, props.ticker, props.currency);
  const price: StockHistoryProps['price'] = !key
    ? { state: 'unavailable', history: null, identity: null, message: 'Owner access or published snapshot identity unavailable.' }
    : selected?.state === 'ready' ? selected
    : pending ? { state: 'loading', history: null, identity: null }
    : { state: 'unavailable', history: null, identity: null, message: matching?.error || selected?.message };
  return <div className="sd-history sd-history-data">
    <StockHistory ticker={props.ticker} scope={props.scope} ratings={props.ratings} isEtf={props.isEtf} price={price} />
    {matching?.error && <p role="status">{matching.error} {selected?.state === 'ready' && 'Showing the last successful response; freshness could not be confirmed. Original source dates remain unchanged.'}</p>}
    {pending && selected?.state === 'ready' && <p role="status">Refreshing price history; showing the last successful response with its original source dates.</p>}
    <div className="sd-history-controls"><button type="button" disabled={!key || pending} onClick={() => setRetry(value => value + 1)}>{matching?.error ? 'Retry price history' : 'Refresh price history'}</button></div>
  </div>;
}
