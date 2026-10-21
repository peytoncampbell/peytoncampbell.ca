import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  ArrowUp,
  CalendarClock,
  ChevronDown,
  CircuitBoard,
  Download,
  ExternalLink,
  Github,
  Linkedin,
  Mail,
  Menu,
  ShieldCheck,
  Sparkles,
  SlidersHorizontal,
  Smartphone,
  Terminal,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import { CONTACT_TRUST, EXPERIENCE, HERO, HIGHLIGHTS, NAV_LINKS, PROJECTS, TECH_STACK, TOOL_LINKS } from './data';
import ScrollProgress from './ScrollProgress';
import ArchitectureDiagram from './ArchitectureDiagram';
import OwnerLogin from './OwnerLogin';
import OwnerStocks from './OwnerStocks';
import ReaderDesk from './ReaderDesk';
import Odds from './Odds';
import NotFound from './NotFound';
import ProjectDetail from './ProjectDetail';
import { trackEvent, trackPageView } from './analytics';

const Certifications = lazy(() => import('./Certifications'));
const GitHubActivity = lazy(() => import('./GitHubActivity'));

function SectionShell({
  id,
  eyebrow,
  title,
  copy,
  children,
  className = '',
}: {
  id?: string;
  eyebrow: string;
  title: React.ReactNode;
  copy?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={clsx('site-section', className)}>
      <div className="site-container">
        <div className="section-intro">
          {eyebrow && <p className="section-eyebrow">{eyebrow}</p>}
          <h2 className="section-title">{title}</h2>
          {copy && <p className="section-copy">{copy}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}

function SectionSkeleton({ className = '' }: { className?: string }) {
  return <div className={clsx('site-container py-16', className)}><div className="skeleton-panel" /></div>;
}

function TechIcon({ className = '' }: { className?: string }) {
  return <span className={clsx('tech-spark', className)} aria-hidden="true" />;
}

const categoryOrder = ['Languages', 'Frontend', 'Backend & Data', 'Infrastructure', 'Systems', 'Tools'];
const categoryTone: Record<string, string> = {
  Languages: 'blue',
  Frontend: 'cyan',
  'Backend & Data': 'violet',
  Infrastructure: 'teal',
  Systems: 'amber',
  Tools: 'slate',
};

const projectPresentation = {
  'scoreboard-configurator': { title: 'Scoreboard Configurator', icon: SlidersHorizontal, summary: 'React and Next.js product previews, admin layout editing, and JSON publishing workflows.' },
  scorecontroller: { title: 'ScoreController', icon: Smartphone, summary: '.NET MAUI scoreboard control across iOS, Android, Windows, and BLE-connected hardware.' },
  'provisioning-console': { title: 'Provisioning Operations', icon: Terminal, summary: 'Python tooling for IoT commissioning, guided validation, and persistent job history.' },
  'production-test-jig': { title: 'Production Test Jig', icon: CircuitBoard, summary: 'Serial validation, firmware programming, and cloud logging for embedded board manufacturing.' },
  'catan-settlement-optimizer': { title: 'Catan Settlement Optimizer', icon: SlidersHorizontal, summary: 'An interactive decision tool for settlement placement, probability, and resource scarcity.' },
};

const orderedProjects = ['scoreboard-configurator', 'scorecontroller', 'provisioning-console', 'production-test-jig', 'catan-settlement-optimizer']
  .map((slug) => PROJECTS.find((project) => project.slug === slug)!)
  .filter(Boolean);

function PortfolioTools({ onNavigate, onSelect }: { onNavigate: (path: string) => void; onSelect?: () => void }) {
  return (
    <details className="portfolio-tools" onKeyDown={(event) => {
      if (event.key === 'Escape') {
        event.currentTarget.open = false;
        event.currentTarget.querySelector('summary')?.focus();
      }
    }}>
      <summary>Tools <ChevronDown size={14} aria-hidden="true" /></summary>
      <div className="portfolio-tools-panel">
        <p>Things I use and build</p>
        {TOOL_LINKS.map((tool) => (
          <a key={tool.href} href={tool.href} onClick={(event) => {
            trackEvent({ name: 'Navigation click', props: { target: tool.label } });
            const menu = event.currentTarget.closest('details');
            if (menu) menu.open = false;
            onSelect?.();
            if (!tool.spa) return;
            event.preventDefault();
            onNavigate(tool.href);
          }}>
            {tool.label}<ArrowRight size={14} aria-hidden="true" />
          </a>
        ))}
        <a href="/login" onClick={(event) => {
          event.preventDefault();
          onSelect?.();
          onNavigate('/login');
        }}>Owner sign in<ArrowRight size={14} aria-hidden="true" /></a>
      </div>
    </details>
  );
}

/** GitHub Pages answers /login as a directory: /login and /login/ must be the same route. */
function normalizePath(path: string): string {
  return path.length > 1 ? path.replace(/\/+$/, '') || '/' : path;
}

export default function App() {
  const prefersReducedMotion = useReducedMotion();
  // GitHub Pages serves /login as a directory and 301s /login -> /login/, so the trailing slash
  // has to be normalised away or the route table below never matches.
  const [route, setRoute] = useState(() => normalizePath(window.location.pathname));
  const [scrolled, setScrolled] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [projectFilter, setProjectFilter] = useState('All');
  const [showAllProjects, setShowAllProjects] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' });
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactSuccess, setContactSuccess] = useState(false);
  const [contactLoading, setContactLoading] = useState(false);
  const [athleteImageIndex, setAthleteImageIndex] = useState(0);
  const cursorGlowRef = useRef<HTMLDivElement>(null);

  const baseUrl = import.meta.env.BASE_URL;
  const portraitImage = `${baseUrl}portrait-1200.webp`;
  const athleteImages = [`${baseUrl}basketball-1200.webp`, `${baseUrl}golf-1200.webp`];
  const projectFilters = ['All', ...Array.from(new Set(PROJECTS.map((project) => project.category)))];
  const filteredProjects = projectFilter === 'All' ? orderedProjects : orderedProjects.filter((project) => project.category === projectFilter);
  const visibleProjects = showAllProjects ? filteredProjects : filteredProjects.slice(0, 3);
  const groupedTech = useMemo(
    () =>
      TECH_STACK.reduce((groups, item) => {
        if (!groups[item.category]) groups[item.category] = [];
        groups[item.category].push(item.name);
        return groups;
      }, {} as Record<string, string[]>),
    []
  );

  const navigateHome = () => {
    // The stock pages are a legacy static app now; "/" belongs to the Off the Dock site.
    // Leave the stock bundle instead of rendering the retired in-bundle homepage over it.
    window.location.assign('/');
  };

  const navigate = (path: string) => {
    if (normalizePath(window.location.pathname) === path) return;
    window.history.pushState({}, '', path);
    setRoute(path);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const navigateToProject = (slug: string) => {
    window.history.pushState({}, '', `/projects/${slug}`);
    setRoute(`/projects/${slug}`);
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    trackEvent({ name: 'Project detail opened', props: { project: slug } });
  };

  useEffect(() => {
    const handlePopState = () => setRoute(normalizePath(window.location.pathname));
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    trackPageView(route);
  }, [route]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 42);
      setShowBackToTop(window.scrollY > 700);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    const imageTimer = prefersReducedMotion
      ? undefined
      : window.setInterval(() => {
          setAthleteImageIndex((current) => (current + 1) % athleteImages.length);
        }, 5200);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (imageTimer) window.clearInterval(imageTimer);
    };
  }, [athleteImages.length, prefersReducedMotion]);

  useEffect(() => {
    if (prefersReducedMotion || !window.matchMedia('(pointer: fine)').matches) return;

    let frame = 0;
    const handleMouseMove = (event: MouseEvent) => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        cursorGlowRef.current?.style.setProperty('--cursor-x', `${event.clientX}px`);
        cursorGlowRef.current?.style.setProperty('--cursor-y', `${event.clientY}px`);
        frame = 0;
      });
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [prefersReducedMotion]);

  const handleContactChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setContactForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleContactSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setContactError(null);
    setContactSuccess(false);
    setContactLoading(true);

    if (!contactForm.name.trim() || !contactForm.email.trim() || !contactForm.message.trim()) {
      setContactError('Please fill in all fields.');
      setContactLoading(false);
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactForm.email.trim())) {
      setContactError('Please enter a valid email.');
      setContactLoading(false);
      return;
    }

    try {
      const response = await fetch('https://formspree.io/f/xpwzgvqk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: contactForm.name.trim(),
          email: contactForm.email.trim(),
          message: contactForm.message.trim(),
        }),
      });

      if (!response.ok) throw new Error('Failed to send message');
      setContactSuccess(true);
      setContactForm({ name: '', email: '', message: '' });
      trackEvent({ name: 'Contact form sent' });
    } catch {
      setContactError('Failed to send message. Please try again.');
    } finally {
      setContactLoading(false);
    }
  };

  if (route === '/login') {
    return <OwnerLogin onSignedIn={(path) => navigate(path)} onHome={navigateHome} />;
  }
  if (route === '/stocks') {
    return <OwnerStocks onSignedOut={() => navigate('/login')} onHome={navigateHome} onReaderDesk={() => navigate('/mydesk')} />;
  }
  if (route === '/mydesk') {
    return <ReaderDesk onHome={navigateHome} onOwnerConsole={() => navigate('/stocks')} />;
  }
  if (route === '/odds') {
    return <Odds onHome={navigateHome} />;
  }

  const projectSlug = route.match(/^\/projects\/([^/]+)\/?$/)?.[1];
  if (projectSlug && PROJECTS.some((project) => project.slug === projectSlug)) {
    return <ProjectDetail slug={projectSlug} onNavigateHome={navigateHome} />;
  }
  if (route !== '/') return <NotFound onNavigateHome={navigateHome} />;

  return (
    <>
      <ScrollProgress />
      <div className="noise-overlay" />
      <div ref={cursorGlowRef} className="cursor-glow hidden lg:block" aria-hidden="true" />

      <div className="portfolio-home min-h-screen text-slate-200 selection:bg-blue-400/25">
        <nav aria-label="Primary navigation" className={clsx('site-nav', scrolled && 'site-nav--scrolled')}>
          <div className="site-container flex items-center justify-between">
            <a href="#about" className="brand-lockup" aria-label="Peyton Campbell homepage" onClick={() => trackEvent({ name: 'Navigation click', props: { target: 'brand' } })}>
              <span className="brand-name">Peyton Campbell</span>
            </a>

            <div className="hidden items-center gap-3 lg:flex">
              <div className="nav-links">
                {NAV_LINKS.map((link) => (
                  <a key={link.href} href={link.href} onClick={() => trackEvent({ name: 'Navigation click', props: { target: link.label } })}>
                    {link.label}
                  </a>
                ))}
                <PortfolioTools onNavigate={navigate} />
              </div>
              <a href={`${baseUrl}PeytonCampbellResume.pdf`} target="_blank" rel="noopener noreferrer" className="nav-resume" onClick={() => trackEvent({ name: 'Resume click', props: { location: 'nav' } })}>
                <Download size={16} />
                Resume
              </a>
            </div>

            <button
              type="button"
              className="mobile-menu-button lg:hidden"
              onClick={() => setIsMobileMenuOpen((open) => !open)}
              aria-label={isMobileMenuOpen ? 'Close navigation' : 'Open navigation'}
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </nav>

        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="mobile-drawer lg:hidden"
            >
              {NAV_LINKS.map((link) => (
                <a key={link.href} href={link.href} onClick={() => {
                  setIsMobileMenuOpen(false);
                  trackEvent({ name: 'Navigation click', props: { target: link.label } });
                }}>
                  {link.label}
                </a>
              ))}
              <a href="#contact" onClick={() => setIsMobileMenuOpen(false)}>Contact</a>
              <PortfolioTools onNavigate={navigate} onSelect={() => setIsMobileMenuOpen(false)} />
              <a href={`${baseUrl}PeytonCampbellResume.pdf`} target="_blank" rel="noopener noreferrer" onClick={() => trackEvent({ name: 'Resume click', props: { location: 'mobile menu' } })}>
                Resume
              </a>
            </motion.div>
          )}
        </AnimatePresence>

        <main id="main-content">
        <header id="about" className="hero-shell">
          <div className="site-container">
            <div className="hero-grid">
              <div className="hero-copy">
                <p className="hero-kicker">Software engineer</p>
                <h1>{HERO.headline}</h1>
                <p className="hero-introduction">{HERO.introduction}</p>
                <p className="hero-subtitle">{HERO.subheadline}</p>
                <p className="hero-personal">{HERO.personal}</p>
                <div className="hero-actions">
                  <a href="#projects" className="button-primary" onClick={() => trackEvent({ name: 'Projects CTA click', props: { location: 'hero' } })}>
                    Explore my work<ArrowRight size={18} aria-hidden="true" />
                  </a>
                  <a href="#contact" className="hero-contact-link" onClick={() => trackEvent({ name: 'Contact CTA click', props: { location: 'hero' } })}>
                    Get in touch<ArrowRight size={17} aria-hidden="true" />
                  </a>
                </div>
              </div>
              <figure className="hero-aside">
                <img className="hero-portrait" src={portraitImage} alt="Peyton Campbell" width="1200" height="960" loading="eager" decoding="async" />
                <figcaption>Currently / OES + Western basketball</figcaption>
              </figure>
            </div>
            <div className="hero-stack" aria-label="Core technologies">
              <span>React + TypeScript</span><span>Python + AWS</span><span>C# + .NET</span>
            </div>
          </div>
        </header>

        <SectionShell eyebrow="" title="Selected work" id="projects" className="projects-compact portfolio-work">
          <button type="button" className="all-projects-link" onClick={() => {
            setShowAllProjects((all) => !all);
            setProjectFilter('All');
          }} aria-expanded={showAllProjects}>
            {showAllProjects ? 'Show selected work' : `See all ${PROJECTS.length} projects`}<ArrowRight size={16} aria-hidden="true" />
          </button>
          {showAllProjects && (
            <div className="filter-row" aria-label="Project filters">
              {projectFilters.map((filter) => (
                <button key={filter} type="button" onClick={() => setProjectFilter(filter)} className={clsx(projectFilter === filter && 'active')} aria-pressed={projectFilter === filter}>
                  {filter}
                </button>
              ))}
            </div>
          )}
          <div className="work-grid">
            {visibleProjects.map((project) => {
              const presentation = projectPresentation[project.slug as keyof typeof projectPresentation];
              const ProjectIcon = presentation.icon;
              return (
                <article key={project.id} className="work-item">
                  <ProjectIcon className="work-icon" size={27} strokeWidth={1.4} aria-hidden="true" />
                  <div className="work-item-copy">
                    <h3>{presentation.title}</h3>
                    <p>{presentation.summary}</p>
                    <div className="work-links">
                      <button type="button" onClick={() => navigateToProject(project.slug)}>
                        Read case study<ArrowRight size={15} aria-hidden="true" />
                      </button>
                      {project.cta && <a href={project.cta.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${project.title}`} onClick={() => trackEvent({ name: 'Project external click', props: { project: project.slug } })}>
                        <ExternalLink size={16} aria-hidden="true" />
                      </a>}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </SectionShell>

        <ArchitectureDiagram />

        <SectionShell
          eyebrow="Capabilities"
          title={
            <>
              What I work with.
            </>
          }
          copy="The tools behind the work: product interfaces, cloud data flows, and hardware-connected systems."
          className="surface-band capabilities-compact"
        >
          <div className="capability-layout">
            <div className="highlight-column">
              {HIGHLIGHTS.map((highlight) => (
                <article key={highlight.label} className="highlight-row">
                  <highlight.icon size={22} />
                  <div>
                    <h3>{highlight.label}</h3>
                    <p>{highlight.detail}</p>
                  </div>
                </article>
              ))}
            </div>

            <div className="tech-matrix">
              {categoryOrder
                .filter((category) => groupedTech[category]?.length)
                .map((category) => (
                  <div key={category} className={clsx('tech-group', `tone-${categoryTone[category]}`)}>
                    <div className="tech-group-title">
                      <TechIcon />
                      {category}
                    </div>
                    <div className="tech-list">
                      {groupedTech[category].map((tech) => (
                        <span key={tech}>{tech}</span>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </SectionShell>

        <SectionShell
          eyebrow="Playground"
          title="Catan Settlement Optimizer."
          copy="A strategy problem turned into a tool you can play with."
          id="playground"
          className="surface-band"
        >
          <div className="catan-showcase">
            <div className="catan-showcase-copy">
              <h3>Find a stronger opening move.</h3>
              <p>Explore a board, compare settlement positions, and see how dice probability, resource scarcity, and port access shape the rankings.</p>
              <p className="catan-showcase-stack">JavaScript / Canvas API / Algorithms</p>
              <div className="catan-showcase-actions">
                <a href={`${baseUrl}catan/`} className="button-primary" onClick={() => trackEvent({ name: 'Project external click', props: { project: 'catan-settlement-optimizer', location: 'playground' } })}>
                  Try the optimizer<ArrowRight size={18} aria-hidden="true" />
                </a>
                <button type="button" className="hero-contact-link" onClick={() => navigateToProject('catan-settlement-optimizer')}>
                  How it works<ArrowRight size={16} aria-hidden="true" />
                </button>
              </div>
            </div>
            <a href={`${baseUrl}catan/`} className="catan-showcase-preview" aria-label="Open the Catan Settlement Optimizer">
              <img src={`${baseUrl}project-images/catan-optimizer.png`} alt="Catan board with ranked settlement positions, resource tiles, and port access" width="1440" height="1100" loading="lazy" />
            </a>
          </div>
        </SectionShell>

        <SectionShell
          eyebrow="Experience"
          title={
            <>
              Where I spend my time.
            </>
          }
          copy="Software engineering at OES. Basketball analytics at Western."
          id="experience"
        >
          <div className="timeline">
            {EXPERIENCE.map((experience) => (
              <article
                key={`${experience.company}-${experience.period}`}
                className="experience-card"
              >
                <div className="experience-meta">
                  <span>{experience.period}</span>
                  <span>{experience.location}</span>
                </div>
                <div>
                  <h3>{experience.title}</h3>
                  <p>{experience.company}</p>
                </div>
                <ul>
                  {experience.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </SectionShell>

        <div>
          <Suspense fallback={<SectionSkeleton />}>
            <Certifications />
          </Suspense>
        </div>

        <div>
          <Suspense fallback={<SectionSkeleton />}>
            <GitHubActivity />
          </Suspense>
        </div>

        <section id="duality" className="story-section">
          <div className="story-image-wrap">
            <AnimatePresence mode="wait">
              <motion.div
                key={athleteImageIndex}
                initial={{ opacity: 0, scale: 1.04 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.9 }}
                className="story-image"
                style={{ backgroundImage: `url(${athleteImages[athleteImageIndex]})` }}
              />
            </AnimatePresence>
          </div>
          <div className="story-copy">
            <p className="section-eyebrow">My story</p>
            <h2>
              From the court to the codebase.
            </h2>
            <div className="story-points">
              <article>
                <ShieldCheck size={22} />
                <h3>Leadership under pressure</h3>
                <p>I played varsity basketball at Western while studying computer science. I now lead analytics for the men's team, turning performance data into practical guidance for coaches and athletes.</p>
              </article>
              <article>
                <Sparkles size={22} />
                <h3>Systems with intent</h3>
                <p>Away from OES, I built Coach AI: a full-stack platform for team schedules, recruiting, scouting, and film review. Basketball keeps giving me useful problems to solve with software.</p>
              </article>
            </div>
          </div>
        </section>

        <SectionShell
          id="contact"
          eyebrow="Contact"
          title={
            <>
              Let&apos;s build something useful.
            </>
          }
          copy="Open to software engineering roles in Toronto or remotely from Canada. Happy to talk product work, interesting systems, or the Raptors."
          className="contact-section"
        >
          <div className="contact-layout">
            <div className="contact-card">
              <form onSubmit={handleContactSubmit} className="contact-form">
                <label>
                  <span>Name</span>
                  <input name="name" value={contactForm.name} onChange={handleContactChange} autoComplete="name" />
                </label>
                <label>
                  <span>Email</span>
                  <input name="email" type="email" value={contactForm.email} onChange={handleContactChange} autoComplete="email" />
                </label>
                <label className="full">
                  <span>Message</span>
                  <textarea name="message" value={contactForm.message} onChange={handleContactChange} rows={5} />
                </label>
                {contactError && <p role="alert" className="form-message error">{contactError}</p>}
                {contactSuccess && <p role="status" className="form-message success">Message sent. Thanks for reaching out.</p>}
                <button type="submit" className="button-primary" disabled={contactLoading}>
                  <Mail size={18} />
                  {contactLoading ? 'Sending...' : 'Send message'}
                </button>
                <p className="contact-fallback">
                  Prefer email?{' '}
                  <a href="mailto:campbellpeyton042@gmail.com">
                    campbellpeyton042@gmail.com
                  </a>
                  .
                </p>
              </form>
            </div>

            <aside className="contact-aside">
              <p className="contact-note">{CONTACT_TRUST[0]}</p>
              <a href="https://github.com/peytoncampbell" target="_blank" rel="noopener noreferrer">
                <Github size={20} />
                GitHub
              </a>
              <a href="https://www.linkedin.com/in/peyton-campbell/" target="_blank" rel="noopener noreferrer">
                <Linkedin size={20} />
                LinkedIn
              </a>
              <a href={`${baseUrl}PeytonCampbellResume.pdf`} target="_blank" rel="noopener noreferrer">
                <CalendarClock size={20} />
                Resume
              </a>
            </aside>
          </div>
        </SectionShell>
        </main>

        <footer className="site-footer">
          <div className="footer-line" />
          <p>Built with React, Tailwind, and a bias toward useful software.</p>
          <span>&copy; {new Date().getFullYear()} Peyton Campbell</span>
        </footer>

        <AnimatePresence>
          {showBackToTop && (
            <motion.button
              initial={{ opacity: 0, scale: 0.86 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.86 }}
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="back-to-top"
              aria-label="Back to top"
            >
              <ArrowUp size={20} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
