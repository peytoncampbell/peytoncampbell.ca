import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mulberry32 } from '../game/rng'
import { useGameStore } from '../store/useGameStore'
import { PALETTES } from './palette'

/* ------------------------------------------------------------------ */
/* Birds                                                               */
/* ------------------------------------------------------------------ */

interface BirdConfig {
  radius: number
  height: number
  speed: number
  phase: number
  centerX: number
  centerZ: number
  scale: number
}

const BIRDS: BirdConfig[] = [
  { radius: 17, height: 8.6, speed: 0.055, phase: 0.3, centerX: -2, centerZ: 2, scale: 1.3 },
  { radius: 14, height: 9.8, speed: 0.043, phase: 2.2, centerX: 3, centerZ: 5, scale: 1.05 },
  { radius: 20, height: 7.6, speed: 0.036, phase: 4.1, centerX: -5, centerZ: 0, scale: 1.5 },
  { radius: 11, height: 10.4, speed: 0.06, phase: 5.4, centerX: 5, centerZ: -1, scale: 0.9 },
]

function Bird({ config }: { config: BirdConfig }) {
  const groupRef = useRef<THREE.Group>(null)
  const leftWingRef = useRef<THREE.Group>(null)
  const rightWingRef = useRef<THREE.Group>(null)
  const bodyMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#303631', roughness: 0.9, flatShading: true }),
    [],
  )
  const wingMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#343b35',
        roughness: 0.92,
        flatShading: true,
        side: THREE.DoubleSide,
      }),
    [],
  )

  useEffect(() => {
    return () => {
      bodyMaterial.dispose()
      wingMaterial.dispose()
    }
  }, [bodyMaterial, wingMaterial])

  useFrame((state) => {
    const group = groupRef.current
    if (!group) return
    const store = useGameStore.getState()
    group.visible = store.timeOfDay !== 'night'
    if (!group.visible) return
    const time = state.clock.elapsedTime
    const angle = config.phase + time * config.speed
    group.position.set(
      config.centerX + Math.cos(angle) * config.radius,
      config.height + Math.sin(time * 0.7 + config.phase) * 0.45,
      config.centerZ + Math.sin(angle) * config.radius,
    )
    group.rotation.set(
      Math.sin(time * 0.4 + config.phase) * 0.08,
      -angle,
      Math.cos(time * 0.5 + config.phase) * 0.12,
    )
    const flap = Math.sin(time * 6.2 + config.phase) * 0.45
    if (leftWingRef.current) leftWingRef.current.rotation.z = flap
    if (rightWingRef.current) rightWingRef.current.rotation.z = -flap
  })

  return (
    <group ref={groupRef} scale={config.scale}>
      <mesh material={bodyMaterial} rotation={[Math.PI / 2, 0, 0]} scale={[0.08, 0.5, 0.1]}>
        <coneGeometry args={[0.5, 1, 4]} />
      </mesh>
      <mesh material={bodyMaterial} position={[0, 0.01, 0.28]}>
        <sphereGeometry args={[0.06, 5, 4]} />
      </mesh>
      <group ref={leftWingRef} position={[0.06, 0.02, 0]}>
        <mesh material={wingMaterial} position={[0.32, 0, 0]}>
          <boxGeometry args={[0.64, 0.014, 0.15]} />
        </mesh>
      </group>
      <group ref={rightWingRef} position={[-0.06, 0.02, 0]}>
        <mesh material={wingMaterial} position={[-0.32, 0, 0]}>
          <boxGeometry args={[0.64, 0.014, 0.15]} />
        </mesh>
      </group>
    </group>
  )
}

