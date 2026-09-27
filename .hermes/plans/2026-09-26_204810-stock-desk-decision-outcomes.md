# Stock Desk Decision-to-Outcome Implementation Plan

> **For Hermes:** After implementation is explicitly authorized, use the subagent-driven-development skill to implement this plan task-by-task. This document does not authorize implementation, trading, broker sign-in, or production changes.

**Goal:** Connect immutable desk recommendations to broker-confirmed activity and measured outcomes, so the owner can distinguish investment results, execution differences, and model evidence.

**Architecture:** Keep the existing Python pipeline, Supabase owner gate, and React/GitHub Pages site. Add an append-only local decision journal and a broker-import ledger using Python's standard-library SQLite and Decimal; publish only bounded, validated, owner-only outcome reports. Start in shadow mode: nothing changes the current holdings, financial calculations, ticket, model weights, or execution workflow.

**Tech Stack:** Existing Anaconda Python, unittest, csv, json, sqlite3, decimal; existing React/TypeScript/Vite; existing Supabase/PostgREST; existing Puppeteer/Chrome regression harness. No new paid feed, broker automation, server framework, or LLM calculation dependency in the first release.

**Status:** Implementation authorized by the user's subsequent request to build all findings; work is in progress. Originally prepared September 26, 2026, using the local EDT clock. The earlier planning-only statements below describe that preparation, not the current implementation authorization. Progress and verification gates are tracked in `.hermes/outcomes-execution.md`. Real broker reconciliation remains blocked on supplied export/balance evidence; market-horizon maturity cannot be accelerated.

**Findings incorporated:** The complete follow-up discussion is captured in Section 12, with findings mapped to implementation tasks, evidence requirements and release gates. Adding findings to this plan does not authorize implementation or production changes.

---

## 1. The product decision

The next major step should be a verified decision-to-outcome loop, not another dashboard redesign or a larger list of signals.

The previous release answers: What is proposed, why, what changed, and what historical evidence exists?

This release should answer:

1. What exactly did the desk recommend, using what information at that time?
2. What actually happened in the brokerage account?
3. Do the imported cash and positions reconcile with independent broker records?
4. How much did the account earn after external cash flows and costs?
5. Did the model's choices improve on a preselected comparison, and how strong is the evidence?

These are separate questions. A sound recommendation can be executed differently; an account can rise because money was deposited; a profitable recommendation can still lag a passive comparator. Do not collapse them into one success score.

### Why this outranks alternatives

- More charts would improve presentation, not establish whether decisions work.
- A larger universe would add candidates without improving accountability for existing decisions.
- Automatic trading would increase consequences before the desk can reconcile and evaluate executions reliably.
- Reweighting the model now would get ahead of the available forward evidence.
- A conversational analyst can explain validated reports later. It should not invent executions, calculate the ledger, or grade its own recommendations.

The value proposition is accountability, not a promise of higher returns.

## 2. Verified starting point

### Existing work to preserve

Frontend: `C:/Users/campb/tmp/portfolio-skills-20260910`.
Pipeline: `C:/Users/campb/stock-desk`.
Migrations: `C:/Users/campb/coach-ai-cloud-suite`.

The frontend HEAD inspected for this plan is `a40f7643e2b15619c1ad0c4491c49e71b5bc8933`, matching the local origin/main reference. The completed release is documented in `.hermes/context-depth-release.md`.

Preserve contextual inspection, five-factor explanations, Evidence, Changes, lazy History, owner/session guards, the three-region default, four existing KPIs, exact ticket semantics, and the deployed build process.

### Findings from current files

- `holdings.json` contains positions, cash, a broker reference, and a dated trade-notes field. It is a current-state record, not a normalized transaction ledger.
- `reconcile.py` investigates the difference between a quoted portfolio total and a supplied broker total. It does not replay broker transactions and reconcile quantities plus cash at statement boundaries.
- `tools/pit_recorder.py` already captures useful inputs and scores. Its daily CSV is opened for replacement, and the inspected columns lack capture identity, model version, and cohort identity. Those limitations matter for reproducible evaluation.
- `data/pit/` currently contains one capture, `pit-2026-09-25.csv`. This is not enough longitudinal evidence to validate the current model.
- `tools/factor_ic.py` contains proxy studies and an early-to-latest PIT comparison. It should be extended, not replaced by another competing research engine. Its calendar-day maturity logic is not the same as a completed trading-session horizon.
- `tools/playbook.py` upserts by `as_of`. Same-day revisions therefore need a separate immutable record if they are to be evaluated later.
- The current producer already emits `today.comparison_meta`. A legacy live row without that metadata is intentionally unavailable for plan comparison. Do not re-create this finished work or fabricate provenance for that row.
- The current primary navigation is Dashboard, Research, History. `OwnerStocks.tsx` supplies the History workspace; `StockDashboard.tsx` owns layout/navigation, not financial computation.

### Planning assumptions

- Begin with the existing stock/ETF brokerage account, including its relevant currency balances, reported in CAD.
- Do not include chequing, crypto, derivatives, or unrelated accounts in the first import scope. Detect unsupported activity rather than silently ignoring it.
- Imported broker records are read-only evidence. No broker credentials are needed by the importer.
- Keep the existing broker-basis dashboard number and its label unchanged. New performance measures are additional, explicitly named views.
- No new subscription is necessary to prove the first release. Missing historical coverage remains missing.

## 3. Practical source of truth

