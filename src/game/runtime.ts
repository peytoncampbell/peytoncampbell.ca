import * as THREE from 'three'
import { WATER_Y } from './world'

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

export interface PelletSlot {
  active: boolean
  x: number
  y: number
  z: number
  age: number
  life: number
  landed: boolean
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
const MAX_PELLETS = 28

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
  feedingUntil: 0,
  feedPoint: new THREE.Vector3(6, WATER_Y, 3),
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
  pellets: Array.from({ length: MAX_PELLETS }, () => ({
    active: false,
    x: 0,
    y: 0,
    z: 0,
    age: 0,
    life: 8,
    landed: false,
  })) as PelletSlot[],
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
let pelletCursor = 0

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

export function tossPellets(x: number, z: number): void {
  for (let i = 0; i < 11; i += 1) {
    const slot = runtime.pellets[pelletCursor]
    pelletCursor = (pelletCursor + 1) % runtime.pellets.length
    if (!slot) continue
    const angle = Math.random() * Math.PI * 2
    const distance = Math.random() * 1.4
    slot.active = true
    slot.x = x + Math.cos(angle) * distance
    slot.z = z + Math.sin(angle) * distance
    slot.y = 0.45 + Math.random() * 0.65
    slot.age = 0
    slot.life = 7 + Math.random() * 3
    slot.landed = false
  }
  runtime.feedPoint.set(x, WATER_Y, z)
  runtime.feedingUntil = performance.now() / 1000 + 9
  spawnRipple(x, z, 2.2, 2.8, 0.8)
  spawnSplash(x, z, 0.4)
}

export function clearPellets(): void {
  for (const pellet of runtime.pellets) pellet.active = false
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
