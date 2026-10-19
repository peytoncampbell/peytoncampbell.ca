import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Scene } from '../three/Scene'
import { audio } from '../audio/audio'
import { useGameStore } from '../store/useGameStore'
import {
  beginCastCharge,
  beginReelHold,
  cancelCastCharge,
  endFishingSession,
  endReelHold,
  releaseCast,
  releaseCaughtFish,
  setCastAim,
} from '../game/fishingEngine'
import { sceneBridge } from '../game/sceneBridge'
import { QUALITY_ORDER, TIME_ORDER, WEATHER_ORDER } from '../game/types'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { Hud } from '../components/Hud'
import { Journal } from '../components/Journal'
import { CatchCard } from '../components/CatchCard'
import { FishProfileCard } from '../components/FishProfileCard'
import { HelpSheet } from '../components/HelpSheet'
import { SettingsSheet } from '../components/SettingsSheet'
import { Onboarding } from '../components/Onboarding'
import { PhotoBar } from '../components/PhotoBar'
import { Toasts } from '../components/Toasts'

type GestureAction =
  | 'none'
  | 'armed'
  | 'armed-reel'
  | 'charging'
  | 'reeling'
  | 'orbit'
  | 'pinch'
  | 'tap'

interface GestureState {
  pointerId: number | null
  startX: number
  startY: number
  lastX: number
  lastY: number
  downAt: number
  action: GestureAction
  timer: number | null
}

interface DockExperienceProps {
  mode: 'landing' | 'play'
  sceneVisible: boolean
  posterSrc: string
  onMount: () => void
  onReady: () => void
  onFail: () => void
  onExit: () => void
}

class SceneErrorBoundary extends Component<
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

function FirstFrame({ onReady }: { onReady: () => void }) {
  const fired = useRef(false)
  useFrame(() => {
    if (fired.current) return
    fired.current = true
    onReady()
  })
  return null
}

function useDpr() {
  const quality = useGameStore((state) => state.quality)
  return useMemo(() => {
    const base = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1
    const capped =
      quality === 'high' ? Math.min(base, 2) : quality === 'medium' ? Math.min(base, 1.5) : 1
    return Math.max(1, capped)
  }, [quality])
}