Wealthsimple's current official documentation describes downloadable holdings CSVs, activity CSV/PDF statements, and realized gain/loss CSVs. Its activity statement does not contain a running cash balance; monthly statements are needed for that check. Its realized gain/loss report is for reference, not an official tax document. These facts support starting with document imports rather than assuming a live API exists. See S1.

### Initial evidence package

Request, through the user's own broker interface:

1. One account's activity export for a bounded period.
2. Matching opening and closing holdings reports, where available.
3. Broker statements or balance confirmations sufficient to establish opening/closing cash and account equity on matching dates.
4. Optional realized gain/loss export for the same scope and period.

The user can put files in a local private folder. Do not request passwords or verification codes. Do not send the exports to public services, external research tools, an LLM, Git, or the website build.

The actual CSV headers, transaction identifiers, supported event types, settlement representation, and timestamp precision must be inspected before the parser is designed. Do not invent a Wealthsimple format. Synthetic test fixtures must be explicitly synthetic and preserve the inspected format, not real account values.

### When historical evidence is incomplete

Establish a documented opening baseline and begin accurate tracking from there. An opening position is not a purchase and its market value is not its acquisition cost. Unknown prior cash flows or cost basis do not become zero. No invented since-inception return or realized gain.

## 4. Product experience

### Keep the default desk calm

No extra dashboard column, permanent chart, or additional top-level KPI. Keep the existing primary navigation.

Use the existing History workspace for secondary views:

- Snapshots: existing publication history.
- Decisions: original recommendations, confirmed activity, and outcomes.
- Performance: reconciled account results and the comparison methodology.

Research > Model should consume the same validated evaluation report for factor/model evidence. Do not implement a second calculator in the browser.

Attention may eventually show a compact reconciliation warning with an exact broker-data date. A successful pipeline run must not make old broker data look current. New detail remains lazy-loaded.

### Decision detail

A selected decision should show:

- Original action, selected order alternative, quantity or budget, order type, native currency/limit, and exact publication identity.
- Original model/cohort/score metadata and the reason captured at that time.
- Execution evidence: broker-confirmed, user-reported, ambiguous, or no matching execution in the imported period.
- Matched execution quantities, dates, prices, fees and conversion details only where the source supports them.
- Outcome horizon, comparison, costs included, coverage and limitations.

Review acknowledgement, intention to trade, submitted order, and verified execution remain separate concepts. Clicking a review checkbox never creates a transaction.

### Performance detail

The first useful view is a transparent bridge:

    opening account equity
    + net external flows
    + net investment result
    = closing account equity

Show reconciliation status and the evidence period before showing return percentages. Explain discrepancies rather than forcing agreement.

Only split the investment result into price movement, income, fees and currency effects when those components can be reconciled without double counting. Otherwise retain an explicit unexplained or unavailable component.

## 5. Data and calculation contracts

### 5.1 Durable, local evidence

Proposed private data root:
`C:/Users/campb/AppData/Local/stock-desk/private/`

Keep it outside the public site repo, the stock-desk Obsidian vault, and Hermes scratch storage. Scratch is not durable storage.

Proposed contents:
- `outcomes.sqlite3`: canonical local journal/ledger.
- `imports/`: original documents, named by safe import IDs rather than unsanitized filenames.
- `backups/`: SQLite-consistent backups and an import manifest.

Confirm Windows filesystem permissions and backup location before creating the store. Do not claim encryption or off-device backup exists until verified. Never use secrets or an account number as a visible primary key.

Use standard-library SQLite transactions. No event-bus framework or general-purpose accounting platform.

### 5.2 Minimal logical records

Use explicit tables or equivalent constrained records for:

- Import batches: checksum, original evidence reference, account alias, parser version, document type, coverage period, imported time, validation result.
- Events: broker event ID when available, local event ID, event kind, native currency amounts, quantity, instrument identity, trade date, settlement date, source precision, evidence row, reversal/supersession link.
- Baselines and reconciliation checkpoints: positions, currency cash balances, broker values, as-of date, unmatched differences and completeness.
- Decision batches: exact original publication stamp, source payload fingerprint, model/cohort/rule versions, captured time, original financial payload and publication receipt.
- Decision annotations/execution links: evidence references and matched quantities; do not infer links solely from a shared ticker.
- Derived reports: ledger revision, decision IDs, methodology version, source cutoff, benchmark policy, completeness and calculated values.

Cash and quantity calculations use Decimal, with decimal strings at storage/JSON boundaries. Rounding belongs at a documented boundary, not inside every arithmetic step. Keep native amounts separate from CAD reporting values.

### 5.3 Import and identity rules

- Preview is the default; explicit acceptance is required before the import changes the canonical store.
- Reimporting the same file must make no economic change.
- Overlapping exports must not double count events.
- Preserve legitimate identical-looking transactions. A tuple of date/ticker/amount is not sufficient proof of duplication.
- Prefer broker IDs. Where absent, use multiset-aware overlap reconciliation and quarantine ambiguous matches.
- Corrections and reversals add evidence; never silently rewrite original documents.
- Retain both the effective date and the date a correction became known.
- Unknown event types, ambiguous instruments, malformed amounts and missing currencies block completeness for the affected scope.
- Identify the actual listing and currency. A CAD CDR and its USD underlying are not interchangeable ledger instruments.
- A CAD/USD conversion within this account is internal movement, not an external contribution. A transfer across the chosen portfolio boundary is external even if it remains inside Wealthsimple.
- Record separate FX legs and explicit charges when present. A missing disclosed FX fee is not a zero fee.
- Use actual broker debits/credits for executed conversions. An indicative market rate may be a labelled valuation input, never proof of the executed rate; see S3.

