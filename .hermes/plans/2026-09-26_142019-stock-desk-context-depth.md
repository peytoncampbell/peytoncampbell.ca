# Stock Desk Context and Depth Implementation Plan

> **For Hermes:** Use the subagent-driven-development skill to implement this plan task by task, with specification and code-quality review. This document is a plan, not permission to implement. Do not modify the live dashboard, financial model, broker account, database or pipeline until the user requests execution.

**Goal:** Make the existing dashboard explain what changed, why each published call exists, and where its evidence comes from, without making the default desktop overview busier or taller.

**Architecture:** Preserve the existing dashboard shell and financial helpers. Introduce a structured stock-detail view and a deterministic comparison layer, both based on published data. Keep historical series and longer evidence in an explicitly opened analysis workspace. Extend the existing owner-gated publishing contract only where the necessary data is genuinely missing.

**Tech stack:** Existing React 18, TypeScript, Vite, route-scoped CSS, native HTML/SVG, REST reads through `ownerFetch`, Python publishing, Supabase owner-gated storage, and GitHub Pages serving committed `docs`.

**Baseline:** Site checkout `C:/Users/campb/tmp/portfolio-skills-20260910`, commit `4b068db`. Plan prepared September 26, 2026. The source tree was clean apart from local `.hermes/` planning files. This is planning only; no implementation or deployment is included.

**Status:** Planning complete. UI/source inspection and read-only local data checks are complete. The implementation tasks below are not executed or authorized by this document.

---

## 1. The decision: deepen, do not redesign

The default screen should remain recognizable. Keep:

- One primary navigation: Dashboard / Research / History.
- The same four KPI tiles, same primary labels, and same monetary basis.
- Portfolio left; Buy and Sell/trim simultaneously visible in the widest middle panel.
- Attention, candidates and brief in the right panel.
- The funding explanation and warning that planned sale proceeds are not settled cash.
- Exact selected order amounts, market/limit labels, local limit quantities/prices, market-risk warnings and sale reasons.
- The persistent status/attention footer.
- Existing Full book densities, Full ticket, Research, Reports, Model, Brief and History.

Do not add a fourth column, another top navigation, a large chart above the holdings, a decorative score gauge, a radar chart, or a wall of new metric cards. Do not reduce primary text to manufacture fit.

The default desktop acceptance remains 1280×720 browser-content pixels, with 1366×768, 1440×900 and 1920×1080 also checked. Mobile, short windows and enlarged text reflow naturally. Opened analysis can scroll; the untouched overview must not become a report.

The current CSS allocates 528px of workspace height at 1280×720, with 526px inside panel borders; the right-hand grid track is 248px wide. These budgets were calculated from the checked-in grid, gaps and padding and agree with the inspected baseline screenshot. They must be remeasured in the browser after implementation. That is enough for a quick read, not a full analytical chart plus long research.

### Information structure

    DEFAULT OVERVIEW — unchanged structure
      KPIs
      Portfolio | Buy + Sell/trim + funding | Attention / candidates / brief
      Persistent source and warning status

    CLICK A STOCK — quick inspector in the existing right-hand panel
      Identity and relevant published action
      Important order fields when opened from an order
      Five factor bars where available
      Short published rationale
      Open analysis

    EXPAND THAT DETAIL — existing secondary-workspace pattern
      Same global header, KPIs and warning footer
      Back to dashboard + selected stock
      Contextual sections: Summary / History / News & evidence
      One reading area, not multiple nested scrolling boxes

Expansion is a larger presentation of the same stock detail, not a new primary application area. Avoid further nested drill-down levels.

## 2. What the current implementation already gives us

Verified in source:

- `src/StockDashboard.tsx` owns shell layout, pagination, selection, inspector focus and contextual navigation.
- `src/OwnerStocks.tsx` owns financial formatting, selected order routes, funding summaries, merged holdings/news and the underlying detail markup.
- Holding rows already carry `rating`, `rating_scope`, `rating_universe`, `pillars`, `model_version`, `call` and `reason`.
- The current inspector already includes holding rationale, order execution fields, playbook action, news, and candidate context. The next phase reorganizes and explains that information rather than pretending it is new.
- `pc_digest_private` and `pc_digest_public` are requested with a limit of 30 daily rows. `pc_news` uses a limit of 5. Weekly, playbook and quant currently load their newest row only.
- Existing source warnings distinguish failed fetches from missing rows and preserve prior successful secondary data after a failed refresh.
- `fundingSummary()` and `orderGroups()` already normalize supported financial payloads. They remain authoritative.
- No charting package is installed. Begin with native CSS bars and a small SVG line renderer, not a new dashboard library.
- The stored session currently has token/expiry/email fields, but no explicit stable user ID in its TypeScript type.
- Daily publishing uses `as_of` conflict keys. A daily row is not an immutable record of every intraday revision.

The previous live-verification artifact is useful baseline evidence, not a fresh query of production. Do not mistake a request limit of 30 for proof that 30 historical observations exist.

### Concrete data audit, September 26, 2026

These are local read-only observations, not a new live account query:

- `alerts/rating-history.jsonl`: 14 rows for 14 symbols, all dated September 25, 2026. Fields are only `as_of`, `ticker`, `rating`, and `revisions`. There is no multi-date trend or embedded model/cohort identity here yet.
- `.cache/holdings_history.json`: 13 cached symbol entries; 11 match keys in the current 15-holding book. Series have 53–753 observations. Latest timestamps fall on September 23 or 24, 2026 UTC. The only stored fields are `symbol`, `timestamps`, and `close`; they do not establish quote currency, adjustment policy or fetch freshness. The helper intentionally maps to underlying listings.
- `alerts/scored-2026-09-23.csv` and `alerts/scored-2026-09-24.csv`: 494 rows each, with no model-version stamp. The September 25 archive has 1,075 rows under `2026-09-25-revisions`, not the current five-pillar model.
- Current `data/scored.csv`: 1,073 rows with `2026-09-25-five-pillar`. Current `data/scored_book.csv`: 14 rows with that model stamp. Do not join the earlier archives into a continuous current-model trend.
- `data/pit/pit-2026-09-25.csv`: 4,785 mixed-source rows from one capture date, not thousands of historical dates; its inspected schema has no `model_version` field.
- The earlier production-verification artifact contains two digest dates, September 24 and 25. The older digest has no model/scope metadata; the newer one contains current-model book scores. It contains one captured playbook row, not proof of a usable predecessor. Because the browser requested only one playbook row, this artifact cannot establish whether older database rows exist.

