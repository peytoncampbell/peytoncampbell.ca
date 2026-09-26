import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { StockSelection } from './StockDashboard';
import './StockChanges.css';

export type ChangeItem = { id: string; ticker: string | null; category: string; label: string; source: string; beforeDate: string; afterDate: string; before: ReactNode; after: ReactNode; reason?: string | null };
export type ChangeGroup = { source: string; beforeDate: string | null; afterDate: string | null; status: 'loading' | 'ready' | 'baseline' | 'unavailable'; notices: readonly string[]; items: readonly ChangeItem[] };
export type StockChangesProps = { groups: readonly ChangeGroup[]; reviewed: Readonly<Record<string, string>>; onReview: (id: string) => void; onOpen: (selection: StockSelection) => void };
const fact = (value: ReactNode) => typeof value === 'boolean' ? String(value) : value;

/** Presentation only: dates, facts, labels and comparison event IDs belong to the caller. */
export function StockChanges({ groups, reviewed, onReview, onOpen }: StockChangesProps) {
  const [filter, setFilter] = useState<'New' | 'Reviewed' | 'All'>('New');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const root = useRef<HTMLElement>(null);
  const pendingFocus = useRef(false);
  const items = groups.flatMap(group => group.status === 'ready' ? [...group.items] : []);
  const categories = [...new Set(items.map(item => item.category).filter(Boolean))];
  const activeCategory = categories.includes(category) ? category : '';
  const scoped = items.filter(item => !activeCategory || item.category === activeCategory);
  const counts = { All: scoped.length, Reviewed: scoped.filter(item => Boolean(reviewed[item.id])).length, New: scoped.filter(item => !reviewed[item.id]).length };
  const filtered = scoped.filter(item => filter === 'All' || (filter === 'Reviewed') === Boolean(reviewed[item.id]));
  const lastPage = Math.max(0, Math.ceil(filtered.length / 20) - 1);
  const currentPage = Math.min(page, lastPage);
  const visible = new Set(filtered.slice(currentPage * 20, (currentPage + 1) * 20).map(item => item.id));
  useEffect(() => {
    if (page !== currentPage) setPage(currentPage);
    if (pendingFocus.current) { pendingFocus.current = false; heading.current?.focus(); }
  });
  const review = (id: string) => {
    pendingFocus.current = filter === 'New' && Boolean(root.current?.contains(document.activeElement));
    onReview(id);
  };
  return <section className="stock-changes" ref={root}>
    <h3 ref={heading} tabIndex={-1}>Changes since the previous daily snapshot</h3>
    <p>Daily snapshots may be updated during the day. Reviewed does not mean executed or risk resolved.</p>
    <div className="sc-controls" role="group" aria-label="Review filter">{(['New', 'Reviewed', 'All'] as const).map(value => <button key={value} aria-pressed={filter === value} onClick={() => { setFilter(value); setPage(0); }}>{value} ({counts[value]})</button>)}</div>
    {categories.length > 1 && <label className="sc-category">Category <select value={activeCategory} onChange={event => { setCategory(event.target.value); setPage(0); }}><option value="">All categories</option>{categories.map(value => <option key={value} value={value}>{value}</option>)}</select></label>}
    {groups.length === 0 && <p>Comparison unavailable: source coverage has not been supplied.</p>}
    {groups.map((group, index) => <section key={index}>
      <h4>{group.source}</h4><p className="sc-meta">Before: {group.beforeDate ?? 'Unavailable'} · After: {group.afterDate ?? 'Unavailable'}</p>
      <p>{group.status === 'baseline' ? 'Baseline recorded' : group.status === 'unavailable' ? 'Comparison unavailable' : group.status === 'loading' ? 'Loading comparison' : group.items.length === 0 ? 'No changes between these daily snapshots' : `${group.items.length} changes available`}</p>
      {group.notices.map((notice, i) => <p key={i}>{notice}</p>)}
      {group.status === 'unavailable' && group.notices.length === 0 && <p>A complete daily snapshot pair is not available.</p>}
      {group.status === 'ready' && group.items.filter(item => visible.has(item.id)).map(item => <article key={item.id} data-change-id={item.id}>
        <h4>{item.ticker !== null && <span>{item.ticker} · </span>}{item.label}</h4>
        <dl><dt>Before</dt><dd>{fact(item.before)}</dd><dt>After</dt><dd>{fact(item.after)}</dd></dl>
        {item.reason != null && <p>{item.reason}</p>}
        <p className="sc-meta">{item.source} · {item.beforeDate} → {item.afterDate}</p>
        {item.ticker !== null && <button onClick={() => onOpen({ticker:item.ticker!,origin:'change',changeId:item.id})}>Open stock analysis</button>}
        <button disabled={Boolean(reviewed[item.id])} onClick={() => review(item.id)}>{reviewed[item.id] ? 'Reviewed' : 'Mark reviewed'}</button>
      </article>)}
    </section>)}
    {items.length > 0 && filtered.length === 0 && <p role="status">No {filter.toLowerCase()} changes match this filter.</p>}
    {filtered.length > 20 && <nav className="sc-controls" aria-label="Changes pages"><button disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button><span aria-live="polite">{currentPage * 20 + 1}–{Math.min((currentPage + 1) * 20, filtered.length)} of {filtered.length}</span><button disabled={currentPage === lastPage} onClick={() => setPage(currentPage + 1)}>Next</button></nav>}
  </section>;
}
export default StockChanges;

