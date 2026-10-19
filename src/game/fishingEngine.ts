import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { audio } from '../audio/audio'
import { fishBridge } from './fishBridge'
import { runtime, spawnRipple, spawnSplash } from './runtime'
import { useGameStore } from '../store/useGameStore'
import { ANGLER_POSITION, DOCK, WATER_Y, clampWaterPoint, waterSurface } from './world'

type Phase = 'idle' | 'charging' | 'casting' | 'waiting' | 'bite' | 'reeling' | 'catch' | 'caught' | 'snapped'

interface EngineState {
  charging: boolean
  power: number
  aimYaw: number
  castT: number
  castDuration: number
  castFrom: THREE.Vector3
  castTo: THREE.Vector3
  castArc: number
  nibbleAt: number
  biteAt: number
  nibbleDone: boolean
  biteDeadline: number
  biteFishId: string | null
  hookedId: string | null
  reelHeld: boolean
  retrieving: boolean
  reelProgress: number
  reelBar: number
  reelBarVelocity: number
  reelFish: number
  reelFishVelocity: number
  reelFishTarget: number
  reelNextTarget: number
  reelZone: number
  reelInZone: boolean
  tension: number
  reelStart: THREE.Vector3
  catchT: number
  catchResolved: boolean
  snappedT: number
  nextFightSplash: number
  meterClock: number
}

const engine: EngineState = {
  charging: false,
  power: 0,
  aimYaw: 0,
  castT: 0,
  castDuration: 1,
  castFrom: new THREE.Vector3(),
  castTo: new THREE.Vector3(),
  castArc: 3,
  nibbleAt: 0,
  biteAt: 0,
  nibbleDone: false,
  biteDeadline: 0,
  biteFishId: null,
  hookedId: null,
  reelHeld: false,
  retrieving: false,
  reelProgress: 0,
  reelBar: 0.5,
  reelBarVelocity: 0,
  reelFish: 0.5,
  reelFishVelocity: 0,
  reelFishTarget: 0.5,
  reelNextTarget: 0,
  reelZone: 0.26,
  reelInZone: false,
  tension: 0,
  reelStart: new THREE.Vector3(),
  catchT: 0,
  catchResolved: false,
  snappedT: 0,
  nextFightSplash: 0,
  meterClock: 0,
}

const castStart = new THREE.Vector3()
const castTarget = new THREE.Vector3()
const tempPoint = new THREE.Vector3()
const nearestIds: string[] = []

const RARITY_WEIGHT: Record<string, number> = {
  common: 1,
  uncommon: 0.55,
  rare: 0.16,
}

function setPhase(phase: Phase): void {
  useGameStore.getState().setPhase(phase)
}

function syncMeters(force = false): void {
  const store = useGameStore.getState()
  if (!force && engine.meterClock < 0.045) return
  engine.meterClock = 0
  store.setMeters({
    castPower: engine.power,
    tension: engine.tension,
    reelProgress: engine.reelProgress,
  })
  store.setReelGame({
    active: store.phase === 'reeling' && !engine.retrieving,
    bar: engine.reelBar,
    fish: engine.reelFish,
    zone: engine.reelZone,
    inZone: engine.reelInZone,
  })
  runtime.castPower = engine.power
  runtime.tension = engine.tension
  runtime.reelProgress = engine.reelProgress
}

function pickInterestedFish(x: number, z: number): string | null {
  const store = useGameStore.getState()
  const found = fishBridge.findNear?.(x, z, 4) ?? []
  nearestIds.length = 0
  for (const id of found) nearestIds.push(id)

  if (nearestIds.length === 0) {
    const fallback = store.residents[Math.floor(Math.random() * store.residents.length)]
    return fallback?.id ?? null
  }

  let total = 0
  const weights: number[] = []
  for (const id of nearestIds) {
    const resident = store.residents.find((fish) => fish.id === id)
    const species = resident?.speciesId ?? 'bluegill'
    const rarity = species === 'golden' ? 'rare' : species === 'pike' || species === 'walleye' || species === 'catfish' ? 'uncommon' : 'common'
    const weight = RARITY_WEIGHT[rarity] ?? 1
    weights.push(weight)
    total += weight
  }
  let roll = Math.random() * total
  for (let i = 0; i < nearestIds.length; i += 1) {
    roll -= weights[i] ?? 1
    if (roll <= 0) return nearestIds[i] ?? null
  }
  return nearestIds[0] ?? null
}

