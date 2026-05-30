import { useState } from 'react';
import { ARCHITECTURE_VIEWS } from './data';
import { trackEvent } from './analytics';

export default function ArchitectureDiagram() {
  const [activeId, setActiveId] = useState(ARCHITECTURE_VIEWS[0].id);
  const active = ARCHITECTURE_VIEWS.find((view) => view.id === activeId) ?? ARCHITECTURE_VIEWS[0];

  return (
    <section className="site-section architecture-section" id="architecture">
      <div className="site-container">
        <div className="section-intro">
          <p className="section-eyebrow">Architecture</p>
          <h2 className="section-title">
            How the <span className="gradient-text">systems connect.</span>
          </h2>
          <p className="section-copy">
            A quick systems view of the product, mobile, hardware, and operations surfaces behind the work.
          </p>
        </div>

        <div className="architecture-layout">
          <div className="architecture-tabs" role="tablist" aria-label="Architecture views">
            {ARCHITECTURE_VIEWS.map((view) => (
              <button
                key={view.id}
                type="button"
                role="tab"
                aria-selected={activeId === view.id}
                className={activeId === view.id ? 'active' : ''}
                onClick={() => {
                  setActiveId(view.id);
                  trackEvent({ name: 'Architecture view selected', props: { view: view.id } });
                }}
              >
                {view.label}
              </button>
            ))}
          </div>

          <div className="architecture-canvas">
            <div className="architecture-summary">
              <h3>{active.label}</h3>
              <p>{active.summary}</p>
            </div>
            <div className="architecture-nodes">
              {active.nodes.map((node, index) => (
                <div key={node} className="architecture-node">
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>{node}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