type ReviewScope = { user: string | null; session: string | null; reviewed: Record<string, string> };
const reviewKey = (user: string) => `stock-change-review:v1:${encodeURIComponent(user)}`;
const validId = (id: string) => /^[a-f0-9]{64}$/.test(id);
function loadReview(user: string | null, session: string | null): ReviewScope {
  const reviewed: Record<string, string> = {};
  if (user && session) {
    try {
      const stored = JSON.parse(localStorage.getItem(reviewKey(user)) ?? 'null');
      if (stored?.version === 1 && Object.keys(stored).length === 2 && stored.reviewed && typeof stored.reviewed === 'object' && !Array.isArray(stored.reviewed)) {
        for (const [id, time] of Object.entries(stored.reviewed)) {
          if (validId(id) && typeof time === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(time) && Number.isFinite(Date.parse(time)) && new Date(time).toISOString() === time) reviewed[id] = time;
        }
      }
    } catch { /* Storage is optional; review remains usable in memory. */ }
  }
  return { user, session, reviewed: Object.fromEntries(Object.entries(reviewed).sort((a, b) => b[1].localeCompare(a[1])).slice(0, 2000)) };
}

/** Mount at the owner workspace level, not inside a detail renderer.
 * Only event IDs and ISO review times persist locally; no cross-device synchronization.
 * The most recent 2,000 reviews are retained. Missing provider ID means session-only memory.
 * sessionIdentity is an opaque lifecycle identity; it is never persisted.
 */
export function useChangeReview(stableUserId: string | null, sessionIdentity: string | null): { reviewed: Readonly<Record<string, string>>; markReviewed: (id: string) => void } {
  const [storedScope, setScope] = useState(() => loadReview(stableUserId, sessionIdentity));
  let scope = storedScope;
  if (scope.user !== stableUserId || scope.session !== sessionIdentity) {
    scope = loadReview(stableUserId, sessionIdentity);
    setScope(scope);
  }
  const active = useRef<ReviewScope | null>(scope);
  active.current = scope;
  const [, update] = useState(0);
  useEffect(() => {
    active.current = scope;
    return () => { if (active.current === scope) active.current = null; };
  }, [scope]);
  const markReviewed = (id: string) => {
    if (active.current !== scope || !scope.session || !validId(id)) return;
    scope.reviewed = Object.fromEntries(Object.entries({ ...scope.reviewed, [id]: new Date().toISOString() }).sort((a, b) => b[1].localeCompare(a[1])).slice(0, 2000));
    if (scope.user) {
      try { localStorage.setItem(reviewKey(scope.user), JSON.stringify({ version: 1, reviewed: scope.reviewed })); } catch { /* Keep the in-memory review when persistence is blocked. */ }
    }
    update(value => value + 1);
  };
  return { reviewed: scope.reviewed, markReviewed };
}