function resetLine(): void {
  runtime.lineMode = 'stowed'
  runtime.bobberVisible = false
  runtime.bobberDip = 0
  runtime.bobberSink = 0
  runtime.interestedFishId = null
  runtime.hookedFishId = null
  runtime.reelHeld = false
  engine.charging = false
  engine.power = 0
  engine.reelHeld = false
  engine.retrieving = false
  engine.reelProgress = 0
  engine.reelBar = 0.5
  engine.reelBarVelocity = 0
  engine.reelFish = 0.5
  engine.reelFishVelocity = 0
  engine.reelFishTarget = 0.5
  engine.reelNextTarget = 0
  engine.reelInZone = false
  engine.tension = 0
  engine.hookedId = null
  engine.biteFishId = null
  engine.catchT = 0
  engine.catchResolved = false
  engine.snappedT = 0
  engine.nibbleDone = false
  audio.setReel(false)
  audio.setTension(0)
  useGameStore.getState().setHookedFishId(null)
  useGameStore.getState().setMeters({ castPower: 0, tension: 0, reelProgress: 0 })
}

export function beginCastCharge(): void {
  const store = useGameStore.getState()
  if (store.photoMode || store.phase !== 'idle') return
  engine.charging = true
  engine.power = 0
  engine.aimYaw = 0
  engine.tension = 0
  engine.reelProgress = 0
  runtime.castPower = 0
  runtime.tension = 0
  runtime.reelProgress = 0
  runtime.aimYaw = 0
  runtime.lineMode = 'stowed'
  runtime.bobberVisible = false
  runtime.interestedFishId = null
  runtime.hookedFishId = null
  store.setHookedFishId(null)
  setPhase('charging')
  store.setMeters({ castPower: 0, tension: 0, reelProgress: 0 })
}

export function setCastAim(normalizedX: number): void {
  if (useGameStore.getState().phase !== 'charging') return
  engine.aimYaw = THREE.MathUtils.clamp(normalizedX * 0.34, -0.34, 0.34)
  runtime.aimYaw = engine.aimYaw
}

export function cancelCastCharge(): void {
  if (useGameStore.getState().phase !== 'charging') return
  engine.charging = false
  engine.power = 0
  runtime.castPower = 0
  useGameStore.getState().setMeters({ castPower: 0 })
  setPhase('idle')
}

export function releaseCast(): void {  const store = useGameStore.getState()
  if (store.phase !== 'charging') {
    engine.charging = false
    return
  }
  engine.charging = false
  const power = Math.max(0.12, engine.power)
  engine.power = power
  const distance = 4.2 + power * 9.8
  const yaw = engine.aimYaw
  castStart.copy(runtime.rodTip)
  castTarget.set(
    ANGLER_POSITION.x + Math.sin(yaw) * distance,
    WATER_Y,
    ANGLER_POSITION.z + Math.cos(yaw) * distance,
  )
  clampWaterPoint(castTarget)
  engine.castFrom.copy(castStart)
  engine.castTo.copy(castTarget)
  engine.castT = 0
  engine.castDuration = 0.95 + distance * 0.028
  engine.castArc = 2.4 + power * 3.2
  runtime.castPower = power
  runtime.lineMode = 'flying'
  runtime.bobberVisible = true
  runtime.bobber.copy(castStart)
  runtime.tension = 0
  runtime.reelProgress = 0
  store.recordCast()
  store.setMeters({ castPower: power, tension: 0, reelProgress: 0 })
  audio.playCast()
  setPhase('casting')
}

