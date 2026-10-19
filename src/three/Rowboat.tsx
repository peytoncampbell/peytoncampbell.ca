import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { DOCK_POSTS, ROWBOAT_POSITION, WATER_Y, waterSurface } from '../game/world'
import { useGameStore } from '../store/useGameStore'

const ROPE_POINTS = 18
const ropeFrom = new THREE.Vector3()
const ropeTo = new THREE.Vector3()

export function Rowboat() {
  const groupRef = useRef<THREE.Group>(null)
  const bowRef = useRef<THREE.Object3D>(null)

  const assets = useMemo(() => {
    const hullGeo = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)
    hullGeo.scale(0.72, 0.52, 1.9)
    const sideGeo = new THREE.CylinderGeometry(1, 0.98, 0.34, 18, 1, true)
    const rimGeo = new THREE.TorusGeometry(1, 0.055, 4, 22)
    rimGeo.rotateX(Math.PI / 2)
    const bowRingGeo = new THREE.TorusGeometry(0.09, 0.022, 4, 10)
    bowRingGeo.rotateY(Math.PI / 2)

    const hullMat = new THREE.MeshStandardMaterial({
      color: '#b6bab4',
      roughness: 0.46,
      metalness: 0.38,
      flatShading: true,
      side: THREE.DoubleSide,
    })
    const rimMat = new THREE.MeshStandardMaterial({
      color: '#5d6461',
      roughness: 0.52,
      metalness: 0.3,
      flatShading: true,
    })
    const innerMat = new THREE.MeshStandardMaterial({ color: '#8b9188', roughness: 0.9, flatShading: true })
    const plankMat = new THREE.MeshStandardMaterial({ color: '#6d5a41', roughness: 0.9, flatShading: true })
    const oarMat = new THREE.MeshStandardMaterial({ color: '#7c6b50', roughness: 0.86, flatShading: true })
    const metalMat = new THREE.MeshStandardMaterial({ color: '#3f4746', roughness: 0.45, metalness: 0.65 })
    const outboardMat = new THREE.MeshStandardMaterial({
      color: '#303737',
      roughness: 0.4,
      metalness: 0.35,
      flatShading: true,
    })

    const ropeGeometry = new THREE.BufferGeometry()
    ropeGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(ROPE_POINTS * 3), 3),
    )
    const ropeMaterial = new THREE.LineBasicMaterial({
      color: '#bfa77b',
      transparent: true,
      opacity: 0.85,
    })
    const ropeObject = new THREE.Line(ropeGeometry, ropeMaterial)
    ropeObject.frustumCulled = false

    return {
      hullGeo,
      sideGeo,
      rimGeo,
      bowRingGeo,
      hullMat,
      rimMat,
      innerMat,
      plankMat,
      oarMat,
      metalMat,
      outboardMat,
      ropeGeometry,
      ropeMaterial,
      ropeObject,
    }
  }, [])

  useEffect(() => {
    return () => {
      assets.hullGeo.dispose()
      assets.sideGeo.dispose()
      assets.rimGeo.dispose()
      assets.bowRingGeo.dispose()
      assets.hullMat.dispose()
      assets.rimMat.dispose()
      assets.innerMat.dispose()
      assets.plankMat.dispose()
      assets.oarMat.dispose()
      assets.metalMat.dispose()
      assets.outboardMat.dispose()
      assets.ropeGeometry.dispose()
      assets.ropeMaterial.dispose()
    }
  }, [assets])

  useFrame((state, delta) => {
    const group = groupRef.current
    const bow = bowRef.current
    const rope = assets.ropeObject
    if (!group || !bow) return
    const time = state.clock.elapsedTime
    const targetY = WATER_Y + 0.37 + waterSurface(ROWBOAT_POSITION.x, ROWBOAT_POSITION.z, time)
    group.position.y = THREE.MathUtils.damp(group.position.y, targetY, 3.2, Math.min(delta, 0.05))
    group.rotation.z = Math.sin(time * 0.62) * 0.035
    group.rotation.x = Math.cos(time * 0.51) * 0.022
    group.rotation.y = 1.95 + Math.sin(time * 0.27) * 0.018

    if (rope) {
      group.updateMatrixWorld(true)
      bow.getWorldPosition(ropeFrom)
      const post = DOCK_POSTS[6]!
      ropeTo.set(post.x, 0.9, post.z)
      const positions = rope.geometry.attributes.position as THREE.BufferAttribute
      const distance = ropeFrom.distanceTo(ropeTo)
      const sag = Math.min(0.7, 0.18 + distance * 0.05)
      for (let i = 0; i < ROPE_POINTS; i += 1) {
        const t = i / (ROPE_POINTS - 1)
        const x = THREE.MathUtils.lerp(ropeFrom.x, ropeTo.x, t)
        const z = THREE.MathUtils.lerp(ropeFrom.z, ropeTo.z, t)
        const y = THREE.MathUtils.lerp(ropeFrom.y, ropeTo.y, t) - Math.sin(Math.PI * t) * sag
        positions.setXYZ(i, x, y, z)
      }
      positions.needsUpdate = true
      rope.geometry.computeBoundingSphere()
    }
  })

  const timeOfDay = useGameStore((state) => state.timeOfDay)
  const ropeOpacity = timeOfDay === 'night' ? 0.5 : 0.85
  assets.ropeMaterial.opacity = ropeOpacity

  return (
    <>
      <group ref={groupRef} position={[ROWBOAT_POSITION.x, 0.37, ROWBOAT_POSITION.z]} rotation={[0, 1.95, 0]}>
        <mesh geometry={assets.hullGeo} material={assets.hullMat} castShadow receiveShadow />
        <mesh geometry={assets.sideGeo} material={assets.hullMat} position={[0, -0.09, 0]} scale={[0.72, 1, 1.9]} castShadow receiveShadow />
        <mesh
          geometry={assets.rimGeo}
          material={assets.rimMat}
          position={[0, 0.08, 0]}
          scale={[0.72, 1, 1.9]}
          castShadow
        />
        <mesh material={assets.innerMat} position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[0.55, 1, 1.55]}>
          <circleGeometry args={[1, 10]} />
        </mesh>
        <mesh material={assets.plankMat} position={[0, 0.1, -0.5]} castShadow>
          <boxGeometry args={[1.2, 0.055, 0.22]} />
        </mesh>
        <mesh material={assets.plankMat} position={[0, 0.1, 0.58]} castShadow>
          <boxGeometry args={[0.98, 0.055, 0.2]} />
        </mesh>
        <mesh material={assets.plankMat} position={[0, 0.035, 0]} castShadow>
          <boxGeometry args={[0.3, 0.06, 1.9]} />
        </mesh>
        <mesh material={assets.plankMat} position={[0, 0.09, 1.28]} rotation={[0.02, 0, 0]} castShadow>
          <boxGeometry args={[0.75, 0.06, 0.5]} />
        </mesh>

        <group position={[-0.25, 0.19, -0.15]} rotation={[0, 0.1, 0.16]}>
          <mesh material={assets.oarMat} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.02, 0.028, 2.2, 5]} />
          </mesh>
          <mesh material={assets.oarMat} position={[0, 0, 1.02]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <boxGeometry args={[0.16, 0.018, 0.5]} />
          </mesh>
        </group>
        <group position={[0.3, 0.22, 0.3]} rotation={[0, -0.25, -0.1]}>
          <mesh material={assets.oarMat} rotation={[Math.PI / 2, 0, 0.08]} castShadow>
            <cylinderGeometry args={[0.02, 0.028, 2.1, 5]} />
          </mesh>
          <mesh material={assets.oarMat} position={[0, 0, -0.98]} rotation={[Math.PI / 2, 0, 0.08]}>
            <boxGeometry args={[0.15, 0.018, 0.48]} />
          </mesh>
        </group>

        <mesh material={assets.rimMat} position={[0, 0.08, 1.86]} castShadow>
          <boxGeometry args={[0.24, 0.1, 0.23]} />
        </mesh>
        <mesh geometry={assets.bowRingGeo} material={assets.metalMat} position={[0, 0.12, 1.93]} />
        <object3D ref={bowRef} position={[0, 0.16, 2.0]} />

        {/* A small tiller outboard, the way a lake boat actually waits at the dock. */}
        <group position={[0, 0.24, -1.74]} rotation={[0.05, 0, 0]}>
          <mesh material={assets.outboardMat} castShadow>
            <boxGeometry args={[0.34, 0.4, 0.4]} />
          </mesh>
          <mesh material={assets.outboardMat} position={[0, 0.24, -0.01]} castShadow>
            <boxGeometry args={[0.38, 0.07, 0.44]} />
          </mesh>
          <mesh material={assets.metalMat} position={[0, 0.49, 0.02]}>
            <cylinderGeometry args={[0.035, 0.045, 0.2, 6]} />
          </mesh>
          <mesh material={assets.outboardMat} position={[0, -0.33, 0]} castShadow>
            <cylinderGeometry args={[0.05, 0.065, 0.64, 6]} />
          </mesh>
          <mesh material={assets.outboardMat} position={[0, -0.69, 0.02]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <boxGeometry args={[0.3, 0.18, 0.08]} />
          </mesh>
          <mesh material={assets.outboardMat} position={[0, -0.7, -0.18]} rotation={[0.2, 0, 0]}>
            <boxGeometry args={[0.16, 0.32, 0.04]} />
          </mesh>
        </group>

        <mesh material={assets.hullMat} position={[0, -0.31, 0]} scale={[0.55, 0.2, 1.55]}>
          <boxGeometry args={[1, 1, 1]} />
        </mesh>
      </group>
      <primitive object={assets.ropeObject} />
    </>
  )
}
