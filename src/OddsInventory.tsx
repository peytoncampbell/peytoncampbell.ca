import { useEffect, useMemo, useRef, useState } from 'react';
import { loadInventory, loadMarkets, type InventoryCatalogue, type InventoryEvent,
  type InventoryMarket, type InventorySelection } from './oddsInventoryData';

const number = (value = 0) => value.toLocaleString();
const date = (value: string | null) => value ? new Date(value).toLocaleString() : 'Source time unavailable';
const field = 'min-w-0 rounded-lg border border-[#d5d5dc] bg-white px-3 py-2.5 text-sm text-[#1d1d1f] outline-none focus:border-[#0071e3]';

export function trimDecimal(value: string | null | undefined): string {
  if (value == null) return '\u2014';
  return /^[+-]?\d+\.\d+$/.test(value) ? value.replace(/0+$/, '').replace(/\.$/, '') : value;
}

function eventIdentity(event: InventoryEvent | null): string | null {
  if (!event || [event.book, event.source_event_id, event.sport].some(value => typeof value !== 'string' || !value)) return null;
  return JSON.stringify([event.book, event.source_event_id, event.sport]);
}

export function updatedEvent(events: InventoryEvent[], previous: InventoryEvent | null): InventoryEvent | null {
  const identity = eventIdentity(previous);
  if (!identity) return null;
  const matches = events.filter(candidate => eventIdentity(candidate) === identity);
  return matches.length === 1 ? matches[0] : null;
}

