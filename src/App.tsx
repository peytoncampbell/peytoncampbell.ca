import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import {
  ArrowRight,
  ArrowUp,
  CalendarClock,
  ChevronRight,
  Download,
  ExternalLink,
  Github,
  Linkedin,
  Mail,
  Menu,
  ShieldCheck,
  Sparkles,
  Star,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import { BUILDING_NOW, CONTACT_TRUST, EXPERIENCE, HERO, HIGHLIGHTS, NAV_LINKS, PROJECTS, TECH_STACK } from './data';
import ScrollProgress from './ScrollProgress';
import ArchitectureDiagram from './ArchitectureDiagram';
import NotFound from './NotFound';
import ProjectDetail from './ProjectDetail';
import ProjectVisual from './ProjectVisual';
import { trackEvent, trackPageView } from './analytics';

const Certifications = lazy(() => import('./Certifications'));
const GitHubActivity = lazy(() => import('./GitHubActivity'));
const LiveTicker = lazy(() => import('./LiveTicker'));

const fadeInUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] } },
};

const staggerContainer = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.09, delayChildren: 0.08 },
  },
};

function useNearViewport<T extends HTMLElement>(rootMargin = '650px') {
  const ref = useRef<T | null>(null);
  const [isNear, setIsNear] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || isNear) return;

    if (!('IntersectionObserver' in window)) {
      setIsNear(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsNear(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [isNear, rootMargin]);

  return [ref, isNear] as const;
}

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
          <p className="section-eyebrow">{eyebrow}</p>
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

const projectAccent: Record<string, string> = {
  Production: 'cyan',
  Systems: 'amber',
  Tools: 'blue',
  'ML/AI': 'violet',
};

export default function App() {
  const prefersReducedMotion = useReducedMotion();
  const [route, setRoute] = useState(() => window.location.pathname);
  const [scrolled, setScrolled] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [projectFilter, setProjectFilter] = useState('All');
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' });
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactSuccess, setContactSuccess] = useState(false);
  const [contactLoading, setContactLoading] = useState(false);
  const [isLiveTickerReady, setIsLiveTickerReady] = useState(false);
  const [athleteImageIndex, setAthleteImageIndex] = useState(0);
  const cursorGlowRef = useRef<HTMLDivElement>(null);
  const storyRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: storyProgress } = useScroll({
    target: storyRef,
    offset: ['start end', 'end start'],
  });
  const storyY = useTransform(storyProgress, [0, 1], prefersReducedMotion ? [0, 0] : [44, -44]);

  const baseUrl = import.meta.env.BASE_URL;
  const portraitImage = `${baseUrl}portrait-1200.webp`;
  const athleteImages = [`${baseUrl}basketball-1200.webp`, `${baseUrl}golf-1200.webp`];
  const featuredProject = PROJECTS.find((project) => project.featured) ?? PROJECTS[0];
  const projectFilters = ['All', ...Array.from(new Set(PROJECTS.map((project) => project.category)))];
  const filteredProjects = projectFilter === 'All' ? PROJECTS : PROJECTS.filter((project) => project.category === projectFilter);
  const supportingProjects = filteredProjects.filter((project) => project.id !== featuredProject.id);
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
    window.history.pushState({}, '', '/');
    setRoute('/');
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  };

  const navigateToProject = (slug: string) => {
    window.history.pushState({}, '', `/projects/${slug}`);
    setRoute(`/projects/${slug}`);
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    trackEvent({ name: 'Project detail opened', props: { project: slug } });
  };

  useEffect(() => {
    const handlePopState = () => setRoute(window.location.pathname);
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

    const tickerTimer = window.setTimeout(() => setIsLiveTickerReady(true), 900);
    const imageTimer = prefersReducedMotion
      ? undefined
      : window.setInterval(() => {
          setAthleteImageIndex((current) => (current + 1) % athleteImages.length);
        }, 5200);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.clearTimeout(tickerTimer);
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

      <div className="min-h-screen overflow-x-hidden text-slate-200 selection:bg-blue-400/25">
        <nav className={clsx('site-nav', scrolled && 'site-nav--scrolled')}>
          <div className="site-container flex items-center justify-between">
            <a href="#about" className="brand-lockup" aria-label="PC Peyton Campbell homepage" onClick={() => trackEvent({ name: 'Navigation click', props: { target: 'brand' } })}>
              <span className="brand-mark">PC</span>
              <span className="brand-name">Peyton Campbell</span>
            </a>

            <div className="hidden items-center gap-3 lg:flex">
              {isLiveTickerReady && (
                <Suspense fallback={null}>
                  <LiveTicker />
                </Suspense>
              )}
              <div className="nav-links">
                {NAV_LINKS.map((link) => (
                  <a key={link.href} href={link.href} onClick={() => trackEvent({ name: 'Navigation click', props: { target: link.label } })}>
                    {link.label}
                  </a>
                ))}
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
              <a href={`${baseUrl}PeytonCampbellResume.pdf`} target="_blank" rel="noopener noreferrer" onClick={() => trackEvent({ name: 'Resume click', props: { location: 'mobile menu' } })}>
                Resume
              </a>
            </motion.div>
          )}
        </AnimatePresence>

        <main id="main-content">
        <header id="about" className="hero-shell">
          <div className="hero-photo" style={{ backgroundImage: `url(${portraitImage})` }} aria-hidden="true" />
          <div className="hero-aurora" aria-hidden="true" />
          <div className="site-container hero-grid">
            <div className="hero-copy">
              <p className="hero-kicker">Full-stack developer / London, ON</p>
              <h1>{HERO.headline}</h1>
              <p className="hero-subtitle">{HERO.subheadline}</p>
              <div className="hero-actions">
                <a href="#contact" className="button-primary" onClick={() => trackEvent({ name: 'Contact CTA click', props: { location: 'hero' } })}>
                  Start a conversation
                  <Mail size={18} />
                </a>
                <a href="#projects" className="button-primary" onClick={() => trackEvent({ name: 'Projects CTA click', props: { location: 'hero' } })}>
                  See selected work
                  <ArrowRight size={18} />
                </a>
                <a href={`${baseUrl}PeytonCampbellResume.pdf`} target="_blank" rel="noopener noreferrer" className="button-secondary" onClick={() => trackEvent({ name: 'Resume click', props: { location: 'hero' } })}>
                  <Download size={18} />
                  Resume
                </a>
              </div>
              <div className="hero-proof">
                {HERO.stats.map((stat) => (
                  <div key={stat.label}>
                    <stat.icon size={19} />
                    <span>{stat.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 28, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="hero-panel"
            >
              <div className="hero-panel-header">
                <span>Now building</span>
                <span className="status-pill">Available</span>
              </div>
              <div className="hero-panel-main">
                <p>Primary stack</p>
                <strong>React / TypeScript / Node / .NET</strong>
              </div>
              <div className="hero-panel-list">
                {BUILDING_NOW.map((item) => (
                  <div key={item.name}>
                    <item.icon size={18} />
                    <span>
                      <strong>{item.name}</strong>
                      {item.detail}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </header>

        <SectionShell
          eyebrow="Selected work"
          title={
            <>
              Products with <span className="gradient-text">operational weight.</span>
            </>
          }
          copy="Clearer project stories. Easier technical scanning."
          id="projects"
          className="projects-compact"
        >
          <div className="featured-work">
            <article className="featured-case">
              <div className="featured-copy">
                <span className="project-kicker">
                  <Star size={14} />
                  Featured build
                </span>
                <h3>{featuredProject.title}</h3>
                <p>{featuredProject.description}</p>
                <div className="tag-row">
                  {featuredProject.tech.map((tech) => (
                    <span key={tech}>{tech}</span>
                  ))}
                </div>
                {featuredProject.caseStudy && (
                  <div className="case-study-strip">
                    <div>
                      <span>Problem</span>
                      <p>{featuredProject.caseStudy.problem}</p>
                    </div>
                    <div>
                      <span>Approach</span>
                      <p>{featuredProject.caseStudy.approach}</p>
                    </div>
                    <div>
                      <span>Outcome</span>
                      <p>{featuredProject.caseStudy.outcome}</p>
                    </div>
                  </div>
                )}
                {featuredProject.cta?.url && (
                  <a href={featuredProject.cta.url} target="_blank" rel="noopener noreferrer" className="button-primary compact">
                    {featuredProject.cta.label}
                    <ExternalLink size={16} />
                  </a>
                )}
                <button type="button" className="button-secondary compact detail-button" onClick={() => navigateToProject(featuredProject.slug)}>
                  Full case study
                  <ArrowRight size={16} />
                </button>
              </div>
              <ProjectVisual type={featuredProject.visual} title={featuredProject.title} />
              <div className="featured-metrics">
                {featuredProject.metrics?.map((metric) => (
                  <div key={metric}>
                    <TechIcon />
                    <span>{metric}</span>
                  </div>
                ))}
              </div>
            </article>

            <div className="filter-row" aria-label="Project filters">
              {projectFilters.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setProjectFilter(filter)}
                  className={clsx(projectFilter === filter && 'active')}
                  aria-pressed={projectFilter === filter}
                >
                  {filter}
                </button>
              ))}
            </div>

            <motion.div layout className="project-grid">
              <AnimatePresence mode="popLayout">
                {supportingProjects.map((project) => (
                  <motion.article
                    layout
                    key={project.id}
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 18 }}
                    className={clsx('project-card', `tone-${projectAccent[project.category] ?? 'blue'}`)}
                  >
                    <div className="project-card-top">
                      <span>{project.category}</span>
                      {project.cta?.url && (
                        <a href={project.cta.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${project.title}`} className="project-card-link" onClick={() => trackEvent({ name: 'Project external click', props: { project: project.slug } })}>
                          <ExternalLink size={17} />
                        </a>
                      )}
                    </div>
                    <ProjectVisual type={project.visual} title={project.title} />
                    <h3>{project.title}</h3>
                    <p className="project-role">{project.role}</p>
                    <p className="project-description">{project.description}</p>
                    {project.caseStudy && (
                      <div className="project-proof">
                        <span>{project.caseStudy.details[0]}</span>
                        <p>{project.caseStudy.outcome}</p>
                      </div>
                    )}
                    <div className="project-tech">
                      {project.tech.slice(0, 5).map((tech) => (
                        <span key={tech}>{tech}</span>
                      ))}
                    </div>
                    <button type="button" className="project-detail-link" onClick={() => navigateToProject(project.slug)}>
                      View case study
                      <ArrowRight size={15} />
                    </button>
                  </motion.article>
                ))}
              </AnimatePresence>
            </motion.div>
          </div>
        </SectionShell>

        <ArchitectureDiagram />

        <SectionShell
          eyebrow="Capabilities"
          title={
            <>
              A stack built for <span className="gradient-text">shipping and operating.</span>
            </>
          }
          copy="The technical surface is grouped around the real systems from the resume: product UI, backend data flows, infrastructure, and hardware-adjacent delivery."
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
          eyebrow="Experience"
          title={
            <>
              Product delivery in <span className="gradient-text">real environments.</span>
            </>
          }
          copy="The work history is framed around release quality, cross-platform systems, and operational clarity."
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

        <section id="duality" ref={storyRef} className="story-section">
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
          <motion.div className="story-copy" style={{ y: storyY }}>
            <p className="section-eyebrow">My story</p>
            <h2>
              The same habits that travel from the court to the codebase.
            </h2>
            <div className="story-points">
              <article>
                <ShieldCheck size={22} />
                <h3>Leadership under pressure</h3>
                <p>Varsity basketball taught me how to read the floor, communicate clearly, and keep execution steady when the pace changes.</p>
              </article>
              <article>
                <Sparkles size={22} />
                <h3>Systems with intent</h3>
                <p>I bring that same rhythm into engineering: diagnose first, build cleanly, automate the repeatable parts, and keep the team moving.</p>
              </article>
            </div>
          </motion.div>
        </section>

        <SectionShell
          id="contact"
          eyebrow="Contact"
          title={
            <>
              Let&apos;s talk <span className="gradient-text">game plan.</span>
            </>
          }
          copy="Based in London, ON with Toronto reach. Send a note about product work, full-stack roles, or systems worth building."
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
                {contactError && <p className="form-message error">Error: {contactError}</p>}
                {contactSuccess && <p className="form-message success">Sent. I will reply within 24 hours.</p>}
                <button type="submit" className="button-primary" disabled={contactLoading}>
                  <Mail size={18} />
                  {contactLoading ? 'Sending...' : 'Send message'}
                </button>
                <p className="contact-fallback">
                  Prefer email? Reach me through{' '}
                  <a href="https://www.linkedin.com/in/peyton-campbell/" target="_blank" rel="noopener noreferrer">
                    LinkedIn
                  </a>
                  .
                </p>
              </form>
            </div>

            <aside className="contact-aside">
              <div className="contact-trust">
                {CONTACT_TRUST.map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>
              <a href="https://github.com/peytoncampbell" target="_blank" rel="noopener noreferrer">
                <Github size={20} />
                GitHub
                <ArrowRight size={16} />
              </a>
              <a href="https://www.linkedin.com/in/peyton-campbell/" target="_blank" rel="noopener noreferrer">
                <Linkedin size={20} />
                LinkedIn
                <ArrowRight size={16} />
              </a>
              <a href={`${baseUrl}PeytonCampbellResume.pdf`} target="_blank" rel="noopener noreferrer">
                <CalendarClock size={20} />
                Resume
                <ArrowRight size={16} />
              </a>
            </aside>
          </div>
        </SectionShell>
        </main>

        <footer className="site-footer">
          <div className="footer-line" />
          <p>Built with React, Tailwind, and a bias toward useful software.</p>
          <span>(c) {new Date().getFullYear()} Peyton Campbell</span>
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