Result: factor bars, existing rationale and news organization can improve immediately. Historical rating trends need forward collection of properly labelled observations. Price charts need a chart-safe source contract. Snapshot-change review must start with a verified predecessor or an explicit baseline-recorded state.

## 3. Piece A — the quick stock inspector

### A1. Identity and context

Show, in order:

1. Ticker and company name when published.
2. Listing/quote currency and the date of the relevant published information.
3. One leading action appropriate to the clicked row.
4. Close and an explicit Open analysis control.

Selection must retain its origin:

- Portfolio click: lead with the book call and position context.
- Buy click: lead with the selected BUY proposal and execution fields.
- Sell/trim click: lead with the SELL/TRIM proposal and the funding-versus-exit reason.
- Candidate click: lead with universe rating and broker availability.
- Change click: lead with the actual before/after event, followed by the same stock information.

This fixes an information-order problem in the current detail builder: every path currently selects only a ticker, so holding information can precede the order the user clicked to inspect.

Use a selection value such as `{ ticker, origin, side?, changeId? }`. Keep listing identity separate from an underlying company where they differ. A CDR, ADR and primary listing are not interchangeable price series.

### A2. Preserve execution information

When the user enters from an order, keep the stock, exact CAD amount, Market/Limit type and risk/quantity/price at the top. A research improvement must not bury the thing the user is trying to act on.

Keep these distinctions visible:

- Book call versus playbook action.
- Discretionary funding sale versus rule-triggered sale.
- Proposed order versus an executed trade.
- Planned proceeds versus settled cash.
- Limit estimate versus guaranteed fill.
- Selected BUY route versus its mutually exclusive alternative.

Do not add Place order, Execute, or Mark filled controls in this phase.

### A3. Five factor bars

Replace the current text list with five horizontal rows, in the model's published order:

- Growth.
- Revisions.
- Momentum.
- Valuation.
- Quality.

Each row contains a readable label, a restrained bar, a numeric factor score, and a separately labelled model weight where reliable metadata exists.

Rules:

- Use one common 0–100 score axis. The current `analyze.py` builds factor scores from percentile-ranked inputs; these are not expected returns or probabilities of success.
- Keep the distinction between factor score and model weight. Do not put a percentage sign on a score merely because weights are percentages.
- Do not present a stacked sum of factor bars as the final composite. The current composite also applies analyst-coverage shrinkage.
- Call the result a relative model score, not an exact final-score percentile. The implementation weights percentile-derived inputs but does not rerank the final composite into a percentile. Correct explanatory copy, including Full book copy, without changing the underlying rating values.
- Keep the existing rounded UI weights unless a matching published model-metadata record supplies their precise display values. The frontend must not recompute the model from rounded display weights.
- Validate finite values and range. Zero is a real score; missing is not zero. Invalid values get an unavailable state rather than a silently clamped number.
- Where input coverage is not published, do not claim a neutral-looking score is evidence of genuinely average fundamentals. The scorer can use neutral values for missing inputs.
- ETF detail says it is not scored by the equity model. Do not fabricate five neutral bars.
- Candidate factor bars appear only when the candidate's own factor breakdown has been published. Do not borrow bars from a similarly named holding or infer them from its overall rating.
- Book and universe scores remain separate scopes. Show which scope the bars use; do not combine one scope's bars with another scope's composite heading.

Use a muted blue bar on the existing slate track, with printed values. Red/green is not the encoding of factor quality. A reader must understand the result without perceiving color.

### A4. Short explanation

Keep one concise published rationale beneath the action/factors. Do not generate fresh LLM recommendations in the browser.

The inspector should answer:

- What is the published call or proposal?
- What evidence was supplied for it?
- Is the information current and complete enough to interpret?

Do not squeeze a full chart, all headlines, model methodology and an entire order ticket into the sidebar. The Open analysis control is the clear next step.

## 4. Piece B — expanded stock analysis

Use the existing secondary-workspace pattern. The global header, KPIs and warning footer remain. The main portfolio/order/context workspace is temporarily replaced only after Open analysis is activated.

### B1. Navigation and restoration

The expanded header contains:

- Back to dashboard.
- Ticker and company/listing identity.
- A clear source-date summary.
- Three contextual choices: Summary / History / News & evidence.

These are stock-detail sections, not another primary navigation.

Back restores:

- The previously selected stock and quick inspector.
- Portfolio, buy and sale page positions.
- The visible stock or order row when it still exists.
- Focus to a meaningful control, not a detached DOM element.

Store a semantic opener reference, not only an `HTMLElement` reference: replacing the workspace unmounts the original row. If the item disappeared after refresh, focus the relevant panel heading and explain the removal.

Escape behavior is layered: close an open attention disclosure first; otherwise leave expanded analysis; otherwise close the quick inspector. Do not dismiss stock context while the user is reading an unrelated warning.

Changing global navigation is still an explicit exit from stock analysis. Do not introduce URL deep-linking or browser-history changes in this phase; preserve the current route behavior.

### B2. Summary section

Use a readable two-column arrangement when space permits; stack on small screens.

Main content:

- Published action/rationale.
- Relevant position or proposal facts.
- Factor bars and score scope.
- What would change the call, when the underlying evaluation is published.

Secondary content:

- Broker availability and restrictions.
- Source dates and model version.
- Source completeness or stale-data explanation.

For “What would change the call,” render the actual evaluation, not a new trading rule. Prefer structured published conditions with observed value, operator/threshold, evaluation date and pass/fail/unknown state. If that structured evaluation is absent, retain the original published reason and say the detailed conditions were not published.

