import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../store/useGameStore'
import { PALETTES } from './palette'
import { CABIN_POSITION, LANTERN_POSITION } from '../game/world'
import { damp } from '../game/rng'

const skyVertexShader = /* glsl */ `
  varying vec3 vWorldDirection;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldDirection = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const skyFragmentShader = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uMid;
  uniform vec3 uHorizon;
  uniform vec3 uSunColor;
  uniform vec3 uSunGlow;
  uniform vec3 uCloud;
  uniform vec3 uSunDirection;
  uniform float uStars;
  uniform float uTime;

  varying vec3 vWorldDirection;

  float hash31(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  void main() {
    vec3 dir = normalize(vWorldDirection);
    float h = clamp(dir.y, 0.0, 1.0);

    vec3 sky = mix(uHorizon, uMid, smoothstep(0.0, 0.28, h));
    sky = mix(sky, uTop, smoothstep(0.22, 0.9, h));

    vec3 flatDir = normalize(vec3(dir.x, 0.0, dir.z) + vec3(0.0001));
    vec3 flatSun = normalize(vec3(uSunDirection.x, 0.0, uSunDirection.z) + vec3(0.0001));
    float azimuth = max(dot(flatDir, flatSun), 0.0);
    float horizonGlow = pow(azimuth, 7.0) * (1.0 - smoothstep(0.0, 0.42, h)) * 0.45;
    sky += uSunGlow * horizonGlow;

    float sunDot = max(dot(dir, normalize(uSunDirection)), 0.0);
    float disc = smoothstep(0.99945, 0.9998, sunDot);
    float broadGlow = pow(sunDot, 18.0) * 0.22 + pow(sunDot, 90.0) * 0.5;
    sky += uSunColor * (disc * 1.25 + broadGlow);

    // A few slow strata near the horizon, tinted by the sun.
    float band1 = sin(dir.x * 9.0 + dir.z * 5.0 + uTime * 0.006) * 0.5 + 0.5;
    float band2 = sin(dir.x * 21.0 - dir.z * 13.0 + 1.8) * 0.5 + 0.5;
    float cloudMask = smoothstep(0.48, 0.9, band1 * 0.64 + band2 * 0.36);
    cloudMask *= smoothstep(0.008, 0.1, h) * (1.0 - smoothstep(0.3, 0.58, h));
    sky = mix(sky, uCloud, cloudMask * 0.3);

    if (uStars > 0.001) {
      vec3 cellPos = dir * 160.0;
      vec3 cell = floor(cellPos);
      vec3 local = fract(cellPos) - 0.5;
      float hsh = hash31(cell);
      float point = smoothstep(0.16, 0.0, length(local.xy)) * step(0.989, hsh);
      float twinkle = 0.65 + 0.35 * sin(uTime * 1.3 + hsh * 40.0);
      sky += vec3(0.85, 0.9, 1.0) * point * twinkle * uStars * smoothstep(0.0, 0.08, dir.y) * 2.0;
    }

    sky = mix(sky, uHorizon * 0.55, smoothstep(0.0, -0.18, dir.y));
    gl_FragColor = vec4(sky, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

export function SkyDome() {
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const uniforms = useMemo(() => {
    const initial = PALETTES.golden
    return {
      uTop: { value: initial.skyTop.clone() },
      uMid: { value: initial.skyMid.clone() },
      uHorizon: { value: initial.skyHorizon.clone() },
      uSunColor: { value: initial.skySun.clone() },
      uSunGlow: { value: initial.skySunGlow.clone() },
      uCloud: { value: initial.skyCloud.clone() },
      uSunDirection: { value: initial.sunPosition.clone().normalize() },
      uStars: { value: initial.stars },
      uTime: { value: 0 },
    }
  }, [])

  useEffect(() => {
    return () => {
      const material = materialRef.current
      if (material) material.dispose()
    }
  }, [])

  useFrame((state, delta) => {
    const material = materialRef.current
    if (!material) return
    const dt = Math.min(delta, 0.05)
    const time = useGameStore.getState().timeOfDay
    const target = PALETTES[time]
    const uniformsRef = material.uniforms
    uniformsRef.uTime.value = state.clock.elapsedTime
    uniformsRef.uTop.value.lerp(target.skyTop, 1 - Math.exp(-1.7 * dt))
    uniformsRef.uMid.value.lerp(target.skyMid, 1 - Math.exp(-1.7 * dt))
    uniformsRef.uHorizon.value.lerp(target.skyHorizon, 1 - Math.exp(-1.7 * dt))
    uniformsRef.uSunColor.value.lerp(target.skySun, 1 - Math.exp(-1.7 * dt))
    uniformsRef.uSunGlow.value.lerp(target.skySunGlow, 1 - Math.exp(-1.7 * dt))
    uniformsRef.uCloud.value.lerp(target.skyCloud, 1 - Math.exp(-1.7 * dt))
    uniformsRef.uStars.value = damp(uniformsRef.uStars.value, target.stars, 1.8, dt)
    const direction = uniformsRef.uSunDirection.value as THREE.Vector3
    direction.lerp(_sunDir.copy(target.sunPosition).normalize(), 1 - Math.exp(-1.2 * dt))
  })

  return (
    <mesh scale={[150, 150, 150]} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[1, 32, 20]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={skyVertexShader}
        fragmentShader={skyFragmentShader}
        uniforms={uniforms}
        side={THREE.BackSide}
        depthWrite={false}
        fog={false}
      />
    </mesh>
  )
}

const _sunDir = new THREE.Vector3()
const _targetColor = new THREE.Color()

export function EnvironmentRig() {
  const { scene, gl } = useThree()
  const quality = useGameStore((state) => state.quality)
  const sunRef = useRef<THREE.DirectionalLight>(null)
  const fillRef = useRef<THREE.DirectionalLight>(null)
  const ambientRef = useRef<THREE.AmbientLight>(null)
  const hemiRef = useRef<THREE.HemisphereLight>(null)
  const lanternRef = useRef<THREE.PointLight>(null)
  const windowRef = useRef<THREE.PointLight>(null)
  const fogRef = useRef<THREE.FogExp2>(null)

  const fog = useMemo(() => {
    const created = new THREE.FogExp2(PALETTES.golden.fog.getHex(), PALETTES.golden.fogDensity)
    fogRef.current = created
    return created
  }, [])

  useEffect(() => {
    scene.fog = fog
    scene.background = PALETTES.golden.fog.clone()
    return () => {
      scene.fog = null
      scene.background = null
    }
  }, [scene, fog])

  useEffect(() => {
    gl.shadowMap.type = THREE.PCFShadowMap
    gl.shadowMap.needsUpdate = true
  }, [gl, quality])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const store = useGameStore.getState()
    const palette = PALETTES[store.timeOfDay]
    const weather = store.weather
    const k = 1 - Math.exp(-1.7 * dt)
    const sunScale = weather === 'mist' ? 0.55 : weather === 'rain' ? 0.72 : 1
    const fillScale = weather === 'mist' ? 1.25 : weather === 'rain' ? 1.1 : 1

    const sun = sunRef.current
    if (sun) {
      sun.color.lerp(palette.sunColor, k)
      sun.intensity = damp(sun.intensity, palette.sunIntensity * sunScale, 1.7, dt)
      sun.position.lerp(palette.sunPosition, 1 - Math.exp(-1.0 * dt))
    }
    const ambient = ambientRef.current
    if (ambient) {
      ambient.color.lerp(palette.ambientColor, k)
      ambient.intensity = damp(
        ambient.intensity,
        palette.ambientIntensity * (weather === 'mist' ? 1.22 : weather === 'rain' ? 1.06 : 1),
        1.7,
        dt,
      )
    }
    const fill = fillRef.current
    if (fill) {
      fill.color.lerp(palette.hemiSky, k)
      fill.intensity = damp(fill.intensity, palette.hemiIntensity * 0.58 * fillScale, 1.7, dt)
    }
    const hemi = hemiRef.current
    if (hemi) {
      hemi.color.lerp(palette.hemiSky, k)
      hemi.groundColor.lerp(palette.hemiGround, k)
      hemi.intensity = damp(hemi.intensity, palette.hemiIntensity, 1.7, dt)
    }
    const lantern = lanternRef.current
    if (lantern) {
      lantern.intensity = damp(lantern.intensity, palette.lantern, 1.3, dt)
      lantern.color.lerp(_targetColor.set('#ffb968'), k)
    }
    const windowLight = windowRef.current
    if (windowLight) {
      windowLight.intensity = damp(windowLight.intensity, palette.windowLight, 1.3, dt)
    }
    fog.color.lerp(palette.fog, k)
    const weatherFog = weather === 'mist' ? 0.018 : weather === 'rain' ? 0.0045 : 0
    fog.density = damp(fog.density, palette.fogDensity + weatherFog, 1.5, dt)
    if (scene.background instanceof THREE.Color) scene.background.lerp(palette.fog, k)
    gl.toneMappingExposure = damp(gl.toneMappingExposure, palette.exposure, 1.2, dt)
  })

  const shadowSize = quality === 'high' ? 2048 : quality === 'medium' ? 1024 : 512

  return (
    <>
      <ambientLight ref={ambientRef} intensity={0.4} color="#8b958c" />
      <hemisphereLight
        ref={hemiRef}
        args={['#c3cbbc', '#595741', 0.8]}
        intensity={0.8}
      />
      <directionalLight
        ref={fillRef}
        position={[-9, 7, -10]}
        intensity={0.4}
        color="#9dadb8"
      />
      <directionalLight
        ref={sunRef}
        position={[28, 10, -14]}
        intensity={3.15}
        color="#ffcb86"
        castShadow={quality !== 'low'}
        shadow-mapSize-width={shadowSize}
        shadow-mapSize-height={shadowSize}
        shadow-camera-left={-24}
        shadow-camera-right={24}
        shadow-camera-top={24}
        shadow-camera-bottom={-24}
        shadow-camera-near={1}
        shadow-camera-far={90}
        shadow-bias={-0.00035}
        shadow-normalBias={0.025}
      />
      <pointLight
        ref={lanternRef}
        position={[LANTERN_POSITION.x, LANTERN_POSITION.y + 1.35, LANTERN_POSITION.z]}
        color="#ffb968"
        intensity={0}
        distance={14}
        decay={2}
      />
      <pointLight
        ref={windowRef}
        position={[CABIN_POSITION.x - 0.9, 2.1, CABIN_POSITION.z - 1.6]}        color="#ffb15c"
        intensity={0.2}
        distance={11}
        decay={2}
      />
    </>
  )
}
