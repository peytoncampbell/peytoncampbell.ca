import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export type DashboardRow = { ticker: string; summary: ReactNode };
export type DashboardSection = 'opportunities' | 'reports' | 'model' | 'brief' | 'book' | 'history' | 'ticket' | 'status';
type Props = {
  portfolio: DashboardRow[]; buys: DashboardRow[]; sells: DashboardRow[];
  details: Record<string, ReactNode>;
  kpis: { label: string; value: ReactNode; note: ReactNode }[];
  attention: string[]; candidates: { ticker: string; rating: string; availability?: string | null; note?: string }[];
  brief: string | null; funding: ReactNode; sessions: ReactNode; status: ReactNode;
  sections: Partial<Record<DashboardSection, ReactNode>>;
  email?: string; refreshing?: boolean;
  onRefresh: () => void; onHome: () => void; onSignOut: () => void;
};
const labels: Record<DashboardSection, string> = { opportunities: 'Opportunities', reports: 'Reports', model: 'Model', brief: 'Brief', book: 'Full book', history: 'History', ticket: 'Full ticket', status: 'Status details' };

/** Layout owns navigation and capacity only. All finance values and detail markup come from the desk. */
export default function StockDashboard(props: Props) {
  const [section, setSection] = useState<DashboardSection | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [portfolioPage, setPortfolioPage] = useState(0);
  const [buyPage, setBuyPage] = useState(0);
  const [sellPage, setSellPage] = useState(0);
  const [capacity, setCapacity] = useState({ portfolio: 15, buy: 10, sell: 8 });
  const [enlarged, setEnlarged] = useState(false);
  const workspace = useRef<HTMLDivElement>(null);
  const probe = useRef<HTMLSpanElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => { setSelected(null); opener.current?.focus(); }, []);
  const select = (ticker: string, element: HTMLElement) => { opener.current = element; setSelected(ticker); };
  const go = (next: DashboardSection | null) => { setSection(next); setSelected(null); };

  useEffect(() => {
    if (selected && !(selected in props.details)) close();
  }, [props.details, selected, close]);
  useEffect(() => {
    if (!selected) return;
    closeButton.current?.focus();
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); close(); } };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [selected, close]);
  useEffect(() => {
    const measure = () => {
      const large = probe.current ? parseFloat(getComputedStyle(probe.current).fontSize) > 20 : false;
      setEnlarged(large);
      // In a reflow layout, show the full default set and let the document scroll naturally.
      const compact = window.innerWidth >= 1100 && window.innerHeight >= 700 && !large;
      const height = workspace.current?.clientHeight ?? 528;
      const measured = (selector: string) => workspace.current?.querySelector(selector)?.getBoundingClientRect().height ?? 0;
      const rowsThatFit = (length: number, chrome: number, rowHeight: number) => {
        const available = height - chrome;
        const all = Math.floor(available / rowHeight);
        // Page controls consume space only when the full list cannot fit.
        return Math.max(1, length > all ? Math.floor((available - 26) / rowHeight) : all);
      };
      const orderChrome = 2 + measured('.sd-orders .sd-panel-head') + measured('.sd-funding') + measured('.sd-sessions');
      setCapacity(compact ? {
        portfolio: rowsThatFit(props.portfolio.length, 2 + measured('.sd-portfolio .sd-panel-head') + measured('.sd-portfolio-columns') + measured('.sd-portfolio-foot'), Math.max(28, measured('.sd-portfolio-row'))),
        buy: rowsThatFit(props.buys.length, orderChrome + measured('.sd-buy h3'), Math.max(38, measured('.sd-buy .sd-order-row'))),
        sell: rowsThatFit(props.sells.length, orderChrome + measured('.sd-sell h3'), Math.max(46, measured('.sd-sell .sd-order-row'))),
      } : { portfolio: 15, buy: 10, sell: 8 });
    };
    const observer = new ResizeObserver(measure);
    if (workspace.current) observer.observe(workspace.current);
    if (probe.current) observer.observe(probe.current);
    window.addEventListener('resize', measure);
    measure();
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, [section, props.portfolio.length, props.buys.length, props.sells.length, props.funding, props.sessions]);
  const lastPage = (length: number, size: number) => Math.max(0, Math.ceil(length / size) - 1);
  const pp = Math.min(portfolioPage, lastPage(props.portfolio.length, capacity.portfolio));
  const bp = Math.min(buyPage, lastPage(props.buys.length, capacity.buy));
  const sp = Math.min(sellPage, lastPage(props.sells.length, capacity.sell));
  useEffect(() => { setPortfolioPage(pp); setBuyPage(bp); setSellPage(sp); }, [pp, bp, sp]);
  const pagination = (name: string, page: number, total: number, size: number, change: (page: number) => void) => total > size &&
    <div className="sd-pagination"><button aria-label={`Previous ${name} page`} disabled={page === 0} onClick={() => change(page - 1)}>Previous</button><span>{page * size + 1}–{Math.min((page + 1) * size, total)} of {total}</span><button aria-label={`Next ${name} page`} disabled={page === lastPage(total, size)} onClick={() => change(page + 1)}>Next</button></div>;
  const orderSide = (side: 'buy' | 'sell', rows: DashboardRow[], page: number, size: number, change: (page: number) => void) =>
    <div className={`sd-order-side sd-${side}`} data-order-side={side}>
      <h3>{side === 'buy' ? 'Buy' : 'Sell / trim'} <span>{rows.length}</span></h3>
      {rows.length === 0 && <p className="sd-empty">No {side === 'buy' ? 'buys' : 'sales'} published</p>}
      {rows.slice(page * size, (page + 1) * size).map((row, index) => <button key={`${row.ticker}-${index}`} className="sd-order-row" data-stock-ticker={row.ticker} onClick={e => select(row.ticker, e.currentTarget)} aria-label={`Inspect ${row.ticker} ${side} proposal`}>{row.summary}</button>)}
      {pagination(side, page, rows.length, size, change)}
    </div>;
  const researchSections: DashboardSection[] = ['opportunities', 'reports', 'model', 'brief'];
  const research = section !== null && researchSections.includes(section);
  return <div className={`stock-dashboard${enlarged ? ' sd-reflow' : ''}${section ? ' sd-secondary' : ''}`}>
    <span ref={probe} className="sd-size-probe" aria-hidden="true">M</span>
    <header className="sd-header">
      <strong className="sd-brand">PC <span>Stock desk</span></strong>
      <nav aria-label="Primary">{(['Dashboard', 'Research', 'History'] as const).map(label => <button key={label} aria-current={(label === 'Dashboard' ? !research && section !== 'history' : label === 'History' ? section === 'history' : research) ? 'page' : undefined} onClick={() => go(label === 'Dashboard' ? null : label === 'History' ? 'history' : 'opportunities')}>{label}</button>)}</nav>
      <button className="sd-refresh" onClick={props.onRefresh} disabled={props.refreshing}>{props.refreshing ? 'Refreshing…' : 'Refresh'}</button>
      <details className="sd-account"><summary>Account</summary><div><span>{props.email}</span><button onClick={props.onHome}>Site</button><button onClick={props.onSignOut}>Sign out</button></div></details>
    </header>
    <section className="sd-kpis" aria-label="Account metrics">{props.kpis.map(kpi => <div key={kpi.label}><span>{kpi.label}</span><strong>{kpi.value}</strong><small>{kpi.note}</small></div>)}</section>
    {section ? <main className="sd-reading-workspace">
      {research && <div className="sd-research-nav" role="group" aria-label="Research sections">{researchSections.map(key => <button key={key} aria-pressed={section === key} onClick={() => go(key)}>{labels[key]}</button>)}</div>}
      <div className="sd-reading" key={section} tabIndex={0} aria-label={labels[section]}>{props.sections[section] ?? <p>{labels[section]} unavailable in this publish.</p>}</div>
    </main> : <main className="sd-workspace" ref={workspace}>
      <section className="sd-panel sd-portfolio" data-dashboard-panel="portfolio" aria-label="Portfolio">
        <div className="sd-panel-head"><h2>Portfolio <span>{props.portfolio.length}</span></h2><button onClick={() => go('book')}>Full book</button></div>
        <div className="sd-portfolio-columns" aria-hidden="true"><span>Ticker</span><span>CAD value</span><span>Weight</span><span>Day</span><span>Book<br />rating</span><span>Call</span></div>
        {props.portfolio.slice(pp * capacity.portfolio, (pp + 1) * capacity.portfolio).map(row => <button key={row.ticker} data-stock-ticker={row.ticker} className="sd-portfolio-row" onClick={e => select(row.ticker, e.currentTarget)} aria-label={`Inspect ${row.ticker} holding`}>{row.summary}</button>)}
        {props.portfolio.length === 0 && <p className="sd-empty">Holdings unavailable</p>}
        {pagination('portfolio', pp, props.portfolio.length, capacity.portfolio, setPortfolioPage)}
        <p className="sd-portfolio-foot">Book call ≠ playbook action or funding sale</p>
      </section>
      <section className="sd-panel sd-orders" data-dashboard-panel="orders" aria-label="Today's proposed plan">
        <div className="sd-panel-head"><h2>Today's plan <span>Proposed</span></h2><button onClick={() => go('ticket')}>Full ticket</button></div>
        <div className="sd-funding">{props.funding}</div>
        <button className="sd-sessions" onClick={() => go('status')}>{props.sessions}</button>
        <div className="sd-order-columns">{orderSide('buy', props.buys, bp, capacity.buy, setBuyPage)}{orderSide('sell', props.sells, sp, capacity.sell, setSellPage)}</div>
      </section>
      <aside className="sd-panel sd-context" data-dashboard-panel="context">
        {selected ? <div className="sd-inspector" role="dialog" aria-modal="false" aria-label={`${selected} stock details`}>
          <div className="sd-panel-head"><h2>{selected}</h2><button ref={closeButton} onClick={close} aria-label={`Close ${selected} details`}>Close</button></div>
          <div className="sd-inspector-content">{props.details[selected]}</div>
        </div> : <>
          <div className="sd-panel-head"><h2>Attention</h2><button onClick={() => go('status')}>View all ({props.attention.length})</button></div>
          <ul className="sd-attention">{props.attention.slice(0, 3).map((item, i) => <li key={i}>{item}</li>)}</ul>
          {!props.attention.length && <p className="sd-empty">No reported exceptions</p>}
          <div className="sd-context-head"><h3>Candidates <span>{props.candidates.length}</span></h3><button onClick={() => go('opportunities')}>View all</button></div>
          <p className="sd-scope">Composite · universe ranking</p>
          <ol className="sd-candidates">{props.candidates.slice(0, 5).map(row => <li key={row.ticker}><button onClick={e => select(row.ticker, e.currentTarget)}>{row.ticker}</button><span>{row.availability && <small className="sd-warning" title={row.note}>{row.availability} · </small>}<b>{row.rating}</b></span></li>)}</ol>
          <div className="sd-context-head"><h3>Morning brief</h3><button onClick={() => go('brief')}>Full brief</button></div>
          <p className="sd-brief-preview">{props.brief ? `${props.brief.slice(0, 145)}${props.brief.length > 145 ? '…' : ''}` : 'Brief unavailable in this publish.'}</p>
        </>}
      </aside>
    </main>}
    <footer className="sd-status"><span>{props.status}</span>
      <details className="sd-attention-details"><summary className={props.attention.length ? 'sd-warning' : ''}>{props.attention.length} attention · Details</summary><div><h3>Attention details</h3><ul>{props.attention.map((item, i) => <li key={i}>{item}</li>)}</ul>{!props.attention.length && <p>No reported exceptions</p>}<button onClick={() => go('status')}>Status details</button></div></details>
      {(selected || section) && props.attention.length ? <span className="sd-warning sd-persistent-warning">{props.attention[0].split(';')[0]}</span> : <span>Proposals only · no orders executed</span>}
    </footer>
  </div>;
}
