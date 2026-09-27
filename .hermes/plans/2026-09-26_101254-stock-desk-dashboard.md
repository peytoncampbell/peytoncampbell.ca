# Stock Desk: One-Screen Desktop Dashboard Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Replace the vertically stacked owner console with a calm, readable desktop dashboard that shows the portfolio, today's orders, funding, and important exceptions in one viewport.

**Architecture:** Preserve the existing Supabase fetch/auth layer and financial calculations in `src/OwnerStocks.tsx`. Reorganize the same data into a viewport-sized shell, compact portfolio/order tables, and one context pane. Secondary research and history occupy click-selected workspaces rather than extending the dashboard vertically.

**Tech Stack:** Existing React, TypeScript, Vite, CSS Grid, esbuild, and react-dom/server. No grid-layout framework, charting library, backend migration, or pipeline change is needed.

**Status:** Planning only. No implementation, commits, deployment, authentication changes, or production data writes were performed for this request.

---

## 1. Confirmed brief and definition of success

The user explicitly selected:

- Prioritize **laptop/desktop**.
- **Tabs and a details panel are acceptable** when the main dashboard stays on one screen.

This means all primary numbers and current decisions should be simultaneously visible. It does not mean rendering every research paragraph, every historical record, and the full stock universe at once.

Target browser CONTENT viewports, not physical display resolutions:

- Primary: 1440 × 900 and 1366 × 768.
- Minimum no-scroll desktop acceptance case: 1280 × 720 at normal text size / 100% zoom.
- At smaller heights, larger text, or high zoom: preserve access and legibility with an explicit adaptive layout; do not clip content to maintain a cosmetic no-scroll claim.
- Mobile is a usable secondary layout, not a squeezed three-column desktop. It may use stacked content and normal scrolling.

Default dashboard must have no document scrollbar and no scrollbars inside its primary panels for the current data volume. Explicitly opened long-form research/details may scroll. Larger future lists use visible pagination and totals instead of hidden overflow or silently omitted rows.

## 2. Baseline established by inspection

Workspace: `C:/Users/campb/tmp/portfolio-skills-20260910`.
Baseline commit: `abd519d` on clean `main` when this plan was prepared.
Production is GitHub Pages from committed `main:/docs`, not Vercel.

Current source places these sections in one long column:

1. Today's ticket, with sequential SELL / TRIM / BUY groups.
2. Six separate statistic blocks.
3. The book, including Cards / List / Detailed and its news brief.
4. Playbook holdings and the entry list.
5. Best composite-ranked names, weekly picks and reports.
6. Quant research, evidence tables and studies.
7. Today's read and history.

The current buy rows are correct but tall: ticker, amount/type, execution note, and a separate disclosure line. The production desktop screenshot shows substantial space between ticker and amount while every stock still takes several lines.

Sizing baseline from LOCAL source files (recheck the actual published payload before implementation):

- `holdings.json`: 15 positions.
- `data/order_ticket.json`, dated 2026-09-25: 10 unique buys, 7 sells, and 1 trim.
- The ticket intentionally contains alternative execution routes. The UI already selects one buy per ticker. Preserve that fix.

Existing verification:

- `npm run verify:ticket` bundles/renders the real component with synthetic data.
- `verify:resume`, `verify:compact`, `verify:ticker`, `verify:site`, and the production build passed during the preceding change.
- `npx tsc --noEmit` has five verified baseline unused-symbol errors in unchanged `src/App.tsx`. Do not call this command green or silently disable its checks. Compare against baseline and keep new changes free of new diagnostics.
- A whole-page mobile overflow in the existing research tables also predates this redesign. Removing the stacked layout must not preserve unreachable research content inside the new workspaces.

## 3. Recommended design: a calm portfolio workstation

Organize the screen around three questions:

- What do I own?
- What is the plan?
- What needs attention?

Do not make another grid of oversized summary cards. Use aligned tables and a small number of purposeful regions, with more width reserved for the order plan than for supporting material.

