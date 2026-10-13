import { AUTH_CONFIGURED, SUPABASE_ANON_KEY, SUPABASE_URL } from './ownerAuth';

export type RefreshStatus = {
  state: 'idle' | 'queued' | 'running' | 'complete' | 'failed' | 'denied' |
    'rate_limited' | 'cooldown' | 'offline' | 'unconfigured';
  job_id?: string | null;
  message?: string;
  retry_after_seconds?: number;
  worker_online?: boolean;
  completed_at?: string | null;
  deadline_at?: string;
  server_now?: string;
  details?: Record<string, number>;
};

const STATES = new Set(['idle', 'queued', 'running', 'complete', 'failed', 'denied',
  'rate_limited', 'cooldown', 'offline', 'unconfigured']);

async function rpc(name: string, body: unknown, signal?: AbortSignal): Promise<RefreshStatus> {
  if (!AUTH_CONFIGURED) throw new Error('Refresh is not configured.');
  const bounded = new AbortController();
  const cancel = () => bounded.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) cancel();
  const timer = setTimeout(cancel, 5000);
  try {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY as string,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body), cache: 'no-store', signal: bounded.signal,
  });
  if (!response.ok) throw new Error('Could not reach the refresh service. Try again shortly.');
  const result = await response.json() as RefreshStatus & { job_state?: RefreshStatus['state'] };
  const status = result && (result.state as string) === 'job' &&
    (result.job_state === 'queued' || result.job_state === 'running')
    ? { ...result, state: result.job_state } : result;
  if (!status || !STATES.has(status.state)) throw new Error('Refresh service returned an invalid response.');
  return status;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}

export async function submitRefresh(pin: string): Promise<RefreshStatus> {
  if (!/^\d{6,10}$/.test(pin)) throw new Error('Enter a PIN of 6–10 digits.');
  return rpc('pc_odds_request_price_refresh', { pin });
}

export async function watchRefresh(jobId: string, onStatus: (status: RefreshStatus) => void,
  signal: AbortSignal, maxPolls = 70, windowMs = 60000): Promise<RefreshStatus> {
  const bounded = new AbortController();
  const cancel = () => bounded.abort();
  signal.addEventListener('abort', cancel, { once: true });
  if (signal.aborted) cancel();
  let deadline = Date.now() + Math.max(0, windowMs);
  let deadlineTimer = setTimeout(cancel, Math.max(0, windowMs));
  try {
  for (let attempt = 0; attempt < maxPolls; attempt++) {
    if (bounded.signal.aborted) throw new DOMException('Refresh watch aborted.', 'AbortError');
    const status = await rpc('pc_odds_price_refresh_status', { job_id: jobId }, bounded.signal);
    if (bounded.signal.aborted) throw new DOMException('Refresh watch aborted.', 'AbortError');
    if (status.job_id !== jobId) throw new Error('Refresh status belongs to another request.');
    onStatus(status);
    if (status.state === 'complete' || status.state === 'failed') return status;
    if (status.deadline_at && status.server_now) {
      const remaining = Date.parse(status.deadline_at) - Date.parse(status.server_now);
      if (!Number.isFinite(remaining)) throw new Error('Refresh deadline is invalid.');
      deadline = Math.min(deadline, Date.now() + Math.max(0, remaining));
      clearTimeout(deadlineTimer);
      deadlineTimer = setTimeout(cancel, Math.max(0, deadline - Date.now()));
    }
    if (status.state !== 'queued' && status.state !== 'running') {
      throw new Error(status.message || 'Refresh is unavailable.');
    }
    await new Promise<void>((resolve, reject) => {
      const cancel = () => { clearTimeout(timer); reject(new DOMException('Refresh watch aborted.', 'AbortError')); };
      const timer = setTimeout(() => { bounded.signal.removeEventListener('abort', cancel); resolve(); }, 1000);
      bounded.signal.addEventListener('abort', cancel, { once: true });
      if (bounded.signal.aborted) cancel();
    });
  }
  throw new Error('The 60-second refresh deadline ended. Reload to check the published board.');
  } catch (error) {
    if (bounded.signal.aborted && !signal.aborted) {
      throw new Error('The 60-second refresh deadline ended. The previous board is retained unless publication was acknowledged.');
    }
    throw error;
  } finally {
    clearTimeout(deadlineTimer);
    signal.removeEventListener('abort', cancel);
  }
}
