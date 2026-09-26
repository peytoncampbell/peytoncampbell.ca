/** Synthetic browser-only fixture. No account snapshots, real tokens, or live news URLs. */
export function stockDashboardFixture({ holdingsCount = 15, buysCount = 10 } = {}) {
  const as_of = '2026-09-25';
  const generated_at = `${as_of}T11:45:00Z`;
  const symbol = (prefix, i) => `${prefix}${String(i + 1).padStart(2, '0')}`;
  const pillars = { growth: 81, revisions: 76, momentum: 69, valuation: 58, quality: 84 };
  const holdings = Array.from({ length: holdingsCount }, (_, i) => ({
    ticker: symbol('SYN', i), is_etf: i === holdingsCount - 1, currency: ['USD', 'CAD', 'EUR'][i % 3],
    weight_pct: 100 * (holdingsCount - i) / (holdingsCount * (holdingsCount + 1) / 2),
    day_pct: i % 3 ? 1.25 : -0.75, call: i < 4 ? 'SELL' : 'HOLD',
    reason: `Synthetic thesis ${i + 1}: retain the exact position rationale for inspector research.`,
    buys: 8, ratings: 12, rating: i === holdingsCount - 1 ? null : 92 - i,
    rating_scope: 'book', rating_universe: i === holdingsCount - 1 ? null : 85 - i,
    pillars: i === holdingsCount - 1 ? null : { ...pillars }, model_version: 'synthetic-five-pillar-v1',
  }));
  // These are the expected selected lines, declared independently of the production deduper.
  const expectedBuys = Array.from({ length: buysCount }, (_, i) => {
    const market = i % 10 < 6;
    return {
      ticker: symbol('BUY', i), name: `Synthetic purchase ${i + 1}`, action: i % 2 ? 'NEW' : 'ADD',
      qty: market ? null : i + 2, limit_local: market ? null : 41.27 + i,
      currency: ['USD', 'CAD', 'EUR'][i % 3], limit_cad: market ? null : 63.19 + i,
      est_cad: 201.13 + i * 17, region: ['US', 'CA', 'EU'][i % 3],
      session_et: '09:30-16:00 ET', session_state: 'closed', next_open: 'Mon 09:30 ET',
      whole_shares: !market, rating: 95 - i,
      why: `Synthetic order rationale ${i + 1}: preserve sizing and session fields.`, funded: true,
      kind: market ? 'MARKET_FRACTIONAL' : i % 2 ? 'NEW' : 'TOP_UP', market_order: market,
    };
  });
  const buys = expectedBuys.flatMap((chosen, i) => {
    const alternative = chosen.market_order
      ? { ...chosen, qty: 1, limit_local: 900.37 + i, limit_cad: 1200.19 + i,
          est_cad: 1200.19 + i, whole_shares: true, kind: 'NEW', market_order: false, funded: i % 2 === 0 }
      : { ...chosen, qty: null, limit_local: null, limit_cad: null, est_cad: 19.99,
          whole_shares: false, kind: 'MARKET_FRACTIONAL', market_order: true, funded: false };
    return i % 2 ? [chosen, alternative] : [alternative, chosen];
  });
  const sales = holdings.slice(0, 8).map((h, i) => ({
    ticker: h.ticker, name: `Synthetic sale ${i + 1}`, action: i < 4 ? 'SELL' : 'TRIM',
    qty: i + 3, limit_local: 71.23 + i, currency: h.currency, limit_cad: 93.17 + i,
    est_cad: 500.25 + i * 25, region: 'US', session_et: '09:30-16:00 ET',
    session_state: 'closed', next_open: 'Mon 09:30 ET', whole_shares: true, rating: 51 + i,
    why: `Synthetic sale rationale ${i + 1}`, reason_kind: i < 2 ? 'exit_rule' : 'funding',
  }));
  const needed = expectedBuys.reduce((sum, line) => sum + line.est_cad, 0);
  const raised = sales.reduce((sum, line) => sum + line.est_cad, 0);
  const funding = { needed_cad: needed, raised_cad: raised, shortfall_cad: Math.max(0, needed - raised),
    sources: sales.map(line => ({ ticker: line.ticker, cad: line.est_cad, reason_kind: line.reason_kind, why: line.why })) };
  const candidates = Array.from({ length: 7 }, (_, i) => ({ ticker: symbol('RES', i),
    name: `Synthetic research candidate ${i + 1}`, region: i % 2 ? 'EU' : 'US', currency: i % 2 ? 'EUR' : 'USD',
    rating: 91 - i, revisions_net: 0.12, px_vs_200d: 0.18, targets: 12, fwd_pe: 18.2,
    broker_ok: i !== 6, broker_note: i === 6 ? 'Synthetic listing unavailable at this broker' : null }));
  const privateRows = Array.from({ length: 12 }, (_, i) => ({ id: i + 1,
    as_of: new Date(Date.UTC(2026, 8, 25 - i)).toISOString().slice(0, 10),
    book_value_cad: 123456.78 - i * 123, true_cost_cad: 100000, day_change_cad: 234.56,
    etf_weight_pct: holdings.at(-1).weight_pct, holdings }));
  const publicRows = privateRows.map(row => ({ as_of: row.as_of, account_return_pct: 23.45678,
    day_change_pct: 0.19, positions_held: holdingsCount, positions_stocks: holdingsCount - 1,
    names_up: holdingsCount - 5, names_down: 5, calls_sell: 4, calls_hold: holdingsCount - 4,
    rules_triggered: 2, automations_ok: 6, automations_total: 6 }));
  const stories = holdings.flatMap(h => [0, 1].map(i => ({ ticker: h.ticker,
    title: `Synthetic headline ${h.ticker} ${i + 1}`, url: `https://news.invalid/${h.ticker}/${i}`,
    source: 'Synthetic News', published: generated_at, image: null })));
  const routes = {
    pc_digest_private: privateRows, pc_digest_public: publicRows,
    pc_news: [{ as_of, generated_at, summary: 'Synthetic daily brief: balanced breadth with a funded rotation.',
      watch: ['Synthetic watch: earnings concentration', 'Synthetic watch: currency exposure'],
      tickers: holdings.map((h, i) => ({ ticker: h.ticker, read: `Synthetic research read ${h.ticker}: estimates improving.`,
        sentiment: i % 2 ? 'positive' : 'neutral', story_url: stories[i * 2].url, story_source: 'Synthetic News', story_image: null })),
      stories, model: { model: 'synthetic-news-model', seconds: 7, prompt_tokens: 100, completion_tokens: 80 } }],
    pc_playbook: [{ as_of, holdings: holdings.map((h, i) => ({ ticker: h.ticker, currency: h.currency,
      action: i < 4 ? 'EXIT' : i < 8 ? 'TRIM' : 'HOLD', weight: h.weight_pct / 100, pl: 0.12,
      revisions: 0.1, price: 100, ma200: 90, rating: h.rating, is_etf: h.is_etf, flags: ['Synthetic thesis review'] })),
      entries: candidates.map(c => ({ ...c, price: 100.27, price_cad: 135.19, score: c.rating,
        revisions: c.revisions_net, px_vs_50d: 0.05, buy_to: 0.02, timing: 'Synthetic patient entry' })),
      today: { as_of, generated_at, fx_age_days: 0.25, market_note: 'Synthetic fixture: markets closed until Monday.',
        sells: sales.slice(0, 4), trims: sales.slice(4), buys, funding,
        watch: [{ ticker: 'SYN09', name: 'Synthetic watch position', rating: 41, revisions: -0.2,
          readings: 2, weeks_needed: 3, why: 'Synthetic watch is not an order' }],
        unfunded: [{ ticker: 'WAIT01', name: 'Synthetic deferred idea', est_cad: 700.13, why: 'Synthetic cash queue' }],
        counts: { buys: 999, sells: 999, trims: 999 } } }],
    pc_weekly: [{ as_of, generated_at, gate: 'PASSED', universe_size: 1100, resolved: 1090,
      actionable: candidates, picks: candidates.slice(0, 5).map((c, i) => ({ ...c, country: c.region,
        exchange: 'SYNTH', gate_passed: true, rank_in_screen: i + 1, score: c.rating, vol_pct: 22, analysts: 12 })),
      moves: [{ ticker: 'RES01', name: 'Synthetic research candidate 1', was: 80, now: 91, change: 11 }],
      report_md: '# Synthetic weekly report\n\nSynthetic report evidence: gates passed.\n\n| Signal | Result |\n| --- | --- |\n| Revisions | Positive |',
      weekly_md: 'Synthetic run log: all seven candidates evaluated.' }],
    pc_quant: [{ as_of, headline: 'Synthetic model evidence: measured momentum, argued growth.',
      drift_warning: 'Synthetic model caveat: limited forward sample.',
      pillars: Object.keys(pillars).map((name, i) => ({ name, weight: [27.2, 21.7, 21.7, 16.3, 13][i],
        status: i % 2 ? 'measured' : 'argued', inputs: `Synthetic ${name} inputs`, influence: 0.12, influence_before: 0.09 })),
      measured: { names: 120, anchors: 8, horizons: ['3m', '6m', '12m'], rows: [{ signal: 'Synthetic momentum',
        cells: [0.04, 0.06, 0.08].map(ic => ({ ic, t: 2.4, n: 120 })), spread: [1, 2, 3] }] },
      surprise: { events: 240, names: 80, window: 'synthetic sample', buckets: [{ label: 'Synthetic beat', n: 120, f63: 2, f126: 4, up_rate: 61 }] },
      pit: { captures: 14, rows: 15400, ladders: 7, days: 14, next: { label: 'Synthetic forward test', in_days: 42 } },
      top: candidates.map(c => ({ symbol: c.ticker, score: c.rating })) }],
  };
  return { routes, holdings, expectedBuys, sales, candidates, funding, privateRows };
}