### Desktop wireframe

```text
+--------------------------------------------------------------------------+
| Stock desk     Dashboard   Research   History        As of...   Account    |
+--------------------------------------------------------------------------+
| Book value + cost basis | Account return | Day: C$ and % | ETF allocation  |
+-----------------------+--------------------------------+-----------------+
| Portfolio             | Today's plan                   | Attention       |
|                       | Needed / sales / funding gap   | Shortfalls      |
| Ticker  Value  Weight  +---------------+----------------+| Exit watch      |
| Day %   Rating  Action | Buy           | Sell / trim    || Data health     |
|                       | Stock Amount  | Stock Amount   |+-----------------+
| Compact position rows | Type / limit  | Type / limit   || Best candidates |
|                       |               |                || Rating / status |
|                       |               |                |+-----------------+
|                       |               |                || Brief / news    |
+-----------------------+---------------+----------------+-----------------+
| Snapshot freshness / session status / any unresolved warnings             |
+--------------------------------------------------------------------------+
```

The order area's two execution columns sit side by side. They are NOT Buy/Sell tabs: the funding leg and the purchases should be visible together.

Initial width budget: 32% portfolio, 45% orders, 23% context, with 12px gutters. Treat these as prototype starting values; measured content fit decides the final ratios.

### Header and KPI strip

- One compact header: `Stock desk`, a single top navigation with Dashboard / Research / History, snapshot freshness, and an account menu.
- No simultaneous side navigation and top navigation.
- Move the email, sign-out, site link, and automation explanation out of permanent headline space into the account/status controls.
- Four KPI groups rather than six standalone cards:
  - Book value, with cost basis as secondary text.
  - Account return on the existing broker-authoritative basis.
  - Day change in CAD and percent together.
  - ETF allocation.
- Do not add an available-cash number unless a fetched authoritative field actually provides it. The raw ticket's local cash value is not automatically available in `pc_playbook.today`.
- Do not add a large chart merely to make the page resemble a dashboard. Existing recorded history can support a later chart, but a fictional intraday line or index baseline is prohibited.

### Portfolio region

- A compact table is the dashboard default, not individual position cards.
- Candidate columns: ticker, CAD value, weight, day %, rating, and action. Confirm the exact column allocation at 1280px before locking the layout.
- Right-align numbers; left-align tickers; use tabular numerals.
- Keep rating scope explicit in the header: book percentile is not the same as universe percentile.
- Do not collapse the book's HOLD/SELL call, playbook ADD/HOLD signal, and a discretionary funding sale into an invented common recommendation. The selected-stock detail must distinguish these sources.
- Retain Cards / List / Detailed as an expanded portfolio view or detail workspace. The new dashboard defaults to compact rows without deleting those existing views or repurposing their persisted preference.
- Select a stock to inspect its fuller breakdown without navigating away from the dashboard.

### Today's plan region — the visual priority

- A short funding strip uses the publisher's needed / raised / shortfall fields, with clear labels distinguishing planned sale proceeds from settled available cash.
- Two compact tables: Buy and Sell / trim.
- Buy rows: one stock, CAD amount, explicit Market or Limit type.
- Limit quantity and local-currency limit remain readable without opening research details. A second execution line is acceptable inside a controlled row height.
- Fractional market orders retain a visible no-price-protection warning. Do not relabel them as filled, guaranteed, or executed.
- Sell/trim rows retain quantity, limit/currency, expected proceeds, and a compact funding-versus-exit-rule distinction.
- The general market session note is shown once per relevant venue, not repeated verbatim under every stock.
- Remove the repeated `Order details` line beneath every row. The ticker is a focusable detail action with an accessible name.
- Preserve current order priority and the funded-market-alternative selection behavior. Do not add alternatives together or recalculate the funding plan from display rows.

### Context region

Default content, in priority order:

