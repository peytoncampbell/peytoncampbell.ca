import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { DOCK, DOCK_POSTS, LANTERN_POSITION } from '../game/world'
import { mulberry32 } from '../game/rng'
import { useGameStore } from '../store/useGameStore'
import { PALETTES } from './palette'

const dummy = new THREE.Object3D()
const plankColor = new THREE.Color()

/* ------------------------------------------------------------------ */
/* Planks and piles                                                    */
/* ------------------------------------------------------------------ */

function DockStructure() {
  const quality = useGameStore((state) => state.quality)
  const planksRef = useRef<THREE.InstancedMesh>(null)
  const postsRef = useRef<THREE.InstancedMesh>(null)

  const rows = useMemo(() => {
    const rng = mulberry32(0xd0c)
    const count = Math.floor((DOCK.endZ - DOCK.startZ - 0.2) / 0.37)
    return Array.from({ length: count }, (_, index) => {
      const z = DOCK.startZ + 0.18 + index * 0.37
      return {
        z,
        x: (rng() - 0.5) * 0.035,
        y: DOCK.deckTop - 0.055 + (rng() - 0.5) * 0.012,
        width: 2.9 + (rng() - 0.5) * 0.18,
        rotation: (rng() - 0.5) * 0.018,
        hue: rng(),
        moss: rng(),
      }
    })
  }, [])

  const assets = useMemo(() => {
    const plankGeo = new THREE.BoxGeometry(1, DOCK.plankThickness, 0.315)
    const plankMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.94,
      metalness: 0,
      flatShading: true,
    })
    const postGeo = new THREE.CylinderGeometry(1, 1, 1, 7)
    postGeo.translate(0, 0.5, 0)
    const postMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.96,
      metalness: 0,
      flatShading: true,
    })
    return { plankGeo, plankMat, postGeo, postMat }
  }, [])

  useEffect(() => {
    return () => {
      assets.plankGeo.dispose()
      assets.plankMat.dispose()
      assets.postGeo.dispose()
      assets.postMat.dispose()
    }
  }, [assets])

  useLayoutEffect(() => {
    const mesh = planksRef.current
    if (!mesh) return
    const colors = ['#77776a', '#84806f', '#6c6c60', '#8d8876', '#727465', '#7d7b6b']
    rows.forEach((plank, index) => {
      dummy.position.set(plank.x, plank.y, plank.z)
      dummy.rotation.set(0, plank.rotation, 0)
      dummy.scale.set(plank.width, 1, 1)
      dummy.updateMatrix()
      mesh.setMatrixAt(index, dummy.matrix)
      plankColor.set(colors[Math.floor(plank.hue * colors.length)] ?? '#7b7969')
      if (plank.moss > 0.72) plankColor.lerp(new THREE.Color('#5d6952'), 0.32)
      plankColor.offsetHSL(0, 0, (plank.hue - 0.5) * 0.08)
      mesh.setColorAt(index, plankColor)
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [rows])

  useLayoutEffect(() => {
    const posts = postsRef.current
    if (!posts) return
    const postColors = ['#656256', '#757062', '#5b5a50', '#77725f']
    DOCK_POSTS.forEach((post, index) => {
      dummy.position.set(post.x, -2.25, post.z)
      dummy.rotation.set(0, index * 0.7, 0)
      dummy.scale.set(post.radius, 3.2, post.radius)
      dummy.updateMatrix()
      posts.setMatrixAt(index, dummy.matrix)
      plankColor.set(postColors[index % postColors.length] ?? '#69665a')
      posts.setColorAt(index, plankColor)
    })
    posts.instanceMatrix.needsUpdate = true
    if (posts.instanceColor) posts.instanceColor.needsUpdate = true
    posts.computeBoundingSphere()
  }, [])

  return (
    <group>
      <instancedMesh
        ref={planksRef}
        args={[assets.plankGeo, assets.plankMat, rows.length]}
        castShadow={quality !== 'low'}
        receiveShadow
        frustumCulled={false}
      />
      <instancedMesh
        ref={postsRef}
        args={[assets.postGeo, assets.postMat, DOCK_POSTS.length]}
        castShadow={quality !== 'low'}
        receiveShadow
        frustumCulled={false}
      />

      {/* Stringers and cross-bracing */}
      {[-1.02, 1.02].map((x) => (
        <mesh key={x} position={[x, DOCK.deckTop - 0.21, 0.3]} castShadow receiveShadow>
          <boxGeometry args={[0.17, 0.19, DOCK.endZ - DOCK.startZ + 0.4]} />
          <meshStandardMaterial color="#575349" roughness={1} flatShading />
        </mesh>
      ))}
      {[-3.7, -1.3, 1.1, 3.5, 5.0].map((z) => (
        <mesh key={z} position={[0, 0.47, z]} castShadow receiveShadow>
          <boxGeometry args={[3.0, 0.15, 0.18]} />
          <meshStandardMaterial color="#4d4a40" roughness={1} flatShading />
        </mesh>
      ))}
      {DOCK_POSTS.map((post, index) =>
        index % 2 === 0 ? (
          <mesh
            key={`cap-${index}`}
            position={[post.x, DOCK.deckTop + 0.36, post.z]}
            castShadow
          >
            <cylinderGeometry args={[post.radius * 1.1, post.radius * 1.1, 0.08, 7]} />
            <meshStandardMaterial color="#676459" roughness={1} flatShading />
          </mesh>
        ) : null,
      )}
      {[-1.39, 1.39].map((x) => (
        <mesh key={`brace-${x}`} position={[x * 0.98, 0.05, 0.2]} rotation={[0.73, 0, 0]} castShadow>
          <boxGeometry args={[0.08, 0.08, 4.2]} />
          <meshStandardMaterial color="#4b483e" roughness={1} flatShading />
        </mesh>
      ))}
      <mesh position={[0, -1.72, 5.0]} castShadow>
        <boxGeometry args={[3.1, 0.14, 0.16]} />
        <meshStandardMaterial color="#514d41" roughness={1} flatShading />
      </mesh>
      <mesh position={[0, -0.72, -4.2]}>
        <boxGeometry args={[3.1, 0.14, 0.16]} />
        <meshStandardMaterial color="#514d41" roughness={1} flatShading />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Rope details                                                        */
/* ------------------------------------------------------------------ */

function RopeWraps() {
  const wrapMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#b09a73', roughness: 0.88, flatShading: true }),
    [],
  )
  const coilMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#c0a97f', roughness: 0.9, flatShading: true }),
    [],
  )
  useEffect(() => {
    return () => {
      wrapMaterial.dispose()
      coilMaterial.dispose()
    }
  }, [wrapMaterial, coilMaterial])

  return (
    <group>
      {[DOCK_POSTS[2]!, DOCK_POSTS[2]!, DOCK_POSTS[2]!, DOCK_POSTS[6]!, DOCK_POSTS[6]!].map((post, index) => (
        <mesh
          key={index}
          position={[post.x, DOCK.deckTop + 0.13 + (index % 3) * 0.055, post.z]}
          material={wrapMaterial}
          castShadow
        >
          <torusGeometry args={[post.radius + 0.035, 0.024, 4, 12]} />
        </mesh>
      ))}
      <group position={[0.95, DOCK.deckTop + 0.035, 4.35]} rotation={[0, 0.3, 0]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} material={coilMaterial} position={[0, i * 0.026, 0]} rotation={[-Math.PI / 2, 0, i * 0.4]} castShadow>
            <torusGeometry args={[0.17 - i * 0.01, 0.025, 4, 14]} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Lantern                                                             */
/* ------------------------------------------------------------------ */

function Lantern() {
  const flameRef = useRef<THREE.Mesh>(null)
  const glassMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#ffcf8a',
        emissive: new THREE.Color('#ff9f48'),
        emissiveIntensity: 0.12,
        roughness: 0.3,
        metalness: 0.05,
        transparent: true,
        opacity: 0.88,
      }),
    [],
  )
  const metalMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#35352f', roughness: 0.55, metalness: 0.5 }),
    [],
  )
  const woodMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#5d5a4f', roughness: 1, flatShading: true }),
    [],
  )

  useEffect(() => {
    return () => {
      glassMaterial.dispose()
      metalMaterial.dispose()
      woodMaterial.dispose()
    }
  }, [glassMaterial, metalMaterial, woodMaterial])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    const palette = PALETTES[useGameStore.getState().timeOfDay]
    const target = 0.15 + palette.lantern * 0.42
    glassMaterial.emissiveIntensity = THREE.MathUtils.damp(
      glassMaterial.emissiveIntensity,
      target,
      1.5,
      dt,
    )
    if (flameRef.current) {
      const flicker = 1 + Math.sin(state.clock.elapsedTime * 8.1) * 0.05 + Math.sin(state.clock.elapsedTime * 13.7) * 0.03
      flameRef.current.scale.setScalar(flicker)
    }
  })

  return (
    <group position={[LANTERN_POSITION.x, DOCK.deckTop, LANTERN_POSITION.z]}>
      <mesh position={[0, 0.74, 0]} material={woodMaterial} castShadow>
        <cylinderGeometry args={[0.055, 0.07, 1.48, 6]} />
      </mesh>
      <mesh position={[-0.19, 1.5, 0]} rotation={[0, 0, Math.PI / 2]} material={woodMaterial} castShadow>
        <cylinderGeometry args={[0.035, 0.045, 0.42, 5]} />
      </mesh>
      <mesh position={[-0.37, 1.48, 0]} material={metalMaterial}>
        <torusGeometry args={[0.035, 0.008, 4, 8]} />
      </mesh>
      <group position={[-0.37, 1.24, 0]}>
        <mesh position={[0, 0.02, 0]} material={metalMaterial} castShadow>
          <cylinderGeometry args={[0.13, 0.16, 0.06, 6]} />
        </mesh>
        <mesh material={glassMaterial} position={[0, -0.11, 0]}>
          <cylinderGeometry args={[0.105, 0.13, 0.22, 6]} />
        </mesh>
        <mesh material={metalMaterial} position={[0, -0.25, 0]} castShadow>
          <cylinderGeometry args={[0.15, 0.12, 0.06, 6]} />
        </mesh>
        <mesh material={metalMaterial} position={[0, 0.09, 0]}>
          <cylinderGeometry args={[0.02, 0.035, 0.09, 5]} />
        </mesh>
        <mesh ref={flameRef} position={[0, -0.11, 0]}>
          <sphereGeometry args={[0.032, 6, 4]} />
          <meshBasicMaterial color="#ffd08a" />
        </mesh>
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const angle = (i / 6) * Math.PI * 2
          return (
            <mesh
              key={i}
              material={metalMaterial}
              position={[Math.cos(angle) * 0.115, -0.11, Math.sin(angle) * 0.115]}
            >
              <boxGeometry args={[0.012, 0.24, 0.012]} />
            </mesh>
          )
        })}
      </group>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

