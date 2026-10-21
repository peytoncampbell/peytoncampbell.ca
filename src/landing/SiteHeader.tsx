import { useEffect, useRef, useState } from 'react'
import { navItems, profile } from './content'

interface SiteHeaderProps {
  activeSection: string
  scrolled: boolean
  playMode: boolean
}

export function SiteHeader({ activeSection, scrolled, playMode }: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const headerRef = useRef<HTMLElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (playMode) setMenuOpen(false)
  }, [playMode])

  useEffect(() => {
    if (!menuOpen) return
    const firstLink = panelRef.current?.querySelector<HTMLAnchorElement>('a')
    firstLink?.focus({ preventScroll: true })

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setMenuOpen(false)
      toggleRef.current?.focus({ preventScroll: true })
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [menuOpen])

  const closeMenu = () => setMenuOpen(false)

  return (
    <header
      ref={headerRef}
      className="site-header"
      data-scrolled={scrolled ? 'true' : 'false'}
      data-open={menuOpen ? 'true' : 'false'}
      inert={playMode || undefined}
      aria-hidden={playMode || undefined}
    >
      <a className="site-wordmark" href="#top" aria-label="Peyton Campbell, back to the dock">
        <span className="wordmark-dot" aria-hidden="true" />
        <span>Peyton Campbell</span>
      </a>

      <nav className="site-nav" aria-label="Primary">
        {navItems.map((item) => {
          const id = item.href.slice(1)
          const active = activeSection === id
          return (
            <a
              key={item.href}
              href={item.href}
              className={active ? 'is-active' : undefined}
              aria-current={active ? 'location' : undefined}
            >
              {item.label}
            </a>
          )
        })}
        <a
          className="desk-link"
          href="/stocks"
          title="Private stock desk — sign in required"
        >
          <span className="desk-link-dot" aria-hidden="true" />
          Stock desk
        </a>
      </nav>

      <a
        className="resume-link"
        href={profile.resume}
        download="Peyton-Campbell-Resume.pdf"
      >
        Resume
        <span aria-hidden="true">↗</span>
      </a>

      <button
        ref={toggleRef}
        type="button"
        className="menu-toggle"
        aria-expanded={menuOpen}
        aria-controls="mobile-site-nav"
        aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span className="menu-toggle-label">{menuOpen ? 'Close' : 'Menu'}</span>
        <span className="menu-toggle-lines" aria-hidden="true">
          <i />
          <i />
        </span>
      </button>

      {menuOpen && (
        <div ref={panelRef} className="mobile-nav-panel" id="mobile-site-nav">
          <p className="eyebrow">Navigate</p>
          <nav aria-label="Mobile primary">
            {navItems.map((item) => (
              <a key={item.href} href={item.href} onClick={closeMenu}>
                {item.label}
                <span aria-hidden="true">↗</span>
              </a>
            ))}
            <a
              href={profile.resume}
              onClick={closeMenu}
              download="Peyton-Campbell-Resume.pdf"
            >
              Resume
              <span aria-hidden="true">↓</span>
            </a>
            <a href="/stocks" onClick={closeMenu} title="Private stock desk — sign in required">
              Stock desk
              <span aria-hidden="true">↗</span>
            </a>
          </nav>
        </div>
      )}
    </header>
  )
}
