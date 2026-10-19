import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../store/useGameStore'
import { runtime } from '../game/runtime'
import { DOCK } from '../game/world'
import { buildFishVisual } from './fishVisuals'
import { SPECIES, type SpeciesId } from '../game/species'

const LINE_POINTS = 32
const lineStart = new THREE.Vector3()
const lineEnd = new THREE.Vector3()
const baseBobber = new THREE.Vector3()
const lineColor = new THREE.Color()
const calmLine = new THREE.Color('#e7dfc9')
const tenseLine = new THREE.Color('#d89a58')
const dangerLine = new THREE.Color('#d97a55')
const catchStart = new THREE.Vector3()
const catchEnd = new THREE.Vector3()

function bobberPositionForPhase(phase: string, time: number): THREE.Vector3 {
  if (phase === 'idle' || phase === 'charging' || phase === 'snapped') {
    const length = 0.52 + (phase === 'charging' ? runtime.castPower * 0.24 : 0)
    const swing = Math.sin(time * 1.4) * 0.05
    baseBobber.set(
      runtime.rodTip.x + swing + 0.03,
      runtime.rodTip.y - length,
      runtime.rodTip.z + 0.12,
    )
    return baseBobber
  }
  baseBobber.copy(runtime.bobber)
  if (phase === 'waiting' || phase === 'bite' || phase === 'reeling') {
    baseBobber.y -= runtime.bobberSink + runtime.bobberDip
  }
  return baseBobber
}