function Bucket() {
  return (
    <group position={[-1.02, DOCK.deckTop, 4.55]} rotation={[0, 0.4, 0]}>
      <mesh position={[0, 0.16, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.17, 0.14, 0.32, 10, 1, true]} />
        <meshStandardMaterial color="#626962" metalness={0.6} roughness={0.46} side={THREE.DoubleSide} flatShading />
      </mesh>
      <mesh position={[0, 0.005, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.14, 0.02, 10]} />
        <meshStandardMaterial color="#4e544f" metalness={0.55} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.32, 0]}>
        <torusGeometry args={[0.17, 0.014, 4, 12]} />
        <meshStandardMaterial color="#72796f" metalness={0.55} roughness={0.48} />
      </mesh>
      <mesh position={[0, 0.2, 0]} rotation={[0, 0, 0.05]}>
        <cylinderGeometry args={[0.152, 0.152, 0.018, 10]} />
        <meshStandardMaterial color="#27433f" metalness={0.1} roughness={0.18} transparent opacity={0.82} />
      </mesh>
      <mesh position={[0, 0.36, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.16, 0.009, 4, 12, Math.PI]} />
        <meshStandardMaterial color="#5a5f57" metalness={0.55} roughness={0.5} />
      </mesh>
    </group>
  )
}

