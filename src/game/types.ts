import type { FishProfile } from './residents'
import type { SpeciesId } from './species'

export type TimeOfDay = 'golden' | 'blue' | 'night'
export type Weather = 'calm' | 'rain' | 'mist'
export type Quality = 'low' | 'medium' | 'high'
export type Phase =
  | 'idle'
  | 'charging'
  | 'casting'
  | 'waiting'
  | 'bite'
  | 'reeling'
  | 'catch'
  | 'caught'
  | 'snapped'

export type ToastTone = 'quiet' | 'warm' | 'warn'

export interface Toast {
  id: number
  text: string
  tone: ToastTone
}

export interface SessionStats {
  casts: number
  bites: number
  catches: number
  releases: number
  snaps: number
  bestCm: number
  startedAt: number
}

export interface CatchSummary {
  fish: FishProfile
  speciesId: SpeciesId
  isFirstCatch: boolean
  isPersonalBest: boolean
  released: boolean
}

export interface TimeMeta {
  label: string
  short: string
  clock: string
}

export const TIME_META: Record<TimeOfDay, TimeMeta> = {
  golden: { label: 'Golden hour', short: 'Golden', clock: '6:42 PM' },
  blue: { label: 'Blue hour', short: 'Blue', clock: '8:07 PM' },
  night: { label: 'Night', short: 'Night', clock: '10:28 PM' },
}

export const TIME_ORDER: TimeOfDay[] = ['golden', 'blue', 'night']
export const WEATHER_ORDER: Weather[] = ['calm', 'rain', 'mist']
export const WEATHER_LABEL: Record<Weather, string> = {
  calm: 'Calm',
  rain: 'Light rain',
  mist: 'Mist',
}
export const QUALITY_LABEL: Record<Quality, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}
export const QUALITY_ORDER: Quality[] = ['low', 'medium', 'high']
