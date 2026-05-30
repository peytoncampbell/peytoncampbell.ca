import { ArrowLeft, Briefcase, FileText, Mail } from 'lucide-react';

type NotFoundProps = {
  onNavigateHome: () => void;
};

export default function NotFound({ onNavigateHome }: NotFoundProps) {
  return (
    <main className="not-found-page">
      <div className="site-container not-found-layout">
        <p className="hero-kicker">404 / Page not found</p>
        <h1>That route is off the board.</h1>
        <p>
          The page may have moved, but the useful paths are still close: selected work, resume, and contact.
        </p>
        <div className="not-found-actions">
          <button type="button" className="button-primary" onClick={onNavigateHome}>
            <ArrowLeft size={18} />
            Back home
          </button>
          <a href="/#projects" className="button-secondary">
            <Briefcase size={18} />
            Projects
          </a>
          <a href="/PeytonCampbellResume.pdf" className="button-secondary">
            <FileText size={18} />
            Resume
          </a>
          <a href="/#contact" className="button-secondary">
            <Mail size={18} />
            Contact
          </a>
        </div>
      </div>
    </main>
  );
}
