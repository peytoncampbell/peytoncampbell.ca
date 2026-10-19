import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mulberry32 } from '../game/rng'
import {
  FORM_ROCKS,
  LILY_POSITION,
  TREE_LINE,
  flowAt,
  shoreZ,
  terrainHeight,
  waterSurface,
} from '../game/world'
import { useGameStore } from '../store/useGameStore'
import { PALETTES } from './palette'

const dummy = new THREE.Object3D()
const tint = new THREE.Color()
const flow = new THREE.Vector2()
const hazeColor = new THREE.Color()

/* ------------------------------------------------------------------ */
/* Pines                                                               */
/* ------------------------------------------------------------------ */

interface TreeData {
  x: number
  z: number
  y: number
  scale: number
  rotation: number
  hue: number
}

function buildTrees(): TreeData[] {
  const rng = mulberry32(0x51ee)
  const trees: TreeData[] = TREE_LINE.map((tree) => ({
    x: tree.x,
    z: tree.z,
    y: terrainHeight(tree.x, tree.z),
    scale: tree.scale,
    rotation: rng() * Math.PI * 2,
    hue: rng(),
  }))

  for (let i = 0; i < 42; i += 1) {
    const side = rng() < 0.3
    const farBank = i > 26
    const x = side
      ? (rng() < 0.5 ? -1 : 1) * (16.5 + rng() * 6)
      : -21 + rng() * 42
    const z = farBank ? 19.2 + rng() * 4.3 : side ? -2 + rng() * 18 : -21.5 + rng() * 13.5
    const y = terrainHeight(x, z)
    if (y < 0.35) continue
    if (Math.abs(x) < 3.4 && z > -8.5) continue
    if (Math.hypot(x + 8.2, z + 10.4) < 4.5) continue
    trees.push({
      x,
      z,
      y,
      scale: farBank ? 0.62 + rng() * 0.5 : 0.8 + rng() * 0.9,
      rotation: rng() * Math.PI * 2,
      hue: rng(),
    })
  }

  // A denser far treeline gives the bay a proper wooded opposite shore.
  for (let i = 0; i < 15; i += 1) {
    const x = -20.5 + i * 2.9 + (rng() - 0.5) * 1.4
    const z = 22.1 + rng() * 1.7
    const y = terrainHeight(x, z)
    if (y < 0.4) continue
    if (Math.hypot(x + 8.2, z + 10.4) < 4.5) continue
    trees.push({
      x,
      z,
      y,
      scale: 0.6 + rng() * 0.5,
      rotation: rng() * Math.PI * 2,
      hue: rng(),
    })
  }

  // Pines on the west headland, framing the default side-on view.
  for (let i = 0; i < 18; i += 1) {
    const x = -20.8 + rng() * 5.6
    const z = -13 + rng() * 13
    const y = terrainHeight(x, z)
    if (y < 0.4) continue
    trees.push({
      x,
      z,
      y,
      scale: 0.7 + rng() * 0.7,
      rotation: rng() * Math.PI * 2,
      hue: rng(),
    })
  }

  // Fill the visible cottage shore so the island reads as continuous forest,
  // not a diorama with a handful of specimen trees.
  for (let i = 0; i < 34; i += 1) {
    const x = -19.5 + rng() * 39
    const z = -17.5 + rng() * 11.5
    const y = terrainHeight(x, z)
    if (y < 0.3) continue
    if (Math.abs(x) < 3.6 && z > -8.8) continue
    if (Math.hypot(x + 8.2, z + 10.4) < 4.5) continue
    trees.push({
      x,
      z,
      y,
      scale: 0.72 + rng() * 0.95,
      rotation: rng() * Math.PI * 2,
      hue: rng(),
    })
  }
  return trees
}

