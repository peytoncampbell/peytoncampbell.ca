import { useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { audio } from '../audio/audio'
import {
  beginCastCharge,
  beginReelHold,
  endReelHold,
  releaseCast,
} from '../game/fishingEngine'
import {
  QUALITY_LABEL,
  TIME_META,
  WEATHER_LABEL,
  type Phase,
} from '../game/types'
import { useGameStore } from '../store/useGameStore'
import {
  IconBook,
  IconCamera,
  IconCompass,
  IconDusk,
  IconHelp,
  IconHook,
  IconMist,
  IconMoon,
  IconMute,
  IconRain,
  IconSliders,
  IconSound,
  IconSun,
  IconWaves,
  IconWorm,
} from './Icons'

function usePhaseCopy(): {
  title: string
  body: string
  action: string
  actionHint: string
  attention: boolean
} {
  const phase = useGameStore((state) => state.phase) as Phase
  const tension = useGameStore((state) => state.tension)
  const feedMode = useGameStore((state) => state.feedMode)

  if (feedMode) {
    return {
      title: 'A little bait, a little patience.',
      body: 'Click the water to scatter pellets. The residents will find them.',
      action: 'Bait ready',
      actionHint: 'tap the water',
      attention: false,
    }
  }

  switch (phase) {
    case 'charging':
      return {
        title: 'Take your time.',
        body: 'Swing the pointer to aim. Release when the cast feels right.',
        action: 'Release to cast',
        actionHint: 'power',
        attention: false,
      }
    case 'casting':
      return {
        title: 'Out over the water…',
        body: 'A small splash. A small hope.',
        action: 'Casting',
        actionHint: 'watch the arc',
        attention: false,
      }
    case 'waiting':
      return {
        title: 'Read the bobber.',
        body: 'Something may be curious. Wait for the tell, or hold to bring the line in.',
        action: 'Hold to reel in',
        actionHint: 'or wait for a bite',
        attention: false,
      }
    case 'bite':
      return {
        title: 'The bobber is under.',
        body: 'Set the hook — hold steady, then ease off before the line sings.',
        action: 'Hold to reel!',
        actionHint: 'now',
        attention: true,
      }
    case 'reeling':
      return {
        title: tension > 0.58 ? 'Let the line breathe.' : 'Bring it home.',
        body:
          tension > 0.82
            ? 'Too much tension. Ease off the reel for a moment.'
            : tension > 0.58
              ? 'The line is tight. Release, then reel again.'
              : 'Hold to reel. A gentle, uneven rhythm.',
        action: 'Hold to reel',
        actionHint: 'release to ease off',
        attention: tension > 0.82,
      }
    case 'catch':
      return {
        title: 'A flash of silver, then the sky.',
        body: 'A quick hello. Then back to the deep.',
        action: 'Landing…',
        actionHint: 'a quick hello',
        attention: true,
      }
    case 'caught':
      return {
        title: 'A quiet encounter.',
        body: 'The water settles. The journal remembers.',
        action: 'Caught',
        actionHint: 'release & cast again',
        attention: false,
      }
    case 'snapped':
      return {
        title: 'The line gave.',
        body: 'Breathe. Tie another knot. The lake is patient.',
        action: 'Breathe…',
        actionHint: 'tie another knot',
        attention: false,
      }
    case 'idle':
    default:
      return {
        title: 'The channel is holding its breath.',
        body: 'Hold anywhere on the water — or press Space — to charge a cast.',
        action: 'Hold to cast',
        actionHint: 'or press Space',
        attention: false,
      }
  }
}

function TimeIcon({ time }: { time: 'golden' | 'blue' | 'night' }) {
  if (time === 'golden') return <IconSun />
  if (time === 'blue') return <IconDusk />
  return <IconMoon />
}

function WeatherIcon({ weather }: { weather: 'calm' | 'rain' | 'mist' }) {
  if (weather === 'rain') return <IconRain />
  if (weather === 'mist') return <IconMist />
  return <IconWaves />
}

export function Hud() {
  const timeOfDay = useGameStore((state) => state.timeOfDay)
  const weather = useGameStore((state) => state.weather)
  const quality = useGameStore((state) => state.quality)
  const soundOn = useGameStore((state) => state.soundOn)
  const cinematic = useGameStore((state) => state.cinematic)
  const journalOpen = useGameStore((state) => state.journalOpen)
  const helpOpen = useGameStore((state) => state.helpOpen)
  const caughtCount = useGameStore((state) => state.residents.filter((fish) => fish.catches > 0).length)
  const phase = useGameStore((state) => state.phase) as Phase
  const castPower = useGameStore((state) => state.castPower)
  const tension = useGameStore((state) => state.tension)
  const reelProgress = useGameStore((state) => state.reelProgress)
  const feedMode = useGameStore((state) => state.feedMode)
  const photoMode = useGameStore((state) => state.photoMode)

  const cycleTime = useGameStore((state) => state.cycleTime)
  const cycleWeather = useGameStore((state) => state.cycleWeather)
  const cycleQuality = useGameStore((state) => state.cycleQuality)
  const toggleSound = useGameStore((state) => state.setSoundOn)
  const toggleJournal = useGameStore((state) => state.toggleJournal)
  const setHelpOpen = useGameStore((state) => state.setHelpOpen)
  const setPhotoMode = useGameStore((state) => state.setPhotoMode)
  const setFeedMode = useGameStore((state) => state.setFeedMode)
  const notify = useGameStore((state) => state.notify)

  const copy = usePhaseCopy()
  const holdActive = useRef(false)
  const [pressing, setPressing] = useState(false)

  const handleSound = () => {
    const next = !soundOn
    if (next) audio.ensureStarted(true)
    audio.setEnabled(next)
    toggleSound(next)
  }

  const canUseBait =
    !photoMode && !feedMode
      ? phase !== 'casting' && phase !== 'catch' && phase !== 'caught' && phase !== 'snapped'
      : true

  const startAction = () => {
    const store = useGameStore.getState()
    if (store.photoMode) return
    if (store.feedMode) {
      setFeedMode(false)
      notify('Bait stowed.', 'quiet')
      return
    }
    if (store.phase === 'idle') beginCastCharge()
    else if (store.phase === 'waiting' || store.phase === 'bite' || store.phase === 'reeling') {
      beginReelHold()
    }
  }

  const endAction = () => {
    const store = useGameStore.getState()
    if (store.phase === 'charging') releaseCast()
    else if (store.phase === 'reeling' || store.phase === 'bite') endReelHold()
  }

  const onHoldDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    holdActive.current = true
    setPressing(true)
    startAction()
  }

  const onHoldUp = () => {
    if (!holdActive.current) return
    holdActive.current = false
    setPressing(false)
    endAction()
  }

  const onHoldKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== ' ' && event.key !== 'Enter') return
    event.preventDefault()
    event.stopPropagation()
    if (event.repeat) return
    holdActive.current = true
    setPressing(true)
    startAction()
  }

  const onHoldKeyUp = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== ' ' && event.key !== 'Enter') return
    event.preventDefault()
    event.stopPropagation()
    onHoldUp()
  }

  const toggleBait = () => {
    if (!canUseBait) return
    const next = !feedMode
    setFeedMode(next)
    if (next) notify('Bait ready. Click the water to scatter pellets.', 'quiet')
  }

  const meta = TIME_META[timeOfDay]
  const disabledAction =
    photoMode || phase === 'casting' || phase === 'catch' || phase === 'caught' || phase === 'snapped'

  return (
    <div className="hud" aria-hidden={photoMode}>
      <header className="brand">
        <div className="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="21" stroke="currentColor" strokeOpacity="0.2" />
            <path d="M6 32c7-4 13-4 19 0s13 4 19 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
            <path d="M24 29c0-9 5-16 15-19" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M37 8c3 1.4 4.5 4 4.5 7-3 0-6-1.6-7-4.5" fill="currentColor" opacity="0.85" />
            <circle cx="16" cy="27.5" r="2.1" fill="currentColor" />
          </svg>
        </div>
        <div className="brand-copy">
          <p className="brand-eyebrow">A quiet lake study</p>
          <h1>Off the Dock</h1>
          <p className="brand-meta">
            <span>Jessups Island</span>
            <span className="meta-dot" />
            <span>{meta.label}</span>
            <span className="meta-dot" />
            <span>{meta.clock}</span>
          </p>
        </div>
      </header>

      <nav className="controls" aria-label="Scene controls">
        <div className="control-group">
          <button
            type="button"
            className="control-btn"
            aria-label={soundOn ? 'Mute ambient sound' : 'Enable ambient sound'}
            aria-pressed={soundOn}
            title={soundOn ? 'Sound on (M)' : 'Sound off (M)'}
            onClick={handleSound}
          >
            {soundOn ? <IconSound /> : <IconMute />}
            <span className="control-label">{soundOn ? 'Sound' : 'Muted'}</span>
          </button>
          <button
            type="button"
            className="control-btn"
            aria-label={`Time of day: ${meta.label}. Change time.`}
            title="Change time (T)"
            onClick={cycleTime}
          >
            <TimeIcon time={timeOfDay} />
            <span className="control-label">{meta.short}</span>
          </button>
          <button
            type="button"
            className="control-btn"
            aria-label={`Weather: ${WEATHER_LABEL[weather]}. Change weather.`}
            title="Change weather (W)"
            onClick={cycleWeather}
          >
            <WeatherIcon weather={weather} />
            <span className="control-label">{WEATHER_LABEL[weather]}</span>
          </button>
          <button
            type="button"
            className="control-btn"
            aria-label={`Quality: ${QUALITY_LABEL[quality]}. Change quality.`}
            title="Change quality"
            onClick={cycleQuality}
          >
            <IconSliders />
            <span className="control-label">{QUALITY_LABEL[quality]}</span>
          </button>
        </div>
        <div className="control-group">
          <button
            type="button"
            className={`control-btn ${journalOpen ? 'is-active' : ''}`}
            aria-label={`Open field journal. ${caughtCount} residents caught.`}
            aria-pressed={journalOpen}
            title="Field journal (J)"
            onClick={toggleJournal}
          >
            <IconBook />
            {caughtCount > 0 && <span className="control-badge">{caughtCount}</span>}
          </button>
          <button
            type="button"
            className="control-btn"
            aria-label="Enter photo mode"
            title="Photo mode (P)"
            onClick={() => setPhotoMode(true)}
          >
            <IconCamera />
          </button>
          <button
            type="button"
            className={`control-btn ${helpOpen ? 'is-active' : ''}`}
            aria-label="Help and keyboard shortcuts"
            aria-pressed={helpOpen}
            title="Help & shortcuts (?)"
            onClick={() => setHelpOpen(!helpOpen)}
          >
            <IconHelp />
          </button>
        </div>
      </nav>

      <div className="hints" aria-hidden="true">
        <p>
          <span>Drag</span> look · <span>Scroll</span> zoom
        </p>
        <p>
          <kbd>Space</kbd> cast / reel <i>·</i> <kbd>F</kbd> feed <i>·</i> <kbd>C</kbd> cinema{' '}
          <i>·</i> <kbd>P</kbd> photo <i>·</i> <kbd>J</kbd> journal
        </p>
      </div>

      {cinematic && <div className="cinematic-chip"><IconCompass /> Cinematic orbit · <kbd>C</kbd> to release</div>}

      <section className="action-dock" aria-label="Fishing controls">
        <div className="prompt-block">
          <div className="prompt-heading">
            <span className={`status-orb ${copy.attention ? 'is-alert' : ''}`} aria-hidden="true" />
            <p className="prompt-title" aria-live="polite">{copy.title}</p>
          </div>
          <p className="prompt-body">{copy.body}</p>
        </div>

        <MeterStack
          phase={phase}
          castPower={castPower}
          tension={tension}
          reelProgress={reelProgress}
        />

        <div className="action-row">
          <button
            type="button"
            className={`bait-btn ${feedMode ? 'is-armed' : ''}`}
            onClick={toggleBait}
            disabled={!canUseBait && !feedMode}
            aria-pressed={feedMode}
            title="Toggle bait (F)"
            aria-label={feedMode ? 'Bait ready. Click the water to scatter pellets.' : 'Toggle bait, then click the water to scatter pellets.'}
          >
            <IconWorm size={17} />
            <span>{feedMode ? 'Bait ready' : 'Bait'}</span>
            <kbd>F</kbd>
          </button>

          <button
            type="button"
            className={`hold-action ${pressing ? 'is-pressing' : ''} ${copy.attention ? 'is-attention' : ''}`}
            data-phase={phase}
            onPointerDown={onHoldDown}
            onPointerUp={onHoldUp}
            onPointerCancel={onHoldUp}
            onLostPointerCapture={onHoldUp}
            onContextMenu={(event) => event.preventDefault()}
            onKeyDown={onHoldKeyDown}
            onKeyUp={onHoldKeyUp}
            disabled={disabledAction}
            aria-label={`${copy.action}. ${copy.actionHint}.`}
          >
            <span className="action-icon" aria-hidden="true">
              <IconHook size={19} />
            </span>
            <span className="action-text">
              <strong>{copy.action}</strong>
              <small>{copy.actionHint}</small>
            </span>
          </button>

          <button
            type="button"
            className="bait-btn journal-shortcut"
            onClick={toggleJournal}
            aria-pressed={journalOpen}
            aria-label="Open field journal"
            title="Field journal (J)"
          >
            <IconBook size={17} />
            <span>Journal</span>
            <kbd>J</kbd>
          </button>
        </div>
      </section>
    </div>
  )
}

