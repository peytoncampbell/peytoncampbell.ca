import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { clamp, hash2, smoothstep } from '../game/rng'
import type { Species } from '../game/species'

export interface FishVisual {
  geometry: THREE.BufferGeometry
  material: THREE.MeshBasicMaterial
  timeUniform: { value: number }
  nativeLength: number
}

const tempColor = new THREE.Color()
const backColor = new THREE.Color()
const midColor = new THREE.Color()
const bellyColor = new THREE.Color()
const finColor = new THREE.Color()
const accentColor = new THREE.Color()

function paintFace(
  colorAttribute: THREE.BufferAttribute,
  index: number,
  color: THREE.Color,
): void {
  colorAttribute.setXYZ(index, color.r, color.g, color.b)
  colorAttribute.setXYZ(index + 1, color.r, color.g, color.b)
  colorAttribute.setXYZ(index + 2, color.r, color.g, color.b)
}

function bodyColor(
  species: Species,
  x: number,
  y: number,
  z: number,
  halfHeight: number,
  halfLength: number,
  out: THREE.Color,
): THREE.Color {
  const yNorm = clamp(y / Math.max(0.0001, halfHeight), -1, 1)
  const zNorm = clamp(z / Math.max(0.0001, halfLength), -1, 1)
  const bellyT = smoothstep(-0.1, -0.9, yNorm)
  const midT = smoothstep(-0.1, 0.55, yNorm)

  out.copy(bellyColor).lerp(midColor, 1 - bellyT)
  out.lerp(backColor, midT * 0.92)

  switch (species.pattern) {
    case 'bars': {
      const bar = Math.sin((zNorm + 1) * 7.2) * 0.5 + 0.5
      if (yNorm > -0.5) out.lerp(accentColor, smoothstep(0.55, 0.92, bar) * 0.5)
      break
    }
    case 'stripe': {
      const band = 1 - smoothstep(0.06, 0.24, Math.abs(yNorm + 0.03 + Math.sin(zNorm * 6) * 0.04))
      out.lerp(accentColor, band * 0.42)
      break
    }
    case 'spots': {
      const spot = hash2(Math.floor(zNorm * 13), Math.floor(yNorm * 7))
      if (spot > 0.71 && yNorm > -0.6) out.lerp(bellyColor, 0.5)
      if (spot < 0.12 && yNorm > -0.3) out.lerp(accentColor, 0.35)
      break
    }
    case 'mottled': {
      const blotch = hash2(Math.floor(zNorm * 8 + 2), Math.floor(yNorm * 5 + 1))
      if (blotch > 0.62) out.lerp(accentColor, 0.3)
      if (blotch < 0.2) out.lerp(bellyColor, 0.25)
      break
    }
    case 'gold': {
      const lateral = 1 - smoothstep(0.03, 0.2, Math.abs(yNorm + 0.02))
      out.lerp(accentColor, lateral * 0.5)
      const spot = hash2(Math.floor(zNorm * 12 + 4), Math.floor(yNorm * 6))
      if (spot > 0.78) out.lerp(bellyColor, 0.35)
      break
    }
    case 'plain':
      break
    default:
      break
  }

  // Slight facet variation keeps the low-poly surfaces from looking flat.
  const facet = (hash2(x * 5.1 + 3.2, z * 4.7 + y * 3.1) - 0.5) * 0.08
  out.offsetHSL(0, 0, facet)
  return out
}

