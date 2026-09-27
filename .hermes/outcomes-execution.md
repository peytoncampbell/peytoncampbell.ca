# Decision-to-outcome implementation checkpoint

Active user request: build out all findings from `.hermes/plans/2026-09-26_204810-stock-desk-decision-outcomes.md`.

Implementation is authorized; automated trading, broker login scraping, invented fills and model reweighting are not.

## Preflight

- Frontend main and fetched origin/main: a40f7643e2b15619c1ad0c4491c49e71b5bc8933. Only .hermes/ was untracked.
- Migration repo main and fetched origin/main: 248990c581c9413289c1584d9ad738b8075b6455. Unsafe unrelated verify_digest_security.py remains untracked; do not run or stage it.
- Pipeline is not Git-managed. Backups: C:/Users/campb/stock-desk/archive/decision-outcomes-2026-09-26-211658/. manifest.json contains hashes for backed-up source and unchanged financial input baselines.
- Interpreter: C:/Users/campb/anaconda3/python.exe (3.12.7), SQLite 3.45.3. Use -B; temporary tests under Hermes TMPDIR.
- Developer terminal uses bash; native commands take C:/ paths.

## Broker-data dependency and user steering

No clear broker export was identified among the inspected Downloads filenames or stock-desk activity filenames. User said they doubted Wealthsimple supports exports and asked to look it up, noting potential friction.

Official Help Centre search results confirm self-service web Activity > Download activities > period/account > Download CSV. Documents also supports monthly statement CSVs and bulk ZIP downloads. Holdings report CSV is current-date only; historical opening evidence should come from matching monthly statements/balance evidence, not a nonexistent arbitrary-date holdings export.

Explained this to the user and reduced initial input to one activity CSV; matching balance evidence can follow. User has not yet supplied an export. Do not fabricate a Wealthsimple parser schema, real import, reconciliation, benchmark choice or investment outcome. Core canonical ledger and synthetic tests can proceed; real broker gates stay pending.

The URL extraction tool failed because its configured backend is search-only. Native/public-page browser hit a Cloudflare check. Fallback official-domain web_search in execute_code succeeded and returned the concrete export workflows from Wealthsimple's own pages. Do not claim the user's signed-in broker screen was inspected.

## Contract

Producer/consumer schema and source/input constraints are pinned in C:/Users/campb/stock-desk/docs/outcomes-data-contract.md. It defines the bounded v1 pc_outcome_reports row/payload, native decimal values, decision execution states, unavailable performance, collecting model evidence, unchanged dashboard and private local storage.

## Current verification and delivery

Delayed notifications from deleg_4dcdf20b, deleg_5badd6da and deleg_f99fe518 are historical. They do not supersede the current corrections or authorize repeating implementation work.

