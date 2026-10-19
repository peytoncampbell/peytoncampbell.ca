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
    skyTop: color('#7c8f8f'),
    skyMid: color('#d6c2a2'),
    skyHorizon: color('#ffd49c'),
    skySun: color('#ffdfaa'),
    skySunGlow: color('#f3ad66'),
    skyCloud: color('#f0d5b2'),
    stars: 0,
    sunPosition: new THREE.Vector3(28, 10, -14),
    sunColor: color('#ffcb86'),
    sunIntensity: 3.15,
    ambientColor: color('#a1a394'),
    ambientIntensity: 0.6,
    hemiSky: color('#d4d2bd'),
    hemiGround: color('#6e674c'),
    hemiIntensity: 1.02,
    fog: color('#cec1a9'),
    fogDensity: 0.0102,
    waterDeep: color('#174a47'),
    waterShallow: color('#518576'),
    waterSky: color('#b8b99d'),
    waterFoam: color('#efe6d0'),
    waterCaustic: color('#e8c78d'),
    waterAlpha: 0.34,
    exposure: 1.14,
    lantern: 0,
    windowLight: 0.35,
    fireflies: 0,
    bloom: 0.5,
    particles: color('#f3d9a2'),
  },
  blue: {
    skyTop: color('#2d4057'),
    skyMid: color('#6b6f7c'),
    skyHorizon: color('#c08d7e'),
    skySun: color('#ffcfb0'),
    skySunGlow: color('#cd8e80'),
    skyCloud: color('#8a8794'),
    stars: 0.25,
    sunPosition: new THREE.Vector3(-17, 14, -11),
    sunColor: color('#9fb8dc'),
    sunIntensity: 1.05,
    ambientColor: color('#53677a'),
    ambientIntensity: 0.5,
    hemiSky: color('#8498ab'),
    hemiGround: color('#3b4045'),
    hemiIntensity: 0.72,
    fog: color('#7b8490'),
    fogDensity: 0.017,
    waterDeep: color('#123841'),
    waterShallow: color('#4a7374'),
    waterSky: color('#849b9b'),
    waterFoam: color('#d3d5cc'),
    waterCaustic: color('#a8b9b4'),
    waterAlpha: 0.44,
    exposure: 0.98,
    lantern: 1.4,
    windowLight: 0.75,
    fireflies: 0.08,
    bloom: 0.62,
    particles: color('#becbd2'),
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
