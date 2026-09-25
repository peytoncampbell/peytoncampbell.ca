import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * The live desk: yesterday's and today's published portfolio digest, read straight from
 * Supabase in the browser. There is no build step involved in a daily update - the page
 * fetches on load, on tab focus, and every few minutes, so the numbers on screen are the
 * ones the 07:45 publish wrote.
 *
 * WHY THE VIEW AND NOT THE TABLE. `pc_digest_public` is a Postgres view that only contains
 * the public columns; the book value, cost basis and per-holding rows are not in it at all.
 * The Supabase anon key ships in this bundle and is public by design, so the guarantee has
 * to come from the database, not from hiding a component.
 */

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/+$/, '');
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const PUBLIC_VIEW = 'pc_digest_public';
const HISTORY_LIMIT = 12;
/** Weekday publishes; a reload is not needed to see a new day, an interval is enough. */
const REFRESH_MS = 5 * 60 * 1000;

export type DigestRow = {
  id: number;
  as_of: string;
  created_at: string;
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

async function fetchDigest(): Promise<DigestRow[]> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('missing-config');
  const url = `${SUPABASE_URL}/rest/v1/${PUBLIC_VIEW}` +
    `?select=*&order=as_of.desc&limit=${HISTORY_LIMIT}`;
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    // A cached response would show yesterday's call after this morning's publish.
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as DigestRow[];
}

function pct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined) return '--';
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}%`;
}

function tone(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'flat';
  if (value > 0) return 'up';
  if (value < 0) return 'down';
  return 'flat';
}

function todayIso(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export default function PortfolioDigest() {
  const [rows, setRows] = useState<DigestRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    try {
      const next = await fetchDigest();
      if (!mounted.current) return;
      setRows(next);
      setError(null);
      setRefreshedAt(new Date());
    } catch (err) {
      if (!mounted.current) return;
      setError(err instanceof Error ? err.message : 'unknown');
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void load();
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      mounted.current = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [load]);

  const latest = rows && rows.length > 0 ? rows[0] : null;
  const history = useMemo(() => (rows ? rows.slice(0, 10) : []), [rows]);
  const isToday = latest ? latest.as_of === todayIso() : false;

  if (error === 'missing-config') {
    return (
      <div className="desk-shell">
        <p className="desk-note">
          The desk feed is not configured for this build (VITE_SUPABASE_URL /
          VITE_SUPABASE_ANON_KEY).
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="desk-shell">
        <p className="desk-note desk-note-warn">
          Could not reach the desk feed ({error}). The automation still runs weekdays at 07:45 ET.
        </p>
      </div>
    );
  }

  if (!rows) {
    return (
      <div className="desk-shell">
        <div className="desk-grid">
          {[0, 1, 2, 3].map((i) => (
            <div className="desk-stat" key={i}>
              <span className="desk-stat-k">Loading</span>
              <span className="desk-stat-v">--</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!latest) {
    return (
      <div className="desk-shell">
        <p className="desk-note">No published rows yet. The desk writes one each weekday at 07:45 ET.</p>
      </div>
    );
  }

  const stats = [
    { k: 'Account return', v: pct(latest.account_return_pct, 2), t: tone(latest.account_return_pct) },
    { k: 'Today', v: pct(latest.day_change_pct, 2), t: tone(latest.day_change_pct) },
    {
      k: 'Calls',
      v: `${latest.calls_hold ?? 0} hold / ${latest.calls_sell ?? 0} sell`,
      t: (latest.calls_sell ?? 0) > 0 ? 'down' : 'flat',
    },
    {
      k: 'Breadth',
      v: `${latest.names_up ?? 0} up / ${latest.names_down ?? 0} down`,
      // a count that holds both directions is neutral: tinting it one way reads as a verdict
      t: 'flat',
    },
  ];

  return (
    <div className="desk-shell">
      <div className="desk-grid">
        {stats.map((stat) => (
          <div className="desk-stat" key={stat.k}>
            <span className="desk-stat-k">{stat.k}</span>
            <span className={`desk-stat-v ${stat.t}`}>{stat.v}</span>
          </div>
        ))}
      </div>

      <div className="desk-meta">
        <span className={`desk-pill ${isToday ? 'live' : 'stale'}`}>
          {isToday ? 'Today' : `Latest: ${latest.as_of}`}
        </span>
        <span>
          {latest.positions_held ?? 0} positions ({latest.positions_stocks ?? 0} names + ETF)
          {' \u00b7 '}
          {latest.rules_triggered ?? 0} exit rules fired
          {' \u00b7 '}
          automations {latest.automations_ok ?? 0}/{latest.automations_total ?? 0} clean
        </span>
        {refreshedAt && (
          <span className="desk-meta-quiet">
            checked {refreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {history.length > 1 && (
        <div className="desk-history">
          <table>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Account</th>
                <th scope="col">Day</th>
                <th scope="col">Hold</th>
                <th scope="col">Sell</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={row.id}>
                  <td>{row.as_of}</td>
                  <td className={tone(row.account_return_pct)}>{pct(row.account_return_pct, 2)}</td>
                  <td className={tone(row.day_change_pct)}>{pct(row.day_change_pct, 2)}</td>
                  <td>{row.calls_hold ?? 0}</td>
                  <td className={(row.calls_sell ?? 0) > 0 ? 'down' : 'flat'}>{row.calls_sell ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="desk-note">
        Published by the local pre-open automation each weekday at 07:45 ET, from analyst
        consensus only. Analyst targets, not investment advice.
      </p>
    </div>
  );
}