- Parent's latest independent foundation run passed 70 tests in 9.815s: store 4, journal 21, PIT 25, performance 20. It includes both the user-approved journal namespace correction and the first PIT quality correction; all 14 reviewed file hashes were re-verified in the same pass. Earlier 66/65/60 results are historical. The last financial-input manifest check found all five inputs unchanged; no worker is authorized to edit them.
- Journal final SPEC found one additional namespace defect after the two corrections: uppercase/mixed-case SQLite names occupying a reserved journal namespace are treated as absent. Parent reproduced list returning [] and prepare raising generic OperationalError; bytes remained unchanged. All prior 24 tests, 53 schema variants and 112 actual-frontend parity cases still pass. This is recorded in journal-spec-final.json, not an old notification.
- Journal revision-3 SPEC PASSED: journal-spec-revision3.json binds the same two hashes parent verified. 25 journal/store tests with 340 namespace-operation checks, an independent 96-variant/480-check namespace probe, archived-source compatibility, 4 adversarial tests and 112 actual-frontend parity cases all pass. Only namespace-presence detection folds ASCII case; exact DDL stays strict. First QUALITY review is running (deleg_84b3eb46/sa-1-ad5feb8f). Backup: archive/decision-outcomes-2026-09-26-211658/revision-3-user-approved/. Still not an unlimited revision-loop waiver.
- PIT PIT-Q1 correction implemented and parent-verified: pit-quality-fix-handoff.json records exactly two changed source lines (explicit None clock default; aware-instant sort key in status) and four new tests with observed RED (rows/ladders/median 1,1,-1.0 instead of 2,2,0.75; all three falsey clocks intercepted) then GREEN (25 tests, 40 legacy parity, 8 adapted probes). Hashes: pit_recorder.py 3a628efe…, test_pit_recorder.py 5ad55ae7…. Fresh SPEC review is running (deleg_84b3eb46/sa-2-c74853c8); fresh QUALITY follows only after it passes. Backup: archive/decision-outcomes-2026-09-26-211658/pit-quality-1/. Task-13 items (concurrency, two-file transactions, power-loss, archive budget) remain explicitly deferred.
- Performance passed SPEC and QUALITY; all 38 SPEC and 80 quality probe entries were checked. Financial formulas are unchanged. Verdict: performance-quality-rereview.json.
- History integration SPEC and first QUALITY both PASS: ui-integration-quality-review.json binds all eight scoped/approved hashes and adds 3 independent probes (deadline cleanup across success/rejection/owner-change/unmount; HTML-shaped report text stays inert; superseded rejection cannot downgrade a successful retry) plus a decisive lazy-load mutation control (candidate 0 initial reads vs injected-defect 1, restores clean, repeated). 24 unique combined browser scenarios, strict TypeScript and whitespace checks pass. No frontend writer is active.
- Parent fetched the frontend and confirmed HEAD=origin/main=a40f7643, then produced a fresh production-mode Vite build with the downloaded Node20 toolchain into scratch/stock-outcomes-build/built-ui. Build passed; main assets index-CLV2JJSL.js and index-CCedO8nY.css. Source and output hashes are in built-ui-manifest.json. Committed docs is unchanged. Npm prebuild/postbuild were deliberately not invoked; this is not a deploy-ready Pages route-copy or hosted proof.
- The prior built-artifact browser worker died to the gpt-6-astra usage limit (HTTP 429, reset ~159 h) only after completing a fresh run of the FULL existing suite against built-ui: passed 50, failed 0, acceptance true (existing-suite-result.json), with product hashes unchanged. Its draft next-stage harness is new-main.txt. That unit was re-dispatched as deleg_84b3eb46/sa-0-e526f09e (rerun suite + new-view lazy-read/state/keyboard/reflow proof on the same artifact). Main session model is now deepseek-flash; children inherit it. The Sharp test-alignment child (deleg_dd631d87/sa-3-2bf4d2c2, old provider) is still running and may die the same way — its on-disk diff already shows exactly the three intended tests/scouting-export.test.js literals changed and a verify rerun in progress.
- Migration and isolated SQL verifier passed independent SPEC/QUALITY, parent 73/73 local PostgreSQL checks, Node syntax, npm scheduling smoke, staged whitespace and a complete 224-added-line security scan. The six exec matches are inspected PGlite SQL calls, not JavaScript evaluation. Proof: migration-precommit-verification.json.
- Migration code is committed and pushed as 1aefd0e656e4dfd965ae88c773be8b9972f61a3f in coach-ai-cloud-suite/main. Exact remote refs/heads/main was read back and matches. Only the migration and verifier were included. Unsafe verify_digest_security.py remains untracked and untouched.
- GitHub Verify run 36289420717 remains RED; no corrected commit has been pushed. The approved Sharp0.35.4 package/lock patch is implemented and its hashes verified. Handoff records real audit RED (one high) then GREEN (zero), Node20 native PNG/JPEG/WebP/AVIF roundtrips, scheduling/build/server checks and integrity-verified Linux x64/arm64 optional-package metadata. Linux native execution and remote CI are not yet proved.
- The isolated full verification stopped at three existing exact-version assertions still expecting Sharp0.35.3 in tests/scouting-export.test.js:153,158,159. Parent inspected those assertions and the actual failure. A new scoped worker may update ONLY those three literals to the user-approved 0.35.4, preserving exact checks and all behavior/security tests, then rerun focused export, aggregate verify and audit in the isolated Node20 tree. Package/lock files are now read-only. Independent reviews, separate commit/push and remote CI readback remain.
- Official GitHub advisory and Sharp release were retrieved through gh API after the generic extractor failed. The advisory identifies <0.35.4 as affected and 0.35.4/libheif 1.23.2 as fixed, with glibc Linux exposure under relevant untrusted-image conditions. The release links sharp-libvips v1.3.3. The worker must check Linux optional lockfile packages and Node20 compatibility, not only the local Windows binary. No audit bypass, decoding workaround or broad dependency upgrade is authorized.
- The database migration has not been applied by this session. No outcome report, real broker ledger, production capture or stock-desk UI release has been published.