1. Attention: real funding shortfalls, exit-watch items, broker availability restrictions, invalid/stale data, and automation failures.
2. Best candidates: a clearly labeled top-five preview using the existing composite ordering. A total and `View all` access the complete ranking.
3. Brief: a compact excerpt or a few existing headlines, linked to the full source/detail. Never invent a shorter financial conclusion.

Bound summaries visibly. For example, an attention preview must say how many additional items exist; an unresolved warning cannot disappear because the panel ran out of room.

Selecting a stock replaces this context region with a stock inspector. Portfolio and orders remain visible. A persistent warning indicator in the header/status strip survives this replacement.

The inspector contains concise overview, order context, book/universe scores, revisions, allocation, and linked news. Close/Escape returns to context and restores focus to the selected row. Long reading is intentionally opened, not added below the main dashboard.

## 4. What moves behind a click

| Existing content | New home | Default dashboard representation |
|---|---|---|
| Full ticket explanations and sessions | Stock inspector | Order, exact execution fields, funding state |
| Book cards and detailed position view | Expanded portfolio view / inspector | Compact portfolio table |
| Holding playbook signals | Portfolio + selected-stock context | Action with its source distinguished |
| Full gated entry list and rankings | Research: Opportunities | Top-five candidate preview + total |
| Weekly picks, moves, full reports and logs | Research: Reports | As-of / gate status |
| Five-pillar methods, evidence and studies | Research: Model | Rating scope and relevant warning only |
| Full morning brief / all stories | Research: Brief or stock inspector | Short brief preview |
| Daily account history | History workspace | Existing headline return/day figures |
| Automation details and publishing explanation | Status detail | Current health and freshness |
| Auth explanation and account email | Account menu | Account control |

Research and History replace the main workspace in the same shell. They are not additional panels below it. Tables are paginated with explicit totals. Long reports can use one obvious reading scroll area, because the user has intentionally opened secondary content.

Existing explanatory paragraphs contain older hard-coded rules/weights alongside newer live data. Do not turn those paragraphs into new dashboard badges or financial logic. Source compact labels from current payloads and distinguish measured evidence from argued assumptions. Resolving model-policy disagreements is a separate task.

## 5. Visual language

Proposed tokens, scoped to the stock workspace:

- Canvas: `#10161F`.
- Panel: `#18212D`.
- Selected / raised surface: `#202C3A`.
- Main text: `#E2E8F0`.
- Secondary text: `#A7B5C6`.
- Selection accent: `#8FAFE6`.

Calculated proposal contrast against the darkest-to-lightest surfaces:

- Main text: 14.73:1 to 11.49:1.
- Secondary text: 8.71:1 to 6.79:1.
- Accent text: 8.16:1 to 6.37:1.

These are calculations for the proposed solid colors, not a claim that a rendered interface has already passed accessibility testing. Recheck computed colors after actual CSS composition. Financial gains/losses and warnings retain distinct textual labels/signs, not color alone.

Typography: retain the existing `IBM Plex Sans` body family (with Segoe UI/system fallbacks) and use tabular numerals. The stylesheet's later `--font-body` rule overrides its initial Aptos declaration, so use the effective token rather than assuming the first body rule wins. No additional font download is needed. Aim for 14px decision/table data, 12–13px secondary labels, 16px panel titles, and 22–26px headline values. Never shrink critical numbers to force a fit.

Use restrained 6–8px corner rounding and subtle separators. No glows, gradients, giant uppercase headings, bouncing updates, or badges for every normal state. The signature layout is the side-by-side funding and buy plan, not decorative charts.

Reference inspected: Koyfin's official `v3.90: Compact Table` help page and product screenshot. The useful move is organizing dense, aligned data into side-by-side sections. Do NOT copy its extreme ticker density, tiny type, large tool palette, or full visual treatment. This was a targeted layout reference, not a completed broad visual-reference audit; validate the proposed palette and arrangement in the first mockup before production implementation.

Current production baseline screenshot inspected:
`C:/Users/campb/AppData/Local/hermes/cache/scratch/ticket-live/buy-1440.png`.

## 6. Measurable space budget

