import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mulberry32 } from '../game/rng'
import { spawnRipple } from '../game/runtime'
import { useGameStore } from '../store/useGameStore'

const RAIN_COUNT = 720

interface RainDrop {
  x: number
  y: number
  z: number
  speed: number
  length: number
  wind: number
}

export function Rain() {
  const rippleClock = useRef(0)
  const assets = useMemo(() => {
    const rng = mulberry32(0x4a1f)
    const drops: RainDrop[] = []
    const positions = new Float32Array(RAIN_COUNT * 6)
    for (let i = 0; i < RAIN_COUNT; i += 1) {
      const drop: RainDrop = {
        x: -18 + rng() * 36,
        y: 0.2 + rng() * 13,
        z: -6 + rng() * 24,
        speed: 9 + rng() * 7,
        length: 0.45 + rng() * 0.85,
        wind: 0.2 + rng() * 0.45,
      }
      drops.push(drop)
      positions[i * 6] = drop.x
      positions[i * 6 + 1] = drop.y
      positions[i * 6 + 2] = drop.z
      positions[i * 6 + 3] = drop.x + drop.wind * 0.1
      positions[i * 6 + 4] = drop.y - drop.length
      positions[i * 6 + 5] = drop.z
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const material = new THREE.LineBasicMaterial({
      color: '#c4d4d4',
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: true,
    })
    const line = new THREE.LineSegments(geometry, material)
    line.frustumCulled = false
    line.renderOrder = 6
    line.visible = false
    return { drops, positions, geometry, material, line }
  }, [])

  useEffect(() => {
    return () => {
      assets.geometry.dispose()
      assets.material.dispose()
    }
  }, [assets])

  useFrame((_state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05)
    const store = useGameStore.getState()
    const target = store.weather === 'rain' ? (store.reducedMotion ? 0.18 : 0.34) : 0
    assets.material.opacity = THREE.MathUtils.damp(assets.material.opacity, target, 1.5, dt)
    assets.line.visible = assets.material.opacity > 0.005
    if (!assets.line.visible) return

    const positions = assets.positions
    for (let i = 0; i < assets.drops.length; i += 1) {
      const drop = assets.drops[i]!
      drop.y -= drop.speed * dt
      drop.x += drop.wind * dt
      if (drop.y < -0.1) {
        drop.x = -18 + Math.random() * 36
        drop.z = -6 + Math.random() * 24
        drop.y = 9 + Math.random() * 5
      }
      if (drop.x > 18) drop.x = -18
      positions[i * 6] = drop.x
      positions[i * 6 + 1] = drop.y
      positions[i * 6 + 2] = drop.z
      positions[i * 6 + 3] = drop.x + drop.wind * 0.08
      positions[i * 6 + 4] = drop.y - drop.length
      positions[i * 6 + 5] = drop.z
    }
    const attribute = assets.geometry.attributes.position as THREE.BufferAttribute
    attribute.needsUpdate = true
    assets.material.color.set(
      store.timeOfDay === 'night' ? '#93a9b1' : store.timeOfDay === 'blue' ? '#aebfc5' : '#c4d4d4',
    )

    rippleClock.current += dt
    if (store.weather === 'rain' && rippleClock.current > 0.16) {
      rippleClock.current = 0
      const x = -14 + Math.random() * 28
      const z = Math.max(-2, -5 + Math.random() * 18)
      spawnRipple(x, z, 0.22 + Math.random() * 0.24, 0.75, 0.26)
      if (Math.random() < 0.3) {
        spawnRipple(x + Math.random() * 3, z + Math.random() * 2, 0.18, 0.65, 0.18)
      }
    }
  })

  return <primitive object={assets.line} />
}

export function Weather() {
  return <Rain />
}
