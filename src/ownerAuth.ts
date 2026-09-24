import { useCallback, useEffect, useState } from 'react';

/**
 * Owner session plumbing, shared by the login page and the console.
 *
 * Direct REST calls to Supabase auth (no supabase-js): password sign-in, an emailed link as the
 * fallback, refresh-token renewal, and the session a link leaves in the URL fragment. Nothing here
 * decides who may see what - the database does that, via pc_digest_private and its allowlist.
 */

export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/+$/, '');
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const AUTH_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const STORE_KEY = 'pc-desk-session';

export type Session = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  email: string;
};

export function readSession(): Session | null {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function writeSession(session: Session | null): void {
  try {
    if (session) window.localStorage.setItem(STORE_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(STORE_KEY);
  } catch {
    /* private mode: the session simply does not persist */
  }
}

async function authPost(path: string, body: unknown, token?: string) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY as string,
      Authorization: `Bearer ${token ?? SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, data: text ? JSON.parse(text) : null };
}

function sessionFrom(payload: any, email: string): Session {
  return {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    expires_at: Date.now() + (payload.expires_in ?? 3600) * 1000,
    email,
  };
}

/** Adopts a session left in the URL fragment by an emailed link, then tidies the address bar. */
function adoptLinkSession(): { session: Session; error: string | null } | null {
  if (!window.location.hash) return null;
  const params = new URLSearchParams(window.location.hash.slice(1));
  const access = params.get('access_token');
  const refresh = params.get('refresh_token');
  const problem = params.get('error_description') || params.get('error');
  if (!access && !problem) return null;
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  if (!access || !refresh) {
    return { session: null as unknown as Session, error: problem ? decodeURIComponent(problem) : 'That link has expired. Ask for a new one.' };
  }
  return {
    session: sessionFrom({ access_token: access, refresh_token: refresh, expires_in: Number(params.get('expires_in') ?? 3600) }, params.get('email') ?? ''),
    error: null,
  };
}

/**
 * The signed-in session plus the operations both pages need. `ready` is false until the stored or
 * linked session has been examined, so a page never flashes its sign-in form at someone who is
 * already signed in.
 */
export function useOwnerSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!AUTH_CONFIGURED) {
      setReady(true);
      return;
    }
    const adopted = adoptLinkSession();
    if (adopted) {
      if (adopted.error) setError(adopted.error);
      else {
        writeSession(adopted.session);
        setSession(adopted.session);
      }
      setReady(true);
      return;
    }
    setSession(readSession());
    setReady(true);
  }, []);

  /** A token that is valid now - renewing it once if it has expired - or null if it is dead. */
  const ensureFresh = useCallback(async (): Promise<Session | null> => {
    const current = session ?? readSession();
    if (!current || !AUTH_CONFIGURED) return null;
    if (current.expires_at - 30_000 > Date.now()) return current;
    const refreshed = await authPost('token?grant_type=refresh_token', { refresh_token: current.refresh_token });
    if (!refreshed.ok) {
      writeSession(null);
      setSession(null);
      setError('Your session expired. Sign in again.');
      return null;
    }
    const next = sessionFrom(refreshed.data, refreshed.data.user?.email ?? current.email);
    writeSession(next);
    setSession(next);
    return next;
  }, [session]);

  const signIn = useCallback(async (email: string, password: string): Promise<boolean> => {
    if (!AUTH_CONFIGURED) {
      setError('This build is missing its Supabase URL or anon key.');
      return false;
    }
    setError(null);
    const res = await authPost('token?grant_type=password', { email, password });
    if (!res.ok) {
      setError(res.status === 400 ? 'That email and password do not match.' : `Sign-in failed (HTTP ${res.status}).`);
      return false;
    }
    const next = sessionFrom(res.data, res.data.user?.email ?? email);
    writeSession(next);
    setSession(next);
    return true;
  }, []);

  const requestLink = useCallback(async (email: string): Promise<boolean> => {
    if (!AUTH_CONFIGURED || !email) {
      setError('Enter your email first, then ask for the link.');
      return false;
    }
    setError(null);
    const res = await authPost('otp', {
      email,
      // The public endpoint reads these under `options`; should_create_user keeps a typo'd or
      // unknown address from creating an account.
      options: { email_redirect_to: window.location.origin + '/stocks', should_create_user: false },
    });
    if (!res.ok) {
      setError(`Could not send the link (HTTP ${res.status}).`);
      return false;
    }
    return true;
  }, []);

  const signOut = useCallback(async () => {
    const active = session;
    writeSession(null);
    setSession(null);
    if (active && AUTH_CONFIGURED) {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: { apikey: SUPABASE_ANON_KEY as string, Authorization: `Bearer ${active.access_token}` },
      }).catch(() => undefined);
    }
  }, [session]);

  return { session, ready, error, setError, signIn, requestLink, signOut, ensureFresh };
}

/** GETs a PostgREST path with the owner's token, renewing once on a 401. */
export async function ownerFetch(path: string, fresh: () => Promise<Session | null>) {
  let token = await fresh();
  if (!token) return { ok: false, status: 401, rows: [] as any[] };
  let res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_ANON_KEY as string, Authorization: `Bearer ${token.access_token}` },
    cache: 'no-store',
  });
  if (res.status === 401) {
    token = await fresh();
    if (!token) return { ok: false, status: 401, rows: [] as any[] };
    res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { apikey: SUPABASE_ANON_KEY as string, Authorization: `Bearer ${token.access_token}` },
      cache: 'no-store',
    });
  }
  if (!res.ok) return { ok: false, status: res.status, rows: [] as any[] };
  return { ok: true, status: res.status, rows: (await res.json()) as any[] };
}

/** Keeps the owner pages out of search results without touching the public site's metadata. */
export function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex,nofollow';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);
}