function MeterStack({
  phase,
  castPower,
  tension,
  reelProgress,
}: {
  phase: Phase
  castPower: number
  tension: number
  reelProgress: number
}) {
  const showPower = phase === 'charging'
  const showTension = phase === 'reeling' && tension > 0.001
  const showProgress = phase === 'reeling'
  const tone = tension > 0.82 ? 'danger' : tension > 0.58 ? 'warning' : 'safe'

  return (
    <div className={`meter-stack ${showPower || showTension ? 'is-visible' : ''}`}>
      {showPower && (
        <div className="meter">
          <div className="meter-heading">
            <span>Cast power</span>
            <span>{Math.round(castPower * 100)}%</span>
          </div>
          <div
            className="meter-track"
            role="progressbar"
            aria-label="Cast power"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(castPower * 100)}
          >
            <span className="meter-fill power" style={{ width: `${castPower * 100}%` }} />
          </div>
        </div>
      )}
      {showTension && (
        <div className="meter">
          <div className="meter-heading">
            <span>Line tension</span>
            <span className={`tension-readout ${tone}`}>
              {tone === 'danger' ? 'ease off' : tone === 'warning' ? 'tight' : 'steady'}
            </span>
          </div>
          <div
            className="meter-track tension-track"
            role="meter"
            aria-label="Line tension"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(100, Math.round(tension * 100))}
          >
            <span className="safe-zone" aria-hidden="true" />
            <span className={`meter-fill tension ${tone}`} style={{ width: `${Math.min(100, tension * 100)}%` }} />
            <span className="threshold" aria-hidden="true" />
          </div>
        </div>
      )}
      {showProgress && (
        <div className="meter compact">
          <div className="meter-heading">
            <span>{tension > 0 ? 'Bringing it in' : 'Line in'}</span>
            <span>{Math.round(reelProgress * 100)}%</span>
          </div>
          <div
            className="meter-track slim"
            role="progressbar"
            aria-label="Fish brought in"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(reelProgress * 100)}
          >
            <span className="meter-fill progress" style={{ width: `${reelProgress * 100}%` }} />
          </div>
        </div>
      )}
    </div>
  )
}


