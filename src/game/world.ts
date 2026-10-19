import * as THREE from 'three'
import { clamp, smoothstep } from './rng'

export const WATER_Y = 0
export const WORLD_HALF = 22
export const DOCK = {
  startZ: -4.8,
  endZ: 5.4,
  halfWidth: 1.55,
  deckTop: 0.72,
  plankThickness: 0.11,
  seatZ: 5.22,
  seatX: 0.16,
} as const

export const ANGLER_POSITION = new THREE.Vector3(DOCK.seatX, DOCK.deckTop, DOCK.seatZ)

export const DOCK_POSTS: ReadonlyArray<{ x: number; z: number; radius: number; height: number }> = [
  { x: -1.39, z: -4.2, radius: 0.14, height: 1.5 },
  { x: 1.39, z: -4.2, radius: 0.14, height: 1.5 },
  { x: -1.39, z: -1.45, radius: 0.14, height: 1.25 },
  { x: 1.39, z: -1.45, radius: 0.14, height: 1.25 },
  { x: -1.39, z: 1.4, radius: 0.14, height: 1.25 },
  { x: 1.39, z: 1.4, radius: 0.14, height: 1.25 },
  { x: -1.39, z: 4.65, radius: 0.15, height: 1.5 },
  { x: 1.39, z: 4.65, radius: 0.15, height: 1.5 },
]

export const LANTERN_POSITION = new THREE.Vector3(1.39, DOCK.deckTop, 4.15)
export const ROWBOAT_POSITION = new THREE.Vector3(-4.8, 0, 6.0)
export const CABIN_POSITION = new THREE.Vector3(-8.2, 0, -10.4)
export const LILY_POSITION = new THREE.Vector3(7.4, 0, 1.6)

/** The shoreline meanders gently; every other system samples this same curve. */
export function shoreZ(x: number): number {
  return -5.45 + Math.sin(x * 0.18) * 1.15 + Math.sin(x * 0.07 + 1.3) * 0.55
}

function detailNoise(x: number, z: number): number {
  return (
    Math.sin(x * 0.42 + z * 0.31) * 0.5 +
    Math.sin(x * 1.13 - z * 0.71 + 2.1) * 0.24 +
    Math.sin(x * 0.15 + z * 0.83 + 1.3) * 0.55
  )
}

/** Height of the lakebed and the land around the bay. */
export function terrainHeight(x: number, z: number): number {
  const s = shoreZ(x)
  const d = z - s
  const edge = smoothstep(14.5, 21.5, Math.abs(x)) * 2.65
  const n = detailNoise(x, z)

  if (d >= 0) {
    const deep = smoothstep(0, 12, d)
    const farBank = smoothstep(18, 23.5, z) * 4.9
    const bed = -0.08 - deep * 2.55 + farBank + edge * (0.55 + smoothstep(5, 14, d) * 0.6)
    return bed + n * (0.06 + deep * 0.18)
  }

  const land = smoothstep(0, 15, -d)
  const rise = Math.pow(land, 0.9) * 3.3
  return -0.08 + rise + edge + n * (0.14 + land * 0.55)
}

export function isWater(x: number, z: number): boolean {
  return z > shoreZ(x) + 0.45 && Math.abs(x) < WORLD_HALF - 1.5 && z < WORLD_HALF - 1
}

export function isInsideDock(x: number, z: number, padding = 0): boolean {
  return (
    Math.abs(x) < DOCK.halfWidth + padding &&
    z > DOCK.startZ - padding &&
    z < DOCK.endZ + padding
  )
}

/** Small, consistent surface displacement used by floating props and the bobber. */
export function waterSurface(x: number, z: number, time: number): number {
  return (
    Math.sin(x * 0.52 + time * 0.9) * 0.023 +
    Math.sin(z * 0.71 - time * 0.72) * 0.018 +
    Math.sin((x + z) * 1.17 + time * 1.5) * 0.009
  )
}

/** Slow eddy that keeps the bay feeling alive. */
export function flowAt(x: number, z: number, time: number, out: THREE.Vector2): THREE.Vector2 {
  const angle = Math.atan2(z - 2.5, x + 1.5)
  out.set(
    Math.sin(angle * 1.4 + time * 0.035) * 0.035 + Math.sin(z * 0.24 + time * 0.04) * 0.018,
    Math.cos(angle * 1.1 - time * 0.045) * 0.03 + Math.cos(x * 0.19 - time * 0.03) * 0.016,
  )
  return out
}

