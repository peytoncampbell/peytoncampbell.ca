import {
  Component,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { audio } from '../audio/audio'
import { useGameStore } from '../store/useGameStore'
import { navItems, profile } from './content'
import { ProfileSections } from './ProfileSections'
import { SiteHeader } from './SiteHeader'

const DockExperience = lazy(() => import('../experience/DockExperience'))

const posterSrc = `${import.meta.env.BASE_URL}preview.jpg`

type Mode = 'landing' | 'play'

function supportsWebGL(): boolean {
  if (typeof document === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    const gl =
      canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false }) ||
      canvas.getContext('webgl', { failIfMajorPerformanceCaveat: false })
    if (!gl) return false
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch {
    return false
  }
}

class ExperienceBoundary extends Component<
  { children: ReactNode; onFail: () => void },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch() {
    this.props.onFail()
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

function PlayFallback({ onExit }: { onExit: () => void }) {
  return (
    <div className="play-fallback" role="dialog" aria-modal="true" aria-label="Opening the dock">
      <div className="play-fallback-poster" aria-hidden="true">
        <img src={posterSrc} alt="" />
      </div>
      <div className="play-fallback-shade" aria-hidden="true" />
      <button type="button" className="play-exit" onClick={onExit} autoFocus>
        <span aria-hidden="true">←</span> Back to profile
      </button>
      <div className="play-fallback-copy">
        <p className="eyebrow">Stillwater Bay</p>
        <p>Opening the dock…</p>
      </div>
    </div>
  )
}

export default function LandingPage() {
  const [mode, setMode] = useState<Mode>('landing')
  const [webgl, setWebgl] = useState<boolean | null>(null)
  const [sceneRequested, setSceneRequested] = useState(false)
  const [sceneReady, setSceneReady] = useState(false)
  const [sceneFailed, setSceneFailed] = useState(false)
  const [experienceMounted, setExperienceMounted] = useState(false)
  const [heroVisible, setHeroVisible] = useState(true)
  const [scrolled, setScrolled] = useState(false)
  const [activeSection, setActiveSection] = useState('')
  const heroRef = useRef<HTMLElement>(null)
  const lastTriggerRef = useRef<HTMLElement | null>(null)
  const timeOfDay = useGameStore((state) => state.timeOfDay)
  const weather = useGameStore((state) => state.weather)
  const quality = useGameStore((state) => state.quality)
  const reducedMotion = useGameStore((state) => state.reducedMotion)

  const playing = mode === 'play'
  const canPlay = webgl !== false && !sceneFailed

  useEffect(() => {
    const available = supportsWebGL()
    setWebgl(available)
    if (!available) return

    let timer = 0
    const requestScene = () => {
      timer = window.setTimeout(() => setSceneRequested(true), 220)
    }
    if (document.readyState === 'complete') requestScene()
    else window.addEventListener('load', requestScene, { once: true })
    return () => {
      window.removeEventListener('load', requestScene)
      window.clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    if (webgl === false && mode === 'play') {
      audio.setPaused(true)
      setMode('landing')
    }
  }, [webgl, mode])

  useEffect(() => {
    document.body.classList.toggle('is-playing', playing)
    return () => document.body.classList.remove('is-playing')
  }, [playing])

  useEffect(() => {
    const element = heroRef.current
    if (!element) return
    const observer = new IntersectionObserver(
      ([entry]) => setHeroVisible(entry?.isIntersecting ?? false),
      { threshold: 0 },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    document.documentElement.style.scrollBehavior = reducedMotion ? 'auto' : ''
  }, [reducedMotion])

  useEffect(() => {
    let prevScrolled = false
    let prevSection = ''
    const onScroll = () => {
      const hero = heroRef.current
      if (hero) {
        const height = Math.max(1, hero.offsetHeight)
        const fade = Math.min(
          0.94,
          Math.max(0, (window.scrollY - window.innerHeight * 0.15) / (height * 0.9)),
        )
        hero.style.setProperty('--hero-fade', fade.toFixed(3))
      }
      const isScrolled = window.scrollY > 24
      if (isScrolled !== prevScrolled) {
        prevScrolled = isScrolled
        setScrolled(isScrolled)
      }
      let next = ''
      for (const item of navItems) {
        const section = document.getElementById(item.href.slice(1))
        if (section && section.getBoundingClientRect().top <= window.innerHeight * 0.36) {
          next = item.href.slice(1)
        }
      }
      if (next !== prevSection) {
        prevSection = next
        setActiveSection(next)
      }
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!playing || experienceMounted) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      audio.setPaused(true)
      setMode('landing')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [experienceMounted, playing])

  const handlePlay = useCallback(() => {
    if (webgl === false || sceneFailed) return
    lastTriggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    setSceneRequested(true)
    const store = useGameStore.getState()
    audio.ensureStarted(store.soundOn)
    audio.setEnabled(store.soundOn)
    audio.setTime(store.timeOfDay)
    audio.setWeather(store.weather)
    audio.setPaused(false)
    setMode('play')
  }, [sceneFailed, webgl])

  const handleExit = useCallback(() => {
    audio.setPaused(true)
    setMode('landing')
    const trigger = lastTriggerRef.current
    if (trigger?.isConnected) {
      window.setTimeout(() => trigger.focus({ preventScroll: true }), 0)
    }
  }, [])

  const handleFail = useCallback(() => {
    setSceneFailed(true)
    setSceneRequested(false)
    setSceneReady(false)
    setMode('landing')
    audio.setPaused(true)
  }, [])

  const handleMounted = useCallback(() => setExperienceMounted(true), [])

  const scene = webgl && sceneRequested && !sceneFailed ? (
    <ExperienceBoundary onFail={handleFail}>
      <Suspense fallback={null}>
        <DockExperience
          mode={mode}
          sceneVisible={heroVisible}
          posterSrc={posterSrc}
          onMount={handleMounted}
          onReady={() => setSceneReady(true)}
          onFail={handleFail}
          onExit={handleExit}
        />
      </Suspense>
    </ExperienceBoundary>
  ) : null

  return (
    <div
      className={`app landing-page ${playing ? 'is-playing' : 'is-landing'} ${sceneReady ? 'is-scene-ready' : ''}`}
      data-mode={mode}
      data-time={timeOfDay}
      data-weather={weather}
      data-quality={quality}
      data-reduced={reducedMotion ? 'true' : 'false'}
    >
      <a
        className="skip-link"
        href="#main"
        tabIndex={playing ? -1 : undefined}
        aria-hidden={playing || undefined}
      >
        Skip to content
      </a>

      <SiteHeader activeSection={activeSection} scrolled={scrolled} playMode={playing} />

      <main id="main">
        <section
          ref={heroRef}
          id="top"
          className={`hero ${sceneFailed ? 'is-scene-failed' : ''}`}
          aria-labelledby="hero-title"
        >
          <div className="hero-poster" aria-hidden="true">
            <img
              src={posterSrc}
              alt=""
              width={1440}
              height={900}
              fetchPriority="high"
              decoding="async"
            />
          </div>

          {scene}

          <div className="hero-scrim" aria-hidden="true" />
          <div className="hero-scroll-fade" aria-hidden="true" />

          <div
            className="hero-ui"
            inert={playing || undefined}
            aria-hidden={playing || undefined}
          >
            <div className="hero-inner">
              <p className="hero-eyebrow">{profile.eyebrow}</p>
              <h1 id="hero-title">
                {profile.headlineLead}
                <em>{profile.headlineEmphasis}</em>
                {profile.headlineTail}
              </h1>
              <p className="hero-subhead">{profile.subhead}</p>
              <p className="hero-personal">{profile.secondary}</p>

              <div className="hero-actions">
                <a className="hero-primary" href="#work">
                  {profile.primaryCta}
                  <span aria-hidden="true">↓</span>
                </a>
                <button
                  type="button"
                  className="hero-secondary"
                  onClick={handlePlay}
                  disabled={!canPlay}
                  aria-label={
                    canPlay
                      ? 'Cast a line and enter the interactive dock'
                      : 'The interactive dock is unavailable in this browser'
                  }
                >
                  <span className="hero-play-mark" aria-hidden="true">
                    <svg viewBox="0 0 16 16" fill="none">
                      <path d="M5.2 3.1 12 8l-6.8 4.9V3.1Z" fill="currentColor" />
                    </svg>
                  </span>
                  {profile.secondaryCta}
                </button>
              </div>
              {!canPlay && (
                <p className="hero-fallback-note">
                  The interactive dock needs WebGL. The profile is still here.
                </p>
              )}
            </div>

            <aside className="hero-aside" aria-label="Interactive dock">
              <span className={`live-dot ${canPlay ? 'is-live' : ''}`} aria-hidden="true" />
              <p>{canPlay ? 'The dock is live' : 'Stillwater Bay, still'}</p>
              <span>{canPlay ? 'Drag to look · Cast a line' : 'Static poster'}</span>
            </aside>
          </div>

          <a className="hero-scroll-cue" href="#about">
            <span>Scroll</span>
            <i aria-hidden="true" />
          </a>
        </section>

        <ProfileSections playMode={playing} canPlay={canPlay} onPlay={handlePlay} />
      </main>

      {playing && !experienceMounted && <PlayFallback onExit={handleExit} />}

      <div className="page-grain" aria-hidden="true" />
    </div>
  )
}