Initial shell budget at 100% zoom:

- Header/navigation: 48px.
- KPI strip: 72px.
- Status strip: 24px.
- Outer vertical padding: 24px total.
- Three vertical gaps: 24px total.
- Remaining height goes to the workspace.

| Viewport | Workspace height | Portfolio sizing case | Buy sizing case |
|---|---:|---:|---:|
| 1440 × 900 | 708px | 508px | 512px |
| 1440 × 800 | 608px | 508px | 512px |
| 1366 × 768 | 576px | 508px | 512px |
| 1280 × 720 | 528px | 508px | 512px |

Portfolio case: header 32 + columns 28 + 15 × 28px rows + footer 28 = 508px.
Buy case: panel header 32 + funding strip 48 + columns 24 + 10 × 38px rows + footer 28 = 512px. Sell/trim occupies the adjacent column, not additional vertical space.

These are design budgets, not browser measurements. The 720px case has little spare height, so test it first with real limit-price text, long ticker labels, large amounts, and warnings. If it fails, change hierarchy or use explicit pagination; do not solve it by clipping, removing execution fields, or reducing number legibility.

Future growth: compute visible row capacity from available panel height, preserve the original order, and provide labeled page controls and total counts. Reset/clamp the page after data refresh. At larger viewports, show more rows rather than expanding blank margins. The current sizing case should not need paging.

## 7. Proposed files and boundaries

Modify:

- `src/OwnerStocks.tsx`: retain fetch/auth, merge/read-model logic, order helpers and money formatters; compose dashboard/research/history workspaces; add selected-stock state and reuse compact rows.
- `scripts/verifyTicket.js`: preserve money/selection/funding assertions; update only UI assertions that intentionally change from native disclosure to accessible stock inspection.
- `package.json`: add dashboard verification commands.

Create:

- `src/StockDashboard.tsx`: small presentational shell and controlled workspace/inspector containers. Accept existing rendered sections or explicitly typed data; do not reproduce data fetching or financial math.
- `src/StockDashboard.css`: route-scoped dashboard tokens, viewport grid, tables, responsive modes, focus and selected states. Import through the dashboard component.
- `scripts/verifyStockDashboard.js`: deterministic component/interaction contract tests with synthetic inputs, using existing esbuild/react tooling.
- `scripts/verifyStockDashboardBrowser.mjs`: browser geometry, keyboard, state and reachability checks. Reuse the existing scratch browser toolchain rather than adding a runtime dependency.

Generated only when implementing and shipping:

- `docs/assets/*` and generated route HTML via `npm run build`.

Do not touch the stock pipeline, scheduled tasks, availability gates, model weights, live holdings, migrations, authentication policy, or public marketing-page design.

Do not add another generic override layer to the end of `src/index.css`. Scope new selectors beneath the new dashboard root. Remove or stop rendering replaced owner markup rather than hiding shared `.own-table` / `.own-panel` classes, which have other consumers.

## 8. Implementation sequence after approval

### Task 1: Prove the layout visually before migrating production markup

**Objective:** Confirm readability and the no-scroll sizing budget with representative data.

**Files:** Scratch-only mockup under the Hermes scratch directory; implementation plan may be amended after approval.

1. Produce one primary desktop mockup using the three-region layout, plus one alternate arrangement that swaps portfolio/orders prominence.
2. Show both at 1280 × 720 and 1440 × 900 using synthetic positions/orders with the inspected row counts.
3. Include funded and unfunded orders, CAD and foreign limit prices, closed markets, long names, and an invalid-data alert.
4. Check screenshots and geometry; choose the layout that keeps action context clear without tiny text.
5. Do not publish mockups or include private account screenshots in a public repo.

### Task 2: Pin the financial and content-preservation contract

**Files:** `scripts/verifyTicket.js`, `scripts/verifyStockDashboard.js`.

