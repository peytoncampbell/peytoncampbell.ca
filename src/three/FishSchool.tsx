import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { FishProfile } from '../game/residents'
import { SPECIES_LIST, type Species } from '../game/species'
import { mulberry32 } from '../game/rng'
import {
  DOCK_POSTS,
  flowAt,
  shoreZ,
  terrainHeight,
} from '../game/world'
import { runtime, spawnRipple, spawnSplash } from '../game/runtime'
import { fishBridge } from '../game/fishBridge'
import { useGameStore } from '../store/useGameStore'
import { sceneBridge } from '../game/sceneBridge'
import { audio } from '../audio/audio'
import { applyFishSwimAttribute, buildFishVisual, type FishVisual } from './fishVisuals'

interface Home {
  x: number
  z: number
  radius: number
}

const HOMES: Record<string, Home[]> = {
  // Fish hold to structure: the dock shadow, the granite points,
  // the one weedy cove, and the deeper channel seam.
  bluegill: [
    { x: 2.8, z: 3.8, radius: 2.7 },
    { x: -7.6, z: 1.2, radius: 2.6 },
    { x: 7.8, z: 5.4, radius: 2.5 },
  ],
  perch: [
    { x: -1.8, z: 2.8, radius: 3.2 },
    { x: 5.2, z: 3.4, radius: 3.2 },
    { x: -7.0, z: 3.4, radius: 2.6 },
  ],
  bass: [
    { x: 8.6, z: 3.0, radius: 3.0 },
    { x: -9.6, z: 1.6, radius: 2.8 },
    { x: 2.8, z: 8.6, radius: 3.0 },
  ],
  walleye: [
    { x: -1.2, z: 10.2, radius: 4.0 },
    { x: 8.0, z: 12.6, radius: 3.4 },
    { x: -9.2, z: 8.0, radius: 3.0 },
  ],
  pike: [
    { x: 9.8, z: 1.8, radius: 3.0 },
    { x: -9.8, z: 0.4, radius: 3.2 },
  ],
  catfish: [
    { x: -3.4, z: 7.2, radius: 3.8 },
    { x: 3.6, z: 12.0, radius: 3.2 },
  ],
  golden: [{ x: -12.0, z: 5.0, radius: 2.2 }],
}

interface FishAgent {
  id: string
  profile: FishProfile
  species: Species
  instanceIndex: number
  x: number
  z: number
  depth: number
  depthBase: number
  vx: number
  vz: number
  heading: number
  roll: number
  pitch: number
  phase: number
  size: number
  homeX: number
  homeZ: number
  homeRadius: number
  jumpAge: number
  jumpDuration: number
  jumpHeight: number
  jumping: boolean
}

interface SpeciesGroup {
  species: Species
  agents: FishAgent[]
  visual: FishVisual
}

const dummy = new THREE.Object3D()
dummy.rotation.order = 'YXZ'
const colorTint = new THREE.Color()
const flow2 = new THREE.Vector2()

function makeGroups(residents: FishProfile[]): SpeciesGroup[] {
  const rng = mulberry32(0xf15a)
  const groups: SpeciesGroup[] = []
  for (const species of SPECIES_LIST) {
    const members = residents.filter((resident) => resident.speciesId === species.id)
    if (members.length === 0) continue
    const agents = members.map((profile, instanceIndex): FishAgent => {
      const homes = HOMES[species.id] ?? [{ x: 0, z: 6, radius: 4 }]
      const home = homes[instanceIndex % homes.length] ?? homes[0]!
      const angle = rng() * Math.PI * 2
      const radius = rng() * home.radius
      let x = home.x + Math.cos(angle) * radius
      let z = home.z + Math.sin(angle) * radius
      z = Math.max(z, shoreZ(x) + 2.2)
      const depthMin = species.behavior.depth[0]
      const depthMax = species.behavior.depth[1]
      const depthBase = depthMin + rng() * (depthMax - depthMin)
      const worldLength = 0.56 + (profile.lengthCm / 100) * 0.96
      const nativeLength = 1
      return {
        id: profile.id,
        profile,
        species,
        instanceIndex,
        x,
        z,
        depth: depthBase,
        depthBase,
        vx: Math.cos(angle) * 0.08,
        vz: Math.sin(angle) * 0.08,
        heading: angle,
        roll: 0,
        pitch: 0,
        phase: rng() * Math.PI * 2,
        size: worldLength / nativeLength,
        homeX: home.x,
        homeZ: home.z,
        homeRadius: home.radius,
        jumpAge: -1,
        jumpDuration: 0.75 + rng() * 0.5,
        jumpHeight: 0.35 + rng() * 0.55,
        jumping: false,
      }
    })
    const visual = buildFishVisual(species)
    for (const agent of agents) agent.size = (0.56 + (agent.profile.lengthCm / 100) * 0.96) / visual.nativeLength
    applyFishSwimAttribute(
      visual.geometry,
      agents.map((agent) => ({
        phase: agent.phase,
        amplitude: 0.55 + (agent.species.behavior.speed / 0.7) * 0.5,
      })),
    )
    groups.push({ species, agents, visual })
  }
  return groups
}

function wrapAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle))
}

function findNearestFish(groups: SpeciesGroup[], x: number, z: number, count = 3): string[] {
  const candidates: Array<{ id: string; distance: number }> = []
  for (const group of groups) {
    for (const agent of group.agents) {
      const dx = agent.x - x
      const dz = agent.z - z
      candidates.push({ id: agent.id, distance: dx * dx + dz * dz })
    }
  }
  candidates.sort((a, b) => a.distance - b.distance)
  return candidates.slice(0, count).map((entry) => entry.id)
}

export function FishSchool() {
  const initialResidents = useRef(useGameStore.getState().residents).current
  const groups = useMemo(() => makeGroups(initialResidents), [initialResidents])
  const meshRefs = useRef<Array<THREE.InstancedMesh | null>>([])
  const nextWake = useRef(6)

  useEffect(() => {
    const cleanups = groups.map((group, index) => {
      const mesh = meshRefs.current[index]
      if (!mesh) return null
      return sceneBridge.registerFishMesh(mesh, group.agents.map((agent) => agent.id))
    })
    fishBridge.findNear = (x, z, count = 3) => findNearestFish(groups, x, z, count)
    return () => {
      cleanups.forEach((cleanup) => cleanup?.())
      fishBridge.findNear = null
    }
  }, [groups])

  useEffect(() => {
    return () => {
      for (const group of groups) {
        group.visual.geometry.dispose()
        group.visual.material.dispose()
      }
    }
  }, [groups])

  useLayoutEffect(() => {
    groups.forEach((group, groupIndex) => {
      const mesh = meshRefs.current[groupIndex]
      if (!mesh) return
      group.agents.forEach((agent, index) => {
        colorTint.setRGB(
          0.94 + ((agent.profile.name.length % 5) * 0.01 - 0.02),
          0.97 + ((agent.instanceIndex % 3) * 0.008 - 0.008),
          0.92 + ((agent.instanceIndex % 4) * 0.008 - 0.012),
        )
        mesh.setColorAt(index, colorTint)
        dummy.position.set(agent.x, -agent.depth, agent.z)
        dummy.rotation.set(0, agent.heading, 0)
        dummy.scale.setScalar(agent.size)
        dummy.updateMatrix()
        mesh.setMatrixAt(index, dummy.matrix)
      })
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      mesh.computeBoundingSphere()
    })
  }, [groups])

  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05)
    const time = state.clock.elapsedTime
    const store = useGameStore.getState()
    const phase = store.phase
    const activity =
      store.timeOfDay === 'night'
        ? 0.7
        : store.timeOfDay === 'blue'
          ? 1.04
          : store.weather === 'rain'
            ? 0.9
            : 1
    const interested = runtime.interestedFishId
    const hooked = runtime.hookedFishId
    const fishing = phase === 'waiting' || phase === 'bite' || phase === 'reeling'

    if (time > nextWake.current) {
      nextWake.current = time + 2.2 + Math.random() * 3.5
      const shallow: FishAgent[] = []
      for (const group of groups) {
        for (const agent of group.agents) {
          if (agent.depth < 0.7 && !agent.jumping) shallow.push(agent)
        }
      }
      if (shallow.length > 0) {
        const fish = shallow[Math.floor(Math.random() * shallow.length)]
        if (fish) spawnRipple(fish.x, fish.z, 0.32, 1.35, 0.35)
      }
    }

    if (
      time > runtime.nextAmbientJump &&
      phase !== 'bite' &&
      phase !== 'reeling' &&
      phase !== 'catch'
    ) {
      const pool: FishAgent[] = []
      for (const group of groups) {
        for (const agent of group.agents) {
          if (!agent.jumping && agent.id !== hooked) pool.push(agent)
        }
      }
      if (pool.length > 0) {
        const chosen = pool[Math.floor(Math.random() * pool.length)]
        if (chosen) {
          chosen.jumping = true
          chosen.jumpAge = 0
          spawnSplash(chosen.x, chosen.z, 0.55)
          audio.playSplash(0.35)
        }
      }
      runtime.nextAmbientJump = time + (store.reducedMotion ? 24 : 12) + Math.random() * 14
    }

    for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
      const group = groups[groupIndex]!
      const mesh = meshRefs.current[groupIndex]
      if (!mesh) continue
      group.visual.timeUniform.value = time

      group.agents.forEach((agent, index) => {
        const species = agent.species
        const dxHome = agent.homeX - agent.x
        const dzHome = agent.homeZ - agent.z
        const homeDistance = Math.hypot(dxHome, dzHome)
        const orbitAngle = time * 0.18 + agent.phase

        let desiredX = Math.sin(time * 0.31 + agent.phase) * 0.055
        let desiredZ = Math.cos(time * 0.26 + agent.phase * 1.3) * 0.045

        flowAt(agent.x, agent.z, time, flow2)
        desiredX += flow2.x
        desiredZ += flow2.y

        if (homeDistance > agent.homeRadius + 2.5) {
          desiredX += (dxHome / homeDistance) * 0.16
          desiredZ += (dzHome / homeDistance) * 0.16
        }

        let speed = species.behavior.speed * activity
        if (species.id === 'walleye') speed *= store.timeOfDay === 'blue' || store.timeOfDay === 'night' ? 1.25 : 0.82
        else if (species.id === 'pike' && store.timeOfDay === 'blue') speed *= 1.12
        let targetDepth = agent.depthBase + Math.sin(time * 0.3 + agent.phase) * 0.08
        let special = false

        if (fishing && agent.id === interested) {
          const orbitRadius = 1.3 + Math.sin(time * 0.7 + agent.phase) * 0.45
          const tx = runtime.bobber.x + Math.cos(orbitAngle) * orbitRadius
          const tz = runtime.bobber.z + Math.sin(orbitAngle) * orbitRadius
          const dx = tx - agent.x
          const dz = tz - agent.z
          const dist = Math.hypot(dx, dz) || 1
          desiredX += (dx / dist) * 0.65
          desiredZ += (dz / dist) * 0.65
          speed = Math.min(0.55, speed + 0.08)
          targetDepth = 0.34
          special = true
        }

        if (agent.id === hooked && (phase === 'bite' || phase === 'reeling')) {
          const dx = runtime.bobber.x - agent.x
          const dz = runtime.bobber.z - agent.z
          const dist = Math.hypot(dx, dz) || 1
          const thrash = Math.sin(time * 7.3 + agent.phase) * 0.35
          desiredX += (dx / dist) * 0.8 + thrash * 0.22
          desiredZ += (dz / dist) * 0.8 + Math.cos(time * 6.1 + agent.phase) * 0.18
          speed = 0.82
          targetDepth = 0.24 + Math.sin(time * 4.8) * 0.05
          special = true
        }

        if (!special && species.behavior.schooling > 0.4) {
          let nearestX = 0
          let nearestZ = 0
          let nearestCount = 0
          for (const other of group.agents) {
            if (other === agent) continue
            const dx = other.x - agent.x
            const dz = other.z - agent.z
            if (dx * dx + dz * dz < 16) {
              nearestX += other.x
              nearestZ += other.z
              nearestCount += 1
              if (nearestCount >= 3) break
            }
          }
          if (nearestCount > 0) {
            const cx = nearestX / nearestCount
            const cz = nearestZ / nearestCount
            desiredX += (cx - agent.x) * 0.02 * species.behavior.schooling
            desiredZ += (cz - agent.z) * 0.02 * species.behavior.schooling
          }
        }

        for (const post of DOCK_POSTS) {
          const dx = agent.x - post.x
          const dz = agent.z - post.z
          const dist = Math.hypot(dx, dz)
          const avoidRadius = post.radius + 0.85
          if (dist < avoidRadius && dist > 0.0001) {
            const push = (avoidRadius - dist) / avoidRadius
            desiredX += (dx / dist) * push * 1.3
            desiredZ += (dz / dist) * push * 1.3
          }
        }

        const minShore = shoreZ(agent.x) + 1.5
        if (agent.z < minShore) desiredZ += (minShore - agent.z) * 1.15
        if (agent.x < -16.2) desiredX += (-16.2 - agent.x) * 0.5
        if (agent.x > 16.2) desiredX += (16.2 - agent.x) * 0.5
        if (agent.z > 16.2) desiredZ += (16.2 - agent.z) * 0.5

        const desiredLength = Math.hypot(desiredX, desiredZ)
        if (desiredLength > 0.0001) {
          desiredX = (desiredX / desiredLength) * speed
          desiredZ = (desiredZ / desiredLength) * speed
        }
        agent.vx = THREE.MathUtils.damp(agent.vx, desiredX, special ? 3.4 : 1.8, dt)
        agent.vz = THREE.MathUtils.damp(agent.vz, desiredZ, special ? 3.4 : 1.8, dt)
        agent.x += agent.vx * dt
        agent.z += agent.vz * dt

        const targetHeading = Math.atan2(agent.vx, agent.vz)
        const turn = Math.max(-0.9, Math.min(0.9, wrapAngle(targetHeading - agent.heading)))
        agent.heading += turn * Math.min(1, dt * (special ? 4.5 : 2.1))
        agent.roll = THREE.MathUtils.damp(
          agent.roll,
          Math.max(-0.35, Math.min(0.35, turn)) + Math.sin(time * 1.7 + agent.phase) * 0.045,
          3,
          dt,
        )

        const bed = terrainHeight(agent.x, agent.z)
        const maxDepth = Math.max(0.22, -bed - 0.22)
        targetDepth = Math.max(0.28, Math.min(maxDepth, targetDepth))
        agent.depth = THREE.MathUtils.damp(agent.depth, targetDepth, 2.2, dt)
        let y = -agent.depth

        if (agent.jumping) {
          agent.jumpAge += dt
          const t = Math.min(1, agent.jumpAge / agent.jumpDuration)
          const arc = Math.sin(Math.PI * t)
          y = -Math.min(agent.depth, 0.22) + arc * agent.jumpHeight
          agent.pitch = -Math.cos(Math.PI * t) * 0.9
          if (t >= 1) {
            agent.jumping = false
            agent.jumpAge = -1
            spawnSplash(agent.x, agent.z, 0.7)
            spawnRipple(agent.x, agent.z, 1.4, 2.6, 0.8)
            audio.playSplash(0.4)
          }
        } else {
          agent.pitch = THREE.MathUtils.damp(
            agent.pitch,
            Math.sin(time * 0.8 + agent.phase) * 0.03,
            2,
            dt,
          )
        }

        const hidden =
          agent.id === hooked && (phase === 'catch' || phase === 'caught')
        if (hidden) {
          dummy.scale.setScalar(0)
        } else {
          dummy.position.set(agent.x, y, agent.z)
          dummy.rotation.set(agent.pitch, agent.heading, agent.roll)
          dummy.scale.setScalar(agent.size)
        }
        dummy.updateMatrix()
        mesh.setMatrixAt(index, dummy.matrix)
      })
      mesh.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <group>
      {groups.map((group, index) => (
        <instancedMesh
          key={group.species.id}
          ref={(node) => {
            meshRefs.current[index] = node
          }}
          args={[group.visual.geometry, group.visual.material, group.agents.length]}
          frustumCulled={false}
          renderOrder={0}
        />
      ))}
    </group>
  )
}