function TackleBox() {
  return (
    <group position={[-0.92, DOCK.deckTop + 0.02, 3.32]} rotation={[0, 0.31, 0]}>
      <mesh position={[0, 0.13, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.55, 0.24, 0.32]} />
        <meshStandardMaterial color="#4f5a46" roughness={0.82} flatShading />
      </mesh>
      <mesh position={[0, 0.13, 0.163]}>
        <boxGeometry args={[0.48, 0.17, 0.01]} />
        <meshStandardMaterial color="#647058" roughness={0.7} flatShading />
      </mesh>
      <mesh position={[0.02, 0.26, -0.03]} rotation={[-0.12, 0, 0]} castShadow>
        <boxGeometry args={[0.57, 0.055, 0.34]} />
        <meshStandardMaterial color="#59644d" roughness={0.8} flatShading />
      </mesh>
      <mesh position={[0, 0.2, 0.18]}>
        <boxGeometry args={[0.08, 0.08, 0.015]} />
        <meshStandardMaterial color="#a8a58f" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.31, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.075, 0.012, 4, 10, Math.PI]} />
        <meshStandardMaterial color="#343a2f" roughness={0.7} />
      </mesh>
      <mesh position={[0.36, 0.02, 0.08]} rotation={[0, 0.3, 0.1]}>
        <cylinderGeometry args={[0.055, 0.055, 0.15, 8]} />
        <meshStandardMaterial color="#8b5c36" metalness={0.35} roughness={0.55} />
      </mesh>
    </group>
  )
}