### 5.4 Reconciliation rules

Replay supported events from the opening baseline and compare with independently imported closing evidence:

1. Position quantities by exact instrument.
2. Settled cash by currency.
3. Pending settlements or receivables/payables, if documented.
4. Account valuation at matching broker dates and valuation bases.

Do not compare a live quote against a previous statement close and demand equality. Separate quantity/cash accounting from market-price differences.

Tolerances must derive from documented source precision and rounding. No blanket percentage tolerance that can hide a missed transaction. Every difference exceeding that policy has an explicit reason or blocks verification.

A report has at least these states: not imported, incomplete, reconciled, reconciled-with-documented-rounding, discrepancy. A small monetary difference is not automatically a pass.

No automatic overwrite of `holdings.json`, cash, averages, or the dashboard's broker reference in this project phase.

### 5.5 Immutable decisions and research captures

Capture a decision at generation/publication time, not retrospectively after seeing returns. Archive same-day revisions independently. Preserve original timestamp spelling for source identity.

Use a local prepare/receipt sequence: persist the generated payload, publish through the existing publisher, then append a receipt only after an exact readback. A failed publication can remain a generated/unpublished record; it must not masquerade as a published recommendation. Publication proves availability, not that the owner viewed or acted on it. Reuse IDs on retries and recover receipts without re-running financial decisions.

Record the selected exclusive buy alternative. Do not count both a fractional-market alternative and its whole-share limit alternative as funded recommendations.

Freeze source hashes, capture time, source as-of information where known, model version and universe/cohort identity. Keep weekly scores' source vintage distinct from a daily capture time. Unknown source vintage remains unknown.

Extend PIT capture without breaking existing consumers. Retain a compatibility daily CSV if necessary, but use versioned immutable captures as evaluation authority. Existing legacy CSVs must not be relabelled with metadata that cannot be proven.

### 5.6 Execution evidence

Maintain separate dimensions:

- Recommendation: proposed, superseded, withdrawn from the proposal set.
- User intent: unrecorded, considering, skipped, reported submitted.
- Evidence: no match in imported scope, ambiguous match, broker-confirmed executed quantity, broker-confirmed reversal.

A completed trade export may prove a quantity traded without proving order placement time, cancellation, or the full order lifecycle. Only show partial/full order status when order identity and intended quantity are supported.

One proposal can match multiple executions; a fill must not be fully counted against multiple proposals. Aggregate duplicate daily recommendations into explicitly defined research episodes, not independent successes.

First release: read-only web display. Local, explicit annotation/linking commands handle human confirmation; do not add authenticated browser writes or a broker order endpoint just for convenience.

### 5.7 Performance definitions

Keep these separate:

- Net investment result in CAD: an equity/flow bridge for a reconciled period.
- Money-weighted return: the owner's result incorporating the timing and size of external flows.
- Time-weighted return: a strategy-oriented return neutralizing external flow effects, requiring adequate valuation data.
- Broker-reported realized gain/loss: a separately labelled broker report, not this project's tax calculation.
- Decision forward return: research on a recommendation; not the account return or proof it was traded.

S2 explains the distinction between money-weighted and time-weighted returns. Borrow methodology, not a claim of GIPS compliance.

For our implementation: require a complete measurement period, exact cash-flow dates at the source's precision, an agreed account boundary, and a validated valuation policy. Guard undefined denominators and ambiguous/non-convergent IRR cases. Do not silently choose a convenient solution.

Do not claim exact TWR from incomplete cash-flow-boundary valuations. Start with the valid dollar bridge and supported money-weighted result. A labelled approximation can be a later separately tested method. Short periods remain short-period results rather than attention-grabbing annualized projections.

Never add dividends again to a total-return series that already incorporates them. Actual cash-ledger income and benchmark adjustment methodology require separate, explicit treatment.

### 5.8 Fair comparison and model evidence

Before seeing evaluation results, record a comparison policy: a broad global-equity total-return benchmark in CAD, or another explicitly justified comparator. Select the actual series with the owner before this phase; do not quietly choose the one that makes the model look best.

Compare like with like: same period, currency and return method. For the owner's experience, a hypothetical benchmark account should receive the same external flows under a declared timing/execution policy. It is a simulation, not an executable quote or a guaranteed alternative outcome. S4 supports like-for-like comparison.

Expose differences in concentration, cash exposure, risk and turnover. A positive benchmark gap is not automatically risk-adjusted alpha.

Use separate panels/cohorts for:

1. Actual reconciled account results.
2. Broker-confirmed executions linked to desk proposals.
3. All eligible frozen recommendations, including those not executed.
4. The model's cross-sectional factor/ranking research across frozen cohorts.

Do not select only winning recommendations or only today's surviving symbols. Missing delisting/corporate-action data remains a coverage limitation, not a zero return. Separate revisions/models and correlated observations. S5 discusses look-ahead and survivorship pitfalls and walk-forward evaluation.

Candidate horizons are 21, 63 and 126 trading sessions. Use an explicit listing calendar and declared endpoint policy, not elapsed calendar days or a count of only the rows that happened to download. Missing expected prices do not shorten the horizon. The first evaluation price must not precede the decision's information cutoff.

