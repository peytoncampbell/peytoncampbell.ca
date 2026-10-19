import { SkyDome, EnvironmentRig } from './Environment'
import { Terrain } from './Terrain'
import { Water } from './Water'
import { Dock } from './Dock'
import { Angler } from './Angler'
import { FishSchool } from './FishSchool'
import { Cabin } from './Cabin'
import { Rowboat } from './Rowboat'
import { DistantHills, DriftLeaves, LilyPads, Pines, Reeds, Rocks, ShoreDetails, Campsite } from './Shoreline'
import { ShoreLife } from './Wildlife'
import { Weather } from './Weather'
import { FishingRig } from './FishingRig'
import { WaterEffects } from './WaterEffects'
import { FishingSystem } from '../game/fishingEngine'
import { CameraRig, SceneBinding } from './CameraRig'
import { Effects } from './Effects'

export function Scene() {
  return (
    <>
      <SceneBinding />
      <SkyDome />
      <EnvironmentRig />
      <Terrain />
      <Water />
      <DistantHills />
      <Pines />
      <Rocks />
      <Reeds />
      <LilyPads />
      <DriftLeaves />
      <ShoreDetails />
      <Campsite />
      <Cabin />
      <Rowboat />
      <Dock />
      <Angler />
      <FishSchool />
      <FishingSystem />
      <FishingRig />
      <WaterEffects />
      <ShoreLife />
      <Weather />
      <CameraRig />
      <Effects />
    </>
  )
}
