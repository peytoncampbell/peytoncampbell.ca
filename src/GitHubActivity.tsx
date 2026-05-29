import { ExternalLink, GitBranch, Github, ShieldCheck, Terminal } from 'lucide-react';

const SIGNALS = [
  {
    label: 'Product systems',
    value: 'React, Next.js, TypeScript',
    detail: 'Customer previews, admin editors, reusable components, and publishing workflows.',
    icon: GitBranch,
  },
  {
    label: 'Automation',
    value: 'Python tooling',
    detail: 'Provisioning, serial validation, firmware programming, and production traceability.',
    icon: Terminal,
  },
  {
    label: 'Reliability',
    value: 'Tests and release support',
    detail: 'Regression checks, diagnostics, live logging, and cross-platform debugging.',
    icon: ShieldCheck,
  },
];

export default function GitHubActivity() {
  return (
    <section className="site-section github-section" id="github">
      <div className="site-container">
        <div className="section-intro">
          <p className="section-eyebrow">GitHub</p>
          <h2 className="section-title">
            Shipping <span className="gradient-text">signal.</span>
          </h2>
          <p className="section-copy">
            A quick read on how consistently I ship across automation, product, and infrastructure work.
          </p>
        </div>

        <article className="github-card">
          <div className="github-card-header">
            <div>
              <h3>Engineering Signal</h3>
              <p>Work themes pulled into the site instead of depending on a third-party contribution image.</p>
            </div>
            <Github size={28} aria-hidden="true" />
          </div>
          <a href="https://github.com/peytoncampbell" target="_blank" rel="noopener noreferrer" className="button-secondary">
            <ExternalLink size={16} />
            View profile
          </a>
          <div className="github-signal-grid">
            {SIGNALS.map((signal) => (
              <div key={signal.label} className="github-signal">
                <signal.icon size={21} aria-hidden="true" />
                <span>{signal.label}</span>
                <strong>{signal.value}</strong>
                <p>{signal.detail}</p>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