For the currently implemented book exit rule, the source checks rating, net revisions and the supplied weekly-reading count. The browser must not infer the streak from calendar days or implement its own interpretation of “two weekly readings.” Existing counts/rules are authority. Any defect found in the rule itself is a separate model/pipeline issue, not permission to alter financial behavior during this UI change.

A concrete audit finding needs a separate correctness gate: `tools/rating_exit.py:79–97` selects the latest qualifying prior reading. In a read-only synthetic probe for September 25, a qualifying September 18 reading yields a count of 2; adding another qualifying reading on September 24 reduces it to 1. Thus daily collection can defeat the intuitive consecutive-week description. Do not publish a confident countdown or claim the counter has been validated. Reproduce this in `tools/test_calls.py` during a separately approved rule-correction task; the UI plan does not change the rule. Until resolved, label the value Published qualifying readings and expose the source/date rather than promising when a sale will trigger.

No arbitrary confidence percentage, star rating, or AI certainty gauge. Use factual coverage/freshness labels instead.

### B3. History section

Use one chart at a time, with Price / Rating controls. Do not put price and model scores on dual axes.

Price view:

- Offer 1M / 3M / 1Y only for periods that have usable data.
- Identify the actual source listing and currency.
- Label last observation/close explicitly; do not use a live-price indicator for a daily cache.
- State the adjustment basis. Do not silently treat provider-adjusted prices as raw execution prices.
- Do not substitute a USD underlying series for a CAD CDR position without an explicit underlying-series label.
- Use date/value observations together; validate equal lengths, chronological order, duplicates, finite values and stale endpoints.
- Preserve real missing observations as gaps. Do not invent daily observations, smooth across unavailable sections, or backfill historical ratings from today's fundamentals.

Rating view:

- Identify Book or Universe scope.
- Show actual observed rating points, with their publication dates.
- Keep the score axis at 0–100.
- Segment or stop comparisons at model-version changes or incompatible cohorts.
- Explain that these are relative rankings and do not by themselves prove a company's fundamentals improved.
- A single observation is a dated point, not a trend. No observations means an explicit collecting/unavailable state.

Chart presentation:

- Quiet line and axes, no gradient area, no candlestick terminal, no always-running animation.
- A textual summary and Show observations table accompany the graphic.
- Avoid hundreds of keyboard tab stops. Period/metric controls and the observation table provide keyboard access.
- Never make hover the only way to obtain an exact value.
- One main reading scrollbar in expanded analysis. Do not place the chart, notes and table into separate scroll boxes.

### B4. News & evidence section

Reorganize the existing published summary and headlines into a dated evidence list:

- Distinguish the desk's generated summary from the cited source headline.
- Show source name and actual publication time when provided.
- Do not replace a missing article time with the fetch time and call it published.
- Deduplicate repeated URLs/headlines across available news rows.
- Keep articles in a predictable newest-first order; unknown dates form a labelled group rather than invented chronology.
- Allow access to source articles, validating HTTP(S) URLs and retaining safe external-link attributes.
- Treat a headline as relevant evidence, not proof that it caused a stock's price move.
- Do not invent an earnings calendar from articles mentioning earnings. A future dated catalyst requires a verified event source and is outside this first release.

## 5. Piece C — changes without dashboard clutter

### C1. Baseline terminology

Start with “Changes since the previous daily snapshot,” with both comparison dates shown.

Do not claim “since your last visit” or “since the last publish” while only date-keyed upserts are retained. Same-day revisions can overwrite earlier state. A true intraday audit would require immutable publication versions and is deliberately not part of the first release.

Each event records its own source and comparison dates. Weekly ratings and daily orders need not have the same time interval; never hide that behind one ambiguous date label.

No comparison is produced from a failed or incomplete source fetch. Missing old data is not an empty old portfolio or a removed order list.

For the first release, fetch a bounded current/predecessor pair from the existing owner-gated tables using explicit columns. Keep comparison logic in the shared site helper rather than duplicating the event engine in Python. Add optional publisher completeness/model/cohort metadata to existing JSON fields where needed. A legacy empty list is not proof that a publisher successfully evaluated that category.

On first capture or insufficient metadata, show Baseline recorded — comparison begins with the next valid daily snapshot, or Comparison unavailable with the actual reason. Do not label every current proposal New simply because there is no predecessor. Keep the review window explicit; this first release is not an unbounded inbox of every historical event.

### C2. Default overview placement

Keep the Attention panel, not a new dashboard card.

At 1280×720:

- Preserve the warning preview and its existing access to all warnings.
- Add one compact text control: Changes since [date] (count).
- Do not add another always-visible list below the brief.
- Keep candidates and the brief accessible in their existing positions.

At larger heights:

- If measured space permits, show up to two concise change previews inside the same Attention region.
- Warnings take precedence over those optional previews.
- Decide from measured available height and wrapping, not merely screen width or a hard-coded guess.

The footer continues to expose substantive unresolved warnings during stock analysis. Reviewing a change must not silence a cash shortfall, invalid weekly gate, failed refresh or broker restriction.

### C3. Change types

Prioritize these deterministic comparisons:

1. Book call changed.
2. A selected BUY, SELL or TRIM proposal was added, removed or changed.
3. Market versus limit route changed.
4. Exact order amount, quantity or local limit changed.
5. Funding shortfall appeared, changed or resolved.
6. Availability restriction appeared or was explicitly resolved.
7. Exit-watch status or published reading count changed.
8. A comparable model rating changed.

For orders, compare the already selected exclusive routes from `orderGroups()`/`buyLines()`. Never compare all alternatives as independent orders.

Compare financial fields at their meaningful precision: CAD amounts at cents, quantities at supported execution precision, and local prices at source-supported precision. Do not use display-rounded whole-dollar portfolio values for event detection. Ignore presentation-only changes such as whitespace or a refreshed generation timestamp.

Do not call a removed proposal “sold” or “filled.” It may have been revised, cancelled upstream, or removed by a gate.

