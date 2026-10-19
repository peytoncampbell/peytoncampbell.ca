import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { clamp, hash2, smoothstep } from '../game/rng'
import { shoreZ, terrainHeight } from '../game/world'
import { useGameStore } from '../store/useGameStore'
import { PALETTES } from './palette'

const cSand = new THREE.Color('#968f7e')
const cWetSand = new THREE.Color('#585d57')
const cBedShallow = new THREE.Color('#596756')
const cBedDeep = new THREE.Color('#1d3834')
const cGrass = new THREE.Color('#43553f')
const cGrassDark = new THREE.Color('#2c4030')
const cForest = new THREE.Color('#203124')
const cRock = new THREE.Color('#6c6a60')
const cMoss = new THREE.Color('#4a5a3f')
const tempColor = new THREE.Color()

function terrainColor(x: number, y: number, z: number, out: THREE.Color): THREE.Color {
  const s = shoreZ(x)
  const d = z - s
  const variation = (hash2(Math.floor(x * 0.9 + 50), Math.floor(z * 0.9 + 50)) - 0.5) * 0.13
  const macro = Math.sin(x * 0.26 + Math.cos(z * 0.17) * 2.2) * 0.5 + 0.5

  if (y < -0.05) {
    const depth = clamp(-y / 2.5, 0, 1)
    out.copy(cBedShallow).lerp(cBedDeep, smoothstep(0.12, 0.85, depth))
    if (d < 2.2) out.lerp(cWetSand, 1 - smoothstep(0.3, 2.2, Math.max(0, d)) * 0.75)
    out.offsetHSL(0, 0, variation * 0.5)
    return out
  }

  if (y < 0.5 && d < 1.6) {
    out.copy(cWetSand).lerp(cSand, smoothstep(-0.1, 0.35, y))
  } else {
    const rockT = smoothstep(2.0, 3.5, y)
    out.copy(cGrass).lerp(cMoss, macro * 0.45)
    out.lerp(cForest, smoothstep(0.8, 2.4, y) * 0.55)
    out.lerp(cGrassDark, (1 - macro) * 0.3)
    out.lerp(cRock, rockT * 0.85)
    if (d < 3.5) out.lerp(cSand, 1 - smoothstep(0.5, 3.5, Math.max(0.3, d)) * 0.6)
  }

  out.offsetHSL(0, 0, variation)
  return out
}

const causticChunk = /* glsl */ `
  uniform float uCausticTime;
  uniform vec3 uCausticColor;
  uniform float uCausticStrength;
  varying vec3 vTerrainWorld;

  float terrainCaustic(vec2 p, float t) {
    p += vec2(sin(p.y * 1.9 + t) * 0.2, cos(p.x * 1.7 - t * 0.8) * 0.2);
    float a = sin(p.x * 2.35 + p.y * 1.25 + t * 1.25);
    float b = sin(p.x * 1.45 - p.y * 2.6 - t * 1.05);
    float line = pow(clamp(a * b, 0.0, 1.0), 4.0);
    return line;
  }
`

export function Terrain() {
  const quality = useGameStore((state) => state.quality)
  const segments = quality === 'high' ? 72 : quality === 'medium' ? 56 : 40

  const { geometry, material } = useMemo(() => {
    const geo = new THREE.PlaneGeometry(48, 48, segments, segments)
    geo.rotateX(-Math.PI / 2)
    const position = geo.attributes.position
    const colors = new Float32Array(position.count * 3)

    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i)
      const z = position.getZ(i)
      const y = terrainHeight(x, z)
      position.setY(i, y)
      terrainColor(x, y, z, tempColor)
      colors[i * 3] = tempColor.r
      colors[i * 3 + 1] = tempColor.g
      colors[i * 3 + 2] = tempColor.b
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geo.computeVertexNormals()

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.96,
      metalness: 0,
      flatShading: true,
    })
    const causticTime = { value: 0 }
    const causticColor = { value: PALETTES.blue.waterCaustic.clone() }
    const causticStrength = { value: 0.34 }
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uCausticTime = causticTime
      shader.uniforms.uCausticColor = causticColor
      shader.uniforms.uCausticStrength = causticStrength
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          varying vec3 vTerrainWorld;`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vTerrainWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
        )
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${causticChunk}`)
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          if (vTerrainWorld.y < -0.12) {
            vec2 p = vTerrainWorld.xz * 0.72;
            float t = uCausticTime;
            float c1 = terrainCaustic(p + vec2(t * 0.12, -t * 0.06), t * 0.55);
            float c2 = terrainCaustic(p * 1.7 - vec2(t * 0.08, t * 0.04), t * 0.8);
            float depthMask = smoothstep(-0.12, -0.8, vTerrainWorld.y);
            depthMask *= 1.0 - smoothstep(10.0, 17.0, length(vTerrainWorld.xz));
            diffuseColor.rgb += uCausticColor * (c1 * 0.65 + c2 * 0.35) * uCausticStrength * depthMask;
          }`,
        )
      mat.userData.shader = shader
    }
    mat.userData.causticTime = causticTime
    mat.userData.causticColor = causticColor
    mat.userData.causticStrength = causticStrength

    return { geometry: geo, material: mat }
  }, [segments])

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  useFrame((state, delta) => {
    const mat = material
    const palette = PALETTES[useGameStore.getState().timeOfDay]
    const timeUniform = mat.userData.causticTime as { value: number } | undefined
    const colorUniform = mat.userData.causticColor as { value: THREE.Color } | undefined
    const strengthUniform = mat.userData.causticStrength as { value: number } | undefined
    if (timeUniform) timeUniform.value = state.clock.elapsedTime
    if (colorUniform) colorUniform.value.lerp(palette.waterCaustic, 1 - Math.exp(-1.4 * Math.min(delta, 0.05)))
    if (strengthUniform) {
      const target = useGameStore.getState().timeOfDay === 'night' ? 0.12 : 0.26
      strengthUniform.value = THREE.MathUtils.damp(strengthUniform.value, target, 1.4, Math.min(delta, 0.05))
    }
  })

  return (
    <mesh geometry={geometry} material={material} receiveShadow />
  )
}