export function Birds() {
  return (
    <group>
      {BIRDS.map((config, index) => (
        <Bird key={index} config={config} />
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Dragonflies                                                         */
/* ------------------------------------------------------------------ */

interface DragonflyConfig {
  centerX: number
  centerZ: number
  height: number
  phase: number
  scale: number
}

const DRAGONFLIES: DragonflyConfig[] = [
  { centerX: 6.6, centerZ: 1.2, height: 0.75, phase: 0.4, scale: 1 },
  { centerX: -5.4, centerZ: 0.2, height: 0.62, phase: 2.3, scale: 0.8 },
  { centerX: 10.2, centerZ: 6.4, height: 0.9, phase: 4.2, scale: 0.9 },
]

function Dragonfly({ config }: { config: DragonflyConfig }) {
  const groupRef = useRef<THREE.Group>(null)
  const leftWingRef = useRef<THREE.Group>(null)
  const rightWingRef = useRef<THREE.Group>(null)
  const bodyMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#5f6d5a', roughness: 0.6, metalness: 0.15, flatShading: true }),
    [],
  )
  const wingMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#d5e0d4',
        roughness: 0.25,
        metalness: 0,
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    [],
  )

  useEffect(() => {
    return () => {
      bodyMaterial.dispose()
      wingMaterial.dispose()
    }
  }, [bodyMaterial, wingMaterial])

  useFrame((state) => {
    const group = groupRef.current
    if (!group) return
    const store = useGameStore.getState()
    group.visible = store.timeOfDay !== 'night' && store.weather !== 'rain'
    if (!group.visible) return
    const time = state.clock.elapsedTime
    const drift = time * 0.37 + config.phase
    const x = config.centerX + Math.sin(drift) * 1.25 + Math.sin(drift * 2.7) * 0.3
    const z = config.centerZ + Math.cos(drift * 0.8) * 1.1
    group.position.set(x, config.height + Math.sin(time * 1.9 + config.phase) * 0.11, z)
    group.rotation.set(0.12 + Math.cos(time * 0.7) * 0.08, Math.sin(drift * 0.6) * 1.1, Math.sin(time * 1.2) * 0.08)
    const flap = 0.35 + Math.abs(Math.sin(time * 44 + config.phase)) * 0.55
    if (leftWingRef.current) leftWingRef.current.rotation.z = flap
    if (rightWingRef.current) rightWingRef.current.rotation.z = -flap
  })

  return (
    <group ref={groupRef} scale={config.scale}>
      <mesh material={bodyMaterial} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.022, 0.028, 0.42, 5]} />
      </mesh>
      <mesh material={bodyMaterial} position={[0, 0, 0.24]}>
        <sphereGeometry args={[0.045, 6, 4]} />
      </mesh>
      <mesh material={bodyMaterial} position={[0, 0, 0.29]}>
        <sphereGeometry args={[0.028, 5, 4]} />
      </mesh>
      <group ref={leftWingRef} position={[0.03, 0.02, 0.08]}>
        <mesh material={wingMaterial} position={[0.17, 0, 0]} rotation={[-Math.PI / 2, -0.15, 0]}>
          <planeGeometry args={[0.33, 0.07]} />
        </mesh>
        <mesh material={wingMaterial} position={[0.15, 0, -0.08]} rotation={[-Math.PI / 2, 0.1, 0]}>
          <planeGeometry args={[0.27, 0.06]} />
        </mesh>
      </group>
      <group ref={rightWingRef} position={[-0.03, 0.02, 0.08]}>
        <mesh material={wingMaterial} position={[-0.17, 0, 0]} rotation={[-Math.PI / 2, 0.15, 0]}>
          <planeGeometry args={[0.33, 0.07]} />
        </mesh>
        <mesh material={wingMaterial} position={[-0.15, 0, -0.08]} rotation={[-Math.PI / 2, -0.1, 0]}>
          <planeGeometry args={[0.27, 0.06]} />
        </mesh>
      </group>
    </group>
  )
}

export function Dragonflies() {
  return (
    <group>
      {DRAGONFLIES.map((config, index) => (
        <Dragonfly key={index} config={config} />
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Fireflies and motes                                                 */
/* ------------------------------------------------------------------ */

const glowVertex = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  attribute float aSeed;
  varying float vGlow;
  void main() {
    vec3 p = position;
    p.x += sin(uTime * 0.32 + aSeed * 9.1) * 0.7;
    p.y += sin(uTime * 0.5 + aSeed * 13.7) * 0.28;
    p.z += cos(uTime * 0.27 + aSeed * 7.3) * 0.6;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float blink = pow(max(0.0, sin(uTime * 0.8 + aSeed * 30.0)), 5.0);
    vGlow = blink;
    gl_PointSize = clamp((44.0 + blink * 36.0) * uPixelRatio / max(1.0, -mv.z), 2.0, 11.0);
    gl_Position = projectionMatrix * mv;
  }
`

const glowFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uAmount;
  varying float vGlow;
  void main() {
    vec2 centered = gl_PointCoord - vec2(0.5);
    float dist = length(centered);
    float halo = smoothstep(0.5, 0.0, dist);
    float core = smoothstep(0.15, 0.0, dist);
    float alpha = (halo * 0.55 + core) * vGlow * uAmount;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(uColor, alpha);
  }
`

function GlowPoints({
  count,
  area,
  color,
  seed,
  heightRange,
  mode,
}: {
  count: number
  area: { x: number; z: number; radius: number }
  color: THREE.Color
  seed: number
  heightRange: [number, number]
  mode: 'fireflies' | 'motes'
}) {
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const { geometry, uniforms } = useMemo(() => {
    const rng = mulberry32(seed)
    const positions = new Float32Array(count * 3)
    const phases = new Float32Array(count)
    for (let i = 0; i < count; i += 1) {
      const angle = rng() * Math.PI * 2
      const radius = Math.sqrt(rng()) * area.radius
      const z = area.z + Math.sin(angle) * radius
      positions[i * 3] = area.x + Math.cos(angle) * radius
      positions[i * 3 + 1] = heightRange[0] + rng() * (heightRange[1] - heightRange[0])
      positions[i * 3 + 2] = z
      phases[i] = rng()
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(phases, 1))
    const uniformSet = {
      uTime: { value: 0 },
      uPixelRatio: {
        value: Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio : 1),
      },
      uColor: { value: color.clone() },
      uAmount: { value: 0 },
    }
    return { geometry: geo, uniforms: uniformSet }
  }, [count, area.x, area.z, area.radius, color, seed, heightRange, mode])

  useEffect(() => {
    return () => {
      geometry.dispose()
    }
  }, [geometry])

  useFrame((state, delta) => {
    const store = useGameStore.getState()
    const palette = PALETTES[store.timeOfDay]
    const time = state.clock.elapsedTime
    uniforms.uTime.value = time
    const targetAmount =
      mode === 'fireflies'
        ? palette.fireflies * (store.weather === 'rain' ? 0.15 : 1)
        : store.timeOfDay === 'golden'
          ? 0.32
          : store.timeOfDay === 'blue'
            ? 0.18
            : 0
    uniforms.uAmount.value = THREE.MathUtils.damp(
      uniforms.uAmount.value,
      targetAmount,
      1.1,
      Math.min(delta, 0.05),
    )
    uniforms.uColor.value.lerp(color, 0.02)
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = uniforms.uTime.value
      materialRef.current.uniforms.uAmount.value = uniforms.uAmount.value
      materialRef.current.uniforms.uColor.value.copy(uniforms.uColor.value)
    }
  })

  return (
    <points geometry={geometry} frustumCulled={false} renderOrder={5}>
      <shaderMaterial
        ref={materialRef}
        vertexShader={glowVertex}
        fragmentShader={glowFragment}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  )
}

const fireflyColor = new THREE.Color('#ffd08a')
const moteColor = new THREE.Color('#e7c992')

const FIREFLY_COUNT = 64
const fireflyTint = new THREE.Color(0, 0, 0)

interface FireflySeed {
  x: number
  y: number
  z: number
  phase: number
  speed: number
  scale: number
}

function makeFireflies(): FireflySeed[] {
  const rng = mulberry32(0xf1e)
  const clusters = [
    { x: -8, z: 3.5, radius: 6.5, count: 26 },
    { x: 5.5, z: 7.5, radius: 5.5, count: 22 },
    { x: -1.5, z: 12.5, radius: 5, count: 16 },
  ]
  const seeds: FireflySeed[] = []
  for (const cluster of clusters) {
    for (let i = 0; i < cluster.count; i += 1) {
      const angle = rng() * Math.PI * 2
      const radius = 0.8 + Math.sqrt(rng()) * cluster.radius
      seeds.push({
        x: cluster.x + Math.cos(angle) * radius,
        y: 0.3 + rng() * 1.65,
        z: cluster.z + Math.sin(angle) * radius,
        phase: rng() * Math.PI * 2,
        speed: 0.35 + rng() * 0.65,
        scale: 0.7 + rng() * 0.7,
      })
    }
  }
  return seeds.slice(0, FIREFLY_COUNT)
}

export function Fireflies() {
  const seeds = useMemo(makeFireflies, [])
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const assets = useMemo(() => {
    const geometry = new THREE.SphereGeometry(1, 6, 4)
    const material = new THREE.MeshBasicMaterial({
      color: fireflyColor,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    })
    return { geometry, material }
  }, [])

  useEffect(() => {
    return () => {
      assets.geometry.dispose()
      assets.material.dispose()
    }
  }, [assets])

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const color = new THREE.Color(0, 0, 0)
    for (let i = 0; i < seeds.length; i += 1) mesh.setColorAt(i, color)
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  }, [seeds])

  useFrame((state, _delta) => {
    const mesh = meshRef.current
    if (!mesh) return
    const store = useGameStore.getState()
    const palette = PALETTES[store.timeOfDay]
    const amount = palette.fireflies * (store.reducedMotion ? 0.45 : 1)
    const time = state.clock.elapsedTime
    mesh.visible = amount > 0.015
    if (!mesh.visible) return
    for (let i = 0; i < seeds.length; i += 1) {
      const seed = seeds[i]!
      const drift = time * seed.speed + seed.phase
      const blink = Math.pow(Math.max(0, Math.sin(time * 1.5 + seed.phase * 9.7)), 4)
      const brightness = amount * (0.18 + blink * 0.95)
      dummy.position.set(
        seed.x + Math.sin(drift * 0.8) * 0.65,
        seed.y + Math.sin(drift * 1.3 + 1.4) * 0.2,
        seed.z + Math.cos(drift * 0.6) * 0.55,
      )
      dummy.rotation.set(0, 0, 0)
      dummy.scale.setScalar((0.026 + blink * 0.035) * seed.scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      fireflyTint.setRGB(brightness, brightness * 0.78, brightness * 0.42)
      mesh.setColorAt(i, fireflyTint)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[assets.geometry, assets.material, seeds.length]}
      frustumCulled={false}
      renderOrder={7}
    />
  )
}

export function Motes() {
  return (
    <GlowPoints
      count={100}
      area={{ x: 0, z: 6, radius: 14 }}
      color={moteColor}
      seed={0x30f0}
      heightRange={[0.5, 5.5]}
      mode="motes"
    />
  )
}

const starVertex = /* glsl */ `
  uniform float uPixelRatio;
  uniform float uTime;
  attribute float aSeed;
  varying float vTwinkle;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vTwinkle = 0.6 + 0.4 * sin(uTime * 1.1 + aSeed * 40.0);
    gl_PointSize = (1.35 + fract(aSeed * 17.3) * 1.5) * uPixelRatio;
    gl_Position = projectionMatrix * mv;
  }
`

const starFragment = /* glsl */ `
  uniform float uOpacity;
  varying float vTwinkle;
  void main() {
    vec2 centered = gl_PointCoord - vec2(0.5);
    float dist = length(centered);
    float alpha = smoothstep(0.5, 0.08, dist) * uOpacity * vTwinkle;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(0.86, 0.9, 1.0, alpha);
  }
`

export function Stars() {
  const pointsRef = useRef<THREE.Points>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const { geometry, uniforms } = useMemo(() => {
    const rng = mulberry32(0x57a8)
    const count = 300
    const positions = new Float32Array(count * 3)
    const seeds = new Float32Array(count)
    for (let i = 0; i < count; i += 1) {
      const azimuth = rng() * Math.PI * 2
      const elevation = Math.asin(0.04 + rng() * 0.92)
      const radius = 118
      positions[i * 3] = Math.cos(elevation) * Math.cos(azimuth) * radius
      positions[i * 3 + 1] = Math.sin(elevation) * radius
      positions[i * 3 + 2] = Math.cos(elevation) * Math.sin(azimuth) * radius
      seeds[i] = rng()
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
    return {
      geometry: geo,
      uniforms: {
        uPixelRatio: {
          value: Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio : 1),
        },
        uTime: { value: 0 },
        uOpacity: { value: 0 },
      },
    }
  }, [])

  useEffect(() => {
    return () => {
      geometry.dispose()
    }
  }, [geometry])

  useFrame((state, delta) => {
    const points = pointsRef.current
    if (!points) return
    const store = useGameStore.getState()
    const palette = PALETTES[store.timeOfDay]
    const visibility = palette.stars * (store.weather === 'mist' ? 0.18 : store.weather === 'rain' ? 0.06 : 1)
    uniforms.uOpacity.value = THREE.MathUtils.damp(
      uniforms.uOpacity.value,
      visibility,
      1.3,
      Math.min(delta, 0.05),
    )
    uniforms.uTime.value = state.clock.elapsedTime
    points.visible = uniforms.uOpacity.value > 0.01
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = uniforms.uTime.value
      materialRef.current.uniforms.uOpacity.value = uniforms.uOpacity.value
    }
  })

  return (
    <points ref={pointsRef} geometry={geometry} frustumCulled={false} renderOrder={1}>
      <shaderMaterial
        ref={materialRef}
        vertexShader={starVertex}
        fragmentShader={starFragment}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  )
}

/* ------------------------------------------------------------------ */
/* A little shoreline life                                             */
/* ------------------------------------------------------------------ */

function makeMistTexture(): THREE.CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2)
    gradient.addColorStop(0, 'rgba(232,236,231,0.22)')
    gradient.addColorStop(0.4, 'rgba(225,231,226,0.11)')
    gradient.addColorStop(1, 'rgba(224,230,226,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
    const rng = mulberry32(0xa11)
    for (let i = 0; i < 9; i += 1) {
      const x = 24 + rng() * 80
      const y = 30 + rng() * 70
      const r = 10 + rng() * 30
      const blob = ctx.createRadialGradient(x, y, 1, x, y, r)
      blob.addColorStop(0, 'rgba(245,247,242,0.06)')
      blob.addColorStop(1, 'rgba(245,247,242,0)')
      ctx.fillStyle = blob
      ctx.fillRect(x - r, y - r, r * 2, r * 2)
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

const MIST_SPRITES = [
  { x: -12, y: 1.2, z: 4, sx: 18, sy: 5.5 },
  { x: 10, y: 1.4, z: 8, sx: 20, sy: 6 },
  { x: -3, y: 1.0, z: 13, sx: 22, sy: 5 },
  { x: 15, y: 1.6, z: 1, sx: 14, sy: 4.5 },
  { x: -16, y: 1.8, z: -1, sx: 16, sy: 5 },
]

export function MistBanks() {
  const texture = useMemo(makeMistTexture, [])
  const groupRef = useRef<THREE.Group>(null)
  const material = useMemo(
    () =>
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        opacity: 0,
        color: new THREE.Color('#d5dcd6'),
      }),
    [texture],
  )

  useEffect(() => {
    return () => {
      texture.dispose()
      material.dispose()
    }
  }, [texture, material])

  useFrame((state, delta) => {
    const store = useGameStore.getState()
    const palette = PALETTES[store.timeOfDay]
    const dt = Math.min(delta, 0.05)
    const ambientDawn = store.timeOfDay === 'blue' && store.weather === 'calm' ? 0.3 : 0
    const target = store.weather === 'mist' ? 1 : store.weather === 'rain' ? 0.28 : ambientDawn
    material.opacity = THREE.MathUtils.damp(material.opacity, target, 1.1, dt)
    material.color.lerp(palette.fog, 1 - Math.exp(-1.3 * dt))
    const group = groupRef.current
    if (!group) return
    group.visible = material.opacity > 0.01
    group.children.forEach((child, index) => {
      const config = MIST_SPRITES[index]
      if (!config) return
      child.position.x = config.x + Math.sin(state.clock.elapsedTime * 0.014 + index * 1.7) * 3.5
      child.position.y = config.y + Math.sin(state.clock.elapsedTime * 0.07 + index) * 0.2
    })
  })

  return (
    <group ref={groupRef}>
      {MIST_SPRITES.map((sprite, index) => (
        <sprite
          key={index}
          material={material}
          position={[sprite.x, sprite.y, sprite.z]}
          scale={[sprite.sx, sprite.sy, 1]}
        />
      ))}
    </group>
  )
}

export function ShoreLife() {
  return (
    <>
      <Birds />
      <Dragonflies />
      <Fireflies />
      <Motes />
      <Stars />
      <MistBanks />
    </>
  )
}


