import {
  Bloom,
  BrightnessContrast,
  DepthOfField,
  EffectComposer,
  HueSaturation,
  Noise,
  Vignette,
} from '@react-three/postprocessing'
import { useGameStore } from '../store/useGameStore'

export function Effects() {
  const quality = useGameStore((state) => state.quality)
  if (quality === 'low') return null

  const high = quality === 'high'
  return (
    <EffectComposer multisampling={high ? 4 : 2} enableNormalPass={false}>
      <Bloom
        intensity={high ? 0.5 : 0.38}
        luminanceThreshold={0.74}
        luminanceSmoothing={0.2}
        mipmapBlur
        radius={0.74}
      />
      <DepthOfField
        worldFocusDistance={11.2}
        worldFocusRange={high ? 9 : 15}
        bokehScale={high ? 1.0 : 0.35}
      />
      <HueSaturation saturation={0.04} hue={0.003} />
      <BrightnessContrast brightness={-0.005} contrast={0.035} />
      <Vignette eskil={false} offset={0.3} darkness={0.42} />
      <Noise opacity={0.022} />
    </EffectComposer>
  )
}
