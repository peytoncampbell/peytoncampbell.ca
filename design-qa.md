# Portfolio refinement — design and behavior QA

final result: passed

Reviewed October 12, 2026 (America/New_York). The goal was to sharpen Peyton's existing portfolio using Luke Blommesteyn's site as a visual reference. This is an adaptation of its hierarchy and personal emphasis, rather than a pixel-for-pixel copy of Luke's site.

## Visual evidence

- Reference site: https://www.lukeblom.fyi/
- Before: `C:/Users/campb/output/portfolio-refinement/02-peyton-before.png`
- Source visual target: `C:/Users/campb/output/portfolio-refinement/03-design-target.png` (one grounded concept generated with the built-in Image Gen tool using screenshots of both existing sites).
- Production implementation: http://127.0.0.1:4173/
- Desktop implementation screenshot: `C:/Users/campb/output/portfolio-refinement/14-production-desktop-final.png`
- Final full-view comparison: `C:/Users/campb/output/portfolio-refinement/15-production-design-comparison.png`
- Focused typography comparison: `C:/Users/campb/output/portfolio-refinement/10-comparison-typography.png`
- Accepted phone screenshot: `C:/Users/campb/output/portfolio-refinement/12-production-mobile-390.png`

The desktop state is the top of the signed-out portfolio, dark theme, with the Tools menu closed and three selected projects visible. The requested CSS viewport was 1905 × 904. Source pixels are 1821 × 864; returned desktop capture pixels are 1890 × 897. For paired comparison, both were normalized to 1905 × 904 and placed together in one image. Original captures remain unmodified. The phone CSS viewport was 390 × 844; the browser returned 375 × 812 pixels. Its screenshot was inspected at its returned size.

## Findings and comparison history

1. Initial desktop review: the first serif choice was too narrow compared with the target, and the third project link was too close to the viewport boundary. Replaced Instrument Serif with DM Serif Display and tightened the hero/section spacing. Compared the revised implementation against the source again in a combined full-view image and a focused typography image.
2. Initial phone review: the old mobile rule hid the brand name after the PC badge was removed. Explicitly restored the name and sized the two hero actions to fit phone widths. Rejected captures taken at the wrong scroll position or the wrong viewport. The accepted production phone capture shows the name, full introduction, actions, photograph, and the beginning of selected work.
3. Final production review: no remaining actionable P0/P1/P2 visual findings. All three desktop summaries and their case-study actions are readable. Phone content reflows into one column without horizontal overflow.

## Required visual surfaces

- **Fonts and typography:** DM Serif Display for portfolio display text and IBM Plex Sans for body/UI text. The earlier condensed display mismatch is resolved. Headlines, body paragraphs, project titles, navigation, and phone wrapping were inspected. Existing tool pages retain their original display tokens.
- **Spacing and layout rhythm:** the hero begins higher, navigation is shorter, and selected projects use simple column separators. The smaller portrait and technology line support the main introduction. Desktop actions and project links fit the inspected frame. Phone actions and project summaries reflow naturally.
- **Colors and tokens:** existing charcoal/navy surfaces, off-white text, and teal accent are retained. Hover/focus controls use the established accent. Typography and spacing carry the emphasis.
- **Image quality and assets:** the site uses the existing real portrait and sports photographs, not the generated portrait from the concept. Their crops and sharpness were inspected. Project summaries use the existing Lucide icon library. Existing detailed project routes retain their original visuals.
- **Copy and content:** the hero, experience, and basketball story use facts from Peyton's supplied resume. The concept's speculative game-film sentence was replaced with the verified Western analytics role. Project descriptions are concise summaries of existing project data. All five case-study destinations remain available through the project list. The email fallback points directly to the public professional email.

## Behavior and technical evidence

- `npx tsc --noEmit`: passed on the final source.
- `npm run build`: passed; production files and existing static project/owner entrypoints regenerated under `docs/`.
- `npm run verify:resume`, `npm run verify:site`, and `npm run verify:compact`: passed. The compact check examines historical source strings; actual rendered spacing was verified separately in the browser.
- `git diff --check`: passed after normalizing the source HTML whitespace.
- Desktop: Explore my work navigates to `#projects`; the scoreboard case study opens and Back to portfolio returns; See all projects reveals five projects; the Tools category selects Catan; Show selected work restores the initial list.
- Tools: desktop and phone menus expose Stocks, My Desk, Odds, Budget, and owner sign-in. The Odds link was clicked from the production portfolio and routed to the existing Odds board. This verifies navigation, not the board's full data lifecycle.
- Phone: navigation opens; Tools expands; Contact moves to `#contact` and closes navigation.
- Contact: an empty form produces the alert “Please fill in all fields.” No external message was sent. Successful Formspree delivery was not tested.
- Width checks: no horizontal document overflow at CSS widths 360 and 820. The 390-pixel phone layout was visually inspected; desktop was inspected at 1905.
- Final production browser error log: empty. Removed unused scroll-parallax plumbing that produced a layout warning during development. Historical errors emitted during intermediate hot-reload edits are not errors from the final production build.
- Temporary viewport override reset. Production preview tab kept open as the reviewable deliverable.

## Follow-up polish

No blocking items remain. Real approved screenshots of OES tools would add evidence to the existing case-study pages; their absence predates this refinement. Source-vs-concept copy differences are deliberate corrections to match the resume. Fonts, icon details, and the exact photograph crop are adapted to the existing production assets.

This report records local verification before deployment. No outreach messages or external form submissions were sent.