export function FishingRig() {
  const bobberRef = useRef<THREE.Group>(null)
  const phase = useGameStore((state) => state.phase)
  const hookedFishId = useGameStore((state) => state.hookedFishId)
  const residents = useGameStore((state) => state.residents)

  const hookedResident = residents.find((resident) => resident.id === hookedFishId)
  const caughtSpecies = phase === 'catch' ? hookedResident?.speciesId ?? null : null

  const bobberAssets = useMemo(() => {
    const white = new THREE.MeshStandardMaterial({ color: '#e7dfce', roughness: 0.5, flatShading: true })
    const red = new THREE.MeshStandardMaterial({ color: '#a84938', roughness: 0.5, flatShading: true })
    const dark = new THREE.MeshStandardMaterial({ color: '#3f3b33', roughness: 0.7, flatShading: true })
    const lineMaterial = new THREE.LineBasicMaterial({
      color: calmLine.clone(),
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    })
    const lineGeometry = new THREE.BufferGeometry()
    lineGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(LINE_POINTS * 3), 3),
    )
    const lineObject = new THREE.Line(lineGeometry, lineMaterial)
    lineObject.frustumCulled = false
    return { white, red, dark, lineMaterial, lineGeometry, lineObject }
  }, [])

  useEffect(() => {
    return () => {
      bobberAssets.white.dispose()
      bobberAssets.red.dispose()
      bobberAssets.dark.dispose()
      bobberAssets.lineMaterial.dispose()
      bobberAssets.lineGeometry.dispose()
    }
  }, [bobberAssets])

  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05)
    const time = state.clock.elapsedTime
    const store = useGameStore.getState()
    const currentPhase = store.phase
    const tension = runtime.tension
    const bobber = bobberRef.current
    const line = bobberAssets.lineObject
    if (!line) return

    const position = bobberPositionForPhase(currentPhase, time)
    const showBobber =
      currentPhase === 'idle' ||
      currentPhase === 'charging' ||
      currentPhase === 'casting' ||
      currentPhase === 'waiting' ||
      currentPhase === 'bite' ||
      currentPhase === 'reeling'
    const showLine =
      currentPhase !== 'catch' && currentPhase !== 'caught'

    if (bobber) {
      bobber.visible = showBobber
      if (showBobber) {
        bobber.position.copy(position)
        if (currentPhase === 'waiting' || currentPhase === 'bite') {
          bobber.rotation.z = Math.sin(time * 2.1) * 0.16
          bobber.rotation.x = Math.cos(time * 1.7) * 0.1
        } else if (currentPhase === 'reeling') {
          bobber.rotation.z = Math.sin(time * 6.5) * 0.3
        } else {
          bobber.rotation.z = Math.sin(time * 1.3) * 0.12
          bobber.rotation.x = Math.sin(time * 0.9) * 0.08
        }
      }
    }

    line.visible = showLine
    if (showLine) {
      lineStart.copy(runtime.rodTip)
      lineEnd.copy(position)
      if (currentPhase === 'idle' || currentPhase === 'charging' || currentPhase === 'snapped') {
        lineEnd.y = lineStart.y - (currentPhase === 'snapped' ? 0.36 : 0.5 + runtime.castPower * 0.22)
        lineEnd.x = lineStart.x + Math.sin(time * 1.15) * 0.045
        lineEnd.z = lineStart.z + 0.06
      }

      const distance = lineStart.distanceTo(lineEnd)
      let sag = 0.16
      if (currentPhase === 'waiting') sag = 0.42
      else if (currentPhase === 'bite') sag = 0.07
      else if (currentPhase === 'reeling') sag = 0.09 - tension * 0.05
      else if (currentPhase === 'casting') sag = 0.24
      else if (currentPhase === 'idle' || currentPhase === 'charging' || currentPhase === 'snapped') sag = 0.01
      sag = Math.min(sag, Math.max(0.01, distance * 0.22))

      const positions = line.geometry.attributes.position as THREE.BufferAttribute
      const k = 3.2
      const denom = 1 - Math.cosh(k * 0.5)
      for (let i = 0; i < LINE_POINTS; i += 1) {
        const t = i / (LINE_POINTS - 1)
        const curve = (Math.cosh(k * (t - 0.5)) - Math.cosh(k * 0.5)) / denom
        const jitter =
          i === 0 || i === LINE_POINTS - 1
            ? 0
            : Math.sin(time * 13 + i * 1.7) * 0.003 * (1 + tension * 3)
        positions.setXYZ(
          i,
          THREE.MathUtils.lerp(lineStart.x, lineEnd.x, t),
          THREE.MathUtils.lerp(lineStart.y, lineEnd.y, t) - sag * curve + jitter,
          THREE.MathUtils.lerp(lineStart.z, lineEnd.z, t),
        )
      }
      positions.needsUpdate = true
      line.geometry.computeBoundingSphere()

      const lineMat = line.material as THREE.LineBasicMaterial
      lineColor.copy(calmLine)
      if (tension > 0.72) lineColor.lerp(dangerLine, Math.min(1, (tension - 0.72) / 0.28))
      else if (tension > 0.25) lineColor.lerp(tenseLine, (tension - 0.25) / 0.47)
      lineMat.color.lerp(lineColor, 1 - Math.exp(-9 * dt))
      lineMat.opacity = currentPhase === 'waiting' ? 0.72 : 0.92
    }
  })

  return (
    <group>
      <primitive object={bobberAssets.lineObject} />
      <group ref={bobberRef}>
        <mesh material={bobberAssets.white} position={[0, -0.045, 0]} castShadow>
          <sphereGeometry args={[0.068, 8, 6]} />
        </mesh>
        <mesh material={bobberAssets.red} position={[0, 0.015, 0]} castShadow>
          <sphereGeometry args={[0.07, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        <mesh material={bobberAssets.dark} position={[0, 0.09, 0]}>
          <cylinderGeometry args={[0.006, 0.008, 0.14, 4]} />
        </mesh>
        <mesh material={bobberAssets.dark} position={[0, -0.11, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.03, 5]} />
        </mesh>
      </group>
      {caughtSpecies && <CatchFish speciesId={caughtSpecies} />}
    </group>
  )
}

function CatchFish({ speciesId }: { speciesId: SpeciesId }) {
  const groupRef = useRef<THREE.Group>(null)
  const startRef = useRef<number | null>(null)
  const species = SPECIES[speciesId]
  const { geometry, material, nativeLength } = useMemo(() => {
    const visual = buildFishVisual(species)
    visual.material.dispose()
    const plain = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.58,
      metalness: 0.08,
      side: THREE.DoubleSide,
      emissive: speciesId === 'golden' ? new THREE.Color('#3a1d04') : new THREE.Color('#000000'),
      emissiveIntensity: speciesId === 'golden' ? 0.4 : 0,
    })
    return { geometry: visual.geometry, material: plain, nativeLength: visual.nativeLength }
  }, [species, speciesId])

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  useFrame((state) => {
    const group = groupRef.current
    if (!group) return
    if (startRef.current === null) {
      startRef.current = state.clock.elapsedTime
      catchStart.copy(runtime.bobber)
      catchEnd.set(DOCK.seatX + 0.85, 0.72, DOCK.endZ + 0.6)
    }
    const t = Math.min(1, (state.clock.elapsedTime - startRef.current) / 2.1)
    const eased = t * t * (3 - 2 * t)
    group.position.set(
      THREE.MathUtils.lerp(catchStart.x, catchEnd.x, eased) + Math.sin(t * Math.PI) * 0.55,
      catchStart.y + Math.sin(t * Math.PI) * 1.25,
      THREE.MathUtils.lerp(catchStart.z, catchEnd.z, eased),
    )
    const dx = catchEnd.x - catchStart.x
    const dz = catchEnd.z - catchStart.z
    group.rotation.set(
      -Math.cos(t * Math.PI) * 0.8,
      Math.atan2(dx, dz) + Math.sin(t * 14) * 0.18,
      Math.sin(t * Math.PI * 3) * 0.55,
    )
    group.scale.setScalar((0.56 + (species.lengthRange[0] / 100) * 0.96) / nativeLength)
  })

  return (
    <group ref={groupRef}>
      <mesh geometry={geometry} material={material} />
    </group>
  )
}