Publish sample size, independent date groups, matured versus pending observations, exclusions, costs and uncertainty. Register the hypothesis, primary horizon, inclusion/exclusion policy and economic success criterion before evaluating a new model variant. Retain failed experiments and reserve later observations for confirmation; repeatedly trying weights on the same history is not independent validation. Early results are exploratory. There is no magic trade count that proves the model works. Automatic reweighting and automatic promotion of experiments are out of scope.

## 6. Delivery sequence

### Release A: trustworthy records, useful immediately

Start immutable decision capture as soon as its tests pass. In parallel, inspect/import broker evidence. Deliver the first reconciled period and a decision timeline, with actual/accounting states but no premature model grade.

Exit gate: one real bounded broker period reconciles; duplicate/overlapping imports are safe; original proposals remain replayable; all unsupported/missing evidence is explicit; existing financial outputs are unchanged.

### Release B: measured account and execution outcomes

Add the dollar bridge, supported return methods, comparison policy and execution cost reporting. Publish the first read-only Performance view only after its independent arithmetic and source checks pass.

Exit gate: actual period totals match broker evidence, synthetic cash-flow tests pass, return methods meet their prerequisites, benchmark methodology is disclosed, and every displayed value has a traceable input.

### Release C: forward model evaluation

Extend the existing PIT/quant tools to evaluate matured captures. Display collecting/insufficient-evidence states from day one; do not wait for data maturity to ship the collector.

Exit gate: no future information is used; model/cohort boundaries and missing outcomes are accounted for; research is reproducible; no financial-rule changes occur.

Software completion and investment evidence maturity are different milestones. Historical broker statements may support an account report immediately; newly captured recommendations still need their actual future horizons to occur.

## 7. Implementation work packages

Paths below are exact proposed code locations. Runtime private data remains outside the code tree. Each numbered implementation package must be broken into its listed small actions; do not treat a whole package as a single unreviewed patch.

For each code package: write the named regression, run it red, implement the minimum change, run it green, complete independent specification review, then independent code/security review. Commit only the intended files in Git repositories. The pipeline is not under Git: archive affected files before edits and record a manifest. Do not initialize or restructure its repository as a side quest.

### Task 1: Pin the account boundary and inspect export shapes

**Files:** Create `C:/Users/campb/stock-desk/docs/outcomes-data-contract.md` after approval; synthetic fixtures under `C:/Users/campb/stock-desk/tools/fixtures/outcomes/`.

1. Inspect the actual owner-selected export headers locally without printing personal identifiers.
2. List supported, unsupported and absent event types/fields.
3. Record exact account/subaccount scope, date boundary and precision policy.
4. Build synthetic fixtures for the observed shapes.
5. Ask only for missing source evidence that changes the contract. No guessed column names or quantities.

**Gate:** Source data is sufficient for the first bounded period, or the remaining gap is named and performance stays unavailable.

### Task 2: Add the local store and idempotent import preview

**Create:** `tools/broker_ledger.py`, `tools/test_broker_ledger.py` in the pipeline.

1. Red test: identical import is a no-op after first acceptance.
2. Red test: overlapping exports preserve legitimate duplicate fills without double counting.
3. Implement private-path validation, file hashes, Decimal parsing, import batches and atomic acceptance.
4. Red/green tests for malformed files, unsupported records, rollback on failure and source provenance.
5. Add explicit preview/accept CLI modes; preview must not change economic state.

**Run:** `C:/Users/campb/anaconda3/python.exe -B -m unittest discover -s tools -p 'test_broker_ledger.py' -v` from the pipeline.

**Expected after implementation:** All cases pass with network blocked and temporary storage only.

### Task 3: Add baseline replay and reconciliation

**Modify:** `tools/broker_ledger.py`, `tools/test_broker_ledger.py`.

1. Red tests: buy/sell, fractional quantities, deposit/withdrawal, income and fees.
2. Red tests: paired FX movement, pending settlement, correction/reversal and transfer across the chosen boundary.
3. Implement quantity and per-currency cash replay.
4. Compare with independently supplied closing evidence and precision policy.
5. Test unsupported corporate actions and unknown opening basis fail incomplete rather than inventing an adjustment.

**Gate:** Broker quantity/cash discrepancies are explicit. No live quote fetch or financial publisher runs during tests.

### Task 4: Freeze generated and published decisions

**Create:** `tools/decision_journal.py`, `tools/test_decision_journal.py`.
**Modify narrowly:** `tools/playbook.py` at primary payload preparation/readback. Read `tools/order_plan.py` as the authority; do not rerun its decisions inside the journal.

1. Red test: same-day revisions remain independently retrievable.
2. Red test: retry is idempotent and failed publication cannot become published.
3. Implement original payload recording, stable IDs and appended publication receipts.
4. Prove only the selected mutually exclusive buy alternative counts.
5. Compare financial payloads before/after integration byte-for-byte or structurally with exact source identity preserved.

**Run:** `C:/Users/campb/anaconda3/python.exe -B -m unittest discover -s tools -p 'test_decision_journal.py' -v`.

**Operational rule:** Recording failure is reported as missing journal evidence. It must not silently relabel success or break the existing financial publish without a separately approved policy change.

### Task 5: Make PIT captures evaluation-ready

**Modify:** `tools/pit_recorder.py`.
**Create:** `tools/test_pit_recorder.py`.

