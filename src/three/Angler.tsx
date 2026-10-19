import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ANGLER_POSITION, DOCK, waterSurface } from '../game/world'
import { runtime } from '../game/runtime'
import { useGameStore } from '../store/useGameStore'
import { damp } from '../game/rng'
import { makeSoftCircleTexture } from './textures'

function useCharacterMaterials() {
  const materials = useMemo(() => {
    const make = (color: string, roughness = 0.9, metalness = 0) =>
      new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: true })
    return {
      skin: make('#b9835f', 0.82),
      skinDark: make('#9f6d4c', 0.84),
      jacket: make('#656b50', 0.94),
      jacketDark: make('#4c523e', 0.96),
      shirt: make('#2f3b38', 0.92),
      jeans: make('#415464', 0.92),
      jeansDark: make('#354754', 0.94),
      boots: make('#4c392b', 0.88),
      sole: make('#2c2721', 0.95),
      cap: make('#7b4d38', 0.86),
      capDark: make('#5d392a', 0.9),
      hair: make('#423226', 0.92),
      patch: make('#8b764d', 0.95),
      string: make('#cdbb98', 0.8),
      rod: make('#59604a', 0.55),
      cork: make('#8b6b47', 0.88),
      metal: make('#5e635c', 0.32, 0.72),
      lineGuide: make('#b79b6d', 0.4, 0.5),
      eye: make('#231f1a', 0.5),
      logo: new THREE.MeshStandardMaterial({
        color: '#cfa265',
        roughness: 0.6,
        emissive: '#3d2a10',
        emissiveIntensity: 0.1,
        flatShading: true,
      }),
    }
  }, [])

  useEffect(() => {
    return () => {
      Object.values(materials).forEach((material) => material.dispose())
    }
  }, [materials])

  return materials
}

interface ArmProps {
  side: -1 | 1
  materials: ReturnType<typeof useCharacterMaterials>
  shoulderRef?: RefObject<THREE.Group | null>
  elbowRef?: RefObject<THREE.Group | null>
}

function Arm({ side, materials, shoulderRef, elbowRef }: ArmProps) {
  return (
    <group
      ref={shoulderRef}
      position={[side * -0.275, 0.465, 0.015]}
      rotation={[-0.55, 0, side * 0.42]}
    >
      <mesh material={materials.jacket} castShadow>
        <sphereGeometry args={[0.085, 6, 4]} />
      </mesh>
      <mesh material={materials.jacket} position={[0, -0.135, 0]} castShadow>
        <cylinderGeometry args={[0.066, 0.078, 0.27, 6]} />
      </mesh>
      <mesh material={materials.jacketDark} position={[0, -0.258, 0]}>
        <cylinderGeometry args={[0.064, 0.064, 0.04, 6]} />
      </mesh>
      <group ref={elbowRef} position={[0, -0.28, 0]} rotation={[-1.02, 0, side * -0.12]}>
        <mesh material={materials.jacket} position={[0, -0.12, 0]} castShadow>
          <cylinderGeometry args={[0.056, 0.066, 0.24, 6]} />
        </mesh>
        <mesh material={materials.patch} position={[0, -0.08, 0.055]} rotation={[0.3, 0, 0]}>
          <boxGeometry args={[0.07, 0.06, 0.015]} />
        </mesh>
        <mesh material={materials.skin} position={[0, -0.27, 0]} castShadow>
          <sphereGeometry args={[0.055, 6, 5]} />
        </mesh>
        <mesh material={materials.skin} position={[side * 0.025, -0.255, 0.03]} rotation={[0.4, 0, 0]}>
          <sphereGeometry args={[0.027, 5, 4]} />
        </mesh>
      </group>
    </group>
  )
}

interface LegProps {
  side: -1 | 1
  materials: ReturnType<typeof useCharacterMaterials>
  thighRef?: RefObject<THREE.Group | null>
  kneeRef?: RefObject<THREE.Group | null>
}

