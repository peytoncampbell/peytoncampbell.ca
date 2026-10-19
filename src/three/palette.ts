import * as THREE from 'three'
import type { TimeOfDay } from '../game/types'

export interface ScenePalette {
  skyTop: THREE.Color
  skyMid: THREE.Color
  skyHorizon: THREE.Color
  skySun: THREE.Color
  skySunGlow: THREE.Color
  skyCloud: THREE.Color
  stars: number
  sunPosition: THREE.Vector3
  sunColor: THREE.Color
  sunIntensity: number
  ambientColor: THREE.Color
  ambientIntensity: number
  hemiSky: THREE.Color
  hemiGround: THREE.Color
  hemiIntensity: number
  fog: THREE.Color
  fogDensity: number
  waterDeep: THREE.Color
  waterShallow: THREE.Color
  waterSky: THREE.Color
  waterFoam: THREE.Color
  waterCaustic: THREE.Color
  waterAlpha: number
  exposure: number
  lantern: number
  windowLight: number
  fireflies: number
  bloom: number
  particles: THREE.Color
}

const color = (hex: string): THREE.Color => new THREE.Color(hex)

export const PALETTES: Record<TimeOfDay, ScenePalette> = {
  golden: {
    skyTop: color('#657b7c'),
    skyMid: color('#c0b797'),
    skyHorizon: color('#e9d0a0'),
    skySun: color('#ffd8a5'),
    skySunGlow: color('#dfb27a'),
    skyCloud: color('#c8b99c'),
    stars: 0,
    sunPosition: new THREE.Vector3(26, 12, 6),
    sunColor: color('#ffcf98'),
    sunIntensity: 2.75,
    ambientColor: color('#929688'),
    ambientIntensity: 0.62,
    hemiSky: color('#c6c4af'),
    hemiGround: color('#5c5c4a'),
    hemiIntensity: 0.98,
    fog: color('#b9b6a2'),
    fogDensity: 0.0115,
    waterDeep: color('#113a38'),
    waterShallow: color('#476f63'),
    waterSky: color('#a9b1a0'),
    waterFoam: color('#e3dac6'),
    waterCaustic: color('#d8c197'),
    waterAlpha: 0.35,
    exposure: 1.08,
    lantern: 0,
    windowLight: 0.5,
    fireflies: 0,
    bloom: 0.46,
    particles: color('#ecd6a6'),
  },
  blue: {
    skyTop: color('#344c4e'),
    skyMid: color('#82958c'),
    skyHorizon: color('#d7d0bc'),
    skySun: color('#f0e4c9'),
    skySunGlow: color('#c3bda5'),
    skyCloud: color('#97a49d'),
    stars: 0,
    sunPosition: new THREE.Vector3(-22, 8, -17),
    sunColor: color('#e3dcc9'),
    sunIntensity: 2.2,
    ambientColor: color('#7b8b80'),
    ambientIntensity: 0.78,
    hemiSky: color('#a1ada4'),
    hemiGround: color('#3b453a'),
    hemiIntensity: 1.05,
    fog: color('#a0aaa2'),
    fogDensity: 0.0135,
    waterDeep: color('#0d2a2e'),
    waterShallow: color('#4a6f64'),
    waterSky: color('#9baaa3'),
    waterFoam: color('#d8d7c8'),
    waterCaustic: color('#b5c0ad'),
    waterAlpha: 0.38,
    exposure: 1.12,
    lantern: 1.5,
    windowLight: 0.9,
    fireflies: 0,
    bloom: 0.48,
    particles: color('#d1dad0'),
  },
  night: {
    skyTop: color('#060d15'),
    skyMid: color('#13222b'),
    skyHorizon: color('#293e44'),
    skySun: color('#e2e7ef'),
    skySunGlow: color('#8da4ba'),
    skyCloud: color('#1d3138'),
    stars: 1,
    sunPosition: new THREE.Vector3(-19, 24, -12),
    sunColor: color('#95add4'),
    sunIntensity: 0.62,
    ambientColor: color('#2f4250'),
    ambientIntensity: 0.38,
    hemiSky: color('#4d6b7c'),
    hemiGround: color('#1a2424'),
    hemiIntensity: 0.48,
    fog: color('#15252b'),
    fogDensity: 0.022,
    waterDeep: color('#071f27'),
    waterShallow: color('#1d4647'),
    waterSky: color('#34545f'),
    waterFoam: color('#a9bcb7'),
    waterCaustic: color('#5f8a85'),
    waterAlpha: 0.52,
    exposure: 0.9,
    lantern: 12,
    windowLight: 2.2,
    fireflies: 1,
    bloom: 0.85,
    particles: color('#cfe4c5'),
  },
}

export const sunDirection = (palette: ScenePalette): THREE.Vector3 =>
  palette.sunPosition.clone().normalize()
