# peytoncampbell.ca

Personal portfolio site for Peyton Campbell, built with React, TypeScript, Vite, and Tailwind CSS.

The site highlights full-stack product work, experience, education, GitHub activity, contact links, and a downloadable resume. It also includes a standalone Catan Settlement Optimizer at `/catan/`, an interactive board analysis tool for ranking strong opening settlement spots.

## Local Development

```bash
npm install
npm run dev
```

The local dev server usually runs at `http://127.0.0.1:5174/` or the next available Vite port.

## Build

```bash
npm run build
```

The production output is written to `docs/` because GitHub Pages is configured to serve from `main` and `/docs`.

## Deployment

The repository is hosted at `peytoncampbell/peytoncampbell.ca` and publishes to:

- https://peytoncampbell.ca/
- https://peytoncampbell.ca/catan/
- https://peytoncampbell.ca/stock-analysis/

The custom domain is configured through the `CNAME` files in `public/` and `docs/`.

## Infrastructure

This is a static website hosted with GitHub Pages. The app is built with Vite, and the generated production files are committed to `docs/`. GitHub Pages serves that folder from the `main` branch.

Cloudflare manages the public DNS for `peytoncampbell.ca`. The domain routes traffic to the GitHub Pages site while Cloudflare handles DNS resolution, HTTPS, and edge-level routing for the custom domain. In practice:

- Source code lives in this GitHub repository.
- `npm run build` generates the static site into `docs/`.
- GitHub Pages serves the `docs/` folder.
- Cloudflare points `peytoncampbell.ca` at the GitHub Pages deployment.
- The `CNAME` files keep GitHub Pages attached to the custom domain.

## Odds

`/odds/` opens the captured-market browser, with book/sport/game filters and
market/player search. Coverage shows the original source times and remaining
inventory gaps. Edge board displays the existing published HTML board.

Market data comes from immutable gzip objects in the public Supabase
`odds-inventory` bucket. The client verifies hashes, game identity and selection
counts before displaying them. Prices and signed lines retain their original
decimal text. The Python producer and publisher live in the separate
`oddsjam-lite/site_inventory` package; no server credential belongs in this repo.

The captures are historical. PIN refresh updates the existing edge board;
the all-market inventory is published separately. Run `npm run
verify:odds-inventory` and `npm run verify:odds-refresh` before building changes
to these flows.