export function beginReelHold(): void {
  const store = useGameStore.getState()
  if (store.photoMode) return
  if (store.phase === 'bite') {
    engine.reelHeld = true
    engine.tension = Math.max(engine.tension, 0.06)
    engine.reelProgress = 0.5
    engine.reelBar = 0.5
    engine.reelBarVelocity = 0
    engine.reelFish = 0.35 + Math.random() * 0.3
    engine.reelFishVelocity = 0
    engine.reelFishTarget = engine.reelFish
    engine.reelNextTarget = performance.now() / 1000 + 0.7
    engine.reelZone = 0.32
    engine.reelInZone = false
    engine.reelStart.copy(runtime.bobber)
    engine.hookedId = runtime.hookedFishId
    engine.retrieving = false
    runtime.reelHeld = true
    runtime.lineMode = 'taut'
    audio.setReel(true)
    setPhase('reeling')
    syncMeters(true)
    return
  }
  if (store.phase === 'reeling') {
    engine.reelHeld = true
    runtime.reelHeld = true
    audio.setReel(true)
    return
  }
  if (store.phase === 'waiting') {
    engine.retrieving = true
    engine.reelHeld = true
    engine.reelProgress = 0
    engine.tension = 0
    runtime.reelHeld = true
    runtime.lineMode = 'taut'
    runtime.interestedFishId = null
    runtime.hookedFishId = null
    store.setHookedFishId(null)
    audio.setReel(true)
    setPhase('reeling')
    store.setMeters({ tension: 0, reelProgress: 0 })
  }
}

export function endReelHold(): void {
  engine.reelHeld = false
  runtime.reelHeld = false
  audio.setReel(false)
}

export function releaseCaughtFish(): void {
  const store = useGameStore.getState()
  if (store.phase !== 'caught') return
  tempPoint.copy(runtime.bobber)
  spawnSplash(tempPoint.x, tempPoint.z, 0.55)
  spawnRipple(tempPoint.x, tempPoint.z, 1.7, 2.6, 0.8)
  audio.playSplash(0.35)
  store.closeCatchCard()
  resetLine()
  setPhase('idle')
  store.notify('Back she goes. The lake keeps its own.', 'quiet')
}

/** Puts the rod away when the player returns to the profile. */
export function endFishingSession(): void {
  const store = useGameStore.getState()
  resetLine()
  store.closeCatchCard()
  setPhase('idle')
}

function resolveMissedBite(): void {
  const store = useGameStore.getState()
  runtime.hookedFishId = null
  runtime.interestedFishId = null
  runtime.bobberSink = 0
  store.setHookedFishId(null)
  engine.hookedId = null
  engine.nibbleDone = false
  setPhase('waiting')
  store.notify('It let go. The lake settles again.', 'quiet')
  engine.nibbleAt = performance.now() / 1000 + 1.6 + Math.random() * 2.4
  engine.biteAt = 0
}