function buildBody(species: Species): THREE.BufferGeometry {
  const width = 0.52 * species.body.width * 2
  const height = 0.52 * species.body.height * 2
  const length = 0.5 * species.body.length * 2
  const halfWidth = width * 0.5
  const halfHeight = height * 0.5
  const halfLength = length * 0.5

  const source = new THREE.SphereGeometry(1, 10, 7)
  const positions = source.attributes.position
  for (let i = 0; i < positions.count; i += 1) {
    let x = positions.getX(i)
    let y = positions.getY(i)
    let z = positions.getZ(i)

    x *= halfWidth
    y *= halfHeight
    z *= halfLength

    const tailT = clamp((-z - halfLength * 0.15) / (halfLength * 0.95), 0, 1)
    const taper = 1 - 0.74 * Math.pow(tailT, 1.25)
    x *= taper
    y *= taper

    // Flatten the head a little and lift the back.
    const headT = smoothstep(0.25, 0.95, z / halfLength)
    x *= 1 - headT * 0.14
    y += halfHeight * headT * 0.04

    positions.setXYZ(i, x, y, z)
  }

  source.deleteAttribute('uv')
  const flat = source.toNonIndexed()
  source.dispose()

  const colors = new Float32Array(flat.attributes.position.count * 3)
  const attr = new THREE.BufferAttribute(colors, 3)
  const pos = flat.attributes.position
  for (let i = 0; i < pos.count; i += 3) {
    const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3
    const cy = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3
    const cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3
    bodyColor(species, cx, cy, cz, halfHeight, halfLength, tempColor)
    paintFace(attr, i, tempColor)
  }
  flat.setAttribute('color', attr)
  flat.computeVertexNormals()
  return flat
}