Do not produce a noisy event for every ordinary market-price fluctuation. Rating changes are presented as factual changes, not a new eligibility threshold. If the list grows, use explicit filters/pagination rather than silently dropping small but real order changes.

### C4. Change review workspace

The Changes control opens a secondary workspace with:

- Comparison period and source coverage.
- New / Reviewed / All contextual filters.
- Optional category filter only when multiple categories make it useful.
- Rows showing ticker, change type, before, after, relevant reason and source date.
- Open stock analysis and Mark reviewed actions.

Use precise copy: New proposal, Revised limit, Published call changed, Funding gap changed, or Comparison unavailable. Do not use alerts such as Buy now unless the existing financial policy actually publishes that instruction.

If previous/current model version, rating scope or cohort is incompatible, show “Model or comparison group changed” rather than a misleading numerical rating delta. Do not fabricate a continuity line through that boundary.

A removed stock/proposal still needs a useful click target. Keep the event's prior identity, reason and execution terms in a clearly labelled historical detail view. Do not insert it back into current holdings/orders, and do not close the detail merely because the ticker is absent from the current list. If the old facts were not retained, the change row itself remains readable and explicitly says that extended prior detail is unavailable.

### C5. Reviewed state

Reviewed means the user has inspected a change. It does not mean an order was executed or a risk resolved.

Recommended first implementation:

- Persist only opaque event IDs and review timestamps on this device.
- Scope them to the authenticated user identity.
- Store no portfolio snapshots, amounts, research text or new credentials in review-state storage.
- Add an optional provider user ID to the existing Session shape when it is supplied by sign-in/refresh responses. Do not change the authorization mechanism.
- For a legacy session without a stable user ID, use session-only review state until identity is available; do not mix accounts under an empty key.
- Handle blocked storage by falling back to in-memory state without breaking the dashboard.
- Clear in-memory private data on sign-out or owner-gate loss.
- A new revision to an already reviewed change gets a new event ID and becomes unreviewed.
- Do not advertise cross-device synchronization. A server-backed preference table would be a separate later decision.

## 6. Data integrity and the smallest useful backend extension

### D1. Source availability matrix

| Capability | Present in current browser payload? | Required work |
|---|---|---|
| Holding identity, book call and rationale | Yes | Reorganize existing fields |
| Holding five-factor values | Yes where supplied | Visualize with scope/coverage safeguards |
| Candidate factor breakdown | Not in current WeeklyTarget type | Optional publisher extension; honest unavailable state until present |
| Exact order execution details | Yes | Preserve and prioritize by click origin |
| Basic published call explanation | Yes | Reuse existing reason text |
| Structured condition evaluation | Not a complete uniform contract | Add optional metadata from the actual rule-evaluation path |
| Recent news/headlines | Yes; five news rows requested | Normalize/deduplicate and expose dates |
| Complete price history in browser | No | Validate/refesh cached sources, then publish a bounded owner-gated series |
| Rating history | Some daily snapshots are readable | Verify coverage/model/scope/cohort metadata; never assume a full year |
| Prior order proposals for comparisons | Current browser only requests newest playbook | Provide a bounded predecessor or published comparison object |
| Immutable intraday revisions | Not established | Out of scope for first release |
| Reliable portfolio contribution | Not established by holdings snapshots | Requires a reconciled ledger and historical valuations |

### D2. Do not reuse caches blindly

The existing `fetch_holdings_history.py` is a correlation-oriented cache helper. Its code maps holdings to underlying symbols, calls `history(period='3y')`, and skips names already stored. It is not yet a reliable fresh price-chart contract for the actual held listing.

Before a visible price chart can ship, require:

- Explicit listing/source-symbol mapping.
- Quote currency and any minor-unit convention.
- Fetch time and last observed market date.
- Explicit adjustment parameters and interpretation.
- Refresh behavior for already-cached symbols.
- Preserved timestamp/value alignment and null observations.
- Visible availability state for missing, stale or incompatible series.

Backfilled prices may be useful for a price chart. They are not proof that the current model would have selected a stock at that time. Historical ratings need observations actually recorded under the relevant model.

### D3. Proposed storage decision

For the visual-inspector slice, use existing payloads: no database migration is necessary merely to draw five bars or reorganize rationale.

For historical charts and the expanded insight dataset, the preferred small extension is one nullable `insights` JSONB column on the existing owner-gated `pc_playbook` table. Completeness/model metadata can ride existing JSON fields. Comparing two existing daily rows does not itself require a migration or a second Python event engine. This is preferable to a new service, chart API, generic event warehouse or multiple new private tables.

Why a separate column rather than burying full histories in `today`:

- The dashboard can continue loading `as_of,holdings,entries,today` without downloading all charts.
- Expanded analysis explicitly requests `insights` for the selected published snapshot.
- Existing table ownership policies continue to apply, subject to verification.
- New and old publishers/clients can coexist because the field is nullable and optional.

Use explicit select lists before adding the column. The present `select=*` would otherwise pull the expanded payload on every initial load and refresh.

The publisher should compose the extension from existing outputs, not rerun financial ranking in the browser. Keep price/history preparation off the critical path for publishing the primary order plan: a chart refresh failure must produce unavailable chart metadata, not prevent the day's ticket from publishing.

Migrations belong in `C:/Users/campb/coach-ai-cloud-suite/supabase/migrations/`. Create a new execution-time-stamped migration; do not edit an applied migration. Do not run one during this planning task.

If the data audit shows an equally clean existing field can provide on-demand reads without inflating the overview payload, use that smaller proven option. Do not create a table merely because the feature has a new name.

### D4. Proposed contract, illustrative rather than existing data