export function FishingSystem() {
  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05)
    const time = state.clock.elapsedTime
    const now = performance.now() / 1000
    const store = useGameStore.getState()
    const phase = store.phase as Phase
    engine.meterClock += dt

    switch (phase) {
      case 'charging': {
        engine.power = Math.min(1, engine.power + dt / 1.15)
        runtime.castPower = engine.power
        runtime.bobberVisible = false
        runtime.lineMode = 'stowed'
        syncMeters()
        break
      }
      case 'casting': {
        engine.castT += dt
        const t = Math.min(1, engine.castT / engine.castDuration)
        const eased = t * t * (3 - 2 * t)
        runtime.bobber.set(
          THREE.MathUtils.lerp(engine.castFrom.x, engine.castTo.x, eased),
          THREE.MathUtils.lerp(engine.castFrom.y, WATER_Y + 0.04, t) + Math.sin(Math.PI * t) * engine.castArc,
          THREE.MathUtils.lerp(engine.castFrom.z, engine.castTo.z, eased),
        )
        runtime.lineMode = 'flying'
        runtime.bobberVisible = true
        if (t >= 1) {
          runtime.bobber.y = WATER_Y + 0.035
          runtime.lineMode = 'water'
          spawnRipple(runtime.bobber.x, runtime.bobber.z, 1.7, 2.5, 0.9)
          spawnSplash(runtime.bobber.x, runtime.bobber.z, 0.45)
          audio.playSplash(0.5)
          engine.nibbleAt = now + 1.4 + Math.random() * 2.0
          engine.nibbleDone = false
          engine.biteAt = 0
          runtime.interestedFishId = pickInterestedFish(runtime.bobber.x, runtime.bobber.z)
          setPhase('waiting')
        }
        break
      }
      case 'waiting': {
        const surface = waterSurface(runtime.bobber.x, runtime.bobber.z, time)
        runtime.bobber.y = WATER_Y + 0.035 + surface
        runtime.bobberDip = Math.max(0, runtime.bobberDip - dt * 0.7)
        runtime.bobberSink = Math.max(0, runtime.bobberSink - dt * 0.4)
        runtime.bobberVisible = true
        runtime.lineMode = 'water'
        if (!engine.nibbleDone && now >= engine.nibbleAt) {
          engine.nibbleDone = true
          runtime.bobberDip = 0.055
          spawnRipple(runtime.bobber.x, runtime.bobber.z, 0.75, 1.7, 0.55)
          engine.biteAt = now + 2.0 + Math.random() * 3.0
          if (!runtime.interestedFishId) {
            runtime.interestedFishId = pickInterestedFish(runtime.bobber.x, runtime.bobber.z)
          }
        }
        if (engine.nibbleDone && engine.biteAt > 0 && now >= engine.biteAt) {
          const interested = runtime.interestedFishId
          const hooked = interested ?? pickInterestedFish(runtime.bobber.x, runtime.bobber.z)
          if (hooked) {
            runtime.hookedFishId = hooked
            runtime.interestedFishId = hooked
            engine.hookedId = hooked
            engine.biteDeadline = now + 4.2
            engine.tension = 0
            engine.reelProgress = 0
            engine.nibbleDone = false
            engine.biteAt = 0
            engine.reelStart.copy(runtime.bobber)
            runtime.bobberSink = 0.13
            runtime.lineMode = 'taut'
            spawnSplash(runtime.bobber.x, runtime.bobber.z, 0.6)
            audio.playBite()
            store.recordBite()
            store.setHookedFishId(hooked)
            setPhase('bite')
          } else {
            engine.nibbleAt = now + 1.8
          }
        }
        break
      }
      case 'bite': {
        runtime.bobber.y = WATER_Y + 0.01 + waterSurface(runtime.bobber.x, runtime.bobber.z, time)
        runtime.bobberSink = 0.16 + Math.sin(time * 9.2) * 0.035
        runtime.bobberDip = 0
        runtime.lineMode = 'taut'
        if (now > engine.biteDeadline) {
          resolveMissedBite()
        }
        break
      }
      case 'reeling': {
        if (engine.retrieving) {
          const surface = waterSurface(runtime.bobber.x, runtime.bobber.z, time)
          engine.reelProgress = Math.min(1, engine.reelProgress + (engine.reelHeld ? dt * 1.35 : 0))
          runtime.bobber.y = WATER_Y + 0.035 + surface
          runtime.lineMode = engine.reelHeld ? 'taut' : 'water'
          runtime.reelProgress = engine.reelProgress
          runtime.tension = 0
          if (engine.reelHeld) {
            runtime.bobber.x = THREE.MathUtils.damp(runtime.bobber.x, ANGLER_POSITION.x, 0.6, dt)
            runtime.bobber.z = THREE.MathUtils.damp(runtime.bobber.z, DOCK.endZ + 0.4, 0.8, dt)
          }
          if (engine.reelProgress >= 1) {
            resetLine()
            setPhase('idle')
            store.notify('Line in.', 'quiet')
          }
          syncMeters()
          break
        }

        const barAcceleration = engine.reelHeld ? 1.5 : -1
        engine.reelBarVelocity = THREE.MathUtils.clamp(
          engine.reelBarVelocity + barAcceleration * dt,
          -0.85,
          0.85,
        )
        engine.reelBarVelocity *= Math.pow(0.25, dt)
        engine.reelBar += engine.reelBarVelocity * dt

        const halfZone = engine.reelZone / 2
        if (engine.reelBar < halfZone) {
          engine.reelBar = halfZone
          engine.reelBarVelocity = 0
        } else if (engine.reelBar > 1 - halfZone) {
          engine.reelBar = 1 - halfZone
          engine.reelBarVelocity = 0
        }

        if (now > engine.reelNextTarget) {
          engine.reelFishTarget = 0.12 + Math.random() * 0.76
          engine.reelNextTarget = now + 1.1 + Math.random() * 1.2
        }
        const fishPull = THREE.MathUtils.clamp(
          (engine.reelFishTarget - engine.reelFish) * 1.1,
          -0.4,
          0.4,
        )
        engine.reelFishVelocity = THREE.MathUtils.damp(
          engine.reelFishVelocity,
          fishPull,
          2.4,
          dt,
        )
        engine.reelFish = THREE.MathUtils.clamp(
          engine.reelFish + engine.reelFishVelocity * dt,
          0.08,
          0.92,
        )
        engine.reelInZone = Math.abs(engine.reelBar - engine.reelFish) <= halfZone
        engine.reelProgress = THREE.MathUtils.clamp(
          engine.reelProgress + dt * (engine.reelInZone ? 0.3 : -0.08),
          0,
          1,
        )
        engine.tension = THREE.MathUtils.clamp(
          0.25 + Math.abs(engine.reelBar - engine.reelFish) * 0.65 + (engine.reelHeld ? 0.08 : 0),
          0,
          0.92,
        )
        runtime.tension = engine.tension
        runtime.reelProgress = engine.reelProgress
        audio.setTension(engine.tension)
        syncMeters()

        if (engine.reelProgress <= 0) {
          resetLine()
          setPhase('idle')
          store.notify('It slipped off. Keep the fish in the green.', 'quiet')
          break
        }

        const startX = engine.reelStart.x
        const startZ = engine.reelStart.z
        const endX = ANGLER_POSITION.x + 0.4
        const endZ = DOCK.endZ + 1.4
        runtime.bobber.x = THREE.MathUtils.lerp(startX, endX, engine.reelProgress)
        runtime.bobber.z = THREE.MathUtils.lerp(startZ, endZ, engine.reelProgress)
        const surface = waterSurface(runtime.bobber.x, runtime.bobber.z, time)
        runtime.bobber.y = WATER_Y + 0.03 + surface
        runtime.bobberSink = 0.11 + Math.sin(time * 7.6) * 0.05
        runtime.lineMode = 'taut'
        runtime.bobberVisible = true

        if (time > engine.nextFightSplash) {
          engine.nextFightSplash = time + 0.8 + Math.random() * 0.8
          spawnSplash(runtime.bobber.x, runtime.bobber.z, 0.4 + engine.tension * 0.3)
        }

        if (engine.reelProgress >= 1) {
          engine.catchT = 0
          engine.catchResolved = false
          runtime.lineMode = 'taut'
          runtime.bobberVisible = false
          runtime.hookedFishId = engine.hookedId
          audio.setReel(false)
          audio.setTension(0)
          spawnSplash(runtime.bobber.x, runtime.bobber.z, 1.5)
          spawnRipple(runtime.bobber.x, runtime.bobber.z, 2.4, 3.0, 1)
          audio.playSplash(1.3)
          setPhase('catch')
          store.notify('Landed. A quick hello, then home.', 'warm')
        }
        break
      }
      case 'catch': {
        engine.catchT += dt
        runtime.tension = Math.max(0, runtime.tension - dt * 0.3)
        runtime.reelProgress = 1
        if (!engine.catchResolved && engine.catchT > 2.35) {
          engine.catchResolved = true
          const id = engine.hookedId ?? runtime.hookedFishId
          if (id) {
            store.registerCatch(id)
          } else {
            resetLine()
            setPhase('idle')
          }
          runtime.hookedFishId = null
          runtime.interestedFishId = null
          runtime.bobberVisible = false
          runtime.lineMode = 'stowed'
          audio.playCatch()
          store.setHookedFishId(null)
          store.setMeters({ tension: 0, reelProgress: 0 })
        }
        break
      }
      case 'snapped': {
        engine.snappedT += dt
        runtime.tension = 0
        runtime.reelProgress = 0
        if (engine.snappedT > 1.7) {
          resetLine()
          setPhase('idle')
        }
        break
      }
      case 'caught':
      case 'idle':
      default:
        if (phase === 'idle') {
          runtime.tension = 0
          runtime.reelHeld = false
          runtime.lineMode = 'stowed'
          runtime.bobberVisible = false
        }
        break
    }

    syncMeters()
  })

  return null
}

