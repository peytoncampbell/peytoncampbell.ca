import { create } from 'zustand'
import {
  loadResidents,
  residentById,
  saveResidents,
  type FishProfile,
} from '../game/residents'
import {
  QUALITY_ORDER,
  TIME_ORDER,
  WEATHER_ORDER,
  type CatchSummary,
  type Phase,
  type Quality,
  type SessionStats,
  type TimeOfDay,
  type Toast,
  type ToastTone,
  type Weather,
} from '../game/types'

interface Settings {
  timeOfDay: TimeOfDay
  weather: Weather
  quality: Quality
  soundOn: boolean
  reducedMotion: boolean
}

const SETTINGS_KEY = 'off-the-dock:settings:v1'
const ONBOARDED_KEY = 'off-the-dock:onboarded:v1'

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function defaultQuality(): Quality {
  if (typeof window === 'undefined') return 'medium'
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const small = Math.min(window.innerWidth, window.innerHeight) < 820
  return coarse && small ? 'low' : 'medium'
}

function loadSettings(): Settings {
  const fallback: Settings = {
    timeOfDay: 'blue',
    weather: 'calm',
    quality: defaultQuality(),
    soundOn: true,
    reducedMotion: prefersReducedMotion(),
  }
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<Settings>
    return {
      timeOfDay: TIME_ORDER.includes(parsed.timeOfDay as TimeOfDay)
        ? (parsed.timeOfDay as TimeOfDay)
        : fallback.timeOfDay,
      weather: WEATHER_ORDER.includes(parsed.weather as Weather)
        ? (parsed.weather as Weather)
        : fallback.weather,
      quality: QUALITY_ORDER.includes(parsed.quality as Quality)
        ? (parsed.quality as Quality)
        : fallback.quality,
      soundOn: typeof parsed.soundOn === 'boolean' ? parsed.soundOn : fallback.soundOn,
      reducedMotion:
        typeof parsed.reducedMotion === 'boolean' ? parsed.reducedMotion : fallback.reducedMotion,
    }
  } catch {
    return fallback
  }
}

function saveSettings(settings: Settings): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // Ignore storage failures.
  }
}

function onboardingNeeded(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(ONBOARDED_KEY) !== '1'
  } catch {
    return true
  }
}

const settings = loadSettings()
const initialResidents = loadResidents()

const initialStats: SessionStats = {
  casts: 0,
  bites: 0,
  catches: 0,
  releases: 0,
  snaps: 0,
  bestCm: 0,
  startedAt: Date.now(),
}

const nextMoodOnCatch = (fish: FishProfile): string => {
  const moods: Record<string, string> = {
    bluegill: 'a little startled',
    perch: 'curious about the sky',
    bass: 'quietly offended',
    walleye: 'wide awake',
    pike: 'already plotting',
    catfish: 'patient as ever',
    golden: 'glad to have met you',
  }
  return moods[fish.speciesId] ?? 'curious'
}

interface GameStore {
  phase: Phase
  castPower: number
  tension: number
  reelProgress: number
  timeOfDay: TimeOfDay
  weather: Weather
  quality: Quality
  soundOn: boolean
  reducedMotion: boolean
  photoMode: boolean
  journalOpen: boolean
  helpOpen: boolean
  settingsOpen: boolean
  onboardingOpen: boolean
  cinematic: boolean
  hookedFishId: string | null
  selectedFishId: string | null
  catchCard: CatchSummary | null
  toast: Toast | null
  stats: SessionStats
  residents: FishProfile[]

  setPhase: (phase: Phase) => void
  setMeters: (meters: { castPower?: number; tension?: number; reelProgress?: number }) => void
  setTimeOfDay: (time: TimeOfDay) => void
  cycleTime: () => void
  setWeather: (weather: Weather) => void
  cycleWeather: () => void
  setQuality: (quality: Quality) => void
  cycleQuality: () => void
  setSoundOn: (on: boolean) => void
  toggleSound: () => void
  setReducedMotion: (on: boolean) => void
  setPhotoMode: (on: boolean) => void
  togglePhotoMode: () => void
  setJournalOpen: (open: boolean) => void
  toggleJournal: () => void
  setHelpOpen: (open: boolean) => void
  setSettingsOpen: (open: boolean) => void
  setOnboardingOpen: (open: boolean) => void
  completeOnboarding: () => void
  toggleCinematic: () => void
  setHookedFishId: (id: string | null) => void
  selectFish: (id: string | null) => void
  recordCast: () => void
  recordBite: () => void
  recordSnap: () => void
  registerCatch: (fishId: string) => CatchSummary | null
  closeCatchCard: () => void
  notify: (text: string, tone?: ToastTone) => void
  clearToast: (id: number) => void
}

const settingsOf = (state: GameStore): Settings => ({
  timeOfDay: state.timeOfDay,
  weather: state.weather,
  quality: state.quality,
  soundOn: state.soundOn,
  reducedMotion: state.reducedMotion,
})

let toastCounter = 0

