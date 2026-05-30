import { ArrowLeft, ExternalLink, Mail } from 'lucide-react';
import ProjectVisual from './ProjectVisual';
import { PROJECTS } from './data';
import { trackEvent } from './analytics';

type ProjectDetailProps = {
  slug: string;
  onNavigateHome: () => void;
};

export default function ProjectDetail({ slug, onNavigateHome }: ProjectDetailProps) {
  const project = PROJECTS.find((item) => item.slug === slug);

  if (!project) return null;

  return (
    <main className="detail-page">
      <nav className="detail-nav site-container">
        <button type="button" className="button-secondary" onClick={onNavigateHome}>
          <ArrowLeft size={18} />
          Back to portfolio
        </button>
        <a href="/#contact" className="button-primary" onClick={() => trackEvent({ name: 'Detail contact click', props: { project: project.slug } })}>
          <Mail size={18} />
          Talk about this work
        </a>
      </nav>

      <header className="detail-hero">
        <div className="site-container detail-hero-grid">
          <div>
            <p className="hero-kicker">{project.category} / {project.role}</p>
            <h1>{project.title}</h1>
            <p>{project.description}</p>
            <div className="tag-row">
              {project.tech.map((tech) => (
                <span key={tech}>{tech}</span>
              ))}
            </div>
            {project.cta?.url && (
              <a
                href={project.cta.url}
                target="_blank"
                rel="noopener noreferrer"
                className="button-secondary"
                onClick={() => trackEvent({ name: 'Project external click', props: { project: project.slug } })}
              >
                {project.cta.label}
                <ExternalLink size={16} />
              </a>
            )}
          </div>
          <ProjectVisual type={project.visual} title={project.title} />
        </div>
      </header>

      {project.caseStudy && (
        <section className="site-section">
          <div className="site-container detail-grid">
            <article>
              <span>Problem</span>
              <h2>What needed to change</h2>
              <p>{project.caseStudy.problem}</p>
            </article>
            <article>
              <span>Approach</span>
              <h2>How I shaped it</h2>
              <p>{project.caseStudy.approach}</p>
            </article>
            <article>
              <span>Outcome</span>
              <h2>Why it mattered</h2>
              <p>{project.caseStudy.outcome}</p>
            </article>
          </div>
        </section>
      )}

      <section className="site-section surface-band">
        <div className="site-container detail-grid wide">
          <article>
            <h2>Technical decisions</h2>
            <ul>
              {project.caseStudy?.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
              {project.metrics?.slice(0, 3).map((metric) => (
                <li key={metric}>{metric}</li>
              ))}
            </ul>
          </article>
          <article>
            <h2>What I would improve next</h2>
            <ul>
              <li>Add deeper usage analytics around the highest-friction workflow steps.</li>
              <li>Create more visual regression coverage around edge-case layouts and states.</li>
              <li>Document operator-facing failure states so support and engineering share the same language.</li>
            </ul>
          </article>
        </div>
      </section>
    </main>
  );
}