Current exact ownership:
- deleg_84b3eb46 / sa-0-e526f09e: READ-ONLY built-artifact browser verification (suite rerun + new History views, states, keyboard, reflow on built-ui). Expected built-ui-browser-review.json.
- deleg_84b3eb46 / sa-1-ad5feb8f: READ-ONLY journal revision-3 QUALITY. Expected journal-quality-revision3.json.
- deleg_84b3eb46 / sa-2-c74853c8: READ-ONLY PIT post-fix SPEC. Expected pit-spec-postfix.json.
- deleg_dd631d87 / sa-3-2bf4d2c2: still running Sharp test alignment; owns only the three version literals in coach-ai-cloud-suite/tests/scouting-export.test.js. Expected sharp-test-alignment-handoff.json. Watch for a 429 failure; if it dies, verify its on-disk state before re-dispatching the remaining verify/audit evidence.

Completed: deleg_dd631d87 tasks 0–2 (journal SPEC pass, UI QUALITY pass, PIT fix) and deleg_888a00bf (partial: existing suite 50/50 vs built-ui, then 429). All reports and exact hashes were read and independently re-verified before advancing gates. No frontend writer remains. Delayed notifications from deleg_581c33ab and deleg_d12f0d93 are historical.

Revision-2 pipeline backup: archive/decision-outcomes-2026-09-26-211658/revision-2/tools/. Frontend baseline remains a40f7643e2b15619c1ad0c4491c49e71b5bc8933. A scratch build now exists; its browser verification and the eventual committed/hosted artifact are separate gates. Migration repo remains at 1aefd0e with scoped uncommitted dependency/test work.

Integration requirements: History-only Snapshots/Decisions/Performance; no outcomes request on Dashboard or Snapshots; bounded latest row; existing ownerFetch and opaque owner generation; render-time cache clearing; strict parser before ready; secondary denial/empty revalidates the authoritative private gate without assuming logout; 12-second deadline; late-response invalidation; explicit staleness on retained transient-failure data; browser race/keyboard/no-egress tests. Child has no docs-build, production-API, commit or push scope. Parent must run SPEC then QUALITY and release verification.

The 60/65/66-test results below are historical; 70 is the current parent baseline. Journal runs its first QUALITY after the revision-3 SPEC pass. PIT re-runs SPEC then QUALITY on the fixed hashes. Escalate unresolved repeated blockers rather than silently starting an unlimited revision loop.

## Previous verification checkpoint

Initial implementation batch deleg_1c58ae45 is historical. Its delayed completion notification does not supersede the defects found during subsequent independent reviews. Standalone UI batch deleg_432a2e2c and initial migration implementation are also finished; do not re-run their implementation work.

- Parent independently ran the revised foundation suite: `python -B -m unittest test_outcome_store test_decision_journal test_pit_recorder test_performance -v` from stock-desk/tools with the Anaconda interpreter and scratch TMPDIR. Actual result: 60 tests in 1.819s, OK. All eight source/test SHA-256 values matched the revision handoffs.
- Private store/journal: 4 store tests and 17 journal tests now pass. Corrections freeze the shipped frontend selection rule at preparation time, preserve alternatives and original indices, reject malformed/backdated timestamps and oversized cursors, and distinguish empty shared stores from incompatible journal state. Independent SPEC re-review is running; QUALITY must follow. Publication integration is not started.
- PIT: 19 revised tests now pass, retaining the original 14 tests. Corrections cover price-source currency, duplicate headers, strict/future source timestamps and numeric nonfinite strings. Independent SPEC re-review is running; QUALITY must follow. No production capture has run.
- Performance: 20 revised tests now pass. Only the shared timestamp helper changed to turn UTC range overflow into explicit unavailable metrics; financial formulas are unchanged. The fix handoff reports all 38 SPEC and 80 quality probes green. Fresh independent QUALITY re-review is running; the old performance-quality-review.json is a historical failed verdict, not the new approval. Check individual probe entries, not process exit alone.
- Standalone UI: original-prose/zero corrections passed parent parser/SSR/Chrome/strict-TypeScript checks and fresh independent SPEC re-review. QUALITY is now running. No component/CSS change was needed for the correction. Parent integration has not started.
- Migration: supabase/migrations/20260927015312_peyton_outcome_reports.sql and scripts/verifyOutcomeReportMigration.mjs passed SPEC and QUALITY. Parent ran 73 actual local PostgreSQL/WASM checks; reviewers also executed adversarial and permission-mutation tests. No production migration or commit/push yet. The table uses pc_is_owner(), authenticated owner-only SELECT, service SELECT/INSERT/DELETE without UPDATE. Live PostgREST and production access tests remain mandatory.
- Existing dashboard, owner-data, owner lifecycle, ticket, Changes and strict TypeScript baselines passed before integration. Built-browser baseline concerns the unchanged committed docs bundle only, not the new feature. The new UI remains untracked and unintegrated.

