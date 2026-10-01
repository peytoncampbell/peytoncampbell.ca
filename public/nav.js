/**
 * nav.js — the shared cross-app switcher for peytoncampbell.ca
 *
 * ONE file, loaded by every app on the domain. Deliberately self-contained (it injects
 * its own styles) so there is no shared build step, no npm dependency, and no monorepo
 * between the portfolio site and the tools. Copy this file, do not fork it.
 *
 * WHY NOT JUST <a> TAGS IN EACH APP. Two apps with their own hand-written navbars drift
 * apart within a month - different labels, different order, one of them forgets the new
 * tool. A single source of truth means adding an app is a one-line change here.
 *
 * Usage, from any app at any depth:
 *
 *   <!-- plain script: attributes are readable -->
 *   <script src="/nav.js" data-app="budget" data-root="/"></script>
 *
 *   <!-- bundled by a build tool: set the global from the host page instead, because
 *        an imported module has no script tag of its own to read -->
 *   <script>window.PC_NAV = { app: 'budget', root: '..' };</script>
 *
 * `app` (or data-app) highlights the current tool and takes priority; if absent the tool
 * is inferred from the URL, so a host page that forgets it still highlights correctly.
 *
 * `root` (or data-root) is the path back to the site root, and it MUST be supplied:
 * nav.js cannot work it out itself, because it is bundled into /budget/assets/, so its
 * own src says /budget/ and its BASE_URL says /budget/ - both describe where THIS app
 * lives, not where the site lives. Guessing between the two is how you ship a Stocks
 * link pointing at /budget/stocks/. Defaults to "..", correct for a tool at /tool/.
 * `hideOn` (or data-hide-on) is a comma-separated list of paths where the nav should not
 * render. The portfolio already has its own navbar with these same links, so drawing a
 * second one on top of it is just noise; the app routes need it and the home page does
 * not.
 */