function Leg({ side, materials, thighRef, kneeRef }: LegProps) {
  return (
    <group
      ref={thighRef}
      position={[side * 0.125, 0.185, 0.045]}
      rotation={[-1.31, side * 0.04, side * 0.025]}
    >
      <mesh material={materials.jeans} position={[0, -0.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.165, 0.4, 0.185]} />
      </mesh>
      <mesh material={materials.jeans} position={[0, -0.04, 0]} castShadow>
        <boxGeometry args={[0.18, 0.12, 0.2]} />
      </mesh>
      <group ref={kneeRef} position={[0, -0.405, 0]} rotation={[1.29, 0, 0]}>
        <mesh material={materials.jeans} position={[0, -0.17, 0]} castShadow>
          <boxGeometry args={[0.14, 0.34, 0.155]} />
        </mesh>
        <mesh material={materials.jeansDark} position={[0, -0.345, 0]}>
          <boxGeometry args={[0.148, 0.06, 0.165]} />
        </mesh>
        <group position={[0, -0.37, 0.025]}>
          <mesh material={materials.boots} position={[0, -0.035, 0.055]} castShadow receiveShadow>
            <boxGeometry args={[0.16, 0.145, 0.29]} />
          </mesh>
          <mesh material={materials.boots} position={[0, 0.055, -0.025]} castShadow>
            <cylinderGeometry args={[0.079, 0.088, 0.17, 6]} />
          </mesh>
          <mesh material={materials.sole} position={[0, -0.108, 0.06]} castShadow>
            <boxGeometry args={[0.17, 0.038, 0.31]} />
          </mesh>
          <mesh material={materials.patch} position={[0, 0.015, 0.17]} rotation={[0.1, 0, 0]}>
            <boxGeometry args={[0.09, 0.025, 0.06]} />
          </mesh>
          {[-0.028, 0, 0.028].map((z, index) => (
            <mesh key={z} material={materials.patch} position={[0, 0.048 + index * 0.012, z - 0.02]}>
              <boxGeometry args={[0.075, 0.008, 0.008]} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  )
}

function Head({ materials }: { materials: ReturnType<typeof useCharacterMaterials> }) {
  return (
    <group>
      <mesh material={materials.skin} position={[0, 0.055, 0]} castShadow>
        <cylinderGeometry args={[0.072, 0.082, 0.13, 7]} />
      </mesh>
      <mesh material={materials.skin} position={[0, 0.185, 0]} castShadow receiveShadow>
        <icosahedronGeometry args={[0.155, 1]} />
      </mesh>
      <mesh material={materials.hair} position={[0, 0.18, -0.045]} scale={[1.0, 1.0, 0.98]}>
        <icosahedronGeometry args={[0.152, 1]} />
      </mesh>
      <mesh material={materials.skinDark} position={[0, 0.165, 0.15]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <coneGeometry args={[0.028, 0.06, 4]} />
      </mesh>
      <mesh material={materials.skin} position={[-0.15, 0.175, 0.0]} scale={[0.65, 1, 0.8]}>
        <sphereGeometry args={[0.045, 5, 4]} />
      </mesh>
      <mesh material={materials.skin} position={[0.15, 0.175, 0.0]} scale={[0.65, 1, 0.8]}>
        <sphereGeometry args={[0.045, 5, 4]} />
      </mesh>
      <mesh material={materials.eye} position={[-0.055, 0.205, 0.143]} scale={[1, 1, 0.55]}>
        <sphereGeometry args={[0.014, 5, 4]} />
      </mesh>
      <mesh material={materials.eye} position={[0.055, 0.205, 0.143]} scale={[1, 1, 0.55]}>
        <sphereGeometry args={[0.014, 5, 4]} />
      </mesh>
      <mesh material={materials.hair} position={[-0.057, 0.229, 0.132]} rotation={[0, 0, 0.08]}>
        <boxGeometry args={[0.048, 0.011, 0.016]} />
      </mesh>
      <mesh material={materials.hair} position={[0.057, 0.229, 0.132]} rotation={[0, 0, -0.08]}>
        <boxGeometry args={[0.048, 0.011, 0.016]} />
      </mesh>
      <mesh material={materials.skinDark} position={[0, 0.139, 0.145]} rotation={[0, 0, 0.05]}>
        <boxGeometry args={[0.052, 0.008, 0.009]} />
      </mesh>
      <mesh material={materials.hair} position={[-0.14, 0.135, 0.048]} rotation={[0, 0.2, 0.1]}>
        <boxGeometry args={[0.022, 0.07, 0.035]} />
      </mesh>
      <mesh material={materials.hair} position={[0.14, 0.135, 0.048]} rotation={[0, -0.2, -0.1]}>
        <boxGeometry args={[0.022, 0.07, 0.035]} />
      </mesh>

      <mesh material={materials.cap} position={[0, 0.242, -0.008]} castShadow>
        <sphereGeometry args={[0.172, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <mesh material={materials.capDark} position={[0, 0.247, -0.008]}>
        <cylinderGeometry args={[0.174, 0.174, 0.038, 12, 1, true]} />
      </mesh>
      <mesh
        material={materials.cap}
        position={[0, 0.248, 0.112]}
        rotation={[0, -Math.PI / 2, 0]}
        scale={[1.28, 1, 1]}
        castShadow
      >
        <cylinderGeometry args={[0.188, 0.188, 0.018, 12, 1, false, 0, Math.PI]} />
      </mesh>
      <mesh material={materials.capDark} position={[0, 0.412, -0.008]}>
        <sphereGeometry args={[0.018, 6, 4]} />
      </mesh>
      <mesh material={materials.logo} position={[0, 0.315, 0.149]} rotation={[-0.45, 0, 0]}>
        <circleGeometry args={[0.022, 8]} />
      </mesh>
    </group>
  )
}

function Rod({
  materials,
  pivotRef,
  segmentsRef,
  handleRef,
  tipRef,
}: {
  materials: ReturnType<typeof useCharacterMaterials>
  pivotRef: RefObject<THREE.Group | null>
  segmentsRef: RefObject<Array<THREE.Group | null>>
  handleRef: RefObject<THREE.Group | null>
  tipRef: RefObject<THREE.Object3D | null>
}) {
  return (
    <group ref={pivotRef} position={[0.19, 0.29, 0.32]} rotation={[1.04, 0, 0.03]}>
      <mesh material={materials.cork} position={[0, 0.13, 0]} castShadow>
        <cylinderGeometry args={[0.022, 0.026, 0.26, 7]} />
      </mesh>
      <mesh material={materials.metal} position={[0, 0.28, 0]}>
        <cylinderGeometry args={[0.024, 0.024, 0.08, 7]} />
      </mesh>

      <group position={[0.052, 0.29, 0]} rotation={[0, 0, 0.0]}>
        <mesh material={materials.metal} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.06, 0.06, 0.045, 10]} />
        </mesh>
        <mesh material={materials.metal} position={[-0.025, -0.012, 0]}>
          <boxGeometry args={[0.03, 0.05, 0.03]} />
        </mesh>
        <group ref={handleRef} position={[0.048, 0, 0]}>
          <mesh material={materials.metal} position={[0, -0.048, 0]} rotation={[0, 0, 0]}>
            <boxGeometry args={[0.012, 0.1, 0.014]} />
          </mesh>
          <mesh material={materials.capDark} position={[0, -0.098, 0]}>
            <sphereGeometry args={[0.017, 5, 4]} />
          </mesh>
        </group>
      </group>

      <group position={[0, 0.34, 0]}>
        <group
          ref={(node) => {
            segmentsRef.current = [node, segmentsRef.current?.[1] ?? null, segmentsRef.current?.[2] ?? null, segmentsRef.current?.[3] ?? null]
          }}
        >
          <mesh material={materials.rod} position={[0, 0.34, 0]} castShadow>
            <cylinderGeometry args={[0.016, 0.021, 0.68, 6]} />
          </mesh>
          <mesh material={materials.lineGuide} position={[0, 0.66, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.022, 0.005, 4, 6]} />
          </mesh>
          <mesh material={materials.lineGuide} position={[0, 0.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.026, 0.005, 4, 6]} />
          </mesh>
          <group position={[0, 0.68, 0]}>
            <group
              ref={(node) => {
                segmentsRef.current = [segmentsRef.current?.[0] ?? null, node, segmentsRef.current?.[2] ?? null, segmentsRef.current?.[3] ?? null]
              }}
            >
              <mesh material={materials.rod} position={[0, 0.3, 0]} castShadow>
                <cylinderGeometry args={[0.011, 0.016, 0.6, 6]} />
              </mesh>
              <mesh material={materials.lineGuide} position={[0, 0.58, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.017, 0.0045, 4, 6]} />
              </mesh>
              <group position={[0, 0.6, 0]}>
                <group
                  ref={(node) => {
                    segmentsRef.current = [segmentsRef.current?.[0] ?? null, segmentsRef.current?.[1] ?? null, node, segmentsRef.current?.[3] ?? null]
                  }}
                >
                  <mesh material={materials.rod} position={[0, 0.26, 0]} castShadow>
                    <cylinderGeometry args={[0.0075, 0.011, 0.52, 5]} />
                  </mesh>
                  <mesh material={materials.lineGuide} position={[0, 0.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
                    <torusGeometry args={[0.012, 0.004, 4, 6]} />
                  </mesh>
                  <group position={[0, 0.52, 0]}>
                    <group
                      ref={(node) => {
                        segmentsRef.current = [segmentsRef.current?.[0] ?? null, segmentsRef.current?.[1] ?? null, segmentsRef.current?.[2] ?? null, node]
                      }}
                    >
                      <mesh material={materials.rod} position={[0, 0.19, 0]} castShadow>
                        <cylinderGeometry args={[0.004, 0.0075, 0.38, 5]} />
                      </mesh>
                      <mesh material={materials.lineGuide} position={[0, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]}>
                        <torusGeometry args={[0.008, 0.003, 4, 6]} />
                      </mesh>
                      <object3D ref={tipRef} position={[0, 0.4, 0]} />
                    </group>
                  </group>
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}

export function Angler() {
  const materials = useCharacterMaterials()
  const rootRef = useRef<THREE.Group>(null)
  const bodyRef = useRef<THREE.Group>(null)
  const torsoRef = useRef<THREE.Group>(null)
  const headRef = useRef<THREE.Group>(null)
  const shoulderRightRef = useRef<THREE.Group>(null)
  const shoulderLeftRef = useRef<THREE.Group>(null)
  const elbowRightRef = useRef<THREE.Group>(null)
  const elbowLeftRef = useRef<THREE.Group>(null)
  const thighLeftRef = useRef<THREE.Group>(null)
  const thighRightRef = useRef<THREE.Group>(null)
  const kneeLeftRef = useRef<THREE.Group>(null)
  const kneeRightRef = useRef<THREE.Group>(null)
  const rodPivotRef = useRef<THREE.Group>(null)
  const rodSegmentsRef = useRef<Array<THREE.Group | null>>([null, null, null, null])
  const reelHandleRef = useRef<THREE.Group>(null)
  const rodTipRef = useRef<THREE.Object3D>(null)

  const shadowTexture = useMemo(() => makeSoftCircleTexture(), [])
  useEffect(() => {
    return () => {
      shadowTexture.dispose()
    }
  }, [shadowTexture])

  const look = useRef({ targetYaw: -0.15, targetPitch: 0.02, next: 3.5 })
  const rodTipWorld = useRef(new THREE.Vector3())

  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05)
    const time = state.clock.elapsedTime
    const store = useGameStore.getState()
    const phase = store.phase
    const reduced = store.reducedMotion ? 0.25 : 1
    const tension = runtime.tension
    const power = runtime.castPower
    const progress = runtime.reelProgress

    const breath = Math.sin(time * 1.18) * (0.007 + (phase === 'reeling' ? 0.005 : 0)) * reduced
    const sway = Math.sin(time * 0.57) * 0.011 * reduced
    if (bodyRef.current) {
      bodyRef.current.rotation.z = sway
      bodyRef.current.position.y = Math.sin(time * 0.91) * 0.005 * reduced
    }

    let targetLean = 0.045 + breath * 0.5
    if (phase === 'charging') targetLean = -0.03 - power * 0.05
    if (phase === 'casting') targetLean = 0.15
    if (phase === 'bite') targetLean = 0.1
    if (phase === 'reeling') targetLean = -0.035 - tension * 0.05
    if (phase === 'catch') targetLean = -0.19
    if (phase === 'snapped') targetLean = -0.16
    if (torsoRef.current) {
      torsoRef.current.rotation.x = damp(torsoRef.current.rotation.x, targetLean, phase === 'casting' ? 12 : 4.5, dt)
      torsoRef.current.rotation.z = damp(torsoRef.current.rotation.z, sway * 0.8 + (phase === 'reeling' ? Math.sin(time * 4.2) * 0.008 : 0), 4, dt)
    }

    // The head lives in its own quiet orbit: glance at the bobber, the shore,
    // a bird, then back to the line.
    if (time > look.current.next) {
      if (phase === 'reeling' || phase === 'bite' || phase === 'catch') {
        look.current.targetYaw = 0.1 + Math.random() * 0.2
        look.current.targetPitch = 0.16
        look.current.next = time + 2.5
      } else {
        look.current.targetYaw = -0.55 + Math.random() * 1.0
        look.current.targetPitch = -0.06 + Math.random() * 0.12
        look.current.next = time + 5 + Math.random() * 8
      }
    }
    if (headRef.current) {
      const yawTarget = phase === 'catch' ? 0.25 : look.current.targetYaw
      const pitchTarget = phase === 'catch' ? 0.12 : look.current.targetPitch
      headRef.current.rotation.y = damp(headRef.current.rotation.y, yawTarget, 2.2, dt)
      headRef.current.rotation.x = damp(headRef.current.rotation.x, pitchTarget - breath * 0.3, 2.6, dt)
      headRef.current.rotation.z = damp(headRef.current.rotation.z, Math.sin(time * 0.42) * 0.022 * reduced, 2, dt)
    }

    // Occasional, unhurried leg swing.
    const swingL = Math.pow(Math.max(0, Math.sin(time * 0.31 - 0.6)), 12)
    const swingR = Math.pow(Math.max(0, Math.sin(time * 0.27 + 2.2)), 12)
    if (kneeLeftRef.current) {
      kneeLeftRef.current.rotation.x = 1.29 + (swingL * 0.2 + (phase === 'catch' ? 0.08 : 0)) * reduced
      kneeLeftRef.current.rotation.z = Math.sin(time * 0.22) * 0.025 * reduced
    }
    if (kneeRightRef.current) {
      kneeRightRef.current.rotation.x = 1.29 + swingR * 0.12 * reduced
      kneeRightRef.current.rotation.z = Math.sin(time * 0.19 + 1.7) * 0.018 * reduced
    }
    if (thighLeftRef.current) {
      thighLeftRef.current.rotation.x = -1.31 + Math.sin(time * 0.21) * 0.008 * reduced
    }
    if (thighRightRef.current) {
      thighRightRef.current.rotation.x = -1.31 - Math.sin(time * 0.24 + 1.3) * 0.006 * reduced
    }

    // Arms settle with the rod; the right hand stays on the grip.
    if (shoulderRightRef.current) {
      shoulderRightRef.current.rotation.x = damp(
        shoulderRightRef.current.rotation.x,
        phase === 'casting' ? -0.85 : phase === 'catch' ? -0.32 : -0.55 - tension * 0.06,
        4,
        dt,
      )
    }
    if (shoulderLeftRef.current) {
      shoulderLeftRef.current.rotation.x = damp(
        shoulderLeftRef.current.rotation.x,
        phase === 'casting' ? -0.7 : phase === 'catch' ? -0.2 : -0.55 - tension * 0.05,
        4,
        dt,
      )
    }
    if (elbowRightRef.current) {
      elbowRightRef.current.rotation.x = damp(elbowRightRef.current.rotation.x, -1.02 + (phase === 'reeling' ? Math.sin(time * 8) * 0.04 : 0), 5, dt)
    }
    if (elbowLeftRef.current) {
      elbowLeftRef.current.rotation.x = damp(elbowLeftRef.current.rotation.x, -1.02 - (phase === 'reeling' ? 0.08 : 0), 5, dt)
    }

    // Rod pose, bend and reel.
    let rodTarget = 1.06
    if (phase === 'charging') rodTarget = 1.06 - power * 0.4
    else if (phase === 'casting') rodTarget = 1.28
    else if (phase === 'waiting') rodTarget = 1.1 + Math.sin(time * 0.8) * 0.012
    else if (phase === 'bite') rodTarget = 1.19 + Math.sin(time * 12) * 0.018
    else if (phase === 'reeling') rodTarget = 1.1 + progress * 0.12 + tension * 0.08
    else if (phase === 'catch') rodTarget = 1.22
    else if (phase === 'snapped') rodTarget = 0.8
    else if (phase === 'caught') rodTarget = 1.08
    if (rodPivotRef.current) {
      rodPivotRef.current.rotation.x = damp(rodPivotRef.current.rotation.x, rodTarget, 6, dt)
      rodPivotRef.current.rotation.z = damp(
        rodPivotRef.current.rotation.z,
        0.03 + Math.sin(time * 0.67) * 0.008 * reduced,
        3,
        dt,
      )
    }
    let bendTarget = 0.008
    if (phase === 'bite') bendTarget = 0.035
    else if (phase === 'reeling') bendTarget = 0.045 + tension * 0.16
    else if (phase === 'catch') bendTarget = 0.25
    else if (phase === 'charging') bendTarget = 0.004
    const segments = rodSegmentsRef.current
    for (let i = 0; i < segments.length; i += 1) {
      const segment = segments[i]
      if (!segment) continue
      const target = bendTarget * (0.4 + i * 0.28) + Math.sin(time * (1.1 + i * 0.2) + i) * 0.003 * reduced
      segment.rotation.x = damp(segment.rotation.x, target, 5, dt)
      segment.rotation.z = damp(segment.rotation.z, Math.sin(time * 0.5 + i) * 0.004 * reduced, 3, dt)
    }
    if (reelHandleRef.current) {
      const spin = runtime.reelHeld && phase === 'reeling' ? 11 : phase === 'reeling' ? 2.4 : 0.35
      reelHandleRef.current.rotation.x += spin * dt
    }

    if (rodTipRef.current) {
      rodTipRef.current.getWorldPosition(rodTipWorld.current)
      runtime.rodTip.copy(rodTipWorld.current)
    }

    // A tiny bob on the dock line keeps the angler connected to the water.
    if (phase === 'idle' || phase === 'waiting' || phase === 'bite') {
      const bob = waterSurface(ANGLER_POSITION.x, ANGLER_POSITION.z, time)
      if (rootRef.current) rootRef.current.position.y = DOCK.deckTop + bob * 0.015
    } else if (rootRef.current) {
      rootRef.current.position.y = DOCK.deckTop
    }
  })

  return (
    <group ref={rootRef} position={[ANGLER_POSITION.x, DOCK.deckTop, ANGLER_POSITION.z]} rotation={[0, 0.22, 0]}>
      <mesh position={[0.02, 0.008, 0.02]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
        <planeGeometry args={[1.1, 0.9]} />
        <meshBasicMaterial
          map={shadowTexture}
          transparent
          opacity={0.32}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <group ref={bodyRef}>
        <mesh material={materials.jeansDark} position={[0, 0.08, 0.01]} castShadow>
          <boxGeometry args={[0.44, 0.07, 0.38]} />
        </mesh>
        <mesh material={materials.jeans} position={[0, 0.18, 0]} castShadow>
          <boxGeometry args={[0.42, 0.19, 0.35]} />
        </mesh>
        <mesh material={materials.jacketDark} position={[0, 0.075, -0.17]} rotation={[0.2, 0, 0]}>
          <boxGeometry args={[0.5, 0.035, 0.42]} />
        </mesh>

        <Leg side={-1} materials={materials} thighRef={thighRightRef} kneeRef={kneeRightRef} />
        <Leg side={1} materials={materials} thighRef={thighLeftRef} kneeRef={kneeLeftRef} />

        <group ref={torsoRef} position={[0, 0.32, -0.015]}>
          <mesh material={materials.shirt} position={[0, 0.27, 0]} castShadow>
            <cylinderGeometry args={[0.21, 0.185, 0.54, 7]} />
          </mesh>
          <mesh material={materials.jacket} position={[0, 0.3, -0.005]} scale={[1.09, 1, 0.9]} castShadow>
            <cylinderGeometry args={[0.21, 0.195, 0.5, 7]} />
          </mesh>
          <mesh material={materials.shirt} position={[0, 0.28, 0.145]} scale={[0.34, 0.82, 0.2]}>
            <boxGeometry args={[0.22, 0.5, 0.09]} />
          </mesh>
          <mesh material={materials.jacketDark} position={[-0.15, 0.33, 0.155]} rotation={[0, 0, 0.08]}>
            <boxGeometry args={[0.115, 0.42, 0.055]} />
          </mesh>
          <mesh material={materials.jacketDark} position={[0.15, 0.33, 0.155]} rotation={[0, 0, -0.08]}>
            <boxGeometry args={[0.115, 0.42, 0.055]} />
          </mesh>
          <mesh material={materials.jacketDark} position={[0, 0.515, 0.02]} scale={[1.1, 0.7, 0.85]}>
            <sphereGeometry args={[0.165, 7, 5]} />
          </mesh>
          <mesh material={materials.jacketDark} position={[0, 0.44, -0.155]} rotation={[0.5, 0, 0]} scale={[1.35, 0.7, 0.8]}>
            <sphereGeometry args={[0.17, 7, 5]} />
          </mesh>
          <mesh material={materials.jacket} position={[-0.11, 0.47, 0.12]} rotation={[0.2, 0.35, -0.3]}>
            <boxGeometry args={[0.14, 0.17, 0.04]} />
          </mesh>
          <mesh material={materials.jacket} position={[0.11, 0.47, 0.12]} rotation={[0.2, -0.35, 0.3]}>
            <boxGeometry args={[0.14, 0.17, 0.04]} />
          </mesh>
          <mesh material={materials.string} position={[-0.04, 0.36, 0.173]} rotation={[0.15, 0, 0.05]}>
            <cylinderGeometry args={[0.004, 0.004, 0.16, 4]} />
          </mesh>
          <mesh material={materials.string} position={[0.04, 0.35, 0.173]} rotation={[0.15, 0, -0.05]}>
            <cylinderGeometry args={[0.004, 0.004, 0.17, 4]} />
          </mesh>
          <mesh material={materials.patch} position={[-0.115, 0.31, 0.168]}>
            <boxGeometry args={[0.09, 0.11, 0.012]} />
          </mesh>

          {/* Quiet details on the back of the jacket: yoke seam and a small
              leather tag. They read from the default over-the-shoulder view. */}
          <mesh material={materials.jacketDark} position={[0, 0.36, -0.192]} rotation={[0.02, 0, 0]}>
            <boxGeometry args={[0.35, 0.025, 0.012]} />
          </mesh>
          <mesh material={materials.jacketDark} position={[0, 0.25, -0.197]}>
            <boxGeometry args={[0.012, 0.34, 0.012]} />
          </mesh>
          <mesh material={materials.patch} position={[0.09, 0.4, -0.2]} rotation={[0, 0, 0.04]}>
            <boxGeometry args={[0.06, 0.04, 0.012]} />
          </mesh>

          {/* The rod hand, placed exactly where the grip sits. */}
          <mesh material={materials.skin} position={[0.19, 0.29, 0.35]} scale={[0.9, 1.15, 0.9]} castShadow>
            <sphereGeometry args={[0.055, 6, 5]} />
          </mesh>
          <mesh material={materials.jacketDark} position={[0.19, 0.32, 0.28]} rotation={[0.55, 0, 0]}>
            <cylinderGeometry args={[0.062, 0.07, 0.14, 6]} />
          </mesh>

          <group ref={headRef} position={[0, 0.53, 0.01]}>
            <Head materials={materials} />
          </group>

          <Arm side={-1} materials={materials} shoulderRef={shoulderRightRef} elbowRef={elbowRightRef} />
          <Arm side={1} materials={materials} shoulderRef={shoulderLeftRef} elbowRef={elbowLeftRef} />

          <Rod
            materials={materials}
            pivotRef={rodPivotRef}
            segmentsRef={rodSegmentsRef}
            handleRef={reelHandleRef}
            tipRef={rodTipRef}
          />
        </group>
      </group>
    </group>
  )
}

