type AnalyticsEvent = {
  name: string;
  props?: Record<string, string>;
};

declare global {
  interface Window {
    plausible?: (eventName: string, options?: { props?: Record<string, string> }) => void;
  }
}

export function trackEvent({ name, props }: AnalyticsEvent) {
  if (typeof window === 'undefined') return;

  window.plausible?.(name, props ? { props } : undefined);
  window.dispatchEvent(new CustomEvent('portfolio-analytics', { detail: { name, props } }));
}

export function trackPageView(path: string) {
  trackEvent({ name: 'Page view', props: { path } });
}