```ts
type SourceStamp = {
  source: 'digest' | 'playbook' | 'weekly' | 'news' | 'price-cache';
  asOf: string;
  generatedAt: string | null;
  snapshotId: string | null;
  complete: boolean;
};

type ScoreStamp = {
  modelVersion: string | null;
  scope: 'book' | 'universe';
  cohortId: string | null;
  cohortSize: number | null;
  subjectId: string;
};

type HistorySeries = {
  listingId: string;
  sourceSymbol: string;
  currency: string | null;
  metric: 'price' | 'rating';
  adjustment: string | null;
  stamp: SourceStamp;
  scoreStamp?: ScoreStamp;
  observations: { date: string; value: number | null }[];
};

type DeskChange = {
  id: string;
  ticker: string;
  kind: 'call' | 'proposal' | 'execution-terms' | 'funding'
    | 'availability' | 'watch' | 'rating' | 'comparison-boundary';
  field: string;
  before: string | number | boolean | null;
  after: string | number | boolean | null;
  beforeStamp: SourceStamp;
  afterStamp: SourceStamp;
  reason: string | null;
};
```

Names may follow the repository's snake_case wire convention; the point is the explicit meaning. The final versioned contract also needs per-feature availability/reason, model metadata, source coverage, source timezone/trading-date interpretation, and the set of listings included.

Keep the chart payload bounded to current holdings, current proposals and published research candidates; never duplicate the entire scored universe by default. Cap a requested price period at the published one-year window with at most 400 daily observations per listing, preserving documented gaps. Record availability for uncovered symbols rather than silently substituting another listing. Validate payload size and lazy-loading behavior before committing to the optional column.

A comparison requires two successful, complete records for the same subject and relevant metric. A rating comparison additionally needs compatible model, scope and cohort. Unknown metadata must not be guessed into compatibility.

Stable event IDs must include the subject, kind/field, comparison baseline and substantive before/after values, not just the latest fetch timestamp. Use a tested canonical representation; do not rely on incidental object-key ordering or browser floating-point string noise.

### D5. Publication/version behavior

- Continue treating daily snapshots as daily observations.
- Retain enough complete predecessor state to explain current changes.
- Same-day corrections update that day's comparison; do not claim an immutable audit trail.
- Include the source version/completeness stamp needed to reject incomplete comparisons.
- Do not merge daily book data and weekly ratings into one fictitious observation date.
- Display cached insight data only with its matching snapshot stamp. A late response for an old selection or superseded snapshot cannot overwrite newer detail.
- Cache only in memory by snapshot identity; clear it on identity change or access loss. Do not place private history JSON under public `docs/`.

## 7. Piece D — portfolio contribution, deliberately later

This remains a separate, gated release. It is not a prerequisite for the inspector/change upgrade.

The desired future view would explain:

- Which holdings added to or subtracted from account performance.
- Cash, deposits/withdrawals, dividends, fees and currency effects.
- The selected period and reconciliation status.

Before implementation, require a reliable source of:

- Opening positions and cash balances.
- Dated fills, quantities, prices, fees and FX amounts/rates.
- Deposits, withdrawals and transfers.
- Dividends, withholding and relevant corporate actions.
- Historical valuations in the reporting currency.
- Reconciliation against broker statements and the broker-authoritative account basis.

Do not apply today's weights to a historical price chart and label it the account's historical performance. Do not relabel the current cost-basis return as time-weighted return. Do not treat a deposit as investment gain or a proposed sale as a confirmed fill.

Begin with a read-only, user-approved import/reconciliation process if a supported broker data source is available. Do not assume an unofficial Wealthsimple integration or auto-execution capability exists.

An account-value chart can be useful before full contribution, but it must say Account value, not Performance, and include cash-flow caveats. Leave the existing KPI basis unchanged.

## 8. Visual and interaction specification

### Typography and color

Reuse the checked-in tokens rather than inventing a second theme:

- Canvas `#10161f` (`--sd-bg`).
- Panels `#18212d` and selected/raised surfaces `#202c3a`.
- Primary text `#e2e8f0`; supporting text `#a7b5c6`.
- Selection/graph accent `#8fafe6`.
- Existing border and warning tokens remain semantic, not decorative accents.

Keep left-aligned labels/explanations and right-aligned numeric columns, with tabular numerals. Keep IBM Plex Sans and existing slate tokens.
- Keep primary decision data at 14px or above in the default desktop layout.
- Use 12px only for supporting dates/source labels where existing readability is retained.
- Keep headings restrained; the company name is not another giant page title.
- Use the existing muted blue for selection and charts, existing warning tones for actual warning semantics.
- Use labels, signs and line patterns as well as color.
- Keep chart/grid rules lighter than decision text. No gradient fills or decorative animation.

### Motion

A short user-triggered transition may help explain the inspector expansion. Respect reduced-motion settings. Do not animate live numbers every refresh or use flashing movement to sell ordinary price changes as urgency.

### Loading/error/empty states

- Stock identity and existing snapshot information appear immediately on selection.
- Load only the requested advanced data.
- A chart failure affects the chart, not the holding/order summary.
- Show explicit states: collecting history, insufficient history, incompatible model, stale source, unavailable listing, and failed refresh.
- Keep last successful data with its date where appropriate; do not relabel it fresh.
- No infinite spinner and no “no changes” conclusion after an unsuccessful comparison fetch.
- Newly published data updates facts without closing a valid inspector, resetting a user's page, or silently moving focus.

### Accessibility

- Native buttons for actions and native controls for simple disclosures.
- Every factor has a readable text value; bars may be decorative once equivalent text is present.
- Charts have a short description, a useful textual summary and an accessible observation table.
- Visible focus remains on the selected row/control. No focus trap in the nonmodal quick inspector.
- Contextual tabs/controls expose their selected state and support keyboard use.
- Status announcements are restrained; do not announce every price cell on refresh.
- Open warnings remain reachable without losing stock selection.

## 9. Files and responsibilities

### Site repository

Modify:

- `src/OwnerStocks.tsx`: normalize current data into a shared detail model; preserve helpers; add bounded optional historical/comparison reads; use explicit playbook selects; pass selection context.
- `src/StockDashboard.tsx`: quick versus expanded detail state; semantic return/focus restoration; compact changes entry; existing navigation/capacity contracts.
- `src/StockDashboard.css`: scoped factor bars, analysis layout, chart/evidence styling, responsive behavior. Do not add another global override layer.
- `src/ownerAuth.ts`: only if needed, add an optional provider user ID for preference namespacing. No authorization-policy changes.
- `scripts/fixtures/stockDashboard.js`: synthetic comparable/incompatible histories and change events; never copy account data.
- `scripts/verifyStockDashboard.js`: extend real-component SSR checks.
- `scripts/verifyStockDashboardBrowser.mjs`: extend actual built-app interaction, geometry, refresh and access checks.
- `package.json`: register any narrowly required new verification command.

Create only where the responsibility earns a file:

- `src/stockInsights.ts`: small typed pure selectors/normalizers, compatibility checks and change comparison helpers.
- `src/StockInsights.tsx`: quick detail, expanded analysis, factor rows and the small chart/evidence presentation. Start with private subcomponents here rather than a charting framework.
- `scripts/verifyStockInsights.js`: deterministic assertions against real pure helpers and component output.

The existing financial helpers stay in their current authority path. Do not fork `buyLines`, `orderGroups`, `fundingSummary`, `orderQty`, currency resolution or the model.

### Pipeline, only for data-backed phases

Likely touchpoints, to confirm against the final audit:

- `C:/Users/campb/stock-desk/publish_digest.py`: optional factor coverage, identity and structured call-evaluation metadata in existing holding payloads.
- `C:/Users/campb/stock-desk/publish_weekly.py`: candidate metadata where not already available.
- `C:/Users/campb/stock-desk/tools/playbook.py`: optional summary/insights publication using existing order outputs.
- `C:/Users/campb/stock-desk/fetch_holdings_history.py`: explicit chart-safe listing/provenance/refresh behavior, or a small separate helper if changing the correlation cache would break consumers.
- One small `tools/desk_insights.py` module if shared normalization/publication is needed; no new independent scheduled task by default.

Back up touched pipeline files into a task-specific archive before future implementation: that repository is not under git. Do not modify its financial policy as incidental cleanup.

## 10. Implementation sequence: vertical slices

Every slice follows RED → minimal implementation → GREEN → visual/behavior review. Do not write an imagined full suite and then redesign to satisfy it.

### Slice 1 — verify the data contract

Objective: establish supported fields, units, dates, scopes and missing-data behavior.

- Inspect actual publisher outputs, not just frontend types.
- Record history coverage by listing and source without committing private data.
- Define successful/empty/failed/comparison-incompatible fixtures.
- Verify that factor scores and weights are distinct quantities.
- Decide and document the minimal optional insights transport.

Exit gate: a field mapping and explicit unavailable states exist for every visible feature. No source edits needed merely to perform this audit.

### Slice 2 — detail view model

Files: `src/stockInsights.ts`, `scripts/verifyStockInsights.js`, synthetic fixture.

RED examples:

```js
assert.equal(canCompareScores(oldVersion, newVersion), false);
assert.equal(canCompareScores(bookScope, universeScope), false);
assert.equal(normalizeFactor(null).status, 'unavailable');
assert.equal(normalizeFactor(0).value, 0);
```

Add tests for missing cohort identity, ETF, missing candidate factors, listing/underlying mismatch and invalid numbers. Implement only those transformations; no React layout changes yet.

### Slice 3 — five-factor inspector

Files: `src/StockInsights.tsx`, `src/OwnerStocks.tsx`, `src/StockDashboard.css`, SSR/browser tests.

- First pin five readable labels/values and no invented ETF factors.
- Replace the existing text list with bars.
- Preserve exact order fields and source rationale.
- Verify held/candidate/order origin behavior and score scope.

Exit gate: current data already produces a better inspector; no chart or backend migration is required for this slice.

### Slice 4 — expanded analysis shell

Files: `src/StockDashboard.tsx`, `src/StockInsights.tsx`, CSS/browser tests.

- Add quick/expanded presentation state and contextual Summary / History / News & evidence controls.
- Implement Back/Escape/focus restoration using semantic opener identity.
- Preserve page numbers and selected stock across valid refreshes.
- Verify removal of a selected item, global navigation away, and warning disclosure interaction.

Exit gate: expansion never changes the default overview geometry or adds another primary nav.

### Slice 5 — rationale and evidence

- Reuse published explanation and source links.
- Add structured conditions only when the publisher supplies them.
- Deduplicate news and expose true publication dates.
- Test unknown dates, long headlines, malformed URLs, unavailable reason and conflicting source dates.

Exit gate: all explanation is traceable to published evidence; no fresh financial recommendation is generated.

### Slice 6 — comparison logic

Files: pure helper/test and synthetic fixture.

- Test selected-route comparisons, exact execution terms and funding fallback.
- Test no changes from reordered input, whitespace or refreshed timestamps alone.
- Test changed/removed proposals without calling them executions.
- Test model/scope/cohort mismatch, first snapshot and partial failure.

Exit gate: the comparator cannot report a removal or improvement merely because a source is unavailable.

### Slice 7 — changes review UI

- Add the compact Attention entry and secondary review workspace.
- Add explicit before/after rows, source period and category labels.
- Add reviewed state without affecting unresolved warnings.
- Test identity scoping, blocked local storage, legacy sessions and revisions to previously reviewed events.
- Measure available preview space at small and large desktop heights.

Exit gate: no additional default page scroll; users can understand and acknowledge a change without implying a trade was executed.

### Slice 8 — optional publisher/storage extension

This slice starts only after the final data contract is agreed.

- Add the new migration if the separate column is needed, initially nullable.
- Back up pipeline files and extend payloads additively.
- Set listing, price adjustment, source dates, model/scope/cohort and completeness fields explicitly.
- Exercise old-client/new-publisher and new-client/old-publisher fixtures.
- Keep failed chart preparation from blocking primary ticket publication.
- Verify owner/non-owner/anonymous reads and protect the new field under the same access boundary.

Exit gate: no schema or policy is considered working until its exact published/read-back behavior is verified.

### Slice 9 — real historical charts

