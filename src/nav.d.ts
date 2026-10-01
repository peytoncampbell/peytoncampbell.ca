/**
 * Types for the shared cross-app nav bar (src/nav.js).
 *
 * nav.js is plain JS injected at runtime: it reads its configuration from window.PC_NAV
 * and exports nothing, so it needs both a global declaration and a module declaration.
 */

/** Configuration nav.js reads at load time. */
interface PcNavConfig {
  /** Which tool to highlight. Inferred from the URL when omitted. */
  app?: string;
  /** Path back to the site root. '/' for pages served from the root. */
  root?: string;
  /** Render in flow instead of as a sticky bar - for apps that own their page frame. */
  inline?: boolean;
  /** Paths where the nav should not render. The portfolio draws these links itself. */
  hideOn?: string;
}

interface Window {
  PC_NAV?: PcNavConfig;
}