(function () {
  'use strict';

  var CONFIG = (typeof window !== 'undefined' && window.PC_NAV) || {};

  // `prefix` is the folder each tool is served from, appended to the site root.
  var LINKS = [
    { id: 'home', label: 'Home', prefix: '' },
    { id: 'stocks', label: 'Stocks', prefix: 'stocks' },
    { id: 'budget', label: 'Budget', prefix: 'budget' },
    { id: 'catan', label: 'Catan', prefix: 'catan' }
  ];

  function currentScript() {
    if (document.currentScript) return document.currentScript;
    var all = document.getElementsByTagName('script');
    for (var i = all.length - 1; i >= 0; i--) {
      if ((all[i].src || '').indexOf('nav.js') !== -1) return all[i];
    }
    return null;
  }

  /** Infer the active tool from the URL. data-app wins when present. */
  function detectFromPath() {
    // Trailing slashes are stripped first: /stocks and /stocks/ are the same route, and
    // matching only on "/stocks/" left /stocks highlighting Home instead.
    var path = (window.location.pathname || '/').toLowerCase().replace(/\/+$/, '');
    for (var i = LINKS.length - 1; i >= 0; i--) {
      if (!LINKS[i].prefix) continue;
      if (path === '/' + LINKS[i].prefix || path.indexOf('/' + LINKS[i].prefix + '/') !== -1) {
        return LINKS[i].id;
      }
    }
    return 'home';
  }

  var script = currentScript();
  var current = CONFIG.app || (script && script.getAttribute('data-app')) || detectFromPath();

  var hidden = String(
    CONFIG.hideOn || (script && script.getAttribute('data-hide-on')) || ''
  )
    .split(',')
    .map(function (entry) { return entry.trim(); })
    .filter(Boolean)
    .map(function (entry) { return entry.replace(/\/+$/, '') || '/'; });

  var here = (window.location.pathname || '/').replace(/\/+$/, '') || '/';
  var suppressed = hidden.indexOf(here) !== -1 || (hidden.indexOf('/') !== -1 && here === '/');

  // In-flow when embedded in an app that already provides a full-page chrome, so it
  // reads as part of the console rather than a second sticky bar stacked above it.
  var inline = CONFIG.inline === true || (script && script.hasAttribute('data-inline'));

  // ".." from /budget/ lands on the site root; from a root-served page it still
  // resolves correctly, so the default is safe for the common case.
  var ROOT = CONFIG.root || (script && script.getAttribute('data-root')) || '..';
  // Normalise so paths concatenate predictably.
  if (ROOT.charAt(ROOT.length - 1) !== '/') ROOT += '/';

  var CSS = [
    '.pc-nav{position:sticky;top:0;z-index:60;backdrop-filter:blur(14px);',
    '-webkit-backdrop-filter:blur(14px);background:rgba(8,12,22,.72);',
    'border-bottom:1px solid rgba(148,163,184,.16);',
    "font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}",
    // In-flow variant: no stickiness, no chrome - the host app owns the page frame.
    '.pc-nav--inline{position:static;background:transparent;border-bottom:0;',
    'backdrop-filter:none;-webkit-backdrop-filter:none}',
    '.pc-nav *{box-sizing:border-box}',
    '.pc-nav-inner{max-width:1180px;margin:0 auto;padding:10px 18px;display:flex;',
    'align-items:center;justify-content:space-between;gap:14px}',
    '.pc-brand{display:inline-flex;align-items:center;gap:10px;text-decoration:none;',
    'color:#e2e8f4;font-weight:650;letter-spacing:-.01em;font-size:15px}',
    '.pc-brand-mark{display:grid;place-items:center;width:30px;height:30px;border-radius:9px;',
    'background:linear-gradient(135deg,#3b82f6,#22d3ee);color:#06111f;font-weight:800;',
    'font-size:12px;letter-spacing:.02em}',
    '.pc-links{display:flex;align-items:center;gap:4px}',
    '.pc-links a{position:relative;text-decoration:none;color:#93a4bd;font-size:13.5px;',
    'font-weight:550;padding:7px 13px;border-radius:9px;transition:color .18s,background .18s}',
    '.pc-links a:hover{color:#e8eefb;background:rgba(148,163,184,.12)}',
    '.pc-links a[aria-current="page"]{color:#eaf2ff;background:rgba(59,130,246,.17)}',
    '.pc-links a[aria-current="page"]::after{content:"";position:absolute;left:13px;right:13px;',
    'bottom:2px;height:2px;border-radius:2px;background:linear-gradient(90deg,#3b82f6,#22d3ee)}',
    '.pc-toggle{display:none;background:none;border:1px solid rgba(148,163,184,.28);',
    'border-radius:9px;padding:6px 9px;cursor:pointer;color:#cbd6e8}',
    '.pc-toggle span{display:block;width:17px;height:2px;background:currentColor;border-radius:2px}',
    '.pc-toggle span+span{margin-top:4px}',
    '@media(max-width:720px){',
    '.pc-toggle{display:block}',
    '.pc-links{position:absolute;top:100%;left:0;right:0;flex-direction:column;align-items:stretch;',
    'gap:2px;padding:8px 14px 14px;background:rgba(8,12,22,.97);',
    'border-bottom:1px solid rgba(148,163,184,.16);display:none}',
    '.pc-links[data-open="true"]{display:flex}',
    '.pc-links a{padding:11px 12px;font-size:15px}',
    '.pc-links a[aria-current="page"]::after{display:none}',
    '}'
  ].join('');

  function build() {
    if (suppressed) return;
    if (document.querySelector('.pc-nav')) return; // idempotent: safe if included twice

    var style = document.createElement('style');
    style.setAttribute('data-pc-nav', '');
    style.textContent = CSS;
    document.head.appendChild(style);

    var nav = document.createElement('nav');
    nav.className = inline ? 'pc-nav pc-nav--inline' : 'pc-nav';
    nav.setAttribute('aria-label', 'Site sections');

    var inner = document.createElement('div');
    inner.className = 'pc-nav-inner';

    var brand = document.createElement('a');
    brand.className = 'pc-brand';
    brand.href = '/';
    brand.innerHTML = '<span class="pc-brand-mark">PC</span><span>Peyton Campbell</span>';
    inner.appendChild(brand);

    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'pc-toggle';
    toggle.setAttribute('aria-label', 'Toggle navigation');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.innerHTML = '<span></span><span></span><span></span>';
    inner.appendChild(toggle);

    var links = document.createElement('div');
    links.className = 'pc-links';
    links.setAttribute('data-open', 'false');

    LINKS.forEach(function (link) {
      var a = document.createElement('a');
      a.href = link.prefix ? ROOT + link.prefix + '/' : ROOT;
      a.textContent = link.label;
      // aria-current is the accessible way to say "you are here"; the CSS keys off it so
      // the visual state cannot drift from the semantic one.
      if (link.id === current) a.setAttribute('aria-current', 'page');
      links.appendChild(a);
    });
    inner.appendChild(links);

    toggle.addEventListener('click', function () {
      var open = links.getAttribute('data-open') === 'true';
      links.setAttribute('data-open', open ? 'false' : 'true');
      toggle.setAttribute('aria-expanded', open ? 'false' : 'true');
    });

    // Close the drawer after navigating on mobile.
    links.addEventListener('click', function (event) {
      if (event.target && event.target.tagName === 'A') {
        links.setAttribute('data-open', 'false');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });

    nav.appendChild(inner);

    if (inline) {
      // In flow before the app's own container. Prepending to <body> would put it at
      // the end of a full-page app that renders into a single root div, i.e. below
      // everything. body's first element child is the app root, so insert before that.
      var first = document.body.firstElementChild;
      if (first) document.body.insertBefore(nav, first);
      else document.body.appendChild(nav);
      return;
    }

    // Insert as the first body child so sticky positioning works without fighting
    // whatever layout the host app already has.
    if (document.body.firstChild) document.body.insertBefore(nav, document.body.firstChild);
    else document.body.appendChild(nav);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