export function Pines() {
  const quality = useGameStore((state) => state.quality)
  const trees = useMemo(buildTrees, [])
  const trunkRef = useRef<THREE.InstancedMesh>(null)
  const foliageRef = useRef<THREE.InstancedMesh>(null)

  const assets = useMemo(() => {
    const trunkGeo = new THREE.CylinderGeometry(0.16, 0.23, 1, 5)
    trunkGeo.translate(0, 0.5, 0)
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#3b2f25', roughness: 1, flatShading: true })
    const foliageGeo = new THREE.ConeGeometry(1, 1, 7)
    foliageGeo.translate(0, 0.5, 0)
    const foliageMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.95,
      metalness: 0,
      flatShading: true,
    })
    return { trunkGeo, trunkMat, foliageGeo, foliageMat }
  }, [])

  useEffect(() => {
    return () => {
      assets.trunkGeo.dispose()
      assets.trunkMat.dispose()
      assets.foliageGeo.dispose()
      assets.foliageMat.dispose()
    }
  }, [assets])

  useLayoutEffect(() => {
    const trunks = trunkRef.current
    const foliage = foliageRef.current
    if (!trunks || !foliage) return
    const foliageColors = ['#20352a', '#2a4435', '#192d24', '#324c3b', '#1f392d', '#3a523f']
    let foliageIndex = 0

    trees.forEach((tree, index) => {
      const trunkHeight = 2.2 * tree.scale
      dummy.position.set(tree.x, tree.y, tree.z)
      dummy.rotation.set(0, tree.rotation, 0)
      dummy.scale.set(tree.scale * 1.25, trunkHeight, tree.scale * 1.25)
      dummy.updateMatrix()
      trunks.setMatrixAt(index, dummy.matrix)
      tint.setHSL(0.08, 0.24, 0.34 + tree.hue * 0.1)
      trunks.setColorAt(index, tint)

      for (let tier = 0; tier < 3; tier += 1) {
        const scale = tree.scale
        const base = tree.y + (0.75 + tier * 1.04) * scale
        const radius = (1.36 - tier * 0.31) * scale
        const height = (2.0 - tier * 0.22) * scale
        dummy.position.set(
          tree.x + Math.sin(tree.rotation + tier) * 0.05,
          base,
          tree.z + Math.cos(tree.rotation + tier) * 0.05,
        )
        dummy.rotation.set(0, tree.rotation + tier * 0.7, 0)
        dummy.scale.set(radius, height, radius)
        dummy.updateMatrix()
        foliage.setMatrixAt(foliageIndex, dummy.matrix)
        const colorIndex = Math.floor((tree.hue * 3 + tier + index) % foliageColors.length)
        tint.set(foliageColors[colorIndex] ?? '#425438')
        tint.offsetHSL(0, 0, (tree.hue - 0.5) * 0.06)
        foliage.setColorAt(foliageIndex, tint)
        foliageIndex += 1
      }
    })
    trunks.instanceMatrix.needsUpdate = true
    foliage.instanceMatrix.needsUpdate = true
    if (trunks.instanceColor) trunks.instanceColor.needsUpdate = true
    if (foliage.instanceColor) foliage.instanceColor.needsUpdate = true
    trunks.computeBoundingSphere()
    foliage.computeBoundingSphere()
  }, [trees])

  return (
    <group>
      <instancedMesh
        ref={trunkRef}
        args={[assets.trunkGeo, assets.trunkMat, trees.length]}
        castShadow={quality !== 'low'}
        receiveShadow
        frustumCulled={false}
      />
      <instancedMesh
        ref={foliageRef}
        args={[assets.foliageGeo, assets.foliageMat, trees.length * 3]}
        castShadow={quality !== 'low'}
        receiveShadow
        frustumCulled={false}
      />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Birches                                                             */
/* ------------------------------------------------------------------ */

interface BirchData {
  x: number
  z: number
  y: number
  scale: number
  rotation: number
  hue: number
}

function buildBirches(): BirchData[] {
  const rng = mulberry32(0xb17c)
  const birches: BirchData[] = []
  for (let i = 0; i < 22; i += 1) {
    const x = -17 + rng() * 34
    const z = -14.5 + rng() * 8.8
    const y = terrainHeight(x, z)
    if (y < 0.35) continue
    if (Math.abs(x) < 3.2 && z > -8.8) continue
    if (Math.hypot(x + 8.2, z + 10.4) < 4.5) continue
    birches.push({
      x,
      z,
      y,
      scale: 0.72 + rng() * 0.7,
      rotation: rng() * Math.PI * 2,
      hue: rng(),
    })
  }
  return birches
}

export function Birches() {
  const quality = useGameStore((state) => state.quality)
  const birches = useMemo(buildBirches, [])
  const trunkRef = useRef<THREE.InstancedMesh>(null)
  const leafRef = useRef<THREE.InstancedMesh>(null)
  const assets = useMemo(() => {
    const trunkGeo = new THREE.CylinderGeometry(0.055, 0.085, 1, 5)
    trunkGeo.translate(0, 0.5, 0)
    const trunkMat = new THREE.MeshStandardMaterial({
      color: '#b7b4a6',
      roughness: 0.9,
      flatShading: true,
    })
    const leafGeo = new THREE.IcosahedronGeometry(1, 0)
    const leafMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.94,
      flatShading: true,
    })
    return { trunkGeo, trunkMat, leafGeo, leafMat }
  }, [])

  useEffect(() => {
    return () => {
      assets.trunkGeo.dispose()
      assets.trunkMat.dispose()
      assets.leafGeo.dispose()
      assets.leafMat.dispose()
    }
  }, [assets])

  useLayoutEffect(() => {
    const trunks = trunkRef.current
    const leaves = leafRef.current
    if (!trunks || !leaves) return
    const leafColors = ['#8a996d', '#788a60', '#99a577', '#6d8057']
    let leafIndex = 0
    birches.forEach((tree, index) => {
      const height = 3.1 * tree.scale
      dummy.position.set(tree.x, tree.y, tree.z)
      dummy.rotation.set(0, tree.rotation, 0)
      dummy.scale.set(tree.scale, height, tree.scale)
      dummy.updateMatrix()
      trunks.setMatrixAt(index, dummy.matrix)

      for (let tier = 0; tier < 3; tier += 1) {
        const angle = tree.rotation + tier * 2.1
        dummy.position.set(
          tree.x + Math.cos(angle) * 0.52 * tree.scale,
          tree.y + (2.15 + tier * 0.55) * tree.scale,
          tree.z + Math.sin(angle) * 0.48 * tree.scale,
        )
        dummy.rotation.set(tree.hue * 0.4, angle, tree.rotation * 0.2)
        dummy.scale.set(
          (0.72 + tree.hue * 0.3) * tree.scale,
          (0.8 + (tier % 2) * 0.25) * tree.scale,
          (0.68 + (1 - tree.hue) * 0.25) * tree.scale,
        )
        dummy.updateMatrix()
        leaves.setMatrixAt(leafIndex, dummy.matrix)
        tint.set(leafColors[Math.floor(tree.hue * 3 + tier) % leafColors.length] ?? '#71845a')
        tint.offsetHSL(0, 0.02, (tree.hue - 0.5) * 0.05)
        leaves.setColorAt(leafIndex, tint)
        leafIndex += 1
      }
    })
    trunks.instanceMatrix.needsUpdate = true
    leaves.instanceMatrix.needsUpdate = true
    if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true
    trunks.computeBoundingSphere()
    leaves.computeBoundingSphere()
  }, [birches])

  return (
    <group>
      <instancedMesh
        ref={trunkRef}
        args={[assets.trunkGeo, assets.trunkMat, birches.length]}
        castShadow={quality !== 'low'}
        receiveShadow
        frustumCulled={false}
      />
      <instancedMesh
        ref={leafRef}
        args={[assets.leafGeo, assets.leafMat, birches.length * 3]}
        castShadow={quality !== 'low'}
        receiveShadow
        frustumCulled={false}
      />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Rocks                                                               */
/* ------------------------------------------------------------------ */

interface RockData {
  x: number
  z: number
  y: number
  scale: number
  rotation: number
  wet: boolean
  hue: number
}

function buildRocks(): RockData[] {
  const rng = mulberry32(0x70c)
  const rocks: RockData[] = FORM_ROCKS.map((rock) => ({
    x: rock.x,
    z: rock.z,
    y: terrainHeight(rock.x, rock.z),
    scale: rock.scale,
    rotation: rock.rotation,
    wet: rock.wet,
    hue: rng(),
  }))
  for (let i = 0; i < 26; i += 1) {
    const x = -20 + rng() * 40
    const z = shoreZ(x) - 1.2 + rng() * 2.4
    const y = terrainHeight(x, z)
    rocks.push({
      x,
      z,
      y,
      scale: 0.24 + rng() * 0.62,
      rotation: rng() * Math.PI * 2,
      wet: y < 0.25,
      hue: rng(),
    })
  }
  for (let i = 0; i < 14; i += 1) {
    const x = -19 + rng() * 38
    const z = 19.5 + rng() * 3.2
    const y = terrainHeight(x, z)
    rocks.push({
      x,
      z,
      y,
      scale: 0.3 + rng() * 0.9,
      rotation: rng() * Math.PI * 2,
      wet: y < 0.5,
      hue: rng(),
    })
  }
  for (let i = 0; i < 15; i += 1) {
    const x = -9 + rng() * 22
    const z = 1.5 + rng() * 10
    const y = terrainHeight(x, z)
    if (y > -0.4) continue
    rocks.push({
      x,
      z,
      y,
      scale: 0.28 + rng() * 0.6,
      rotation: rng() * Math.PI * 2,
      wet: true,
      hue: rng(),
    })
  }
  return rocks
}

export function Rocks() {
  const rocks = useMemo(buildRocks, [])
  const ref = useRef<THREE.InstancedMesh>(null)
  const assets = useMemo(() => {
    const geo = new THREE.DodecahedronGeometry(1, 0)
    const mat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.93,
      metalness: 0.02,
      flatShading: true,
    })
    return { geo, mat }
  }, [])

  useEffect(() => {
    return () => {
      assets.geo.dispose()
      assets.mat.dispose()
    }
  }, [assets])

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    rocks.forEach((rock, index) => {
      dummy.position.set(rock.x, rock.y + rock.scale * 0.22 - 0.08, rock.z)
      dummy.rotation.set(rock.rotation * 0.5, rock.rotation, rock.rotation * 0.2)
      dummy.scale.set(rock.scale * 1.15, rock.scale * 0.7, rock.scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(index, dummy.matrix)
      tint.set(rock.wet ? '#4b544f' : rock.hue > 0.62 ? '#7d7567' : '#6a685f')
      tint.offsetHSL(0.01, 0.03, (rock.hue - 0.5) * 0.12)
      mesh.setColorAt(index, tint)
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [rocks])

  return (
    <instancedMesh
      ref={ref}
      args={[assets.geo, assets.mat, rocks.length]}
      castShadow
      receiveShadow
      frustumCulled={false}
    />
  )
}

/* ------------------------------------------------------------------ */
/* Reeds                                                               */
/* ------------------------------------------------------------------ */

interface ReedData {
  x: number
  z: number
  y: number
  height: number
  rotation: number
  tiltX: number
  tiltZ: number
  hue: number
}

function buildReeds(): ReedData[] {
  const rng = mulberry32(0xbeed)
  const reeds: ReedData[] = []
  for (let cluster = 0; cluster < 9; cluster += 1) {
    const xCenter = -16.5 + rng() * 13.5
    const zCenter = shoreZ(xCenter) + (rng() * 1.8 + 0.35)
    const count = 8 + Math.floor(rng() * 7)
    for (let i = 0; i < count; i += 1) {
      const x = xCenter + (rng() - 0.5) * 2.4
      const z = zCenter + (rng() - 0.5) * 1.8
      const ground = terrainHeight(x, z)
      reeds.push({
        x,
        z,
        y: Math.max(ground + 0.03, -0.35),
        height: 0.65 + rng() * 1.35,
        rotation: rng() * Math.PI * 2,
        tiltX: (rng() - 0.5) * 0.22,
        tiltZ: (rng() - 0.5) * 0.22,
        hue: rng(),
      })
    }
  }
  for (let cluster = 0; cluster < 3; cluster += 1) {
    const xCenter = -18 + rng() * 36
    const zCenter = 19.4 + rng() * 2.6
    for (let i = 0; i < 9; i += 1) {
      const x = xCenter + (rng() - 0.5) * 2.6
      const z = zCenter + (rng() - 0.5) * 1.2
      const ground = terrainHeight(x, z)
      reeds.push({
        x,
        z,
        y: Math.max(ground + 0.03, -0.25),
        height: 0.55 + rng() * 1.1,
        rotation: rng() * Math.PI * 2,
        tiltX: (rng() - 0.5) * 0.18,
        tiltZ: (rng() - 0.5) * 0.18,
        hue: rng(),
      })
    }
  }
  return reeds
}

export function Reeds() {
  const reeds = useMemo(buildReeds, [])
  const ref = useRef<THREE.InstancedMesh>(null)
  const timeUniform = useMemo(() => ({ value: 0 }), [])
  const assets = useMemo(() => {
    const geo = new THREE.CylinderGeometry(0.008, 0.026, 1, 3)
    geo.translate(0, 0.5, 0)
    const mat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 1,
      metalness: 0,
      side: THREE.DoubleSide,
    })
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uReedTime = timeUniform
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uReedTime;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vec4 reedOrigin = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float reedSway = sin(uReedTime * 1.35 + reedOrigin.x * 0.42 + reedOrigin.z * 0.27);
          reedSway += sin(uReedTime * 2.1 + reedOrigin.x * 0.71) * 0.28;
          float reedWeight = max(position.y, 0.0);
          transformed.x += reedSway * reedWeight * reedWeight * 0.16;
          transformed.z += reedSway * reedWeight * reedWeight * 0.07;
          `,
        )
    }
    mat.customProgramCacheKey = () => 'off-the-dock-reeds'
    return { geo, mat }
  }, [timeUniform])

  useEffect(() => {
    return () => {
      assets.geo.dispose()
      assets.mat.dispose()
    }
  }, [assets])

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    reeds.forEach((reed, index) => {
      dummy.position.set(reed.x, reed.y, reed.z)
      dummy.rotation.set(reed.tiltX, reed.rotation, reed.tiltZ)
      dummy.scale.set(1, reed.height, 1)
      dummy.updateMatrix()
      mesh.setMatrixAt(index, dummy.matrix)
      tint.set(reed.hue > 0.72 ? '#a38f5e' : reed.hue > 0.4 ? '#66784b' : '#4f6641')
      tint.offsetHSL(0, 0.02, (reed.hue - 0.5) * 0.1)
      mesh.setColorAt(index, tint)
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [reeds])

  useFrame((state) => {
    timeUniform.value = state.clock.elapsedTime
  })

  return (
    <instancedMesh
      ref={ref}
      args={[assets.geo, assets.mat, reeds.length]}
      receiveShadow
      frustumCulled={false}
    />
  )
}

/* ------------------------------------------------------------------ */
/* Lily pads                                                           */
/* ------------------------------------------------------------------ */

interface LilyData {
  x: number
  z: number
  scale: number
  rotation: number
  hue: number
}

function buildLilies(): LilyData[] {
  const rng = mulberry32(0x117)
  const clusters = [
    { x: LILY_POSITION.x, z: LILY_POSITION.z, count: 9 },
    { x: -7.2, z: 2.2, count: 5 },
  ]
  const lilies: LilyData[] = []
  for (const cluster of clusters) {
    for (let i = 0; i < cluster.count; i += 1) {
      const angle = rng() * Math.PI * 2
      const radius = Math.sqrt(rng()) * 2.6
      lilies.push({
        x: cluster.x + Math.cos(angle) * radius,
        z: cluster.z + Math.sin(angle) * radius * 0.7,
        scale: 0.55 + rng() * 0.8,
        rotation: rng() * Math.PI * 2,
        hue: rng(),
      })
    }
  }
  return lilies
}

export function LilyPads() {
  const lilies = useMemo(buildLilies, [])
  const ref = useRef<THREE.InstancedMesh>(null)
  const assets = useMemo(() => {
    const geo = new THREE.CircleGeometry(0.34, 9, 0.25, Math.PI * 1.86)
    geo.rotateX(-Math.PI / 2)
    const mat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.78,
      metalness: 0.02,
      side: THREE.DoubleSide,
      flatShading: true,
    })
    return { geo, mat }
  }, [])

  useEffect(() => {
    return () => {
      assets.geo.dispose()
      assets.mat.dispose()
    }
  }, [assets])

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    lilies.forEach((lily, index) => {
      tint.set(lily.hue > 0.7 ? '#5b7546' : lily.hue > 0.35 ? '#476743' : '#3d5c3b')
      mesh.setColorAt(index, tint)
    })
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.frustumCulled = false
  }, [lilies])

  useFrame((state) => {
    const mesh = ref.current
    if (!mesh) return
    const time = state.clock.elapsedTime
    lilies.forEach((lily, index) => {
      const y = waterSurface(lily.x, lily.z, time) + 0.025
      dummy.position.set(lily.x, y, lily.z)
      dummy.rotation.set(Math.sin(time * 0.8 + index) * 0.025, lily.rotation, Math.cos(time * 0.7 + index) * 0.025)
      dummy.scale.setScalar(lily.scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(index, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      <instancedMesh
        ref={ref}
        args={[assets.geo, assets.mat, lilies.length]}
        frustumCulled={false}
      />
      <LilyFlower x={LILY_POSITION.x + 0.8} z={LILY_POSITION.z - 0.3} scale={1} delay={0} />
      <LilyFlower x={LILY_POSITION.x - 0.65} z={LILY_POSITION.z + 0.65} scale={0.8} delay={2.1} />
      <LilyFlower x={-7.4} z={2.6} scale={0.75} delay={4.2} />
    </group>
  )
}

function LilyFlower({ x, z, scale, delay }: { x: number; z: number; scale: number; delay: number }) {
  const ref = useRef<THREE.Group>(null)
  const assets = useMemo(() => {
    const petalGeo = new THREE.ConeGeometry(0.055, 0.22, 4)
    const petalMat = new THREE.MeshStandardMaterial({
      color: '#f2d7cf',
      roughness: 0.7,
      emissive: '#3d211f',
      emissiveIntensity: 0.08,
      flatShading: true,
    })
    const centerGeo = new THREE.IcosahedronGeometry(0.055, 0)
    const centerMat = new THREE.MeshStandardMaterial({
      color: '#d8a84c',
      roughness: 0.6,
      emissive: '#6b4410',
      emissiveIntensity: 0.15,
      flatShading: true,
    })
    return { petalGeo, petalMat, centerGeo, centerMat }
  }, [])

  useEffect(() => {
    return () => {
      assets.petalGeo.dispose()
      assets.petalMat.dispose()
      assets.centerGeo.dispose()
      assets.centerMat.dispose()
    }
  }, [assets])

  useFrame((state) => {
    const group = ref.current
    if (!group) return
    const time = state.clock.elapsedTime
    group.position.y = waterSurface(x, z, time) + 0.1 + Math.sin(time * 0.9 + delay) * 0.012
    group.rotation.z = Math.sin(time * 0.5 + delay) * 0.04
    group.rotation.x = Math.cos(time * 0.42 + delay) * 0.03
  })

  return (
    <group ref={ref} position={[x, 0, z]} scale={scale}>
      {Array.from({ length: 5 }).map((_, index) => {
        const angle = (index / 5) * Math.PI * 2
        return (
          <mesh
            key={index}
            geometry={assets.petalGeo}
            material={assets.petalMat}
            position={[Math.cos(angle) * 0.085, 0.07, Math.sin(angle) * 0.085]}
            rotation={[Math.sin(angle) * 0.75, angle, Math.cos(angle) * 0.75]}
            scale={[1, 1, 0.6]}
          />
        )
      })}
      <mesh geometry={assets.centerGeo} material={assets.centerMat} position={[0, 0.09, 0]} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Drifting leaves                                                     */
/* ------------------------------------------------------------------ */

interface LeafData {
  x: number
  z: number
  scale: number
  rotation: number
  spin: number
  drift: number
  hue: number
}

export function DriftLeaves() {
  const leaves = useMemo(() => {
    const rng = mulberry32(0x1eaf)
    return Array.from({ length: 36 }, (): LeafData => {
      const x = -16 + rng() * 32
      const z = shoreZ(x) + 1.5 + rng() * 12
      return {
        x,
        z,
        scale: 0.65 + rng() * 0.9,
        rotation: rng() * Math.PI * 2,
        spin: (rng() - 0.5) * 0.12,
        drift: rng() * Math.PI * 2,
        hue: rng(),
      }
    })
  }, [])
  const ref = useRef<THREE.InstancedMesh>(null)
  const assets = useMemo(() => {
    const geo = new THREE.CircleGeometry(0.13, 5)
    geo.rotateX(-Math.PI / 2)
    geo.scale(1, 1, 1.8)
    const mat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.85,
      metalness: 0,
      side: THREE.DoubleSide,
      flatShading: true,
    })
    return { geo, mat }
  }, [])

  useEffect(() => {
    return () => {
      assets.geo.dispose()
      assets.mat.dispose()
    }
  }, [assets])

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    leaves.forEach((leaf, index) => {
      tint.set(leaf.hue > 0.72 ? '#b8753e' : leaf.hue > 0.42 ? '#8a6b3b' : '#6b6d3f')
      tint.offsetHSL(0, 0.05, (leaf.hue - 0.5) * 0.1)
      mesh.setColorAt(index, tint)
    })
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [leaves])

  useFrame((state, delta) => {
    const mesh = ref.current
    if (!mesh) return
    const dt = Math.min(delta, 0.05)
    const time = state.clock.elapsedTime
    leaves.forEach((leaf, index) => {
      flowAt(leaf.x, leaf.z, time, flow)
      leaf.x += (flow.x + Math.cos(leaf.drift) * 0.018) * dt
      leaf.z += (flow.y + Math.sin(leaf.drift) * 0.014 + 0.006) * dt
      leaf.rotation += leaf.spin * dt
      if (leaf.z > 17 || leaf.x > 18 || leaf.x < -18) {
        leaf.x = -16 + ((index * 7.13) % 32)
        leaf.z = shoreZ(leaf.x) + 2 + ((index * 3.71) % 10)
      }
      const y = waterSurface(leaf.x, leaf.z, time) + 0.012
      dummy.position.set(leaf.x, y, leaf.z)
      dummy.rotation.set(Math.sin(time * 0.9 + index) * 0.06, leaf.rotation, Math.cos(time * 0.8 + index) * 0.04)
      dummy.scale.setScalar(leaf.scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(index, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={ref}
      args={[assets.geo, assets.mat, leaves.length]}
      frustumCulled={false}
    />
  )
}

/* ------------------------------------------------------------------ */
/* Distant ridgelines                                                  */
/* ------------------------------------------------------------------ */

function makeRidgeGeometry(span: number, segments: number, baseY: number, seed: number): THREE.BufferGeometry {
  const rng = mulberry32(seed)
  const positions: number[] = []
  const tops: number[] = []
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments
    tops.push(
      baseY +
        5.8 +
        Math.sin(t * 7.2 + seed) * 2.3 +
        Math.sin(t * 15.4 + 1.2) * 1.1 +
        rng() * 1.3,
    )
  }
  for (let i = 0; i < segments; i += 1) {
    const x0 = -span / 2 + (i / segments) * span
    const x1 = -span / 2 + ((i + 1) / segments) * span
    const y0 = tops[i] ?? baseY
    const y1 = tops[i + 1] ?? baseY
    positions.push(x0, baseY - 4, 0, x1, baseY - 4, 0, x1, y1, 0)
    positions.push(x0, baseY - 4, 0, x1, y1, 0, x0, y0, 0)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.computeVertexNormals()
  return geo
}

export function DistantHills() {
  const assets = useMemo(
    () => [
      {
        geo: makeRidgeGeometry(150, 30, 0, 8.1),
        mat: new THREE.MeshBasicMaterial({ color: '#5f6d61', fog: true }),
        z: 36,
        baseTarget: 0.6,
        rotation: Math.PI,
        scaleY: 0.52,
      },
      {
        geo: makeRidgeGeometry(120, 24, 0, 11.4),
        mat: new THREE.MeshBasicMaterial({ color: '#49594f', fog: true }),
        z: 29,
        baseTarget: 0.46,
        rotation: Math.PI,
        scaleY: 0.4,
      },
    ],
    [],
  )
  const refs = useRef<Array<THREE.Mesh | null>>([])

  useEffect(() => {
    return () => {
      for (const asset of assets) {
        asset.geo.dispose()
        asset.mat.dispose()
      }
    }
  }, [assets])

  useFrame((_, delta) => {
    const palette = PALETTES[useGameStore.getState().timeOfDay]
    const dt = Math.min(delta, 0.05)
    assets.forEach((asset, index) => {
      const mesh = refs.current[index]
      if (!mesh) return
      hazeColor.copy(palette.fog).multiplyScalar(asset.baseTarget)
      hazeColor.offsetHSL(0.02, 0.02, 0)
      const mat = mesh.material as THREE.MeshBasicMaterial
      mat.color.lerp(hazeColor, 1 - Math.exp(-1.2 * dt))
    })
  })

  return (
    <group>
      {assets.map((asset, index) => (
        <mesh
          key={index}
          ref={(node) => {
            refs.current[index] = node
          }}
          geometry={asset.geo}
          material={asset.mat}
          position={[0, 0, asset.z]}
          rotation={[0, asset.rotation, 0]}
          scale={[1, asset.scaleY ?? 1, 1]}
        />
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Small shore details                                                 */
/* ------------------------------------------------------------------ */

export function ShoreDetails() {
  const stones = useMemo(() => {
    const rng = mulberry32(0x570ae)
    const list: Array<{ x: number; z: number; y: number; scale: number; rotation: number }> = []
    for (let i = 0; i < 13; i += 1) {
      const t = i / 12
      const x = -0.55 - t * 6.35 + Math.sin(t * 5.2) * 0.34
      const z = -4.9 - t * 2.55 + Math.cos(t * 3.8) * 0.3
      list.push({
        x,
        z,
        y: terrainHeight(x, z),
        scale: 0.24 + rng() * 0.2,
        rotation: rng() * Math.PI,
      })
    }
    return list
  }, [])
  const stonesRef = useRef<THREE.InstancedMesh>(null)
  const assets = useMemo(() => {
    const geo = new THREE.DodecahedronGeometry(1, 0)
    const mat = new THREE.MeshStandardMaterial({ color: '#777062', roughness: 1, flatShading: true })
    return { geo, mat }
  }, [])

  useEffect(() => {
    return () => {
      assets.geo.dispose()
      assets.mat.dispose()
    }
  }, [assets])

  useLayoutEffect(() => {
    const mesh = stonesRef.current
    if (!mesh) return
    stones.forEach((stone, index) => {
      dummy.position.set(stone.x, stone.y + 0.03, stone.z)
      dummy.rotation.set(stone.rotation * 0.2, stone.rotation, stone.rotation * 0.1)
      dummy.scale.set(stone.scale, stone.scale * 0.35, stone.scale * 0.82)
      dummy.updateMatrix()
      mesh.setMatrixAt(index, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [stones])

  return (
    <group>
      <instancedMesh
        ref={stonesRef}
        args={[assets.geo, assets.mat, stones.length]}
        receiveShadow
        frustumCulled={false}
      />
      <group position={[8.9, terrainHeight(8.9, -3.9) + 0.18, -3.9]} rotation={[0.08, 0.8, 1.38]}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.16, 0.23, 3.6, 6]} />
          <meshStandardMaterial color="#6a5d4a" roughness={1} flatShading />
        </mesh>
        <mesh position={[0.65, 0.2, 0]} rotation={[0, 0, 0.6]} castShadow>
          <cylinderGeometry args={[0.06, 0.11, 1.2, 5]} />
          <meshStandardMaterial color="#5c5142" roughness={1} flatShading />
        </mesh>
      </group>
    </group>
  )
}
