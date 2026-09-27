# Stock desk context-depth release

Status: implementation and release verification complete.
Final verification: 2026-09-27T00:28:07Z (UTC).
Plan: `.hermes/plans/2026-09-26_142019-stock-desk-context-depth.md`.

## Delivered

- Contextual stock inspection and expanded analysis, with five published factors and honest missing/provenance states.
- Expanded, source-linked Evidence; snapshot-based Changes with historical stock identity and local-only review state.
- Deliberately loaded Price/Rating History, strict publication/listing/currency/time metadata, exact observation tables, and explicit partial/legacy limitations.
- Original three-region dashboard, four KPIs, simultaneous buy and sell/trim proposals, funding, Attention, candidates, brief and warnings retained.
- Corrected a real live capacity regression without shrinking type: the first `NO DATA` call now has enough column width. All 15 holdings, 10 buy proposals and 8 sell/trim proposals fit at 1280×720.
- No trades or execution inference. Contribution accounting and exit-counter changes remain outside this plan.

## Delivery identity and order

Frontend feature: `9578afa1f7d3e2db9b7793243f627d8d0be2633e`.
Frontend correction and final deployed HEAD: `a40f7643e2b15619c1ad0c4491c49e71b5bc8933`.
Migration repository: `248990c581c9413289c1584d9ad738b8075b6455`.
Applied migration: `20260926194701_playbook_insights.sql`.

The explicit lightweight frontend projection was deployed and verified before nullable storage and optional history publication. The final GitHub Pages build reported built for the exact final SHA; all 11 hosted HTML paths and all 4 generated JS/CSS artifacts matched committed bytes. A fresh linked Supabase dry-run reports no pending migration.

Final main JS: `/assets/index-BXThoi9t.js`, SHA256 `a026f55735f43de3f6b86a54e6aa811a4be5e28169b507c5dcb6c95585bffd1c`.
Final CSS: `/assets/index-CVusgXN2.css`, SHA256 `f6661a1ba85d9fc4bf2bfde9d725b0a516a628196cad2a83af600ca392ba8956`.

## Verification

- Independent integrated specification and code/security reviews passed. The additional capacity correction independently passed its source/security/visual review and focused 7/7 browser cases.
- The new capacity regression was demonstrated before the CSS correction: 6/7 structure cases passed, with five missing holdings in the desktop `NO DATA` case. After correction, structure 7/7 passed twice and the complete built-browser suite passed 50/50.
- Final authenticated live geometry passed at 1280×720, 1366×768, 1440×900, 1920×1080 and 390×844. Desktop has no page or primary-panel scroll; mobile uses natural document reflow.
- Actual KPI values, all selected buy amounts/types and all eight sell/trim quantities, native limits/currencies, actions and CAD proceeds matched published data.
- Final advanced live checks passed nine groups each for a CAD-listed history and a USD history. Checked factors, Evidence, source identity, exact observations, no eager heavy request, one primary navigation, actual Changes/historical detail and review persistence. No runtime errors or authorization-header leakage.
- All named narrow frontend verifiers passed again after deployment, including owner-data 15/15, owner-lifecycle 14/14 and History lifecycle 20/20. Resume, compact, ticker and site checks passed. Strict TypeScript with the explicit `--noUnusedLocals false` override passed.
- Default strict TypeScript is not clean: exactly five existing TS6133 diagnostics remain in unchanged `src/App.tsx` (ChevronRight, CONTACT_TRUST, fadeInUp, staggerContainer, useNearViewport). These are not introduced by this release.
- Controlled optional publication returned 30 price series. Exact API/cache readback and the original financial snapshot were verified again after cleanup. No financial snapshot field was changed by enrichment.

## Access and cleanup

Anonymous private reads were denied, including a probe using only the publishable apikey and no session Authorization header. Allowlisted temporary identity received the new insights column; that same identity received zero private rows after revocation. Private base columns and the owner allowlist remained forbidden to browser credentials; the public digest remained available.

A real loaded History view was kept open during grant revocation. Refresh cleared all private KPI/history/order content; reload stayed gated. A fresh anonymous browser reached the login route.

The exact temporary grant was deleted and read back absent. The temporary auth identity was deleted and read back HTTP404. Original allowlist equality was checked. Local token/state files and the explicit test browser profile are absent. No owner credentials were used.

## Data limitations, not unfinished features

- The existing plan lacks completeness provenance (`today.comparison_meta`), so plan Changes correctly reports unavailable rather than pretending it has a baseline or inferring removals. The complete weekly source correctly reports its first baseline.
- Legacy ratings without compatible score metadata cannot form a trustworthy rating trend.
- Price coverage varies by listing. Some CAD listings currently provide a single observed point; a checked USD listing provided 251 exact observations. Partial coverage is labelled; underlying prices are not substituted.

## Local scope and evidence

The frontend working tree is clean apart from intentionally untracked `.hermes/`. The migration repository is clean apart from the unrelated unsafe `verify_digest_security.py`, which was neither run nor staged.

Non-Git pipeline backups include:
- `C:/Users/campb/stock-desk/archive/stock-insights-2026-09-26/`
- `C:/Users/campb/stock-desk/archive/stock-insights-snapshot-binding-2026-09-26-c69277d9/`

Detailed private verification artifacts and screenshots remain outside public artifacts at `C:/Users/campb/AppData/Local/hermes/cache/scratch/stock-insights-release/`. Key receipts: `final-hosted-verification.json`, `final-live/verification.json`, `final-sale-values-verification.json`, `final-advanced-cad/verification.json`, `final-advanced-usd/verification.json`, `final-gates-verification.json`, and `final-post-cleanup-verification.json`. Scratch is temporary; this local release note preserves the delivery summary and fingerprints.

No release gate remains open.