1. Red test: recapture on the same date preserves the earlier immutable capture.
2. Red test: old score/source vintage is not promoted to the current capture date.
3. Add capture/model/cohort identities and source metadata where available.
4. Retain backwards-compatible consumers without treating legacy records as fully stamped.
5. Test malformed/unknown timestamps and original exact snapshot identities.

**Run:** `C:/Users/campb/anaconda3/python.exe -B -m unittest discover -s tools -p 'test_pit_recorder.py' -v`.

### Task 6: Connect executions without inferring them

**Modify:** `tools/decision_journal.py`, `tools/test_decision_journal.py`.

1. Red tests for one proposal/multiple fills, one fill/multiple ambiguous proposals, and unexecuted proposals.
2. Add explicit evidence links with matched quantities and review provenance.
3. Keep annotations separate from broker facts and make retractions append-only.
4. Test quantity conservation and repeated recommendations without duplicated P&L.
5. Verify date-only source records cannot produce fabricated execution times or cancellation statuses.

### Task 7: Publish a minimal owner-only outcome report

**Create:** `tools/outcome_report.py`, `tools/test_outcome_report.py`.
**Create migration:** `C:/Users/campb/coach-ai-cloud-suite/supabase/migrations/20260927010000_stock_outcome_reports.sql` (proposed new filename; verify ordering and vacancy before implementation, never overwrite an applied migration).

1. Define `pc_outcome_reports` as a new additive table with immutable report identity, source cutoff, ledger revision, schema/methodology versions and bounded report sections.
2. Reuse the existing owner-membership security-definer check, after inspecting its exact current name and privileges. Do not query the unreadable allowlist directly from an invoker policy.
3. Grant browser SELECT only under the owner gate; retain service-role-only writes. No raw broker documents, account numbers or credentials in report payloads.
4. Publish summary plus a capped recent decision window. Declare window size, total known count and omitted history honestly; the complete ledger remains local. Do not ship an unbounded JSON ledger.
5. Read back the exact report; mark a new report usable only after validation. Older successful reports retain their actual source dates if refresh fails.

**Run locally:** `C:/Users/campb/anaconda3/python.exe -B -m unittest discover -s tools -p 'test_outcome_report.py' -v`.

**Live gate after approval:** Anonymous denied, signed-in non-owner receives no rows, temporary allowlisted owner receives exact report, browser writes denied. Revoke while loaded and prove data clears. Delete/read back the temporary account and grant. Never run the unsafe legacy `verify_digest_security.py`.

### Task 8: Add the Decisions view without changing the dashboard

**Create frontend:** `src/StockOutcomes.tsx`, `src/StockOutcomes.css`, `src/stockOutcomeData.ts`, `scripts/verifyStockOutcomes.js`.
**Modify narrowly:** `src/OwnerStocks.tsx`, `src/StockDashboard.tsx`, `package.json`, `scripts/verifyStockDashboardBrowser.mjs`.

1. Red tests for explicit no-import, incomplete, discrepancy, reconciled and empty-decision states.
2. Add secondary History views, preserving the existing snapshot view.
3. Lazy-load outcome details and reuse owner/session generation guards; never put ledger data in localStorage.
4. Add semantic return focus, keyboard operation, desktop/mobile reflow and exact currency/quantity labels.
5. Test revocation, stale responses, 401/403, timeout, retained-report staleness and account changes.

**Proposed new script:** `npm run verify:outcomes` invokes `node scripts/verifyStockOutcomes.js`.
**Existing full suite:** `npm run verify:dashboard:browser` with the established Puppeteer/Chrome environment.

**Release A gate:** All existing built-browser scenarios plus new cases pass. Real imported evidence is verified on the authenticated hosted site. No current dashboard financial figure changes.

### Task 9: Add the dollar bridge and supported return methods

**Create pipeline:** `tools/performance.py`, `tools/test_performance.py`.
**Modify:** `tools/outcome_report.py`, `tools/test_outcome_report.py`.

1. Red test: adding money in a flat market creates no investment profit.
2. Red tests for withdrawal timing, income, fees, internal transfers, missing valuations and unknown opening basis.
3. Implement the reconciled equity/flow bridge first.
4. Implement money-weighted returns only with explicit solution guards and an independently verified oracle.
5. Implement TWR only where required valuation evidence exists; otherwise publish unavailable with the exact reason.
6. Test actual-cash dividends and adjusted total-return series cannot be counted twice.

**Run:** `C:/Users/campb/anaconda3/python.exe -B -m unittest discover -s tools -p 'test_performance.py' -v`.

**Illustrative proposed regression contract, synthetic values only:**

```python
from decimal import Decimal
import unittest
from performance import net_investment_result

class InvestmentResultTests(unittest.TestCase):
    def test_deposit_is_not_profit(self):
        self.assertEqual(
            net_investment_result(
                opening=Decimal('10000.00'),
                closing=Decimal('11000.00'),
                net_external_flows=Decimal('1000.00'),
            ),
            Decimal('0.00'),
        )
```

This is a future test/API contract, not implemented code or a claim that the project test has run. Its arithmetic was checked during planning with Decimal.

### Task 10: Add the preselected comparison and execution analysis

**Modify:** `tools/performance.py`, `tools/test_performance.py`, `tools/outcome_report.py`.

1. Record the owner-approved benchmark, return convention, currency, costs and policy version before results are viewed.
2. Red tests for matching external flows, holidays, missing prices and mismatched currency/period.
3. Implement comparable account/benchmark results with an explicit hypothetical label.
4. Report execution differences only when source timestamps and price references permit them.
5. Keep price movement, currency movement and FX conversion cost distinct; do not attribute an unexplained residual to a convenient cause.

