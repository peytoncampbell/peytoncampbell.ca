import { AUTH_CONFIGURED, SUPABASE_ANON_KEY, SUPABASE_URL } from './ownerAuth';

export type RefreshStatus = {
  state: 'idle' | 'queued' | 'running' | 'complete' | 'failed' | 'denied' |
    'rate_limited' | 'cooldown' | 'offline' | 'unconfigured';
  job_id?: string | null;
  message?: string;
  retry_after_seconds?: number;
  worker_online?: boolean;
  completed_at?: string | null;
  details?: Record<string, number>;
};

const STATES = new Set(['idle', 'queued', 'running', 'complete', 'failed', 'denied',
  'rate_limited', 'cooldown', 'offline', 'unconfigured']);

async function rpc(name: string, body: unknown, signal?: AbortSignal): Promise<RefreshStatus> {
  if (!AUTH_CONFIGURED) throw new Error('Refresh is not configured.');
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY as string,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body), cache: 'no-store', signal,
  });
  if (!response.ok) throw new Error('Could not reach the refresh service. Try again shortly.');
  const result = await response.json() as RefreshStatus & { job_state?: RefreshStatus['state'] };
  const status = result && (result.state as string) === 'job' &&
    (result.job_state === 'queued' || result.job_state === 'running')
    ? { ...result, state: result.job_state } : result;
  if (!status || !STATES.has(status.state)) throw new Error('Refresh service returned an invalid response.');
  return status;
}

export async function submitRefresh(pin: string): Promise<RefreshStatus> {
  if (!/^\d{6,10}$/.test(pin)) throw new Error('Enter a PIN of 6–10 digits.');
  return rpc('pc_odds_request_refresh', { pin });
}

export async function watchRefresh(jobId: string, onStatus: (status: RefreshStatus) => void,
  signal: AbortSignal, maxPolls = 300): Promise<RefreshStatus> {
  for (let attempt = 0; attempt < maxPolls; attempt++) {
    if (signal.aborted) throw new DOMException('Refresh watch aborted.', 'AbortError');
    const status = await rpc('pc_odds_refresh_status', { job_id: jobId }, signal);
    if (signal.aborted) throw new DOMException('Refresh watch aborted.', 'AbortError');
    onStatus(status);
    if (status.state === 'complete' || status.state === 'failed') return status;
    if (status.state !== 'queued' && status.state !== 'running') {
      throw new Error(status.message || 'Refresh is unavailable.');
    }
    await new Promise<void>((resolve, reject) => {
      const cancel = () => { clearTimeout(timer); reject(new DOMException('Refresh watch aborted.', 'AbortError')); };
      const timer = setTimeout(() => { signal.removeEventListener('abort', cancel); resolve(); }, 2000);
      signal.addEventListener('abort', cancel, { once: true });
      if (signal.aborted) cancel();
    });
  }
  throw new Error('Refresh is still running. Reload the board shortly to check for the update.');
}