function Thermos() {
  return (
    <group position={[-0.47, DOCK.deckTop, 3.58]} rotation={[0, -0.2, 0.03]}>
      <mesh position={[0, 0.15, 0]} castShadow>
        <cylinderGeometry args={[0.072, 0.078, 0.3, 9]} />
        <meshStandardMaterial color="#8f4831" roughness={0.45} metalness={0.25} flatShading />
      </mesh>
      <mesh position={[0, 0.315, 0]} castShadow>
        <cylinderGeometry args={[0.062, 0.068, 0.08, 9]} />
        <meshStandardMaterial color="#c7bca4" roughness={0.32} metalness={0.55} flatShading />
      </mesh>
      <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry args={[0.079, 0.079, 0.035, 9]} />
        <meshStandardMaterial color="#d2c3a4" roughness={0.4} metalness={0.35} />
      </mesh>
    </group>
  )
}

function FoldedJacket() {
  return (
    <group position={[1.08, DOCK.deckTop + 0.02, 3.12]} rotation={[0, -0.35, 0.04]}>
      <mesh position={[0, 0.055, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.54, 0.09, 0.42]} />
        <meshStandardMaterial color="#9a7440" roughness={0.98} flatShading />
      </mesh>
      <mesh position={[0.02, 0.115, 0.02]} rotation={[0, 0.12, 0.02]} castShadow>
        <boxGeometry args={[0.49, 0.07, 0.36]} />
        <meshStandardMaterial color="#a98146" roughness={0.98} flatShading />
      </mesh>
      <mesh position={[-0.2, 0.075, 0.05]} rotation={[0.2, 0.2, -0.1]}>
        <boxGeometry args={[0.16, 0.055, 0.34]} />
        <meshStandardMaterial color="#8a6739" roughness={0.98} flatShading />
      </mesh>
      <mesh position={[0.22, 0.145, -0.09]} rotation={[0, 0.22, 0.02]}>
        <boxGeometry args={[0.18, 0.035, 0.2]} />
        <meshStandardMaterial color="#b18b4d" roughness={0.98} flatShading />
      </mesh>
    </group>
  )
}

function Cleat({ x, z, rotation = 0 }: { x: number; z: number; rotation?: number }) {
  return (
    <group position={[x, DOCK.deckTop, z]} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.035, 0]} castShadow>
        <cylinderGeometry args={[0.055, 0.07, 0.07, 6]} />
        <meshStandardMaterial color="#5c615b" metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.09, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.026, 0.026, 0.27, 6]} />
        <meshStandardMaterial color="#787d74" metalness={0.72} roughness={0.32} />
      </mesh>
      {[-0.09, 0.09].map((offset) => (
        <mesh key={offset} position={[0, 0.075, offset]}>
          <cylinderGeometry args={[0.022, 0.022, 0.09, 5]} />
          <meshStandardMaterial color="#686d65" metalness={0.7} roughness={0.35} />
        </mesh>
      ))}
    </group>
  )
}

function DockProps() {
  return (
    <group>
      <Bucket />
      <TackleBox />
      <Thermos />
      <FoldedJacket />
      <Cleat x={1.28} z={-2.3} rotation={0.2} />
      <Cleat x={-1.28} z={2.3} rotation={-0.15} />
      <mesh position={[0.65, DOCK.deckTop + 0.03, 4.75]} rotation={[0, 0.2, 0]} castShadow>
        <boxGeometry args={[0.22, 0.06, 0.15]} />
        <meshStandardMaterial color="#4b443a" roughness={0.95} flatShading />
      </mesh>
    </group>
  )
}

export function Dock() {
  return (
    <group>
      <DockStructure />
      <RopeWraps />
      <Lantern />
      <DockProps />
    </group>
  )
}
