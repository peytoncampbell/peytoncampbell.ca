import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CABIN_POSITION, terrainHeight } from '../game/world'
import { useGameStore } from '../store/useGameStore'
import { PALETTES } from './palette'

const PUFF_COUNT = 6

function makeSmokeTexture(): THREE.CanvasTexture {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 1, size / 2, size / 2, size / 2)
    gradient.addColorStop(0, 'rgba(228, 224, 214, 0.65)')
    gradient.addColorStop(0.45, 'rgba(216, 212, 202, 0.24)')
    gradient.addColorStop(1, 'rgba(205, 202, 194, 0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

export function Cabin() {
  const baseY = useMemo(() => terrainHeight(CABIN_POSITION.x, CABIN_POSITION.z), [])
  const smokeRefs = useRef<Array<THREE.Sprite | null>>([])
  const smokeTexture = useMemo(makeSmokeTexture, [])
  const smokeMaterials = useMemo(
    () =>
      Array.from({ length: PUFF_COUNT }, () => {
        const material = new THREE.SpriteMaterial({
          map: smokeTexture,
          transparent: true,
          opacity: 0.08,
          depthWrite: false,
          color: new THREE.Color('#a9a69c'),
        })
        return material
      }),
    [smokeTexture],
  )
  const windowMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#3a2a1a',
        emissive: new THREE.Color('#ffb45e'),
        emissiveIntensity: 0.35,
        roughness: 0.45,
        metalness: 0,
      }),
    [],
  )
  const doorMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#40352a', roughness: 0.92, flatShading: true }),
    [],
  )
  const wallMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#574632', roughness: 0.96, flatShading: true }),
    [],
  )
  const roofMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#383129', roughness: 0.9, flatShading: true }),
    [],
  )
  const gableMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#4a3d2d', roughness: 0.96, flatShading: true }),
    [],
  )
  const stoneMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#5e5c54', roughness: 1, flatShading: true }),
    [],
  )
  const gableGeometry = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(-2.25, 0)
    shape.lineTo(2.25, 0)
    shape.lineTo(0, 1.45)
    shape.closePath()
    const geometry = new THREE.ShapeGeometry(shape)
    geometry.computeVertexNormals()
    return geometry
  }, [])

  useEffect(() => {
    return () => {
      smokeTexture.dispose()
      smokeMaterials.forEach((material) => material.dispose())
      windowMaterial.dispose()
      doorMaterial.dispose()
      wallMaterial.dispose()
      roofMaterial.dispose()
      gableMaterial.dispose()
      stoneMaterial.dispose()
      gableGeometry.dispose()
    }
  }, [
    smokeTexture,
    smokeMaterials,
    windowMaterial,
    doorMaterial,
    wallMaterial,
    roofMaterial,
    gableMaterial,
    stoneMaterial,
    gableGeometry,
  ])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    const time = state.clock.elapsedTime
    windowMaterial.emissiveIntensity = THREE.MathUtils.damp(
      windowMaterial.emissiveIntensity,
      PALETTES[useGameStore.getState().timeOfDay].windowLight,
      1.4,
      dt,
    )
    smokeRefs.current.forEach((sprite, index) => {
      if (!sprite) return
      const phase = ((time * 0.11 + index / PUFF_COUNT) % 1)
      const rise = phase * 3.1
      const angle = time * 0.14 + index * 1.9
      sprite.position.set(
        0.35 + Math.sin(angle) * (0.18 + phase * 0.4),
        4.35 + rise,
        -0.4 + Math.cos(angle * 0.8) * (0.14 + phase * 0.28),
      )
      const scale = 0.55 + phase * 1.35
      sprite.scale.set(scale, scale * 0.8, 1)
      const material = smokeMaterials[index]
      if (material) material.opacity = Math.sin(phase * Math.PI) * 0.11
    })
  })

  return (
    <group position={[CABIN_POSITION.x, baseY, CABIN_POSITION.z]} rotation={[0, Math.PI + 0.2, 0]}>
      <mesh material={wallMaterial} castShadow receiveShadow position={[0, 1.28, 0]}>
        <boxGeometry args={[4.5, 2.56, 4.1]} />
      </mesh>

      <mesh material={roofMaterial} castShadow receiveShadow position={[-1.18, 3.08, 0]} rotation={[0, 0, 0.59]}>
        <boxGeometry args={[5.15, 0.18, 4.9]} />
      </mesh>
      <mesh material={roofMaterial} castShadow receiveShadow position={[1.18, 3.08, 0]} rotation={[0, 0, -0.59]}>
        <boxGeometry args={[5.15, 0.18, 4.9]} />
      </mesh>

      <mesh position={[0, 2.56, 2.07]} material={gableMaterial} geometry={gableGeometry} castShadow />

      <mesh material={wallMaterial} castShadow position={[0, 1.4, 2.08]}>
        <boxGeometry args={[3.2, 1.7, 0.12]} />
      </mesh>

      <mesh material={doorMaterial} position={[-0.95, 1.7, 2.12]}>
        <boxGeometry args={[1.14, 1.02, 0.07]} />
      </mesh>
      <mesh material={windowMaterial} position={[-0.95, 1.7, 2.16]}>
        <planeGeometry args={[0.9, 0.8]} />
      </mesh>
      <mesh material={doorMaterial} position={[-0.95, 1.7, 2.18]}>
        <boxGeometry args={[0.06, 0.8, 0.02]} />
      </mesh>
      <mesh material={doorMaterial} position={[-0.95, 1.7, 2.18]}>
        <boxGeometry args={[0.9, 0.06, 0.02]} />
      </mesh>

      <mesh material={doorMaterial} position={[1.2, 0.72, 2.14]} castShadow>
        <boxGeometry args={[0.88, 1.5, 0.12]} />
      </mesh>
      <mesh material={stoneMaterial} position={[1.2, 0.45, 2.52]}>
        <boxGeometry args={[1.25, 0.14, 0.72]} />
      </mesh>

      <mesh material={stoneMaterial} castShadow position={[1.45, 3.7, -0.7]}>
        <boxGeometry args={[0.55, 1.9, 0.55]} />
      </mesh>
      <mesh material={roofMaterial} position={[1.45, 4.7, -0.7]}>
        <boxGeometry args={[0.68, 0.1, 0.68]} />
      </mesh>

      <group position={[-1.85, 0, 2.35]}>
        <mesh material={doorMaterial} position={[0, 1.28, 0]}>
          <boxGeometry args={[0.12, 2.35, 0.12]} />
        </mesh>
        <mesh material={doorMaterial} position={[1.55, 1.28, 0]}>
          <boxGeometry args={[0.12, 2.35, 0.12]} />
        </mesh>
        <mesh material={roofMaterial} position={[0.75, 2.48, 0]} rotation={[0.12, 0, 0]} castShadow>
          <boxGeometry args={[1.9, 0.12, 1.15]} />
        </mesh>
        <mesh position={[0.75, 2.1, 0.08]} material={windowMaterial}>
          <boxGeometry args={[0.16, 0.22, 0.16]} />
        </mesh>
      </group>

      <mesh material={stoneMaterial} position={[0, 0.08, 0]}>
        <boxGeometry args={[4.75, 0.28, 4.35]} />
      </mesh>

      {Array.from({ length: PUFF_COUNT }).map((_, index) => (
        <sprite
          key={index}
          ref={(node) => {
            smokeRefs.current[index] = node
          }}
          material={smokeMaterials[index] ?? undefined}
          position={[0.35, 4.4, -0.4]}
          scale={[0.6, 0.5, 1]}
        />
      ))}
    </group>
  )
}