**Synthetic quantity test:** fills of 0.4 units at 100.00 and 0.6 at 101.00 yield 1.0 unit at a weighted price of 100.60 before costs. These fixture values were checked with Decimal, not taken from the real account.

### Task 11: Add the Performance view

**Modify:** `src/StockOutcomes.tsx`, `src/StockOutcomes.css`, `src/stockOutcomeData.ts`, `scripts/verifyStockOutcomes.js`, browser fixtures.

1. Test source-period/status display before metrics.
2. Render the bridge, separate return methods and comparison methodology.
3. Preserve zero versus missing and currency/period precision.
4. Allow charts only on deliberate entry, with an exact-value table and honest gaps.
5. Verify against the published report and independently calculated fixtures.

**Release B gate:** A matching broker period is reconciled and its account result is traceable; unavailable methods remain unavailable. Broker-reported realized gain is not labelled tax liability.

### Task 12: Extend existing model research, not a parallel engine

**Modify:** `tools/factor_ic.py`, `tools/quant_report.py`.
**Create:** `tools/test_factor_outcomes.py`.

1. Red tests reject future information, mismatched model/cohort stamps and immature endpoints.
2. Replace calendar-age claims with explicit trading-session/coverage checks for new evaluation outputs.
3. Evaluate frozen cohorts and all eligible decision episodes, not only surviving/current holdings.
4. Account for missing outcomes and repeated/correlated samples; label exploratory results.
5. Report results through the existing Model surface without changing scores, weights or tickets.

**Run:** `C:/Users/campb/anaconda3/python.exe -B -m unittest discover -s tools -p 'test_factor_outcomes.py' -v`.

**Release C gate:** Reproducible forward reports or correct collecting states. No minimum-history shortcut and no automatic weight update.

### Task 13: Integrate operations and restore proof

**Modify only as required:** `C:/Users/campb/stock-desk/run_playbook.bat`, `schedule.py`, `run_logged.py`; existing wrappers should be reused.

1. Snapshot/restore the SQLite database through its backup mechanism, not a casual copy during a write.
2. Test crash during import, overlapping task runs, locked database, duplicate retry and publisher outage.
3. Keep ledger/report failures visible but isolate them from unrelated scoring and publishing.
4. Record last broker-data date separately from last report run. No claim of a broker sync when only calculations reran.
5. Verify the exact changed Scheduled Task, its interpreter and next run. Do not reinstall unrelated tasks and erase their run history.

Avoid a new always-running service. Begin with explicit import plus existing daily/weekly jobs. Broker-download automation can be considered separately only when a supported read-only integration is verified.

### Task 14: Review, deploy and prove the hosted result

1. Independent financial/specification review, then independent code/security review, per release slice.
2. Run all affected offline tests plus existing insight, ticket, dashboard, owner-session/lifecycle, Changes and History regressions.
3. Confirm the default TypeScript baseline separately; do not hide new errors under the five previously recorded unused declarations in unchanged `src/App.tsx`.
4. Verify migration scope with `supabase db push --linked --dry-run`; apply only after release approval. Never edit an applied migration.
5. Deploy an additive frontend that handles absent/incomplete outcome data safely. Keep heavy reads deliberate.
6. Build real production configuration, stage only intended source/tests/docs, commit/push, and verify the exact GitHub Pages `main:/docs` commit and hosted hashes.
7. Verify actual owner-visible broker-period values, keyboard/focus, mobile/short/enlarged-text views, and unchanged default dashboard.
8. Complete the anonymous/non-owner/owner/revocation matrix and read back all temporary-access cleanup.
9. Preserve a durable release report with evidence locations and remaining data limitations. Private payloads/screenshots never enter public artifacts.

## 8. Overall acceptance criteria

The first release is not complete until all of these hold:

- Every new published decision can be reproduced from the exact frozen source record.
- Same-day revisions and retries do not erase or duplicate recommendations.
- Reimport/overlap cannot change economics by duplication or erase a legitimate repeated fill.
- At least one independently evidenced broker period reconciles quantity and currency cash. Other periods may remain explicitly incomplete or discrepant; those states do not satisfy this release gate and never receive a green verification label.
- No recommendation, review click or manual note is presented as broker-confirmed execution without evidence.
- Deposits/withdrawals are distinguished from investment profit. Unsupported return methods remain unavailable.
- Every published result carries its evidence period, method, source cutoff and completeness.
- Existing order decisions, funding math, holdings and default KPIs remain unchanged.
- Private reports remain owner-only, stale auth responses cannot restore data, and access-verification accounts are removed.
- The actual deployed page passes the existing desktop capacity and mobile reflow constraints.
- A restore exercise reproduces the same economic ledger and report from preserved evidence.

## 9. Risks and deliberate exclusions

### Risks

- Export formats or available fields may differ across document types. Inspect first; fail explicitly on drift.
- Broker records can be corrected/backdated. Preserve arrival time and versions, not just effective date.
- Missing opening evidence, distributions or corporate actions can invalidate returns. Narrow the supported period rather than inventing them.
- FX, settlement and CDR mapping can create false gains. Reconcile native units before reporting CAD aggregates.
- Recent evidence may represent one market regime. Show uncertainty and concentration; do not label a short profitable sample validated.
- Local-only private evidence needs durable backup and recovery. Existing scratch artifacts are not a backup strategy.
- New metadata/reporting must not introduce a dependency that stops the current desk from publishing.