Durable review/handoff directory: C:/Users/campb/AppData/Local/hermes/cache/scratch/stock-outcomes-build/. Read actual JSON verdicts, then run relevant checks; do not treat summaries as approval or public release proof.

## Historical delegation record

Correction/review batches deleg_581c33ab and deleg_d12f0d93 have finished; their JSON handoffs were read and source hashes verified. Any delayed notifications from these batches or the initial standalone UI batch are historical, not permission to undo or repeat newer corrections.

Completed batch deleg_f99fe518, all READ-ONLY:
- sa-0-96cae166: journal/store SPEC re-review; journal-spec-rereview.json.
- sa-1-124e0753: PIT SPEC re-review; pit-spec-rereview.json.
- sa-2-82aca09d: performance QUALITY re-review; performance-quality-rereview.json.
- sa-3-e7493c14: standalone UI QUALITY; ui-quality-review.json.

Current ownership is listed above. Journal, frontend integration and migration-repo package files are read-only. PIT and the migration-repo's three test expectations each have one assigned writer. No integration may bypass the applicable review gates.

Journal/PIT before-fix source is backed up in archive/decision-outcomes-2026-09-26-211658/revision-1/. All tests use temporary scratch paths. No worker may initialize production stores, capture real inputs, call broker/publisher APIs, commit or push.

Revision gate: independent SPEC must pass before fresh QUALITY. A failed review returns only its concrete defects for correction. Parent must run real checks after handoff. Do not poll child transcripts/artifacts while waiting; finish independent work, then end the turn for delivery. After completion, re-check ownership and file hashes before editing.

## Integration seams inspected, not changed

- tools/playbook.py:989-1009 currently posts the primary dict directly; it has no decision journal or primary exact-readback hook. Preserve its financial values and primary publication behavior. The optional insights refresh is separate at 1010-1018 and must remain best-effort. A journal prepare failure must be visible without breaking primary publication, and no receipt may be recorded from HTTP status alone.
- Frontend OwnerStocks.tsx has existing generation-based owner guards and lightweight primary playbook reads. New outcomes belong only under History: Snapshots / Decisions / Performance; no primary navigation or default-dashboard change. Standalone SPEC and QUALITY are prerequisites for integration.

## Not yet done / external gates

- Real Wealthsimple adapter, owner account boundary, opening/closing evidence, actual reconciliation and selected benchmark policy.
- Canonical broker ledger, explicit evidence links and conserved fill quantities; no synthetic source may become broker-confirmed.
- Remaining journal/PIT reviews, UI integration QUALITY/built/hosted proof, and publication hooks.
- Bounded report producer, forward factor/session evaluation and automation/restore wiring.
- Production migration, live access/revocation matrix, publish, frontend commit/push, hosted verification and temporary-access cleanup. Migration-source commit/push is complete, but its GitHub audit gate is red as recorded above.

Only migration source and its offline verifier have been pushed. No stock-desk outcome publication or UI release has been performed. Do not mark the plan complete until each acceptance criterion is verified; unavailable broker evidence and future market sessions remain explicit external blockers, not gates satisfied by synthetic tests.
