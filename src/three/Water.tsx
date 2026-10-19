import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { DOCK_POSTS, WORLD_HALF } from '../game/world'
import { useGameStore } from '../store/useGameStore'
import { PALETTES } from './palette'

const waterVertex = /* glsl */ `
  uniform float uTime;
  uniform float uWaveScale;
  varying vec3 vWorld;
  varying vec2 vSurface;

  float swell(vec2 p) {
    float t = uTime;
    return sin(p.x * 0.55 + t * 0.8) * 0.022
      + sin(p.y * 0.72 - t * 0.62) * 0.016
      + sin((p.x + p.y) * 1.35 + t * 1.35) * 0.007
      + sin(p.x * 2.9 - t * 1.6) * cos(p.y * 2.4 + t * 1.2) * 0.0035;
  }

  void main() {
    vec3 displaced = position;
    displaced.y += swell(position.xz) * uWaveScale;
    vec4 world = modelMatrix * vec4(displaced, 1.0);
    vWorld = world.xyz;
    vSurface = position.xz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const waterFragment = /* glsl */ `
  uniform float uTime;
  uniform float uAlpha;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uSky;
  uniform vec3 uFoam;
  uniform vec3 uCaustic;
  uniform vec3 uSunColor;
  uniform vec3 uSunDirection;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  uniform float uWeather;
  uniform float uWaveScale;
  uniform vec2 uPosts[8];
  uniform vec4 uDock;

  varying vec3 vWorld;
  varying vec2 vSurface;

  float shoreCurve(float x) {
    return -5.45 + sin(x * 0.18) * 1.15 + sin(x * 0.07 + 1.3) * 0.55;
  }

  float surfaceHeight(vec2 p) {
    float t = uTime;
    return sin(p.x * 0.55 + t * 0.8) * 0.022
      + sin(p.y * 0.72 - t * 0.62) * 0.016
      + sin((p.x + p.y) * 1.35 + t * 1.35) * 0.007
      + sin(p.x * 2.9 - t * 1.6) * cos(p.y * 2.4 + t * 1.2) * 0.0035;
  }

  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  void main() {
    vec2 p = vWorld.xz;
    float t = uTime;
    float e = 0.18;
    float hL = surfaceHeight(p - vec2(e, 0.0));
    float hR = surfaceHeight(p + vec2(e, 0.0));
    float hD = surfaceHeight(p - vec2(0.0, e));
    float hU = surfaceHeight(p + vec2(0.0, e));
    vec3 normal = normalize(vec3((hL - hR) * 2.4, 1.0, (hD - hU) * 2.4));

    // A second, finer normal layer breaks up the regularity.
    float fine = sin(p.x * 5.2 + t * 2.1) * cos(p.y * 4.7 - t * 1.8);
    normal.x += fine * 0.045;
    normal.z += cos(p.x * 4.1 - t * 1.3) * 0.035;
    normal = normalize(normal);

    vec3 viewDir = normalize(cameraPosition - vWorld);
    float fresnel = pow(1.0 - clamp(dot(viewDir, normal), 0.0, 1.0), 3.0);
    fresnel = mix(0.12, 0.92, fresnel);

    float shore = shoreCurve(p.x);
    float shoreDistance = p.y - shore;
    float depthT = smoothstep(0.15, 7.5, shoreDistance);
    float edgeT = smoothstep(0.0, 2.0, shoreDistance);

    vec3 color = mix(uShallow, uDeep, depthT);
    color = mix(color, color * 0.82, smoothstep(7.0, 16.0, shoreDistance));

    // Sky reflection, softened by the low viewing angle.
    vec3 reflected = reflect(-viewDir, normal);
    float skyBand = clamp(reflected.y * 1.6 + 0.18, 0.0, 1.0);
    vec3 skyReflection = mix(uSky, uSky * 0.82 + uDeep * 0.18, skyBand);
    color = mix(color, skyReflection, fresnel * 0.6);

    // Warm sun glints.
    vec3 sunDir = normalize(uSunDirection);
    vec3 halfVec = normalize(viewDir + sunDir);
    float spec = pow(max(dot(normal, halfVec), 0.0), 210.0);
    float broadSpec = pow(max(dot(normal, halfVec), 0.0), 18.0);
    color += uSunColor * (spec * 1.9 + broadSpec * 0.055);

    // Slow caustic ribbons on the surface.
    float causticA = sin(p.x * 1.7 + t * 0.9 + sin(p.y * 1.1) * 1.7);
    float causticB = sin(p.y * 2.05 - t * 0.7 + sin(p.x * 0.8) * 1.4);
    float glimmer = pow(max(causticA * causticB, 0.0), 6.0);
    color += uCaustic * glimmer * 0.1 * (0.35 + fresnel);

    // Foam where the bay meets the shore.
    float noise = hash12(floor(p * 5.0) + floor(t * 0.5));
    float foamWave = 0.5 + 0.5 * sin(p.x * 1.15 + p.y * 0.9 + t * 1.4);
    float shoreFoam = smoothstep(1.15, 0.12, abs(shoreDistance + sin(p.x * 1.7 + t) * 0.14));
    shoreFoam *= (0.3 + foamWave * 0.7) * (0.55 + noise * 0.45);
    shoreFoam *= smoothstep(0.0, 0.35, shoreDistance + 0.75);
    color = mix(color, uFoam, shoreFoam * 0.34);

    // Foam collars around dock posts.
    for (int i = 0; i < 8; i++) {
      float d = distance(p, uPosts[i]);
      float wobble = 0.05 * sin(t * 1.7 + uPosts[i].x * 3.1 + uPosts[i].y);
      float ring = smoothstep(0.46, 0.18, abs(d - 0.22 - wobble));
      float collar = smoothstep(0.38, 0.12, d) * 0.22;
      color = mix(color, uFoam, (ring * 0.12 + collar * 0.26) * edgeT);
    }

    // Ground the dock with a cool shadow and a faint edge of foam.
    float dockX = 1.0 - smoothstep(uDock.x + 0.45, uDock.x + 0.05, abs(p.x - uDock.y));
    float dockZ = smoothstep(uDock.z - 0.3, uDock.z + 0.1, p.y) * (1.0 - smoothstep(uDock.w - 0.1, uDock.w + 0.3, p.y));
    float dockMask = dockX * dockZ;
    color *= 1.0 - dockMask * 0.3;
    float edgeFoam = smoothstep(0.13, 0.0, abs(abs(p.x - uDock.y) - uDock.x)) * dockZ;
    color = mix(color, uFoam, edgeFoam * 0.08 * (0.5 + 0.5 * sin(p.y * 3.0 + t * 1.2)));

    if (uWeather > 0.5 && uWeather < 1.5) {
      float drops = pow(hash12(floor(p * 12.0) + floor(t * 8.0)), 28.0);
      color += uFoam * drops * 0.06;
      color += uFoam * 0.012 * sin(p.x * 20.0 + t * 9.0) * sin(p.y * 17.0 - t * 7.0);
    }

    float dist = length(cameraPosition - vWorld);
    float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
    color = mix(color, uFogColor, fogFactor);

    float alpha = uAlpha + fresnel * 0.12 - (1.0 - edgeT) * 0.08 + fogFactor * 0.14;
    alpha = clamp(alpha, 0.26, 0.86);

    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

export function Water() {
  const quality = useGameStore((state) => state.quality)
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const segments = quality === 'high' ? 108 : quality === 'medium' ? 76 : 44

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(WORLD_HALF * 2 + 2, WORLD_HALF * 2 + 2, segments, segments)
    geo.rotateX(-Math.PI / 2)
    return geo
  }, [segments])

  const uniforms = useMemo(() => {
    const initial = PALETTES.blue
    return {
      uTime: { value: 0 },
      uAlpha: { value: initial.waterAlpha },
      uDeep: { value: initial.waterDeep.clone() },
      uShallow: { value: initial.waterShallow.clone() },
      uSky: { value: initial.waterSky.clone() },
      uFoam: { value: initial.waterFoam.clone() },
      uCaustic: { value: initial.waterCaustic.clone() },
      uSunColor: { value: initial.sunColor.clone() },
      uSunDirection: { value: initial.sunPosition.clone().normalize() },
      uFogColor: { value: initial.fog.clone() },
      uFogDensity: { value: initial.fogDensity },
      uWeather: { value: 0 },
      uWaveScale: { value: 1 },
      uPosts: { value: DOCK_POSTS.map((post) => new THREE.Vector2(post.x, post.z)) },
      uDock: { value: new THREE.Vector4(1.55, 0, -4.8, 5.4) },
    }
  }, [])

  useEffect(() => {
    return () => {
      geometry.dispose()
      materialRef.current?.dispose()
    }
  }, [geometry])

  useFrame((state, delta) => {
    const material = materialRef.current
    if (!material) return
    const dt = Math.min(delta, 0.05)
    const store = useGameStore.getState()
    const palette = PALETTES[store.timeOfDay]
    const k = 1 - Math.exp(-1.5 * dt)
    const u = material.uniforms
    u.uTime.value = state.clock.elapsedTime
    u.uDeep.value.lerp(palette.waterDeep, k)
    u.uShallow.value.lerp(palette.waterShallow, k)
    u.uSky.value.lerp(palette.waterSky, k)
    u.uFoam.value.lerp(palette.waterFoam, k)
    u.uCaustic.value.lerp(palette.waterCaustic, k)
    u.uSunColor.value.lerp(palette.sunColor, k)
    u.uFogColor.value.lerp(palette.fog, k)
    u.uFogDensity.value = THREE.MathUtils.damp(
      u.uFogDensity.value,
      palette.fogDensity + (store.weather === 'mist' ? 0.018 : store.weather === 'rain' ? 0.0045 : 0),
      1.5,
      dt,
    )
    u.uAlpha.value = THREE.MathUtils.damp(u.uAlpha.value, palette.waterAlpha, 1.5, dt)
    ;(u.uSunDirection.value as THREE.Vector3).copy(palette.sunPosition).normalize()
    const weatherTarget = store.weather === 'rain' ? 1 : store.weather === 'mist' ? 2 : 0
    u.uWeather.value = THREE.MathUtils.damp(u.uWeather.value, weatherTarget, 1.2, dt)
    const motionScale = store.reducedMotion ? 0.35 : 1
    const weatherScale = store.weather === 'rain' ? 1.25 : store.weather === 'mist' ? 0.7 : 1
    u.uWaveScale.value = THREE.MathUtils.damp(u.uWaveScale.value, motionScale * weatherScale, 1.2, dt)
  })

  return (
    <mesh geometry={geometry} renderOrder={2} frustumCulled={false}>
      <shaderMaterial
        ref={materialRef}
        vertexShader={waterVertex}
        fragmentShader={waterFragment}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.FrontSide}
      />
    </mesh>
  )
}
