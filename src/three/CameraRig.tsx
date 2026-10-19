import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../store/useGameStore'
import { sceneBridge } from '../game/sceneBridge'
import { runtime } from '../game/runtime'
import { DOCK, groundHeightAt } from '../game/world'
import { damp } from '../game/rng'

const DEFAULT_THETA = 1.28
const DEFAULT_PHI = 0.95
const DEFAULT_RADIUS = 9.8
const baseTarget = new THREE.Vector3(0.25, 1.2, 4.2)
const desiredTarget = new THREE.Vector3()
const smoothTarget = new THREE.Vector3(0.25, 1.2, 4.2)
const lookTarget = new THREE.Vector3()
const desiredPosition = new THREE.Vector3()
const shakeOffset = new THREE.Vector3()

export function CameraRig() {
  const { camera, size } = useThree()
  const cinematic = useGameStore((state) => state.cinematic)
  const goal = useRef({ theta: DEFAULT_THETA, phi: DEFAULT_PHI, radius: DEFAULT_RADIUS })
  const current = useRef({ theta: DEFAULT_THETA, phi: DEFAULT_PHI, radius: DEFAULT_RADIUS })
  const extraRadius = useRef(0)
  const lastInput = useRef(performance.now())
  const initialized = useRef(false)

  const perspective = camera as THREE.PerspectiveCamera

  useEffect(() => {
    const aspect = size.width / Math.max(1, size.height)
    perspective.fov = aspect < 0.82 ? 64 : aspect < 1.2 ? 58 : 54
    perspective.updateProjectionMatrix()
  }, [perspective, size])

  useEffect(() => {
    sceneBridge.orbit = (dx, dy) => {
      const store = useGameStore.getState()
      if (store.cinematic) store.toggleCinematic()
      goal.current.theta -= dx * 0.0042
      goal.current.phi = THREE.MathUtils.clamp(goal.current.phi - dy * 0.0034, 0.18, 1.31)
      lastInput.current = performance.now()
    }
    sceneBridge.zoom = (delta) => {
      const store = useGameStore.getState()
      if (store.cinematic) store.toggleCinematic()
      goal.current.radius = THREE.MathUtils.clamp(
        goal.current.radius * Math.exp(delta * 0.0011),
        store.photoMode ? 5 : 6.4,
        27,
      )
      lastInput.current = performance.now()
    }
    sceneBridge.resetView = () => {
      goal.current.theta = DEFAULT_THETA
      goal.current.phi = DEFAULT_PHI
      goal.current.radius = DEFAULT_RADIUS
      lastInput.current = performance.now()
    }
    return () => {
      sceneBridge.orbit = null
      sceneBridge.zoom = null
      sceneBridge.resetView = null
    }
  }, [])

  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05)
    const time = state.clock.elapsedTime
    const store = useGameStore.getState()
    const motion = store.reducedMotion ? 0.2 : 1

    if (cinematic) {
      goal.current.theta += dt * 0.055
      goal.current.phi = 0.86 + Math.sin(time * 0.055) * 0.2 * motion
      goal.current.radius = 16.2 + Math.sin(time * 0.045) * 2.0 * motion
    }

    let targetRadiusOffset = 0
    switch (store.phase) {
      case 'charging':
        targetRadiusOffset = -0.4 * runtime.castPower
        break
      case 'casting':
        targetRadiusOffset = 0.55
        break
      case 'bite':
        targetRadiusOffset = -0.55
        break
      case 'reeling':
        targetRadiusOffset = -0.45 - runtime.tension * 0.35
        break
      case 'catch':
        targetRadiusOffset = -1.15
        break
      case 'snapped':
        targetRadiusOffset = 0.5
        break
      default:
        break
    }
    extraRadius.current = damp(extraRadius.current, targetRadiusOffset, 2.4, dt)

    const idle = !store.reducedMotion && performance.now() - lastInput.current > 9000 && !cinematic
    const driftTheta = idle ? Math.sin(time * 0.055) * 0.024 * motion : 0
    const driftRadius = idle ? Math.sin(time * 0.041) * 0.35 * motion : 0

    current.current.theta = damp(current.current.theta, goal.current.theta + driftTheta, 3.6, dt)
    current.current.phi = damp(current.current.phi, goal.current.phi, 3.6, dt)
    current.current.radius = damp(
      current.current.radius,
      goal.current.radius + extraRadius.current + driftRadius,
      3.4,
      dt,
    )

    desiredTarget.copy(baseTarget)
    if (store.phase === 'catch') {
      desiredTarget.y += 0.35
      desiredTarget.z += 0.25
    } else if (store.phase === 'reeling' || store.phase === 'bite') {
      desiredTarget.z += 0.16
      desiredTarget.y += 0.05
    } else if (store.phase === 'charging' || store.phase === 'casting') {
      desiredTarget.z += 0.12
    }
    smoothTarget.lerp(desiredTarget, 1 - Math.exp(-2.8 * dt))
    const lookLift = 2.4 * Math.min(1, Math.max(0, (current.current.phi - 0.3) / 0.6))
    lookTarget.copy(smoothTarget)
    lookTarget.y += lookLift
    lookTarget.z += 0.9

    const theta = current.current.theta
    const phi = current.current.phi
    const radius = current.current.radius
    const sinPhi = Math.sin(phi)
    desiredPosition.set(
      smoothTarget.x + radius * sinPhi * Math.sin(theta),
      smoothTarget.y + radius * Math.cos(phi),
      smoothTarget.z + radius * sinPhi * Math.cos(theta),
    )

    // Never dip into the lake, the dock, or the shore.
    const ground = groundHeightAt(desiredPosition.x, desiredPosition.z)
    const minimumY = Math.max(2.35, ground + 1.05)
    if (desiredPosition.y < minimumY) desiredPosition.y = minimumY
    if (Math.abs(desiredPosition.x) < DOCK.halfWidth + 0.7 && desiredPosition.z > DOCK.startZ && desiredPosition.z < DOCK.endZ + 0.7) {
      desiredPosition.y = Math.max(desiredPosition.y, DOCK.deckTop + 1.8)
    }

    let shake = 0
    if (store.phase === 'reeling' && runtime.tension > 0.72) {
      shake = (runtime.tension - 0.72) * 0.12 * motion
    }
    shakeOffset.set(
      Math.sin(time * 61.3) * shake,
      Math.cos(time * 73.7) * shake * 0.6,
      Math.sin(time * 57.1) * shake,
    )
    if (!initialized.current) {
      camera.position.copy(desiredPosition)
      smoothTarget.copy(desiredTarget)
      camera.lookAt(lookTarget)
      initialized.current = true
    } else {
      camera.position.x = damp(camera.position.x, desiredPosition.x + shakeOffset.x, 6.5, dt)
      camera.position.y = damp(camera.position.y, desiredPosition.y + shakeOffset.y, 6.5, dt)
      camera.position.z = damp(camera.position.z, desiredPosition.z + shakeOffset.z, 6.5, dt)
      camera.lookAt(lookTarget)
    }
  })

  return null
}

export function SceneBinding() {
  const { camera, gl, scene } = useThree()

  useEffect(() => {
    sceneBridge.camera = camera
    sceneBridge.gl = gl
    return () => {
      sceneBridge.camera = null
      sceneBridge.gl = null
    }
  }, [camera, gl])

  useEffect(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping
    gl.toneMappingExposure = 1.05
    gl.outputColorSpace = THREE.SRGBColorSpace
    gl.shadowMap.enabled = true
    gl.shadowMap.type = THREE.PCFShadowMap
    gl.shadowMap.autoUpdate = true
    scene.matrixWorldAutoUpdate = true
  }, [gl, scene])

  return null
}