### Not in this project phase

- Automatic order placement, broker-session scraping, or stored broker passwords.
- Self-modifying model weights or automatic experiment promotion.
- Tax-lot/adjusted-cost-base filing calculations, contribution-room calculations, or tax advice.
- Multi-broker, multi-user SaaS infrastructure.
- Options/crypto/margin accounting unless required by the actual chosen account; encountering it blocks completeness rather than producing guesses.
- A paid point-in-time vendor without a separate data/cost decision.
- A new chat workspace, new primary navigation, or more permanent dashboard charts.
- Unrelated contribution-accounting or exit-rule patches from prior work.

## 10. Inputs needed and recommended starting slice

No clarification is needed to save or understand this plan. Before implementing the broker importer, obtain the selected account's real sample exports and matching balance evidence. Confirm the account boundary and the earliest fully supportable start date. Before benchmark comparison, choose the comparator and methodology explicitly.

Start with Tasks 1-6: the source contract, safe importer/reconciliation, immutable decision capture, PIT provenance and execution linking. Start recording new decisions as soon as its slice is independently approved so useful history begins accumulating while older broker records are reconciled.

Then ship a minimal read-only owner view. Do not delay that useful foundation until long-horizon investment evidence matures, and do not claim the evidence matured merely because the software shipped.

## 11. Primary references checked during planning

S1. Wealthsimple Help Centre, "Request a custom statement", updated September 20, 2026. Relevant sections: holdings report, realized gain/loss report, custom activity statement and its cash-balance limitation.

S2. CFA Institute / GIPS, "GIPS Standards Handbook for Firms", calculation-methodology sections defining time-weighted and money-weighted returns. Used as methodological context, not a compliance claim.

S3. Bank of Canada, "Background information on foreign exchange rates", disclaimers and data-source sections: rates are indicative rather than evidence of a broker transaction.

S4. CFA Institute / GIPS, "GIPS Standards Handbook for Asset Owners", benchmark comparison provisions: align return type, currency and period. The personal desk is not represented as a GIPS-compliant reporting firm.

S5. CFA Institute, 2026 "Backtesting & Simulation" refresher reading: walk-forward evaluation, look-ahead bias, survivorship bias and limitations of a historical sample.

Local grounding: the inspected source files named in Section 2, the source/header-only holdings/PIT inspection, and `.hermes/context-depth-release.md`. No financial publisher, model evaluation, broker import, migration, or release command was executed during planning.

## 12. Consolidated discussion findings and implementation traceability

This section incorporates all findings and recommendations from the detailed explanation accompanying this plan. It is the coverage checklist for implementation, not a claim that these features exist. Repository observations are the planning-time findings in Section 2; recheck them before starting work rather than treating them as permanent live-state assertions. External source findings refer to S1-S5 above and must be rechecked if an integration or methodology depends on a changed provider contract.