function triangleGeometry(
  triangles: ReadonlyArray<readonly [THREE.Vector3, THREE.Vector3, THREE.Vector3]>,
  color: THREE.Color,
): THREE.BufferGeometry {
  const points: number[] = []
  for (const tri of triangles) {
    for (const point of tri) {
      points.push(point.x, point.y, point.z)
    }
  }
  const geometry = new THREE.BufferGeometry()
  const positions = new Float32Array(points)
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const colors = new Float32Array(positions.length)
  for (let i = 0; i < positions.length / 3; i += 1) {
    colors[i * 3] = color.r
    colors[i * 3 + 1] = color.g
    colors[i * 3 + 2] = color.b
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  return geometry
}

function buildFins(species: Species): THREE.BufferGeometry[] {
  const width = 0.52 * species.body.width * 2
  const height = 0.52 * species.body.height * 2
  const length = 0.5 * species.body.length * 2
  const halfHeight = height * 0.5
  const halfLength = length * 0.5
  const tailLength = halfLength * (0.55 + species.body.tail * 0.45)
  const tailSpan = halfHeight * (0.82 + species.body.tail * 0.55)
  const tailBase = -halfLength * 0.78
  const tailTip = tailBase - tailLength
  const notchZ = tailBase - tailLength * 0.42

  const peduncle = new THREE.Vector3(0, 0, tailBase)
  const upperBase = new THREE.Vector3(0, tailSpan * 0.2, tailBase)
  const lowerBase = new THREE.Vector3(0, -tailSpan * 0.2, tailBase)
  const upperTip = new THREE.Vector3(0, tailSpan, tailTip)
  const lowerTip = new THREE.Vector3(0, -tailSpan, tailTip)
  const notch = new THREE.Vector3(0, 0, notchZ)

  const tail = triangleGeometry(
    [
      [upperBase, upperTip, notch],
      [peduncle, upperBase, notch],
      [peduncle, notch, lowerBase],
      [lowerBase, notch, lowerTip],
    ],
    finColor,
  )

  const dorsalBaseStart = new THREE.Vector3(0, halfHeight * 0.72, halfLength * 0.3)
  const dorsalBaseEnd = new THREE.Vector3(0, halfHeight * 0.6, -halfLength * 0.55)
  const dorsalPeak = new THREE.Vector3(
    0,
    halfHeight * (species.pattern === 'bars' ? 1.45 : 1.25),
    -halfLength * 0.05,
  )
  const dorsal = triangleGeometry(
    [
      [dorsalBaseStart, dorsalPeak, dorsalBaseEnd],
      [dorsalBaseStart, dorsalBaseEnd, new THREE.Vector3(0, halfHeight * 0.55, -halfLength * 0.62)],
    ],
    finColor,
  )

  const analBaseStart = new THREE.Vector3(0, -halfHeight * 0.7, -halfLength * 0.25)
  const analBaseEnd = new THREE.Vector3(0, -halfHeight * 0.6, -halfLength * 0.68)
  const analPeak = new THREE.Vector3(0, -halfHeight * 1.15, -halfLength * 0.52)
  const anal = triangleGeometry([[analBaseStart, analPeak, analBaseEnd]], finColor)

  const sideX = width * 0.47
  const pectoralTop = new THREE.Vector3(sideX, -halfHeight * 0.08, halfLength * 0.3)
  const pectoralBase = new THREE.Vector3(sideX * 0.85, -halfHeight * 0.4, halfLength * 0.12)
  const pectoralTip = new THREE.Vector3(sideX * 1.7, -halfHeight * 0.5, halfLength * 0.42)
  const pectoralLeft = triangleGeometry(
    [[pectoralTop, pectoralBase, pectoralTip]],
    finColor,
  )
  const pectoralRight = pectoralLeft.clone()
  pectoralRight.scale(-1, 1, 1)
  pectoralRight.computeVertexNormals()

  return [tail, dorsal, anal, pectoralLeft, pectoralRight]
}

function buildWhiskers(species: Species): THREE.BufferGeometry[] {
  if (species.id !== 'catfish') return []
  const length = 0.46 * species.body.length
  const whiskers: THREE.BufferGeometry[] = []
  const color = finColor.clone().lerp(bellyColor, 0.4)
  for (let i = 0; i < 4; i += 1) {
    const geo = new THREE.CylinderGeometry(0.006, 0.014, length, 3, 1)
    geo.deleteAttribute('uv')
    geo.translate(0, length * 0.5, 0)
    geo.rotateX(Math.PI * 0.58)
    geo.rotateY((i - 1.5) * 0.34)
    const side = i < 2 ? -1 : 1
    geo.translate(
      side * (0.04 + Math.abs(i - 1.5) * 0.015),
      -0.02 - (i % 2) * 0.04,
      0.44 * species.body.length * 0.5,
    )
    const flat = geo.toNonIndexed()
    geo.dispose()
    const colors = new Float32Array(flat.attributes.position.count * 3)
    const count = flat.attributes.position.count
    for (let c = 0; c < count; c += 1) {
      colors[c * 3] = color.r
      colors[c * 3 + 1] = color.g
      colors[c * 3 + 2] = color.b
    }
    flat.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    flat.computeVertexNormals()
    whiskers.push(flat)
  }
  return whiskers
}

export function buildFishVisual(species: Species): FishVisual {
  backColor.set(species.palette.back)
  midColor.set(species.palette.mid)
  bellyColor.set(species.palette.belly)
  finColor.set(species.palette.fin)
  accentColor.set(species.palette.accent)

  const body = buildBody(species)
  const fins = buildFins(species)
  const whiskers = buildWhiskers(species)
  const geometries = [body, ...fins, ...whiskers]
  const merged = mergeGeometries(geometries, false)
  for (const geometry of geometries) geometry.dispose()
  if (!merged) throw new Error(`Could not build fish geometry for ${species.id}`)
  merged.computeBoundingBox()
  const size = new THREE.Vector3()
  merged.boundingBox?.getSize(size)

  const timeUniform = { value: 0 }
  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#86a79c'),
    vertexColors: true,
    side: THREE.DoubleSide,
    fog: true,
  })
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = timeUniform
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        attribute vec2 aSwim;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float tailMask = smoothstep(-0.06, -0.92, position.z);
        float swimWiggle = sin(uTime * (4.2 + aSwim.y * 3.4) + aSwim.x + position.z * 2.3);
        transformed.x += swimWiggle * (0.012 + tailMask * 0.13) * (0.35 + aSwim.y);
        transformed.y += sin(uTime * 1.7 + aSwim.x) * 0.006 * (0.3 + tailMask);
        `,
      )
  }
  material.customProgramCacheKey = () => 'off-the-dock-fish-swim'

  return {
    geometry: merged,
    material,
    timeUniform,
    nativeLength: Math.max(0.8, size.z),
  }
}

export function applyFishSwimAttribute(
  geometry: THREE.BufferGeometry,
  phases: ReadonlyArray<{ phase: number; amplitude: number }>,
): void {
  const values = new Float32Array(phases.length * 2)
  phases.forEach((entry, index) => {
    values[index * 2] = entry.phase
    values[index * 2 + 1] = entry.amplitude
  })
  const attribute = new THREE.InstancedBufferAttribute(values, 2)
  geometry.setAttribute('aSwim', attribute)
}