1. Add a failing structural test for one dashboard shell containing portfolio, both order sides, and context.
2. Retain existing tests for one buy per stock, amount-vs-unit-price, exact quantities, currencies, shortfalls, alternative ordering, and payload immutability.
3. Add fixtures where funding sales and automatic exits coexist; require their reasons to remain distinct.
4. Add null, failed-fetch, stale-ticket and broker-unavailable fixtures. Missing data is unknown/unavailable, never a fabricated zero or healthy status.
5. Run the new test to confirm the intended failure before writing the shell.

### Task 3: Implement the viewport shell and single navigation

**Files:** `src/StockDashboard.tsx`, `src/StockDashboard.css`, composition in `src/OwnerStocks.tsx`.

1. Implement the four shell bands and three workspace regions.
2. Keep one top navigation, preserving dashboard selection during refresh and switching workspaces without document-height growth.
3. Reserve error/status space so a routine update does not push the bottom panel out of view.
4. Use `min-width: 0` and `min-height: 0` at grid boundaries. Do not set global document overflow to hidden as a substitute for sizing.
5. Run shell tests and a baseline browser geometry test.

Illustrative scoped shell starting point (measure before treating values as final):

```css
.stock-dashboard {
  box-sizing: border-box;
  height: 100dvh;
  display: grid;
  grid-template-rows: 48px 72px minmax(0, 1fr) 24px;
  gap: 8px;
  padding: 12px 16px;
}
.stock-dashboard__workspace {
  display: grid;
  grid-template-columns: minmax(0, 32fr) minmax(0, 45fr) minmax(0, 23fr);
  gap: 12px;
  min-width: 0;
  min-height: 0;
}
```

### Task 4: Compact the order plan without changing its meaning

**Files:** `src/OwnerStocks.tsx`, `src/StockDashboard.css`, `scripts/verifyTicket.js`.

1. Write failing tests for simultaneous Buy and Sell/trim tables and a single funding strip.
2. Reuse `orderGroups`, `buyLines`, `orderMarket`, currency helpers and funding calculations.
3. Replace tall per-stock blocks with compact rows; preserve visible execution fields and risk warnings.
4. Replace repeated disclosure text with a focusable stock inspection action.
5. Ensure the heading counts exactly match selected/displayed orders and visibly distinguish page count from total if paginated.
6. Run ticket and dashboard tests. Compare displayed money and quantities with the input rows, not just label presence.

### Task 5: Build the compact portfolio and inspector

**Files:** `src/OwnerStocks.tsx`, `src/StockDashboard.tsx`, dashboard stylesheet/tests.

1. Write failing tests for stable position order, current money/rating format, explicit rating scope, and distinct recommendation sources.
2. Reuse the merged book data rather than constructing a second independent holdings model.
3. Add keyboard/click selection that updates the right-side inspector while keeping portfolio/orders visible.
4. Preserve expanded Cards / List / Detailed access and the existing `pc-desk-view` preference; use a separate dashboard preference only if needed.
5. Test Escape, close, focus restoration, refresh, and the selected holding disappearing from a new payload.

### Task 6: Fit attention, candidates and the brief

**Files:** dashboard component/composition, tests and stylesheet.

1. Write failing tests for a real shortfall, invalid/stale data, unavailable listings, watch items, and more alerts than preview space.
2. Add compact previews with honest totals and full-list access.
3. Keep excluded broker listings out of the executable orders but visible in research with the reason.
4. Keep attention visible in the shell even when the inspector replaces the default context region.
5. Test empty states without large placeholder panels or an invented all-clear message.

### Task 7: Move the deep content into Research and History

**Files:** `src/OwnerStocks.tsx`, dashboard component, tests.

1. Write a reachability test for every row of the content-mapping table in section 4.
2. Move opportunities, reports, model studies and brief content into a single selected research workspace with contextual tabs.
3. Move the existing history table into its own workspace with explicit pagination.
4. Keep formatting/source caveats and measured-versus-argued labels. Do not change model policy to resolve old prose inconsistencies.
5. Test tab switching, refresh, no duplicate primary navigation and preserved selected-stock context.

