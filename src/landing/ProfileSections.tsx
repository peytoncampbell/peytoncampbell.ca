import {
  education,
  experience,
  facts,
  offTheClock,
  profile,
  projects,
  sectionCopy,
} from './content'
import { ProjectVisual } from './ProjectVisual'

interface ProfileSectionsProps {
  playMode: boolean
  canPlay: boolean
  onPlay: () => void
}

function SectionMarker({ index, label }: { index: string; label: string }) {
  return (
    <div className="section-marker" aria-hidden="true">
      <span>{index}</span>
      <span>{label}</span>
    </div>
  )
}

function AboutSection() {
  return (
    <section id="about" className="section about-section" aria-labelledby="about-title">
      <div className="section-shell">
        <SectionMarker index="01" label="About" />
        <div className="about-layout">
          <div className="about-copy">
            <h2 id="about-title" className="about-lead">
              {profile.aboutLead}
            </h2>
            <p className="about-secondary">{profile.aboutSecondary}</p>
            <a className="section-link" href={profile.resume} download="Peyton-Campbell-Resume.pdf">
              Download the resume <span aria-hidden="true">↓</span>
            </a>
          </div>

          <div className="about-side">
            <dl className="facts">
              {facts.map((fact) => (
                <div key={fact.label}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
            <div className="focus-row">
              <span className="focus-label">Tools in the room</span>
              <ul className="focus-list" aria-label="Areas of focus">
                {profile.focus.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function WorkSection() {
  return (
    <section id="work" className="section work-section" aria-labelledby="work-title">
      <div className="section-shell">
        <SectionMarker index="02" label="Selected work" />
        <div className="section-head work-head">
          <div>
            <h2 id="work-title" className="section-title">
              Selected work
            </h2>
            <p className="section-dek">
              {sectionCopy.workDek}
            </p>
          </div>
          <p className="work-count" aria-hidden="true">
            05 <span>/</span> 05
          </p>
        </div>

        <div className="project-list">
          {projects.map((project, index) => (
            <article key={project.id} className="project-card">
              <div className="project-index" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </div>

              <div className="project-copy">
                <p className="project-context">{project.context}</p>
                <h3>{project.title}</h3>
                <p className="project-summary">{project.summary}</p>

                <div className="project-meta">
                  <span className="project-role">Role / {project.role}</span>
                  <ul className="tag-list" aria-label={`Technologies used in ${project.title}`}>
                    {project.tech.map((tech) => (
                      <li key={tech}>{tech}</li>
                    ))}
                  </ul>
                </div>

                {project.href ? (
                  <a
                    className="project-link"
                    href={project.href}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {project.linkLabel}
                    <span aria-hidden="true">↗</span>
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                ) : (
                  <span className="project-note">Internal at OES</span>
                )}
              </div>

              <div className="project-art" aria-hidden="true">
                <ProjectVisual id={project.id} />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function ExperienceSection() {
  return (
    <section
      id="experience"
      className="section experience-section"
      aria-labelledby="experience-title"
    >
      <div className="section-shell">
        <SectionMarker index="03" label="Experience" />
        <div className="experience-layout">
          <div className="experience-intro">
            <h2 id="experience-title" className="section-title">
              Experience
            </h2>
            <p className="section-dek">
              {sectionCopy.experienceDek}
            </p>
          </div>

          <div className="experience-body">
            <ol className="timeline">
              {experience.map((entry) => (
                <li key={entry.company} className="timeline-item">
                  <p className="timeline-period">{entry.period}</p>
                  <div className="timeline-copy">
                    <h3>{entry.company}</h3>
                    <p className="timeline-role">{entry.title}</p>
                    <ul>
                      {entry.bullets.map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>
                  </div>
                </li>
              ))}
            </ol>

            <div className="education-block">
              <h3>Education</h3>
              <div className="education-list">
                {education.map((item) => (
                  <div key={item.school} className="education-item">
                    <p className="timeline-period">{item.period}</p>
                    <div>
                      <strong>{item.school}</strong>
                      <span>{item.credential}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function OffTheClockSection({ canPlay, onPlay }: { canPlay: boolean; onPlay: () => void }) {
  return (
    <section
      id="off-the-clock"
      className="section off-clock-section"
      aria-labelledby="off-clock-title"
    >
      <div className="section-shell off-clock-layout">
        <div className="off-clock-copy">
          <SectionMarker index="04" label="Off the clock" />
          <h2 id="off-clock-title" className="section-title">
            {offTheClock.title}
          </h2>
          <blockquote className="off-quote">{offTheClock.quote}</blockquote>
          <p className="off-body">{offTheClock.body}</p>
          <p className="off-dedication">{offTheClock.dedication}</p>
          <ul className="interest-list" aria-label="Interests">
            {offTheClock.interests.map((interest) => (
              <li key={interest}>{interest}</li>
            ))}
          </ul>
        </div>

        <aside className="off-clock-aside" aria-label="The interactive dock">
          <div className="off-dock-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <p className="off-aside-label">Jessups Island</p>
          <p className="off-aside-copy">
            {offTheClock.aside}
          </p>
          <button
            type="button"
            className="text-action"
            onClick={onPlay}
            disabled={!canPlay}
            aria-label={canPlay ? 'Cast a line and enter the interactive dock' : 'Interactive dock unavailable'}
          >
            {canPlay ? 'Cast a line' : 'Dock needs WebGL'}
            {canPlay && <span aria-hidden="true">↗</span>}
          </button>
          {!canPlay && (
            <p className="off-aside-note">The profile and project notes are still available below.</p>
          )}
        </aside>
      </div>
    </section>
  )
}

function ContactSection() {
  return (
    <section id="contact" className="section contact-section" aria-labelledby="contact-title">
      <div className="section-shell">
        <SectionMarker index="05" label="Contact" />
        <div className="contact-layout">
          <div className="contact-copy">
            <h2 id="contact-title" className="section-title">
              Get in touch
            </h2>
            <p className="section-dek">
              {sectionCopy.contactDek}
            </p>
            <p className="contact-note">{profile.contactNote}</p>
          </div>

          <div className="contact-links">
            <a className="contact-email" href={`mailto:${profile.email}`}>
              <span className="contact-label">Email</span>
              <span>{profile.email}</span>
              <span className="contact-arrow" aria-hidden="true">↗</span>
            </a>

            <a
              className="contact-row"
              href={profile.github}
              target="_blank"
              rel="noreferrer noopener"
            >
              <span>GitHub</span>
              <span aria-hidden="true">↗</span>
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            <a
              className="contact-row"
              href={profile.linkedin}
              target="_blank"
              rel="noreferrer noopener"
            >
              <span>LinkedIn</span>
              <span aria-hidden="true">↗</span>
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            <a
              className="contact-row"
              href={profile.resume}
              download="Peyton-Campbell-Resume.pdf"
            >
              <span>Resume</span>
              <span aria-hidden="true">↓</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="section-shell footer-inner">
        <p>
          <span>© {new Date().getFullYear()} Peyton Campbell</span>
          <span className="footer-dot" aria-hidden="true" />
          <span>Toronto, Ontario</span>
        </p>
        <a href="#top">
          Back to the dock <span aria-hidden="true">↑</span>
        </a>
      </div>
    </footer>
  )
}

export function ProfileSections({ playMode, canPlay, onPlay }: ProfileSectionsProps) {
  return (
    <div
      className="profile-content"
      inert={playMode || undefined}
      aria-hidden={playMode || undefined}
    >
      <AboutSection />
      <WorkSection />
      <ExperienceSection />
      <OffTheClockSection canPlay={canPlay} onPlay={onPlay} />
      <ContactSection />
      <SiteFooter />
    </div>
  )
}
