import { useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import {
  beginCastCharge,
  beginReelHold,
  endReelHold,
  releaseCast,
} from '../game/fishingEngine'
import { TIME_META, type Phase } from '../game/types'
import { useGameStore } from '../store/useGameStore'
import {
  IconBook,
  IconCamera,
  IconCompass,
  IconHelp,
  IconSliders,
} from './Icons'

interface PhaseCopy {
  state: string
  action: string
  attention: boolean
}

function usePhaseCopy(): PhaseCopy {
  const phase = useGameStore((store) => store.phase) as Phase
  const reelGameActive = useGameStore((store) => store.reelGameActive)
  const reelInZone = useGameStore((store) => store.reelInZone)

  switch (phase) {
    case 'charging':
      return { state: 'Charging the cast.', action: 'Release to cast', attention: false }
    case 'casting':
      return { state: 'Casting…', action: 'Casting', attention: false }
    case 'waiting':
      return { state: 'Waiting for a bite.', action: 'Hold to reel in', attention: false }
    case 'bite':
      return { state: 'Bite.', action: 'Set the hook', attention: true }
    case 'reeling':
      if (reelGameActive) {
        return {
          state: 'Hold to raise. Release to drop.',
          action: 'Hold to raise',
          attention: !reelInZone,
        }
      }
      return { state: 'Bringing the line in.', action: 'Hold to reel in', attention: false }
    case 'catch':
      return { state: 'Landing…', action: 'Landing', attention: true }
    case 'caught':
      return { state: 'Caught.', action: 'Release', attention: false }
    case 'snapped':
      return { state: 'The line snapped.', action: 'Breathe…', attention: false }
    case 'idle':
    default:
      return { state: 'Ready when you are.', action: 'Hold to cast', attention: false }
  }
}

export function Hud() {
  const timeOfDay = useGameStore((state) => state.timeOfDay)
  const weather = useGameStore((state) => state.weather)
  const phase = useGameStore((state) => state.phase) as Phase
  const castPower = useGameStore((state) => state.castPower)
  const reelProgress = useGameStore((state) => state.reelProgress)
  const reelGameActive = useGameStore((state) => state.reelGameActive)
  const reelBar = useGameStore((state) => state.reelBar)
  const reelFish = useGameStore((state) => state.reelFish)
  const reelZone = useGameStore((state) => state.reelZone)
  const reelInZone = useGameStore((state) => state.reelInZone)
  const cinematic = useGameStore((state) => state.cinematic)
  const photoMode = useGameStore((state) => state.photoMode)
  const journalOpen = useGameStore((state) => state.journalOpen)
  const helpOpen = useGameStore((state) => state.helpOpen)
  const settingsOpen = useGameStore((state) => state.settingsOpen)
  const onboardingOpen = useGameStore((state) => state.onboardingOpen)
  const catchCard = useGameStore((state) => state.catchCard)
  const caughtCount = useGameStore(
    (state) => state.residents.filter((fish) => fish.catches > 0).length,
  )
  const toggleJournal = useGameStore((state) => state.toggleJournal)
  const setHelpOpen = useGameStore((state) => state.setHelpOpen)
  const setSettingsOpen = useGameStore((state) => state.setSettingsOpen)
  const setPhotoMode = useGameStore((state) => state.setPhotoMode)
  const toggleCinematic = useGameStore((state) => state.toggleCinematic)

  const copy = usePhaseCopy()
  const holdActive = useRef(false)
  const [pressing, setPressing] = useState(false)
  const meta = TIME_META[timeOfDay]

  const startAction = () => {
    const store = useGameStore.getState()
    if (store.photoMode) return
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

  const disabledAction =
    photoMode || phase === 'casting' || phase === 'catch' || phase === 'caught' || phase === 'snapped'
  const overlayOpen = journalOpen || helpOpen || settingsOpen || Boolean(catchCard)

  if (onboardingOpen) return null

  return (
    <div className="hud" aria-hidden={photoMode}>
      <header className="hud-top">
        <div className="hud-brand">
          <p className="hud-title">Off the Dock</p>
          <p className="hud-meta">
            <span>Jessups Island</span>
            <span aria-hidden="true">·</span>
            <span>{meta.label}</span>
            <span className="hud-meta-extra" aria-hidden="true">·</span>
            <span className="hud-meta-extra">{meta.clock}</span>
            <span className="hud-meta-extra" aria-hidden="true">·</span>
            <span className="hud-meta-extra">
              {weather === 'rain' ? 'Rain' : weather === 'mist' ? 'Mist' : 'Calm'}
            </span>
          </p>
        </div>

        <nav className="hud-nav" aria-label="Game menu">
          <button
            type="button"
            className={`hud-nav-btn ${journalOpen ? 'is-active' : ''}`}
            aria-label={`Open field journal. ${caughtCount} residents caught.`}
            aria-pressed={journalOpen}
            onClick={toggleJournal}
          >
            <IconBook />
            <span className="hud-nav-label">Journal</span>
            {caughtCount > 0 && <span className="hud-count">{caughtCount}</span>}
          </button>
          <button
            type="button"
            className="hud-nav-btn"
            aria-label="Enter photo mode"
            onClick={() => setPhotoMode(true)}
          >
            <IconCamera />
            <span className="hud-nav-label">Photo</span>
          </button>
          <button
            type="button"
            className="hud-nav-btn"
            aria-label="Open settings"
            onClick={() => setSettingsOpen(true)}
          >
            <IconSliders />
            <span className="hud-nav-label">Settings</span>
          </button>
          <button
            type="button"
            className={`hud-nav-btn ${helpOpen ? 'is-active' : ''}`}
            aria-label="Help and keyboard shortcuts"
            aria-pressed={helpOpen}
            onClick={() => setHelpOpen(!helpOpen)}
          >
            <IconHelp />
            <span className="hud-nav-label">Help</span>
          </button>
        </nav>
      </header>

      {cinematic && (
        <button type="button" className="cinematic-exit" onClick={toggleCinematic}>
          <IconCompass />
          Exit cinematic orbit
        </button>
      )}

      {!cinematic && !photoMode && !overlayOpen && (
        <section
          className={`action-strip ${reelGameActive ? 'is-reel-game' : ''}`}
          aria-label="Fishing action"
        >
          {reelGameActive && (
            <ReelGame
              bar={reelBar}
              fish={reelFish}
              zone={reelZone}
              progress={reelProgress}
              inZone={reelInZone}
            />
          )}
          <div className="action-main">
            <p
              className={`action-state ${copy.attention ? 'is-alert' : ''}`}
              aria-live={reelGameActive ? 'off' : 'polite'}
            >
              {copy.state}
            </p>
            {!reelGameActive && <MeterStack phase={phase} castPower={castPower} />}
            <button
              type="button"
              className={`primary-action ${pressing ? 'is-pressing' : ''} ${copy.attention ? 'is-attention' : ''}`}
              data-phase={phase}
              onPointerDown={onHoldDown}
              onPointerUp={onHoldUp}
              onPointerCancel={onHoldUp}
              onLostPointerCapture={onHoldUp}
              onContextMenu={(event) => event.preventDefault()}
              onKeyDown={onHoldKeyDown}
              onKeyUp={onHoldKeyUp}
              disabled={disabledAction}
              aria-label={
                reelGameActive
                  ? 'Hold to raise the green bar. Release to lower it.'
                  : copy.action
              }
              aria-keyshortcuts="Space"
            >
              {copy.action}
            </button>
          </div>
        </section>
      )}
    </div>
  )
}

function MeterStack({ phase, castPower }: { phase: Phase; castPower: number }) {
  const showPower = phase === 'charging' || (phase === 'casting' && castPower > 0.01)

  if (!showPower) return null

  return (
    <div className="action-meter">
      <div className="action-meter-row">
        <div className="action-meter-heading">
          <span>Cast power</span>
          <span>{Math.round(castPower * 100)}%</span>
        </div>
        <div
          className="action-meter-track"
          role="progressbar"
          aria-label="Cast power"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(castPower * 100)}
        >
          <span className="action-meter-fill power" style={{ width: `${castPower * 100}%` }} />
        </div>
      </div>
    </div>
  )
}

function ReelGame({
  bar,
  fish,
  zone,
  progress,
  inZone,
}: {
  bar: number
  fish: number
  zone: number
  progress: number
  inZone: boolean
}) {
  const zoneBottom = (bar - zone / 2) * 100

  return (
    <div className={`reel-game ${inZone ? 'is-aligned' : ''}`}>
      <div
        className="reel-track"
        role="img"
        aria-label="Fishing mini-game. Keep the fish inside the green bar."
      >
        <span
          className="reel-zone"
          style={{ bottom: `${zoneBottom}%`, height: `${zone * 100}%` }}
        />
        <span className="reel-fish" style={{ bottom: `${fish * 100}%` }}>
          <svg viewBox="0 0 26 14" aria-hidden="true">
            <path d="M2 7c3.4-4 8.8-4.4 13.2-.4L21 3.2v7.6l-5.8-3.4C10.8 11.4 5.4 11 2 7Z" />
            <circle cx="7" cy="6.3" r="1" />
          </svg>
        </span>
        <span className="reel-progress" aria-hidden="true">
          <span style={{ height: `${Math.max(0, Math.min(1, progress)) * 100}%` }} />
        </span>
      </div>
    </div>
  )
}
