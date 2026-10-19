import * as THREE from 'three'

export type LineMode = 'stowed' | 'flying' | 'water' | 'taut'

export interface RippleSlot {
  active: boolean
  x: number
  z: number
  age: number
  life: number
  size: number
  color: THREE.Color
}

export interface SplashSlot {
  active: boolean
  x: number
  z: number
  age: number
  life: number
  power: number
  seed: number
}

export interface FishJump {
  fishId: string | null
  age: number
  life: number
  x: number
  z: number
  height: number
  direction: number
}

const MAX_RIPPLES = 40
const MAX_SPLASHES = 6

const makeRipples = (): RippleSlot[] =>
  Array.from({ length: MAX_RIPPLES }, () => ({
    active: false,
    x: 0,
    z: 0,
    age: 0,
    life: 1,
    size: 1,
    color: new THREE.Color(1, 1, 1),
  }))

export const runtime = {
  bobber: new THREE.Vector3(0, 1.2, 5.4),
  bobberVisible: false,
  bobberDip: 0,
  bobberSink: 0,
  lineMode: 'stowed' as LineMode,
  rodTip: new THREE.Vector3(0, 1.6, 6.4),
  aimYaw: 0,
  lastCameraInput: 0,
  tension: 0,
  reelProgress: 0,
  castPower: 0,
  reelHeld: false,
  interestedFishId: null as string | null,
  hookedFishId: null as string | null,
  ripples: makeRipples(),
  splashes: Array.from({ length: MAX_SPLASHES }, (_, i) => ({
    active: false,
    x: 0,
    z: 0,
    age: 0,
    life: 0.8,
    power: 1,
    seed: i * 17.31,
  })) as SplashSlot[],
  jump: {
    fishId: null,
    age: 0,
    life: 0,
    x: 0,
    z: 0,
    height: 0,
    direction: 0,
  } as FishJump,
  nextAmbientJump: 7,
  photoSaveRequested: 0,
}

let rippleCursor = 0
let splashCursor = 0

export function spawnRipple(
  x: number,
  z: number,
  size = 1.2,
  life = 2.1,
  strength = 1,
): void {
  let slot = runtime.ripples[rippleCursor]
  for (let i = 0; i < runtime.ripples.length; i += 1) {
    const candidate = runtime.ripples[(rippleCursor + i) % runtime.ripples.length]!
    if (!candidate.active) {
      slot = candidate
      break
    }
  }
  rippleCursor = (rippleCursor + 1) % runtime.ripples.length
  if (!slot) return
  slot.active = true
  slot.x = x
  slot.z = z
  slot.age = 0
  slot.life = life
  slot.size = size
  const s = Math.max(0.1, Math.min(1, strength))
  slot.color.setRGB(0.86 * s, 0.92 * s, 0.83 * s)
}

export function spawnSplash(x: number, z: number, power = 1): void {
  let slot = runtime.splashes[splashCursor]
  for (let i = 0; i < runtime.splashes.length; i += 1) {
    const candidate = runtime.splashes[(splashCursor + i) % runtime.splashes.length]!
    if (!candidate.active) {
      slot = candidate
      break
    }
  }
  splashCursor = (splashCursor + 1) % runtime.splashes.length
  if (!slot) return
  slot.active = true
  slot.x = x
  slot.z = z
  slot.age = 0
  slot.life = 0.65 + Math.min(0.5, power * 0.2)
  slot.power = power
  slot.seed = Math.random() * 1000
  spawnRipple(x, z, 1.2 + power * 0.9, 2.4, 0.55 + power * 0.2)
}

export function resetFishingRuntime(): void {
  runtime.bobberVisible = false
  runtime.bobberDip = 0
  runtime.bobberSink = 0
  runtime.lineMode = 'stowed'
  runtime.interestedFishId = null
  runtime.hookedFishId = null
  runtime.tension = 0
  runtime.reelProgress = 0
  runtime.castPower = 0
  runtime.aimYaw = 0
}

export function clearRipples(): void {
  for (const ripple of runtime.ripples) ripple.active = false
}