| Finding or recommendation | Required plan response | Implementation and acceptance |
|---|---|---|
| The next major improvement is proving the desk's value, not adding more presentation or candidates. | Connect original recommendations, broker-confirmed events, reconciled account results and forward model evidence. Keep these distinct rather than combining them into an opaque success score. | Releases A-C; Sections 1, 5.6-5.8. A profitable account or recommendation alone is not proof the model added value. |
| The current holdings/cash record and dated trade notes are not a normalized transaction history. | Add a broker-import ledger in shadow mode; retain original evidence, corrections and the chosen account boundary. Do not overwrite existing holdings, averages, cash or broker-reference values. | Tasks 1-3. Identical/overlapping imports cannot duplicate economics or erase legitimate repeated transactions. |
| Existing reconciliation investigates quote-versus-broker valuation differences, rather than replaying transactions. | Reconcile quantities and currency cash against independently supplied opening/closing evidence. Separate accounting differences from valuation timing and quote differences. | Task 3. At least one real period must reconcile before Release A is complete. Every unresolved difference remains visible. |
| Daily publication can be revised, so its latest version is not necessarily the original recommendation. | Preserve immutable same-day revisions, exact order alternatives, model/cohort metadata, source dates, original reasons and successful publication receipts. | Task 4. Failed publication stays unpublished; publication does not prove the user viewed or executed a recommendation. Only the selected mutually exclusive buy alternative counts. |
| PIT infrastructure exists, but the inspected daily archive has only the September 25 capture and lacks important versioning metadata. | Start durable decision/PIT collection early. Preserve capture versions, source vintage, model identity and cohort identity without fabricating metadata for legacy rows. | Tasks 4-5 and 12. New captures must not destroy old evidence; early research remains collecting or exploratory. |
| Broker document imports are a practical first integration, but an activity export alone is insufficient for cash reconciliation. | Inspect real Wealthsimple export shapes; combine activity, holdings and matching statement/balance evidence. Keep optional broker realized-gain reports separate from tax calculations. No assumed live API or invented CSV schema. | Tasks 1-3; source S1. Missing opening records narrow the supportable period rather than producing invented since-inception results. |
| Import correctness is more important than an optimistic success message. | Handle duplicates, overlapping files, fractional quantities, income, fees, transfers, settlement and corrections. Unsupported events or ambiguous instrument identities make the affected scope incomplete. | Tasks 2-3. Preview before acceptance; atomic rollback on failure; preserve source precision and legitimate identical-looking fills. |
| Reviewing, intending, submitting and executing a trade are different facts. | Preserve separate user-intent and execution-evidence states. Link one proposal to multiple fills where justified; quarantine ambiguous matches and conserve matched quantities. | Task 6. A review click creates no transaction, one fill cannot be counted repeatedly, and date-only evidence cannot invent order timing or cancellation status. |
| Account growth can reflect external funding rather than investment profit. | Present the reconciled opening-equity/external-flow/investment-result/closing-equity bridge first. Distinguish money-weighted, time-weighted, broker-reported realized and decision forward returns. | Tasks 9 and 11; source S2. The synthetic flat-market deposit regression must produce zero investment profit. Preserve the existing dashboard KPI and its label. |
| A return method is only valid when its required evidence exists. | Require supported cash-flow dates, valuations and measurement boundaries. Guard ambiguous IRR solutions, missing basis and dividend double counting. Do not annualize a short sample into a promotional claim. | Task 9. Unsupported methods say unavailable and explain why; incomplete valuations cannot produce a purported exact TWR. |
| Execution costs and currency conversion can affect results, but indicative FX is not a broker fill. | Retain native-currency debits/credits and actual conversion evidence. Keep income, fees, price changes and currency effects distinct; label unresolvable attribution instead of inventing it. | Tasks 3 and 10; source S3. Internal currency transfers are not external contributions, missing charges are not zero, and CAD CDRs are not their USD underlyings. |
| A positive return alone does not establish improvement over a simpler alternative. | Select a benchmark policy before viewing results. Match period, currency and return method; model equivalent external flows where relevant and label the comparison hypothetical. | Task 10; source S4. Disclose concentration, cash exposure, risk and turnover. A benchmark gap is not automatically risk-adjusted alpha. |
| Recommendation quality and execution quality must be assessed separately. | Distinguish actual account results, linked broker executions, all eligible frozen recommendations and full-cohort model research. Report execution differences only when the source supports them. | Tasks 6, 9-12. Do not credit the desk for unrelated trades or silently omit skipped/losing recommendations. |
| Forward evaluation must avoid future information, survivor selection and repeated-sample inflation. | Extend the existing PIT/factor tools with declared trading-session horizons, frozen cohorts, maturity/coverage checks, independent date groups and predeclared experiments. Retain failed experiments and use later observations for confirmation. | Task 12; source S5. No calendar-day shortcut, cherry-picked winners, fabricated delisting returns, automatic reweighting or automatic experiment promotion. |
| More detail must not undo the calm, usable default dashboard. | Keep Dashboard/Research/History as the primary navigation. Add Snapshots/Decisions/Performance within History; use Research > Model for the shared evaluation report. Keep new charts and heavy data behind deliberate entry. | Tasks 8 and 11. Preserve the three regions, four KPIs, exact ticket semantics, desktop capacity and natural mobile reflow. Attention warnings carry actual broker-data dates. |
| The existing stack is sufficient for the first release. | Use Python, SQLite and Decimal locally; publish only bounded validated owner-only reports. Keep raw imports in durable private storage outside Git, public artifacts, the Obsidian vault and scratch. | Tasks 2, 7 and 13. No new paid feed, always-running service, broker-password dependency or LLM financial calculator. Verify permissions and restore behavior rather than assuming them. |
| A successful upload/build is not end-to-end verification. | Retain independent specification and code/security reviews, offline financial fixtures, existing browser regressions, exact deployed artifact checks and real authenticated UI verification. | Task 14. Exercise anonymous/non-owner/owner/revocation behavior, stale-response clearing and browser write denial; delete and read back temporary verification access. |
| Software delivery and investment evidence maturity are different milestones. | Ship records/reconciliation first, account and execution outcomes second, matured model evaluation third. Collect new evidence while broker records are being prepared. | Releases A-C. A collecting state can be correct after software completion; no claimed investment edge merely because the feature shipped. |

### Questions the completed system should answer

- Did the selected stocks do well, but fees or conversion costs reduce the benefit?
- Did the account profit while lagging the preselected simpler alternative?
- Did a strong result depend primarily on one sector, concentrated exposure or a favorable period?
- Did the proposed order and the confirmed execution differ in supported quantity, price or timing?
- Is there enough independent, mature evidence to say anything useful about the model?

These are proposed analytical questions, not findings about the owner's actual performance. Answers require the imported evidence and methods above; do not turn illustrative possibilities into live portfolio claims.

### Dependency and scope checklist

- **Can start after implementation approval without broker exports:** immutable decision capture, PIT versioning/provenance, their offline tests, and explicit unavailable/collecting UI states. Do not substitute a synthetic account report for missing real data.
- **Requires real local broker evidence:** export parser mapping, opening baseline, accepted ledger events, actual reconciliation, execution linking and account results. The first input is an activity sample plus matching holdings/balance evidence, not a password.
- **Requires an explicit policy decision:** exact account boundary, earliest defensible measurement date and benchmark methodology. These decisions must be recorded before the dependent results are presented.
- **Requires elapsed market time:** newly recorded forward outcomes. Calendar time or successful scheduled runs cannot replace completed trading-session horizons.
- **Remains excluded:** automatic trading, broker-session scraping, self-changing model weights, tax accounting, a new chat workspace, extra primary navigation and another dashboard redesign.
- **Plan-update boundary:** all discussion findings are now documented; no importer, ledger, model change, migration, scheduled task, deployment or trade was performed by this update.