export const useGameStore = create<GameStore>((set, get) => ({
  phase: 'idle',
  castPower: 0,
  tension: 0,
  reelProgress: 0,
  timeOfDay: settings.timeOfDay,
  weather: settings.weather,
  quality: settings.quality,
  soundOn: settings.soundOn,
  reducedMotion: settings.reducedMotion,
  photoMode: false,
  journalOpen: false,
  helpOpen: false,
  settingsOpen: false,
  onboardingOpen: onboardingNeeded(),
  cinematic: false,
  hookedFishId: null,
  selectedFishId: null,
  catchCard: null,
  toast: null,
  stats: initialStats,
  residents: initialResidents,

  setPhase: (phase) => set({ phase }),

  setMeters: ({ castPower, tension, reelProgress }) =>
    set((state) => ({
      castPower: castPower ?? state.castPower,
      tension: tension ?? state.tension,
      reelProgress: reelProgress ?? state.reelProgress,
    })),

  setTimeOfDay: (timeOfDay) => {
    set({ timeOfDay })
    saveSettings(settingsOf(get()))
  },

  cycleTime: () => {
    const current = get().timeOfDay
    const next = TIME_ORDER[(TIME_ORDER.indexOf(current) + 1) % TIME_ORDER.length] ?? 'blue'
    get().setTimeOfDay(next)
  },

  setWeather: (weather) => {
    set({ weather })
    saveSettings(settingsOf(get()))
  },

  cycleWeather: () => {
    const current = get().weather
    const next = WEATHER_ORDER[(WEATHER_ORDER.indexOf(current) + 1) % WEATHER_ORDER.length] ?? 'calm'
    get().setWeather(next)
  },

  setQuality: (quality) => {
    set({ quality })
    saveSettings(settingsOf(get()))
  },

  cycleQuality: () => {
    const current = get().quality
    const next = QUALITY_ORDER[(QUALITY_ORDER.indexOf(current) + 1) % QUALITY_ORDER.length] ?? 'medium'
    get().setQuality(next)
  },

  setSoundOn: (soundOn) => {
    set({ soundOn })
    saveSettings(settingsOf(get()))
  },

  toggleSound: () => get().setSoundOn(!get().soundOn),

  setReducedMotion: (reducedMotion) => {
    set({ reducedMotion })
    saveSettings(settingsOf(get()))
  },

  setPhotoMode: (photoMode) => {
    if (photoMode) {
      if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
      set({
        photoMode: true,
        journalOpen: false,
        helpOpen: false,
        settingsOpen: false,
        selectedFishId: null,
        catchCard: null,
      })
    } else {
      set({ photoMode: false })
    }
  },

  togglePhotoMode: () => get().setPhotoMode(!get().photoMode),

  setJournalOpen: (journalOpen) => set({ journalOpen, helpOpen: false, settingsOpen: false }),
  toggleJournal: () =>
    set((state) => ({
      journalOpen: !state.journalOpen,
      helpOpen: false,
      settingsOpen: false,
    })),
  setHelpOpen: (helpOpen) => set({ helpOpen, journalOpen: false, settingsOpen: false }),
  setSettingsOpen: (settingsOpen) =>
    set({ settingsOpen, journalOpen: false, helpOpen: false }),
  setOnboardingOpen: (onboardingOpen) => set({ onboardingOpen }),
  completeOnboarding: () => {
    set({ onboardingOpen: false })
    try {
      window.localStorage.setItem(ONBOARDED_KEY, '1')
    } catch {
      // Ignore storage failures.
    }
  },
  toggleCinematic: () => set((state) => ({ cinematic: !state.cinematic })),
  setHookedFishId: (hookedFishId) => set({ hookedFishId }),

  selectFish: (id) => {
    if (!id) {
      set({ selectedFishId: null })
      return
    }
    const state = get()
    const fish = residentById(state.residents, id)
    if (!fish) return
    const nextResidents = state.residents.map((resident) =>
      resident.id === id ? { ...resident, lastSeen: Date.now() } : resident,
    )
    saveResidents(nextResidents)
    set({ selectedFishId: id, residents: nextResidents })
  },

  recordCast: () =>
    set((state) => ({ stats: { ...state.stats, casts: state.stats.casts + 1 } })),

  recordBite: () =>
    set((state) => ({ stats: { ...state.stats, bites: state.stats.bites + 1 } })),

  recordSnap: () =>
    set((state) => ({ stats: { ...state.stats, snaps: state.stats.snaps + 1 } })),

  registerCatch: (fishId) => {
    const state = get()
    const fish = residentById(state.residents, fishId)
    if (!fish) return null

    const isFirstCatch = fish.catches === 0
    const isPersonalBest = state.stats.catches === 0 || fish.lengthCm > state.stats.bestCm
    const updated: FishProfile = {
      ...fish,
      catches: fish.catches + 1,
      lastSeen: Date.now(),
      mood: nextMoodOnCatch(fish),
    }
    const residents = state.residents.map((resident) => (resident.id === fishId ? updated : resident))
    saveResidents(residents)

    const summary: CatchSummary = {
      fish: updated,
      speciesId: updated.speciesId,
      isFirstCatch,
      isPersonalBest,
      released: true,
    }

    set({
      residents,
      phase: 'caught',
      catchCard: summary,
      selectedFishId: null,
      stats: {
        ...state.stats,
        catches: state.stats.catches + 1,
        releases: state.stats.releases + 1,
        bestCm: Math.max(state.stats.bestCm, updated.lengthCm),
      },
    })

    return summary
  },

  closeCatchCard: () => set({ catchCard: null }),

  notify: (text, tone = 'quiet') => {
    toastCounter += 1
    set({ toast: { id: toastCounter, text, tone } })
  },

  clearToast: (id) => {
    if (get().toast?.id === id) set({ toast: null })
  },
}))