### Task 8: Add capacity, reflow and keyboard safeguards

**Files:** dashboard component/stylesheet and browser regression script.

1. Add failing geometry tests at 1280 × 720, 1366 × 768, 1440 × 900, and 1920 × 1080.
2. Add synthetic stress fixtures with more holdings/orders, long tickers, large money values, and long errors.
3. Implement visible pagination only where capacity requires it; do not silently take the first N rows.
4. At 200% zoom and narrow/mobile layouts, permit intentional reflow/scrolling rather than hiding controls or shrinking financial data.
5. Ensure keyboard navigation, readable focus, dialog/inspector closing and reduced motion.

### Task 9: Verify and ship the actual hosted page

**Files:** relevant source/tests and generated `docs/` only.

Run:

```text
npm run verify:ticket
node scripts/verifyStockDashboard.js
npm run verify:resume
npm run verify:compact
npm run verify:ticker
npm run verify:site
npm run build
npx tsc --noEmit
```

Record known baseline TypeScript failures separately from new regressions. Run browser verification against the built `docs/` output first, then against production after deployment.

- Obtain independent UX and code review on the scoped change.
- Use a temporary test identity for the private console, never the owner's credentials. Reuse the established setup/cleanup process and verify exact cleanup/ACL state afterward.
- Commit source, tests and generated docs; push only after implementation is requested and checks pass.
- Wait for the Pages build for the exact commit, compare the served JS/CSS to the local build, and read rendered values in the authenticated live dashboard.
- Delete temporary identity/grant/session files and confirm the real owner allowlist is restored.

## 9. Acceptance checks

### Visual and geometry

- At the supported desktop sizes and current data volume, portfolio, both order sides, KPIs, funding and attention are simultaneously visible.
- No document scrolling or primary-panel scrolling in the default dashboard.
- No clipped row, money value, warning, focus target or page control.
- The portfolio and execution areas take the screen's space; decorative charts and giant empty cards do not.
- Long reports/details only scroll after explicitly opening the secondary reading view.

Example browser assertions, evaluated on the dashboard route at supported desktop size:

```js
const fit = await page.evaluate(() => {
  const root = document.querySelector('.stock-dashboard');
  const panels = [...root.querySelectorAll('[data-dashboard-panel]')];
  return {
    documentFits: document.documentElement.scrollHeight <= innerHeight + 1
      && document.documentElement.scrollWidth <= innerWidth + 1,
    panelsFit: panels.every(panel => {
      const box = panel.getBoundingClientRect();
      return box.top >= 0 && box.bottom <= innerHeight + 1
        && box.left >= 0 && box.right <= innerWidth + 1
        && panel.scrollHeight <= panel.clientHeight + 1;
    }),
  };
});
assert.equal(fit.documentFits, true);
assert.equal(fit.panelsFit, true);
```

Also assert expected row counts, row visibility and exact displayed values. Geometry alone can be green while CSS has hidden the data.

### Data and behavior

- One selected buy route per ticker; alternatives are never added.
- Market/limit type, quantity/limit, currency, funding state, and reason kind remain correct.
- All existing information remains reachable through the documented content map.
- Book/universe ratings and broker/account authority remain distinguished.
- No new order-execution controls, model recommendations, backend dependencies or auth-policy changes.
- Private data remains private; committed tests use synthetic fixtures only.

## 10. Scope exclusions and tradeoffs

- No drag-and-drop dashboard builder or persistent arbitrary panel sizing in this pass.
- No new live pricing/news provider, investment model changes, or backend tables.
- No blanket promise that unlimited rows fit on every device. Current desktop data fits by layout; future overflow is explicitly paginated.
- No artificial page-size fix through browser zoom, tiny typography, or `overflow: hidden`.
- Dense desktop rows trade some prose visibility for scanability. The inspector and Research workspace preserve explanations on demand.
- Styling tokens are a concrete starting proposal. The first measured mockup, not this document alone, proves the final visual design.