function Selection({ row }: { row: InventorySelection }) {
  const price = row.pricing_verified && row.offered_price !== null ? row.offered_price : row.price;
  return <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-t border-[#ededf1] py-3 first:border-0">
    <div className="min-w-0">
      <p className="break-words text-sm text-[#1d1d1f]">{row.subject && !row.label.includes(row.subject) ? `${row.subject} · ${row.label}` : row.label}</p>
      <p className="mt-1 text-xs text-[#6e6e73]">
        {row.point !== null && <span className="mr-2">Line {trimDecimal(row.point)}</span>}
        {!row.pricing_verified ? 'Pricing unverified' : row.available ? 'Offered at capture' : 'Unavailable at capture'}
      </p>
      {!!row.legs.length && <ul className="mt-2 space-y-1 text-xs text-[#606066]">{row.legs.map((leg,index) =>
        <li key={index}>{leg.market && `${leg.market} · `}{leg.selection || leg.native_reference}{leg.point !== undefined && leg.point !== null && ` · line ${trimDecimal(leg.point)}`}
          <span className="ml-1 text-[#6e6e73]">{leg.operations.map(p => p[1]).join(' → ')}</span></li>)}</ul>}
      <details className="mt-1 text-[11px] text-[#6e6e73]"><summary className="cursor-pointer">Source details</summary>
        <p className="mt-1 break-all">Selection {row.id} · captured {date(row.captured_at)}</p>
        {row.offered_price !== null && <p className="mt-1 break-all">Feed price {trimDecimal(row.price)} · {row.pricing_verified ? 'verified offered price' : 'unverified offered field'} {trimDecimal(row.offered_price)}</p>}
        {row.pricing_warning && <p className="mt-1">{row.pricing_warning}</p>}
        <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap break-all">{row.native_context}</pre>
        {row.native_legs && <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap break-all">{row.native_legs}</pre>}
      </details>
    </div>
    <div className="max-w-[10rem] text-right"><p className={`break-all font-mono text-lg font-semibold ${row.available && row.pricing_verified ? 'text-[#1d1d1f]' : 'text-[#6e6e73]'}`}>{trimDecimal(price)}</p>
      <p className="text-[10px] uppercase tracking-wide text-[#6e6e73]">{row.pricing_verified ? 'Decimal odds' : 'Unverified feed quote'}</p></div>
  </div>;
}

function MarketCard({ market: m }: { market: InventoryMarket }) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const lines = [...new Set(m.selections.map(s => s.point).filter((value): value is string => value !== null))];
  const subjects = [...new Set(m.selections.map(s => s.subject).filter(Boolean))];
  let scope = '';
  try {
    const native = JSON.parse(m.native_context);
    scope = [native.period_labels?.periodLabel?.full, native.subject_side].filter(v => typeof v === 'string' && v).join(' · ');
  } catch { /* The complete original contract text remains inspectable below. */ }
  return <details onToggle={e => setOpen(e.currentTarget.open)} className="rounded-2xl border border-[#e5e5ea] bg-white px-4">
    <summary className="cursor-pointer py-4 text-sm font-semibold">{m.name}
      {scope && <span className="ml-2 text-xs text-[#0071e3]">{scope}</span>}
      {subjects.length === 1 && !m.name.includes(subjects[0]) && <span className="ml-2 text-xs text-[#0071e3]">{subjects[0]}</span>}
      {!!lines.length && <span className="ml-2 text-xs font-normal text-[#606066]">Line {lines.slice(0,4).map(trimDecimal).join(' / ')}{lines.length > 4 && ` · ${lines.length} line values`}</span>}
      <span className="ml-2 text-xs font-normal text-[#6e6e73]">{m.selections.length} selections{m.kind === 'combined' ? ' · prebuilt' : ''}</span></summary>
    {open && <div className="pb-2"><details className="mb-2 text-xs text-[#6e6e73]"><summary className="cursor-pointer">Native market contract</summary>
      <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap break-all text-[11px]">{m.native_context}</pre></details>
      {m.selections.slice(page*100,(page+1)*100).map((row,j) => <Selection key={j} row={row} />)}
      {m.selections.length>100 && <div className="flex items-center justify-between border-t border-[#e5e5ea] py-3 text-xs">
        <button disabled={page===0} onClick={() => setPage(p => p-1)} className="rounded bg-[#ededf2] px-3 py-2 disabled:opacity-30">Previous selections</button>
        <span className="text-[#6e6e73]">{page+1} / {Math.ceil(m.selections.length/100)}</span>
        <button disabled={(page+1)*100>=m.selections.length} onClick={() => setPage(p => p+1)} className="rounded bg-[#ededf2] px-3 py-2 disabled:opacity-30">Next selections</button>
      </div>}
      <p className="border-t border-[#ededf1] py-2 text-[10px] text-[#6e6e73]">Source market {m.id}{m.variant && m.variant !== ':' ? ` · ${m.variant}` : ''}</p>
    </div>}
  </details>;
}

export default function OddsInventory({ coverage = false, revision = 0 }: { coverage?: boolean; revision?: number }) {
  const [catalogue, setCatalogue] = useState<InventoryCatalogue | null>(null);
  const [error, setError] = useState('');
  const [book, setBook] = useState('betrivers_ca_on');
  const [sport, setSport] = useState('');
  const [search, setSearch] = useState('');
  const [event, setEvent] = useState<InventoryEvent | null>(null);
  const [loadedMarkets, setLoadedMarkets] = useState<{ key: string; values: InventoryMarket[] } | null>(null);
  const [marketSearch, setMarketSearch] = useState('');
  const [marketPage, setMarketPage] = useState(0);
  const [gamePage, setGamePage] = useState(0);
  const [marketError, setMarketError] = useState('');
  const currentSnapshot = useRef<string | null>(null);
  const selectedEvent = useRef<string | null>(null);
  const markets = loadedMarkets?.key === event?.key ? loadedMarkets?.values ?? null : null;

  useEffect(() => {
    const controller = new AbortController();
    void loadInventory(controller.signal).then(value => {
      if (controller.signal.aborted) return;
      setError('');
      if (currentSnapshot.current === value.snapshot_id) return;
      currentSnapshot.current = value.snapshot_id;
      setCatalogue(value);
      setEvent(previous => updatedEvent(value.events, previous));
      setGamePage(0);
    })
      .catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Could not load markets.'); });
    return () => controller.abort();
  }, [revision]);
  useEffect(() => {
    setLoadedMarkets(null); setMarketError('');
    if (selectedEvent.current !== eventIdentity(event)) {
      setMarketSearch(''); setMarketPage(0);
      selectedEvent.current = eventIdentity(event);
    }
    if (!event || !catalogue) return;
    const controller = new AbortController();
    void loadMarkets(catalogue, event, controller.signal).then(value => { if (!controller.signal.aborted) setLoadedMarkets({ key: event.key, values: value }); })
      .catch(e => { if (!controller.signal.aborted) setMarketError(e instanceof Error ? e.message : 'Could not load this game.'); });
    return () => controller.abort();
  }, [event, catalogue]);

  const sports = useMemo(() => catalogue ? [...new Set(catalogue.events.filter(e => e.book === book).map(e => e.sport))].sort() : [], [catalogue, book]);
  const games = useMemo(() => catalogue ? catalogue.events.filter(e => e.book === book && (!sport || e.sport === sport)
    && `${e.name} ${e.competition}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (a.start ?? '').localeCompare(b.start ?? '') || a.name.localeCompare(b.name)) : [], [catalogue, book, sport, search]);
  const visibleMarkets = useMemo(() => markets ? markets.filter(m => `${m.name} ${m.selections.map(s => `${s.label} ${s.subject}`).join(' ')}`
    .toLowerCase().includes(marketSearch.toLowerCase())) : [], [markets, marketSearch]);
  useEffect(() => {
    if (markets) setMarketPage(page => Math.min(page, Math.max(0, Math.ceil(visibleMarkets.length / 30) - 1)));
  }, [markets, visibleMarkets.length]);
  const selectedBook = catalogue?.books.find(b => b.key === book);
  const resetGames = () => { setEvent(null); setGamePage(0); };

  return <div className="h-full overflow-y-auto bg-[#f5f5f7] px-4 py-6 sm:px-8">
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div><p className="mb-1 text-xs uppercase tracking-[0.16em] text-[#0071e3]">Direct source captures</p>
          <h1 className="text-2xl font-semibold tracking-tight">{coverage ? 'Coverage' : 'All markets'}</h1></div>
        {catalogue && <p className="text-xs text-[#6e6e73]">{catalogue.books.length} books · {number(catalogue.totals.events)} source events</p>}
      </div>
      <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-relaxed text-amber-900">
        Captured prices are historical. Check current odds before betting. Market and settlement matching across all books is still being verified.
      </div>
      {error && <p role="alert" className="rounded-lg border border-red-200 p-4 text-sm text-red-700">{error}</p>}
      {!catalogue && !error && <p className="py-10 text-center text-sm text-[#6e6e73]">Loading captured inventory…</p>}
      {catalogue && <>
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[[number(catalogue.totals.positions), 'Captured selections'], [number(catalogue.totals.markets), 'Market offers / variants'],
            [String(new Set(catalogue.events.map(e => e.sport)).size), 'Source sport categories'],
            [`${catalogue.books.filter(b => b.status === 'complete').length} / ${catalogue.books.length}`, 'Inventory checks complete']].map(([value,label]) =>
            <div key={label} className="rounded-2xl border border-[#e5e5ea] bg-white p-4"><p className="text-xl font-semibold tabular-nums">{value}</p>
              <p className="mt-1 text-xs text-[#6e6e73]">{label}</p></div>)}
        </div>
        <p className="mb-5 text-xs leading-relaxed text-[#6e6e73]">Offers include native period, team and source variants. Source events can include futures and separate player markets.</p>
        {coverage ? <div className="space-y-3">{catalogue.books.map(b => <article key={b.key} className="rounded-2xl border border-[#e5e5ea] bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{b.name}
            {b.reference_only && <span className="ml-2 text-xs font-normal text-[#6e6e73]">Reference only</span>}</h2>
            <span className={`rounded px-2 py-1 text-xs ${b.status === 'complete' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
              {b.status === 'complete' ? 'Inventory checked' : 'Coverage gaps'}</span></div>
          <p className="mt-2 text-sm text-[#4a4a50]">{number(b.counts.events)} events · {number(b.counts.markets)} offers · {number(b.counts.positions)} selections</p>
          <p className="mt-2 text-xs text-[#6e6e73]">Capture completed {date(b.completed_at)} · {number(b.counts.priced_positions)} priced selections</p>
          {!!b.counts.unverified_pricing_positions && <p className="mt-1 text-xs text-amber-800">{number(b.counts.unverified_pricing_positions)} selections have unverified pricing</p>}
          {!!b.warnings.length && <details className="mt-3 text-xs text-[#6e6e73]"><summary className="cursor-pointer">{b.warnings.length} source coverage warnings</summary>
            <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto">{b.warnings.map((w,i) => <li key={i}>{w.error || w.kind?.replace(/_/g, ' ') || 'Unresolved source inventory'}{w.source_event_id && ` · event ${w.source_event_id}`}
              <details className="mt-1 text-[#6e6e73]"><summary className="cursor-pointer">Native coverage evidence</summary>
                <pre className="mt-1 whitespace-pre-wrap break-all text-[11px]">{JSON.stringify(w,null,2)}</pre></details></li>)}</ul></details>}
        </article>)}<p className="pt-2 text-xs leading-relaxed text-[#6e6e73]">Inventory checks cover the indexed source responses. They do not prove complete sportsbook website coverage.</p></div>
        : <>
          <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_1fr_2fr]">
            <label className="grid gap-1.5 text-xs text-[#6e6e73]">Sportsbook<select className={field} value={book} onChange={e => { setBook(e.target.value); setSport(''); resetGames(); }}>
              {catalogue.books.map(b => <option key={b.key} value={b.key}>{b.name}{b.reference_only ? ' · reference' : ''}</option>)}</select></label>
            <label className="grid gap-1.5 text-xs text-[#6e6e73]">Sport<select className={field} value={sport} onChange={e => { setSport(e.target.value); resetGames(); }}>
              <option value="">All sports</option>{sports.map(s => <option key={s}>{s}</option>)}</select></label>
            <label className="grid gap-1.5 text-xs text-[#6e6e73]">Search games or competitions<input className={field} value={search} placeholder="Team, player event or league" onChange={e => { setSearch(e.target.value); resetGames(); }} /></label>
          </div>
          {selectedBook && <p className="mb-5 text-xs text-[#6e6e73]">{selectedBook.name}: {selectedBook.status === 'complete' ? 'inventory checked' : 'coverage gaps remain'} · captured {date(selectedBook.completed_at)}{selectedBook.reference_only && ' · reference only'}</p>}
          {!event ? <>
            <p className="mb-3 text-sm text-[#606066]">{number(games.length)} captured events · includes future and live events as captured</p>
            <div className="grid gap-3 lg:grid-cols-2">{games.slice(gamePage*40,(gamePage+1)*40).map(g =>
              <button key={g.key} onClick={() => setEvent(g)} className="rounded-2xl border border-[#e5e5ea] bg-white p-4 text-left transition-colors hover:border-[#b7cff0]">
                <span className="mb-2 block text-[11px] uppercase tracking-wide text-[#6e6e73]">{g.sport} · {g.competition}</span>
                <span className="block text-sm font-semibold leading-relaxed">{g.name}</span>
                <span className="mt-2 block text-xs text-[#6e6e73]">{date(g.start)} · {g.phase}</span>
                <span className="mt-3 block text-xs text-[#0071e3]">{number(g.markets)} offers · {number(g.positions)} selections{g.positions === 0 ? ' · inventory unavailable' : ' →'}</span>
              </button>)}</div>
            {!games.length && <p className="py-10 text-center text-sm text-[#6e6e73]">No captured events match these filters.</p>}
            <div className="mt-5 flex items-center justify-between text-sm"><button disabled={gamePage === 0} onClick={() => setGamePage(p => p-1)} className="rounded-lg bg-[#ededf2] px-4 py-2 disabled:opacity-30">Previous</button>
              <span className="text-xs text-[#6e6e73]">Page {gamePage+1} of {Math.max(1,Math.ceil(games.length/40))}</span>
              <button disabled={(gamePage+1)*40 >= games.length} onClick={() => setGamePage(p => p+1)} className="rounded-lg bg-[#ededf2] px-4 py-2 disabled:opacity-30">Next</button></div>
          </> : <>
            <button onClick={() => setEvent(null)} className="mb-4 text-sm text-[#0071e3]">← Back to events</button>
            <h2 className="text-xl font-semibold">{event.name}</h2>
            <p className="mt-2 text-xs text-[#6e6e73]">{selectedBook?.name} · {event.competition} · captured {date(event.captured_at)}</p>
            <p className="mt-2 text-xs text-[#6e6e73]">{event.sport} · starts {date(event.start)} · {event.phase} · source event {event.source_event_id}</p>
            <p className="mt-2 text-sm text-[#606066]">{number(event.markets)} offers · {number(event.positions)} supplied selections · {number(event.priced_positions)} priced</p>
            <label className="mb-5 mt-5 grid gap-2 text-xs text-[#6e6e73]">Search markets or players<input value={marketSearch} className={field} placeholder="Passing yards, player name, total…"
              onChange={e => { setMarketSearch(e.target.value); setMarketPage(0); }} /></label>
            {marketError && <p role="alert" className="py-5 text-sm text-red-700">{marketError}</p>}
            {!markets && !marketError && <p className="py-10 text-sm text-[#6e6e73]">Loading every captured market for this event…</p>}
            {markets && <><p className="mb-3 text-xs text-[#6e6e73]">{number(visibleMarkets.length)} matching offers</p>
              <div className="grid items-start gap-3 lg:grid-cols-2">{visibleMarkets.slice(marketPage*30,(marketPage+1)*30).map((m,i) =>
                <MarketCard key={JSON.stringify([event.key,m.kind,m.id,m.variant,m.native_context,i])} market={m} />)}</div>
              <div className="mt-5 flex items-center justify-between text-sm"><button disabled={marketPage===0} onClick={() => setMarketPage(p => p-1)} className="rounded-lg bg-[#ededf2] px-4 py-2 disabled:opacity-30">Previous markets</button>
                <span className="text-xs text-[#6e6e73]">{marketPage+1} / {Math.max(1,Math.ceil(visibleMarkets.length/30))}</span>
                <button disabled={(marketPage+1)*30 >= visibleMarkets.length} onClick={() => setMarketPage(p => p+1)} className="rounded-lg bg-[#ededf2] px-4 py-2 disabled:opacity-30">Next markets</button></div>
            </>}
          </>}
        </>}
      </>}
    </div>
  </div>;
}