export default function DockExperience({
  mode,
  sceneVisible,
  posterSrc,
  onMount,
  onReady,
  onFail,
  onExit,
}: DockExperienceProps) {
  const timeOfDay = useGameStore((state) => state.timeOfDay)
  const weather = useGameStore((state) => state.weather)
  const soundOn = useGameStore((state) => state.soundOn)
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  const photoMode = useGameStore((state) => state.photoMode)
  const dpr = useDpr()

  const [visible, setVisible] = useState(() => !document.hidden)
  const [ready, setReady] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [interacting, setInteracting] = useState(false)
  const sceneRef = useRef<HTMLDivElement>(null)
  const readyAnnounced = useRef(false)
  const interactTimer = useRef<number | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinchDistance = useRef(0)
  const spaceHeld = useRef(false)
  const quickCastTimer = useRef<number | null>(null)
  const playMode = mode === 'play'
  const trapRef = useFocusTrap<HTMLDivElement>(playMode)
  const gesture = useRef<GestureState>({
    pointerId: null,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    downAt: 0,
    action: 'none',
    timer: null,
  })

  const cameraConfig = useMemo(
    () => ({
      position: [7.9, 6.9, 6.5] as [number, number, number],
      fov: 54,
      near: 0.1,
      far: 240,
    }),
    [],
  )
  const glConfig = useMemo(
    () => ({
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance' as const,
      alpha: false,
      stencil: false,
      depth: true,
    }),
    [],
  )

  const clearGestureTimer = () => {
    if (gesture.current.timer !== null) {
      window.clearTimeout(gesture.current.timer)
      gesture.current.timer = null
    }
  }

  const endReelIfNeeded = () => {
    const phase = useGameStore.getState().phase
    if (phase === 'reeling' || phase === 'bite') endReelHold()
  }

  const cancelGesture = () => {
    clearGestureTimer()
    const phase = useGameStore.getState().phase
    if (phase === 'charging') cancelCastCharge()
    if (phase === 'reeling' || phase === 'bite') endReelHold()
    gesture.current.action = 'none'
    gesture.current.pointerId = null
    setDragging(false)
  }

  const markInteracting = useCallback(() => {
    setInteracting(true)
    if (interactTimer.current !== null) window.clearTimeout(interactTimer.current)
    interactTimer.current = window.setTimeout(() => {
      setInteracting(false)
      interactTimer.current = null
    }, 650)
  }, [])

  const handleFirstFrame = useCallback(() => {
    if (readyAnnounced.current) return
    readyAnnounced.current = true
    setReady(true)
    onReady()
  }, [onReady])

  useEffect(() => {
    onMount()
  }, [onMount])

  useEffect(() => {
    return () => {
      if (interactTimer.current !== null) window.clearTimeout(interactTimer.current)
      if (quickCastTimer.current !== null) window.clearTimeout(quickCastTimer.current)
      if (gesture.current.timer !== null) window.clearTimeout(gesture.current.timer)
    }
  }, [])

  useEffect(() => {
    const syncAudioVisibility = () => {
      const hidden = document.hidden
      setVisible(!hidden)
      if (mode !== 'play' || hidden) {
        audio.setPaused(true)
      } else {
        const store = useGameStore.getState()
        audio.ensureStarted(store.soundOn)
        audio.setEnabled(store.soundOn)
        audio.setTime(store.timeOfDay)
        audio.setWeather(store.weather)
        audio.setPaused(false)
      }
    }
    syncAudioVisibility()
    document.addEventListener('visibilitychange', syncAudioVisibility)
    return () => document.removeEventListener('visibilitychange', syncAudioVisibility)
  }, [mode])

  useEffect(() => {
    audio.setEnabled(soundOn)
  }, [soundOn])

  useEffect(() => {
    audio.setTime(timeOfDay)
  }, [timeOfDay])

  useEffect(() => {
    audio.setWeather(weather)
  }, [weather])

  useEffect(() => {
    if (playMode) return
    audio.setPaused(true)
    endFishingSession()
    const store = useGameStore.getState()
    if (store.photoMode) store.setPhotoMode(false)
    if (store.journalOpen) store.setJournalOpen(false)
    if (store.helpOpen) store.setHelpOpen(false)
    if (store.settingsOpen) store.setSettingsOpen(false)
    if (store.selectedFishId) store.selectFish(null)
    if (store.cinematic) store.toggleCinematic()
    setInteracting(false)
    cancelGesture()
    pointers.current.clear()
    spaceHeld.current = false
    setDragging(false)
  }, [playMode])

  useEffect(() => {
    if (!playMode) return
    const element = sceneRef.current
    if (!element) return
    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      sceneBridge.zoom?.(event.deltaY)
    }
    element.addEventListener('wheel', wheel, { passive: false })
    return () => element.removeEventListener('wheel', wheel)
  }, [playMode])

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

    if (!playMode) {
      markInteracting()
      if (event.pointerType !== 'touch') {
        event.currentTarget.setPointerCapture?.(event.pointerId)
      }
      gesture.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        downAt: performance.now(),
        action: 'orbit',
        timer: null,
      }
      return
    }

    const store = useGameStore.getState()
    audio.ensureStarted(store.soundOn)
    event.currentTarget.focus({ preventScroll: true })

    if (pointers.current.size === 2) {
      clearGestureTimer()
      cancelGesture()
      const values = Array.from(pointers.current.values())
      const a = values[0]
      const b = values[1]
      pinchDistance.current = a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0
      gesture.current.action = 'pinch'
      return
    }
    if (pointers.current.size > 2) return

    const blocked =
      store.onboardingOpen ||
      store.helpOpen ||
      store.settingsOpen ||
      store.journalOpen ||
      Boolean(store.catchCard)

    if (blocked) {
      gesture.current.action = 'none'
      return
    }

    event.currentTarget.setPointerCapture?.(event.pointerId)
    gesture.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      downAt: performance.now(),
      action: 'none',
      timer: null,
    }

    if (store.photoMode) {
      gesture.current.action = 'orbit'
      return
    }

    if (store.phase === 'idle') {
      gesture.current.action = 'armed'
      gesture.current.timer = window.setTimeout(() => {
        if (gesture.current.action === 'armed' && useGameStore.getState().phase === 'idle') {
          beginCastCharge()
          gesture.current.action = 'charging'
          setDragging(false)
        }
        gesture.current.timer = null
      }, 145)
    } else if (store.phase === 'waiting') {
      gesture.current.action = 'armed-reel'
      gesture.current.timer = window.setTimeout(() => {
        if (gesture.current.action === 'armed-reel' && useGameStore.getState().phase === 'waiting') {
          beginReelHold()
          gesture.current.action = 'reeling'
        }
        gesture.current.timer = null
      }, 170)
    } else if (store.phase === 'bite' || store.phase === 'reeling') {
      beginReelHold()
      gesture.current.action = 'reeling'
    } else {
      gesture.current.action = 'orbit'
    }
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const tracked = pointers.current.get(event.pointerId)
    if (tracked) {
      tracked.x = event.clientX
      tracked.y = event.clientY
    }

    if (!playMode) {
      if (gesture.current.pointerId !== event.pointerId) return
      const dx = event.clientX - gesture.current.lastX
      const dy = event.clientY - gesture.current.lastY
      if (dx === 0 && dy === 0) return
      gesture.current.lastX = event.clientX
      gesture.current.lastY = event.clientY
      markInteracting()
      setDragging(true)
      sceneBridge.orbit?.(dx, dy)
      return
    }

    if (pointers.current.size === 2 && gesture.current.action === 'pinch') {
      const values = Array.from(pointers.current.values())
      const a = values[0]
      const b = values[1]
      if (!a || !b) return
      const distance = Math.hypot(a.x - b.x, a.y - b.y)
      const delta = pinchDistance.current - distance
      if (Math.abs(delta) > 0.5) {
        sceneBridge.zoom?.(delta * 2.2)
        pinchDistance.current = distance
      }
      return
    }
    if (gesture.current.pointerId !== event.pointerId) return
    const dx = event.clientX - gesture.current.lastX
    const dy = event.clientY - gesture.current.lastY
    gesture.current.lastX = event.clientX
    gesture.current.lastY = event.clientY
    const totalMove = Math.hypot(
      event.clientX - gesture.current.startX,
      event.clientY - gesture.current.startY,
    )

    if (gesture.current.action === 'armed' || gesture.current.action === 'armed-reel') {
      if (totalMove > 7) {
        clearGestureTimer()
        gesture.current.action = 'orbit'
        setDragging(true)
        sceneBridge.orbit?.(dx, dy)
      }
      return
    }
    if (gesture.current.action === 'tap') {
      if (totalMove > 7) {
        gesture.current.action = 'orbit'
        setDragging(true)
        sceneBridge.orbit?.(dx, dy)
      }
      return
    }
    if (gesture.current.action === 'charging') {
      const rect = event.currentTarget.getBoundingClientRect()
      setCastAim(((event.clientX - rect.left) / rect.width) * 2 - 1)
      return
    }
    if (gesture.current.action === 'reeling') {
      if (totalMove > 14) {
        endReelHold()
        gesture.current.action = 'orbit'
        setDragging(true)
      }
      return
    }
    if (gesture.current.action === 'orbit') {
      setDragging(true)
      sceneBridge.orbit?.(dx, dy)
    }
  }

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const wasActive = gesture.current.pointerId === event.pointerId
    pointers.current.delete(event.pointerId)
    if (pointers.current.size < 2) {
      pinchDistance.current = 0
      if (gesture.current.action === 'pinch') gesture.current.action = 'none'
    }

    if (!playMode) {
      if (wasActive) {
        gesture.current.action = 'none'
        gesture.current.pointerId = null
        setDragging(false)
        markInteracting()
      }
      return
    }

    if (!wasActive) return
    clearGestureTimer()
    const action = gesture.current.action
    const duration = performance.now() - gesture.current.downAt
    const totalMove = Math.hypot(
      event.clientX - gesture.current.startX,
      event.clientY - gesture.current.startY,
    )
    const store = useGameStore.getState()

    if (action === 'charging') {
      releaseCast()
    } else if (action === 'reeling') {
      endReelHold()
    } else if (totalMove < 7 && duration < 650) {
      if (!store.photoMode && action === 'armed' && store.phase === 'idle') {
        beginCastCharge()
        quickCastTimer.current = window.setTimeout(() => {
          releaseCast()
          quickCastTimer.current = null
        }, 280)
      }
    }

    gesture.current.action = 'none'
    gesture.current.pointerId = null
    setDragging(false)
  }

  const onPointerCancel = () => {
    pointers.current.clear()
    cancelGesture()
    setInteracting(false)
  }

  useEffect(() => {
    if (!playMode) return
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const tag = target?.tagName ?? ''
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const store = useGameStore.getState()

      if (event.key === 'Escape') {
        if (store.photoMode) {
          event.preventDefault()
          store.setPhotoMode(false)
        } else if (store.catchCard) {
          event.preventDefault()
          releaseCaughtFish()
        } else if (store.settingsOpen) {
          store.setSettingsOpen(false)
        } else if (store.helpOpen) {
          store.setHelpOpen(false)
        } else if (store.journalOpen) {
          store.setJournalOpen(false)
        } else if (store.selectedFishId) {
          store.selectFish(null)
        } else if (!store.onboardingOpen) {
          event.preventDefault()
          onExit()
        }
        return
      }

      if (store.onboardingOpen) return
      const overlayOpen =
        store.helpOpen || store.settingsOpen || store.journalOpen || Boolean(store.catchCard)
      if (overlayOpen) return

      if (event.key === ' ' || event.key === 'Spacebar') {
        if (tag === 'BUTTON' || tag === 'A') return
        if (store.photoMode) return
        if (spaceHeld.current) return
        spaceHeld.current = true
        event.preventDefault()
        if (store.phase === 'idle') beginCastCharge()
        else if (store.phase === 'waiting' || store.phase === 'bite' || store.phase === 'reeling') {
          beginReelHold()
        }
        return
      }

      if (event.key === 'c' || event.key === 'C') {
        if (store.helpOpen || store.catchCard) return
        store.toggleCinematic()
        return
      }
      if (event.key === 'p' || event.key === 'P') {
        if (store.catchCard || store.helpOpen) return
        store.setPhotoMode(!store.photoMode)
        return
      }
      if (event.key === 'j' || event.key === 'J') {
        if (store.photoMode || store.catchCard) return
        store.toggleJournal()
        return
      }
      if (event.key === 'm' || event.key === 'M') {
        const next = !store.soundOn
        if (next) audio.ensureStarted(true)
        audio.setEnabled(next)
        store.setSoundOn(next)
        return
      }
      if (event.key === 't' || event.key === 'T') {
        store.cycleTime()
        return
      }
      if (event.key === 'w' || event.key === 'W') {
        store.cycleWeather()
        return
      }
      if (event.key === '?') {
        store.setHelpOpen(!store.helpOpen)
        return
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        sceneBridge.orbit?.(-38, 0)
        return
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        sceneBridge.orbit?.(38, 0)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        sceneBridge.orbit?.(0, -22)
        return
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        sceneBridge.orbit?.(0, 22)
        return
      }
      if (event.key === '+' || event.key === '=') {
        event.preventDefault()
        sceneBridge.zoom?.(-180)
        return
      }
      if (event.key === '-' || event.key === '_') {
        event.preventDefault()
        sceneBridge.zoom?.(180)
        return
      }
      if (event.key === '1' || event.key === '2' || event.key === '3') {
        const index = Number(event.key) - 1
        const next = TIME_ORDER[index]
        if (next) store.setTimeOfDay(next)
        return
      }
      if (event.key === '4' || event.key === '5' || event.key === '6') {
        const index = Number(event.key) - 4
        const next = WEATHER_ORDER[index]
        if (next) store.setWeather(next)
        return
      }
      if (event.key === 'q' || event.key === 'Q') {
        const index = QUALITY_ORDER.indexOf(store.quality)
        const next = QUALITY_ORDER[(index + 1) % QUALITY_ORDER.length]
        if (next) store.setQuality(next)
      }
    }

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key !== ' ' && event.key !== 'Spacebar') return
      if (!spaceHeld.current) return
      spaceHeld.current = false
      const phase = useGameStore.getState().phase
      if (phase === 'charging') releaseCast()
      else if (phase === 'reeling' || phase === 'bite') endReelHold()
    }

    const onBlur = () => {
      if (spaceHeld.current) {
        spaceHeld.current = false
        const phase = useGameStore.getState().phase
        if (phase === 'charging') releaseCast()
        else endReelIfNeeded()
      }
      pointers.current.clear()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [onExit, playMode])

  const renderActive = playMode || (sceneVisible && (!reducedMotion || interacting || !ready))
  const frameloop = !visible ? 'never' : renderActive ? 'always' : 'demand'

  return (
    <div
      ref={trapRef}
      className={`dock-experience ${playMode ? 'is-playing' : 'is-landing'}`}
      data-photo={photoMode ? 'true' : 'false'}
      data-dragging={dragging ? 'true' : 'false'}
      role={playMode ? 'dialog' : undefined}
      aria-modal={playMode ? 'true' : undefined}
      aria-label={playMode ? 'Off the Dock interactive experience' : undefined}
    >
      <div
        className={`experience-poster ${ready ? 'is-hidden' : ''}`}
        style={{ backgroundImage: `url("${posterSrc}")` }}
        aria-hidden="true"
      />

      <div
        ref={sceneRef}
        className="scene-shell"
        role={playMode ? 'application' : 'img'}
        aria-label={
          playMode
            ? 'Off the Dock — an interactive lake diorama at Jessups Island'
            : 'Illustration of an angler seated on a weathered dock at Jessups Island on Lake Nipissing'
        }
        tabIndex={playMode ? 0 : -1}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onDoubleClick={() => {
          markInteracting()
          sceneBridge.resetView?.()
        }}
      >
        <SceneErrorBoundary onFail={onFail}>
          <Canvas
            dpr={dpr}
            camera={cameraConfig}
            frameloop={frameloop}
            shadows
            gl={glConfig}
          >
            <Suspense fallback={null}>
              <Scene />
              <FirstFrame onReady={handleFirstFrame} />
            </Suspense>
          </Canvas>
        </SceneErrorBoundary>
      </div>

      <div className="cinema-grade" aria-hidden="true" />
      <div className="film-grain" aria-hidden="true" />

      {playMode && (
        <>
          <Hud />
          <Journal />
          <CatchCard />
          <FishProfileCard />
          <HelpSheet />
          <SettingsSheet />
          <PhotoBar />
          <Onboarding />
          <Toasts />
          <button
            type="button"
            className="play-exit"
            onClick={onExit}
            aria-label="Leave play mode and return to the profile"
          >
            <span className="play-exit-arrow" aria-hidden="true">
              ←
            </span>
            <span className="play-exit-long">Back to profile</span>
            <span className="play-exit-short">Profile</span>
          </button>
        </>
      )}
    </div>
  )
}
