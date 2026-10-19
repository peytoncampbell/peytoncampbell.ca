import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { runtime, spawnRipple } from '../game/runtime'
import { waterSurface } from '../game/world'
import { makeSoftCircleTexture } from './textures'

const dummy = new THREE.Object3D()
const rippleColor = new THREE.Color()

export function RippleField() {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const assets = useMemo(() => {
    const geometry = new THREE.RingGeometry(0.9, 1, 36)
    geometry.rotateX(-Math.PI / 2)
    const material = new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
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
    rippleColor.setRGB(0, 0, 0)
    for (let i = 0; i < runtime.ripples.length; i += 1) {
      mesh.setColorAt(i, rippleColor)
      dummy.position.set(0, -20, 0)
      dummy.scale.setScalar(0)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.instanceMatrix.needsUpdate = true
  }, [])

  useFrame((state, rawDelta) => {
    const mesh = meshRef.current
    if (!mesh) return
    const dt = Math.min(rawDelta, 0.05)
    const time = state.clock.elapsedTime
    for (let i = 0; i < runtime.ripples.length; i += 1) {
      const ripple = runtime.ripples[i]!
      if (!ripple.active) {
        dummy.position.set(0, -20, 0)
        dummy.scale.setScalar(0)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
        rippleColor.setRGB(0, 0, 0)
        mesh.setColorAt(i, rippleColor)
        continue
      }
      ripple.age += dt
      if (ripple.age >= ripple.life) {
        ripple.active = false
        dummy.scale.setScalar(0)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
        rippleColor.setRGB(0, 0, 0)
        mesh.setColorAt(i, rippleColor)
        continue
      }
      const progress = ripple.age / ripple.life
      const fade = Math.pow(1 - progress, 1.6) * 0.42
      const scale = 0.14 + progress * ripple.size * 1.55
      dummy.position.set(
        ripple.x,
        waterSurface(ripple.x, ripple.z, time) + 0.055,
        ripple.z,
      )
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(scale, 1, scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      rippleColor.copy(ripple.color).multiplyScalar(fade)
      mesh.setColorAt(i, rippleColor)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[assets.geometry, assets.material, runtime.ripples.length]}
      frustumCulled={false}
      renderOrder={3}
    />
  )
}

export function SplashField() {
  const pointsRef = useRef<THREE.Points>(null)
  const texture = useMemo(() => makeSoftCircleTexture('rgba(255,255,255,0.85)'), [])
  const assets = useMemo(() => {
    const bursts = runtime.splashes.length
    const particlesPerBurst = 16
    const positions = new Float32Array(bursts * particlesPerBurst * 3)
    const colors = new Float32Array(bursts * particlesPerBurst * 3)
    positions.fill(-100)
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    const material = new THREE.PointsMaterial({
      map: texture,
      size: 0.11,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      alphaTest: 0.01,
      toneMapped: false,
    })
    return { geometry, material, particlesPerBurst }
  }, [texture])

  useEffect(() => {
    return () => {
      assets.geometry.dispose()
      assets.material.dispose()
      texture.dispose()
    }
  }, [assets, texture])

  useFrame((state, rawDelta) => {
    const points = pointsRef.current
    if (!points) return
    const dt = Math.min(rawDelta, 0.05)
    const positions = points.geometry.attributes.position as THREE.BufferAttribute
    const colors = points.geometry.attributes.color as THREE.BufferAttribute
    const time = state.clock.elapsedTime
    let index = 0
    for (const splash of runtime.splashes) {
      if (!splash.active) {
        for (let j = 0; j < assets.particlesPerBurst; j += 1) {
          positions.setXYZ(index, 0, -100, 0)
          colors.setXYZ(index, 0, 0, 0)
          index += 1
        }
        continue
      }
      splash.age += dt
      if (splash.age >= splash.life) {
        splash.active = false
        for (let j = 0; j < assets.particlesPerBurst; j += 1) {
          positions.setXYZ(index, 0, -100, 0)
          colors.setXYZ(index, 0, 0, 0)
          index += 1
        }
        continue
      }
      const t = splash.age / splash.life
      const fade = (1 - t) * (1 - t)
      for (let j = 0; j < assets.particlesPerBurst; j += 1) {
        const seed = splash.seed + j * 12.9898
        const angle = (seed * 0.618) % (Math.PI * 2)
        const speed = 0.4 + ((Math.sin(seed * 7.2) * 0.5 + 0.5) * 1.3)
        const lift = 0.7 + (Math.sin(seed * 3.4) * 0.5 + 0.5) * 1.2
        const x = splash.x + Math.cos(angle) * speed * t * splash.power
        const z = splash.z + Math.sin(angle) * speed * t * splash.power
        const y = 0.04 + lift * t * splash.power - 4.6 * t * t
        positions.setXYZ(index, x, Math.max(0.01, y), z)
        const brightness = fade * (0.7 + 0.3 * Math.sin(time * 3 + j))
        colors.setXYZ(index, brightness, brightness * 0.98, brightness * 0.9)
        index += 1
      }
    }
    positions.needsUpdate = true
    colors.needsUpdate = true
  })

  return (
    <points
      ref={pointsRef}
      geometry={assets.geometry}
      material={assets.material}
      frustumCulled={false}
      renderOrder={4}
    />
  )
}

export function PelletField() {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const assets = useMemo(() => {
    const geometry = new THREE.IcosahedronGeometry(1, 0)
    const material = new THREE.MeshStandardMaterial({
      color: '#9a7c4a',
      roughness: 0.96,
      metalness: 0,
      flatShading: true,
    })
    return { geometry, material }
  }, [])

  useEffect(() => {
    return () => {
      assets.geometry.dispose()
      assets.material.dispose()
    }
  }, [assets])

  useFrame((state, rawDelta) => {
    const mesh = meshRef.current
    if (!mesh) return
    const dt = Math.min(rawDelta, 0.05)
    const time = state.clock.elapsedTime
    for (let i = 0; i < runtime.pellets.length; i += 1) {
      const pellet = runtime.pellets[i]!
      if (!pellet.active) {
        dummy.position.set(0, -20, 0)
        dummy.scale.setScalar(0)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
        continue
      }
      pellet.age += dt
      const surface = waterSurface(pellet.x, pellet.z, time)
      if (pellet.age > pellet.life) {
        pellet.active = false
        dummy.scale.setScalar(0)
      } else if (!pellet.landed) {
        pellet.y -= dt * (0.9 + pellet.age * 1.3)
        if (pellet.y <= surface + 0.02) {
          pellet.y = surface + 0.02
          pellet.landed = true
          spawnRipple(pellet.x, pellet.z, 0.5, 1.5, 0.5)
        }
        dummy.position.set(pellet.x, pellet.y, pellet.z)
        dummy.scale.setScalar(0.035)
      } else {
        pellet.y = surface + 0.02
        dummy.position.set(pellet.x, pellet.y, pellet.z)
        const remaining = Math.min(1, (pellet.life - pellet.age) / 1.4)
        dummy.scale.setScalar(0.035 * remaining)
      }
      dummy.rotation.set(pellet.age * 0.6, pellet.age * 0.4, 0)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[assets.geometry, assets.material, runtime.pellets.length]}
      frustumCulled={false}
      renderOrder={3}
    />
  )
}

export function AmbientRipples() {
  const nextRipple = useRef(3)
  useFrame((state) => {
    const time = state.clock.elapsedTime
    if (time < nextRipple.current) return
    nextRipple.current = time + 2.4 + Math.random() * 4.2
    const x = -12 + Math.random() * 27
    const z = 2 + Math.random() * 13
    spawnRipple(x, z, 0.5 + Math.random() * 0.9, 2.4 + Math.random() * 1.2, 0.24)
  })
  return null
}

export function WaterEffects() {
  return (
    <>
      <RippleField />
      <SplashField />
      <PelletField />
      <AmbientRipples />
    </>
  )
}
