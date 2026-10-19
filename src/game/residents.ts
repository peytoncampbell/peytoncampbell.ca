import { mulberry32 } from './rng'
import {
  SPECIES,
  SPECIES_COUNTS,
  SPECIES_LIST,
  weightFor,
  type SpeciesId,
} from './species'

export interface FishProfile {
  id: string
  name: string
  speciesId: SpeciesId
  lengthCm: number
  weightKg: number
  mood: string
  favoriteBait: string
  /** Epoch ms. `null` means the angler has not met this resident yet. */
  lastSeen: number | null
  catches: number
}

const NAMES: Record<SpeciesId, string[]> = {
  bluegill: ['Sunny', 'Pip', 'Bramble', 'Juniper', 'Moss'],
  perch: ['Marigold', 'Tiger', 'Pebble', 'Cinder', 'Clover', 'Stripe'],
  bass: ['Chief', 'Hollis', 'Rook', 'Sable', 'Bucketmouth'],
  walleye: ['Glass', 'Dusk', 'Mirror'],
  pike: ['Longshanks', 'Reed'],
  catfish: ['Whiskers', 'Old Tom', 'Silt'],
  golden: ['Aurora'],
}

const MOODS: Record<SpeciesId, string[]> = {
  bluegill: ['curious', 'sunbathing', 'peckish', 'nosy'],
  perch: ['content', 'drifting', 'hungry', 'keeping tabs'],
  bass: ['unimpressed', 'brooding', 'watching', 'ornery'],
  walleye: ['sleepy', 'wary', 'hunting the dusk', 'hard to read'],
  pike: ['impatient', 'lurking', 'hungry', 'sizing you up'],
  catfish: ['patient', 'dreaming of mud', 'unbothered', 'old and wise'],
  golden: ['elusive', 'quietly radiant', 'watching the light', 'mythic'],
}

const BAITS: Record<SpeciesId, string[]> = {
  bluegill: ['nightcrawler', 'red worm', 'cricket'],
  perch: ['minnow', 'red worm', 'small spinner'],
  bass: ['crayfish', 'plastic worm', 'minnow'],
  walleye: ['leech', 'minnow', 'jig'],
  pike: ['spoon', 'minnow', 'big streamer'],
  catfish: ['stink bait', 'chicken liver', 'nightcrawler'],
  golden: ['mayfly', 'small spinner', 'a little luck'],
}

const STORAGE_KEY = 'off-the-dock:residents:v2'

function pick<T>(items: T[], rng: () => number): T {
  return items[Math.floor(rng() * items.length)] ?? items[0]
}

/** 25 named residents, generated deterministically so a fresh lake is always the same lake. */
export function createResidents(): FishProfile[] {
  const residents: FishProfile[] = []
  let seed = 0x0ffd0c
  for (const species of SPECIES_LIST) {
    const count = SPECIES_COUNTS[species.id]
    for (let i = 0; i < count; i += 1) {
      const rng = mulberry32(seed)
      seed += 7919
      const [min, max] = species.lengthRange
      const t = Math.pow(rng(), 1.65)
      const lengthCm = min + (max - min) * t
      residents.push({
        id: `resident-${species.id}-${i}`,
        name: NAMES[species.id][i] ?? `${species.name} ${i + 1}`,
        speciesId: species.id,
        lengthCm: Math.round(lengthCm * 10) / 10,
        weightKg: Math.round(weightFor(species, lengthCm) * 100) / 100,
        mood: pick(MOODS[species.id], rng),
        favoriteBait: pick(BAITS[species.id], rng),
        lastSeen: null,
        catches: 0,
      })
    }
  }
  return residents
}

function sanitize(saved: unknown, fallback: FishProfile[]): FishProfile[] {
  if (!Array.isArray(saved)) return fallback
  const byId = new Map<string, unknown>()
  for (const entry of saved) {
    if (entry && typeof entry === 'object' && 'id' in entry && typeof (entry as { id: unknown }).id === 'string') {
      byId.set((entry as { id: string }).id, entry)
    }
  }
  return fallback.map((fish) => {
    const raw = byId.get(fish.id)
    if (!raw || typeof raw !== 'object') return fish
    const value = raw as Partial<FishProfile>
    const species = SPECIES[fish.speciesId]
    const length = typeof value.lengthCm === 'number' && Number.isFinite(value.lengthCm)
      ? Math.min(species.lengthRange[1] * 1.25, Math.max(species.lengthRange[0] * 0.6, value.lengthCm))
      : fish.lengthCm
    const catches = typeof value.catches === 'number' && Number.isFinite(value.catches)
      ? Math.min(9999, Math.max(0, Math.floor(value.catches)))
      : 0
    const lastSeen = typeof value.lastSeen === 'number' && value.lastSeen > 0 && value.lastSeen < Date.now() + 60_000
      ? value.lastSeen
      : null
    return {
      ...fish,
      lengthCm: Math.round(length * 10) / 10,
      weightKg: Math.round(weightFor(species, length) * 100) / 100,
      catches,
      lastSeen,
      mood: typeof value.mood === 'string' && value.mood.length < 40 ? value.mood : fish.mood,
      favoriteBait: typeof value.favoriteBait === 'string' && value.favoriteBait.length < 32
        ? value.favoriteBait
        : fish.favoriteBait,
    }
  })
}

export function loadResidents(): FishProfile[] {
  const fallback = createResidents()
  if (typeof window === 'undefined') return fallback
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) return fallback
    return sanitize(JSON.parse(stored), fallback)
  } catch {
    return fallback
  }
}

export function saveResidents(residents: FishProfile[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(residents))
  } catch {
    // A full or disabled localStorage should never break the lake.
  }
}

export function residentById(residents: FishProfile[], id: string | null): FishProfile | undefined {
  if (!id) return undefined
  return residents.find((fish) => fish.id === id)
}