- Build the price/rating renderer against validated observations.
- Test zero/one/two observations, flat series, real zero values where valid, gaps, duplicate dates, stale endpoints, unsupported periods and model boundaries.
- Verify time/value alignment after filtering.
- Test actual-listing versus labelled-underlying series and local currencies.
- Ensure the graph's exact values remain available without hover.

Exit gate: every chart can identify its subject, date range, source, unit and limitations.

### Slice 10 — resilience and capacity

Extend coverage beyond the current 17 browser cases:

- Successful load followed by a failed refresh retains values and shows a warning.
- More than 12 history observations paginate correctly.
- Overflowing sell/trim lists paginate and clamp after data shrinks.
- Selection/expansion/changes review survive refresh without focus loss.
- Multiple lengthy warnings cannot be displaced by optional previews.
- Unknown or expired authorization does not expose insight payloads in the UI.
- A late response for a previously selected stock cannot replace the current stock.

### Slice 11 — final verification and delivery

Run the existing project checks plus the new insight check:

```text
npm run verify:ticket
npm run verify:dashboard
node scripts/verifyStockInsights.js
npm run verify:resume
npm run verify:compact
npm run verify:ticker
npm run verify:site
npm run build
npm run verify:dashboard:browser
npx tsc --noEmit
git diff --check
```

Use `PUPPETEER_MODULE` and `CHROME_PATH` when required by the installed browser harness. The browser suite serves local built `docs`; it must never send synthetic credentials to production.

Run `C:/Users/campb/anaconda3/python.exe -B tools/test_calls.py` from `C:/Users/campb/stock-desk` after inspecting that test's side effects, plus focused synthetic publisher tests for any touched producer. This is an implementation-time check, not a claim that those tests ran during planning. Do not claim TypeScript clean if the five pre-existing unused-symbol errors in `src/App.tsx` remain; only new failures belong to this change.

Obtain independent specification and code/security reviews. Commit scoped source/tests and rebuilt `docs`, push, wait for the build of that exact commit, compare served assets, and verify rendered values/geometry on the authenticated production page. Use a throwaway identity, then delete its grant/account and verify the access matrix. Keep private screenshots and payloads in scratch.

### Slice 12 — evaluate contribution separately

Do not implement until ledger completeness and broker reconciliation pass. Return a separate specification for supported periods, return methodology, treatment of flows/FX/fees, residuals and reconciliation tolerances. No performance attribution is approved merely by accepting the UI plan.

## 11. Execution cards for small, reviewable changes

The slices above are milestones. Within them, perform one small test/implementation action at a time. Commands below describe future checks and expected behavior, not tests already run. Commit each verified coherent slice with explicit paths; do not deploy half-built source or unrelated local planning files.

### Task A: distinguish a zero factor from unavailable data

**Files:** create `src/stockInsights.ts`; create `scripts/verifyStockInsights.js` using the existing in-memory esbuild/Node assertion pattern from `scripts/verifyStockDashboard.js`.

1. Add assertions against the real exported helper:

```js
assert.deepEqual(normalizeFactor(0), { status: 'ready', value: 0 });
assert.deepEqual(normalizeFactor(null), { status: 'unavailable', value: null });
assert.deepEqual(normalizeFactor(NaN), { status: 'unavailable', value: null });
assert.deepEqual(normalizeFactor(101), { status: 'unavailable', value: null });
```

2. Run `node scripts/verifyStockInsights.js`. Verify the zero/invalid-value behavior fails before implementing it. A broken test loader does not count as regression evidence.
3. Add the minimal helper:

```ts
export function normalizeFactor(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100) {
    return { status: 'ready' as const, value };
  }
  return { status: 'unavailable' as const, value: null };
}
```

4. Rerun that exact command; expected outcome is all four assertions passing against the actual helper.
5. Keep the helper with the first verified inspector slice; do not create a generalized numeric-validation framework.

### Task B: reject incompatible rating histories

**Files:** modify `src/stockInsights.ts` and `scripts/verifyStockInsights.js`.

1. Add synthetic same-model/same-cohort, different-model, different-scope, missing-cohort and different-subject assertions.
2. Run `node scripts/verifyStockInsights.js`; require the incompatible-pair assertion to fail against an over-permissive comparison.
3. Implement the score-metadata gate using the `ScoreStamp` contract above:

```ts
export function canCompareScores(a: ScoreStamp, b: ScoreStamp): boolean {
  return Boolean(
    a.modelVersion && b.modelVersion && a.modelVersion === b.modelVersion &&
    a.cohortId && b.cohortId && a.cohortId === b.cohortId &&
    a.scope === b.scope && a.subjectId && a.subjectId === b.subjectId &&
    a.cohortSize != null && a.cohortSize === b.cohortSize
  );
}
```

4. Rerun the same command. Separately test source success/completeness and chronological dates: this helper checks score metadata, not the entire snapshot.
5. Commit only after the tests cover both accepted and rejected pairs. Do not mistake a helper returning false for every pair for correctness.

### Task C: replace the text factor list

**Files:** create `src/StockInsights.tsx`; modify `src/OwnerStocks.tsx:1283–1310`, `src/StockDashboard.css`, and the two dashboard verification scripts.

1. Extend the inspector browser test to require five named factor rows, visible score text and labelled score scope; add ETF and absent-factor cases.
2. Build the local site and run `npm run verify:dashboard:browser -- --mode interactions`; the old text list must fail the new visual/structure assertion for the intended reason.
3. Render the bars from existing published numbers. Keep the Open analysis control in one location, reachable without scrolling past long prose.
4. Rerun `node scripts/verifyStockInsights.js`, `npm run verify:dashboard` and the same browser scenario. Inspect the actual pixels.
5. Commit this usable visual change only after exact financial values and default geometry remain unchanged.

### Task D: preserve click origin and return state

**Files:** modify `src/StockDashboard.tsx:20–44,80–105,117–120`, `src/OwnerStocks.tsx`, and `scripts/verifyStockDashboardBrowser.mjs`.