/** Camera and prop placement headroom over land. */
export function groundHeightAt(x: number, z: number): number {
  if (isInsideDock(x, z, 1.2)) return DOCK.deckTop
  return terrainHeight(x, z)
}

export const TREE_LINE: ReadonlyArray<{ x: number; z: number; scale: number; kind: number }> = [
  { x: -17.4, z: -8.2, scale: 1.5, kind: 0 },
  { x: -14.2, z: -12.5, scale: 1.25, kind: 1 },
  { x: -12.1, z: -8.3, scale: 1.0, kind: 2 },
  { x: -9.3, z: -16.2, scale: 1.4, kind: 0 },
  { x: -6.5, z: -11.8, scale: 0.95, kind: 1 },
  { x: -4.1, z: -16.8, scale: 1.3, kind: 2 },
  { x: -1.7, z: -10.9, scale: 0.8, kind: 1 },
  { x: 1.6, z: -15.4, scale: 1.2, kind: 0 },
  { x: 4.2, z: -9.7, scale: 0.9, kind: 2 },
  { x: 6.6, z: -14.1, scale: 1.35, kind: 1 },
  { x: 9.5, z: -10.4, scale: 1.0, kind: 0 },
  { x: 12.8, z: -15.3, scale: 1.45, kind: 2 },
  { x: 15.3, z: -9.4, scale: 1.1, kind: 1 },
  { x: 18.1, z: -14.7, scale: 1.55, kind: 0 },
  { x: -19.1, z: -18.5, scale: 1.7, kind: 0 },
  { x: -8.2, z: -20.4, scale: 1.55, kind: 1 },
  { x: 3.2, z: -20.1, scale: 1.5, kind: 0 },
  { x: 13.8, z: -21.2, scale: 1.65, kind: 2 },
  { x: 20.2, z: 3.5, scale: 1.2, kind: 0 },
  { x: -20.6, z: 4.4, scale: 1.15, kind: 2 },
  { x: 18.9, z: 10.8, scale: 0.95, kind: 1 },
  { x: -18.8, z: 12.2, scale: 1.0, kind: 2 },
]

export const FORM_ROCKS: ReadonlyArray<{ x: number; z: number; scale: number; rotation: number; wet: boolean }> = [
  { x: -8.2, z: -4.5, scale: 0.85, rotation: 0.6, wet: true },
  { x: -6.1, z: -5.2, scale: 0.55, rotation: 2.2, wet: true },
  { x: 5.9, z: -4.2, scale: 0.95, rotation: 1.4, wet: true },
  { x: 7.7, z: -5.5, scale: 0.6, rotation: 3.1, wet: true },
  { x: 10.2, z: -3.5, scale: 0.7, rotation: 0.3, wet: false },
  { x: -11.8, z: -2.7, scale: 0.75, rotation: 2.6, wet: false },
  { x: -2.7, z: -5.8, scale: 0.4, rotation: 1.1, wet: true },
  { x: 3.0, z: -5.9, scale: 0.45, rotation: 2.8, wet: false },
  { x: 13.2, z: -1.1, scale: 1.25, rotation: 0.1, wet: false },
  { x: -14.4, z: 0.4, scale: 1.1, rotation: 1.9, wet: false },
  { x: 16.8, z: 4.8, scale: 1.7, rotation: 0.8, wet: true },
  { x: -17.1, z: 6.1, scale: 1.5, rotation: 2.3, wet: true },
  { x: 2.4, z: 12.6, scale: 0.5, rotation: 1.0, wet: true },
  { x: -3.7, z: 8.4, scale: 0.32, rotation: 2.0, wet: true },
  { x: 11.7, z: 10.2, scale: 0.5, rotation: 0.5, wet: true },
  { x: -12.4, z: -6.4, scale: 1.35, rotation: 0.4, wet: true },
  { x: 6.2, z: -6.2, scale: 1.1, rotation: 2.2, wet: true },
  { x: -3.4, z: -6.2, scale: 0.7, rotation: 1.3, wet: true },
  { x: 14.6, z: -5.4, scale: 1.4, rotation: 2.8, wet: false },
  { x: -18.6, z: -6.8, scale: 1.5, rotation: 1.1, wet: false },
  { x: 9.4, z: -5.3, scale: 0.85, rotation: 2.4, wet: true },
]

export const clampWaterPoint = (point: THREE.Vector3): THREE.Vector3 => {
  point.x = clamp(point.x, -17, 17)
  point.z = clamp(point.z, shoreZ(point.x) + 1.3, 16.5)
  point.y = WATER_Y
  return point
}