1. Add a test that opens a held stock from its BUY row and requires that proposal, not the Holding section, to lead.
2. Run the interaction scenario; verify the current ticker-only selection fails that origin-specific behavior.
3. Add origin-aware selection and a shared detail-render callback/data model. Keep all money calculations in the existing owner/helper layer. New hooks belong before the private-book early return, not inside a conditional render path.
4. Add and run expand/back/Escape, warning-disclosure, page-restoration, missing-opener and selected-item-removal cases.
5. Commit after the full interaction scenario passes and no duplicate primary navigation appears.

### Task E: compare selected proposals, not alternatives

**Files:** modify `src/stockInsights.ts`, `src/OwnerStocks.tsx:1106–1135`, `scripts/verifyStockInsights.js`, and `scripts/fixtures/stockDashboard.js`.

1. Add fixtures for a changed selected limit, reordered alternatives, a newly funded alternative, a removed proposal and a failed predecessor request.
2. Run the pure check and `npm run verify:ticket`; require a naive all-alternatives comparator to fail the new duplicate/addition assertion.
3. Feed the comparator the existing selected route groups, not duplicated financial-selection logic. Fetch only the bounded predecessor fields needed. Retain structured source status; never parse a warning string to decide whether a snapshot was complete.
4. Verify that a failed source returns an unavailable comparison state, not an empty event list labelled No changes.
5. Commit only with the original one-BUY-per-ticker tests still passing.

### Task F: add review state without suppressing risk

**Files:** modify `src/StockDashboard.tsx`, `src/StockInsights.tsx`, `src/ownerAuth.ts` only if identity metadata is needed, and the browser fixture/harness.

1. Add synthetic tests for marking a change reviewed, an unresolved shortfall remaining visible, a revised event becoming new, another identity, and denied storage.
2. Run the interaction/resilience scenarios and observe the intended missing-review-state failure.
3. Store only opaque IDs and timestamps under the authenticated identity. Retain only the comparison windows the UI can actually revisit; prune obsolete windows instead of building an unlimited local archive.
4. Rerun the same cases, then the complete dashboard browser suite. Verify blocked storage falls back to memory and sign-out removes in-memory private data.
5. Commit with exact warning counts, change counts and focus behavior verified.

### Task G: publish chart data only after its contract passes

**Files:** inspect/backup the pipeline touchpoints in section 9; add one new Supabase migration only if required; extend `scripts/fixtures/stockDashboard.js` and the insight checks.

1. Add synthetic publisher checks for the actual versus underlying listing, currency, adjustment policy, stale last observation, missing model stamp and null observations.
2. Confirm those checks reject the current bare `symbol/timestamps/close` cache as an insufficient chart contract.
3. Add explicit metadata/refresh behavior and bounded publication. Do not change scoring weights, call thresholds, order sizing or availability gates.
4. Verify the additive payload locally, then the exact owner/non-owner/anonymous read matrix after an approved deployment. Read back the field actually written.
5. Ship chart rendering only after those gates pass. The useful inspector release need not wait for this task.

## 12. Acceptance criteria

### Default screen

- No new horizontal/vertical document overflow at the four desktop targets.
- The representative current-size portfolio and both order sides remain visible together.
- Exactly one primary nav.
- Larger datasets paginate honestly; larger displays use additional capacity.
- No smaller primary text, hidden monetary fields, or new always-visible chart consuming row space.
- Genuine warning content remains available and a substantive warning remains visible during detail reading.

### Inspector/analysis

- Clicking a row prioritizes its actual origin/context.
- Factor scores, model weights and rating scopes cannot be confused.
- ETF, unknown and missing candidate data remain honest.
- Expanded analysis has clear Back/Close/Escape behavior and correct focus restoration.
- Opening/closing details does not reset the dashboard unnecessarily.
- Dates, currencies and source identity are readable.

### Changes

- Dates and baseline are explicit.
- Only successful comparable snapshots create before/after comparisons.
- Mutually exclusive BUY alternatives never appear as two additions.
- Reviewed does not mean filled/resolved.
- Model/cohort changes do not masquerade as stock improvement/deterioration.
- Storage failure and legacy sessions degrade safely.

### History/security

- No fabricated history, fabricated confidence, misleading live label, or inferred fill.
- No strategy-performance claim from backfilled prices.
- No private snapshot, history payload, token or account screenshot in public build/test fixtures.
- Owner gating remains enforced by the database, not merely by hidden frontend controls.
- New nullable fields work with old publications.

## 13. Recommended release boundary

**First release:** factor-bar inspector, context-aware selection, expanded summary/evidence, and daily-snapshot change review where valid predecessor data exists. Show explicit unavailable/collecting states otherwise.

**Second release:** real price/rating history after source identity, freshness and comparability are proven. It may follow closely, but it must not hold the useful presentation upgrade hostage to a stale cache.

**Later, separately approved:** broker-ledger import/reconciliation and performance contribution.

The definition of elevation is not more content on the first screen. It is that a click answers a more useful question, using trustworthy data, and a return brings the user back to the same calm dashboard.

## 14. References consulted

The code and actual publishing contract are the authority for this application. General design/accessibility references inform presentation, not financial policy:

- Nielsen Norman Group, Progressive Disclosure: `https://www.nngroup.com/articles/progressive-disclosure/` — retain frequently needed information up front and make the route to advanced detail explicit.
- W3C WAI, Complex Images: `https://www.w3.org/WAI/tutorials/images/complex/` — provide meaningful text descriptions and access to the information encoded by charts.
- yfinance, PriceHistory reference: `https://ranaroussi.github.io/yfinance/reference/yfinance.price_history.html` — adjustment/action parameters must be explicit before using cached prices as a chart contract.
- GIPS Standards Handbook for Asset Owners: `https://www.gipsstandards.org/standards/gips-standards-for-asset-owners/gips-standards-handbook-for-asset-owners/` — cash-flow treatment is part of return methodology; this plan makes no GIPS-compliance claim.

Historical six-pillar/target-derived audit notes must not be used as the current scoring contract. The internal guidance has been corrected to separate the active model from those historical notes. The active `analyze.py`, published model metadata and current rule code take precedence.
