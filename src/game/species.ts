export type SpeciesId =
  | 'bluegill'
  | 'bass'
  | 'perch'
  | 'walleye'
  | 'pike'
  | 'catfish'
  | 'golden'

export type Rarity = 'common' | 'uncommon' | 'rare'

export interface SpeciesPalette {
  back: string
  mid: string
  belly: string
  fin: string
  accent: string
}

export interface SpeciesBody {
  /** Relative body length. Native geometry is roughly 2 units nose to tail. */
  length: number
  /** Relative body height. */
  height: number
  /** Relative body width. */
  width: number
  /** Relative caudal fin span. */
  tail: number
}

export interface Species {
  id: SpeciesId
  name: string
  latin: string
  blurb: string
  rarity: Rarity
  palette: SpeciesPalette
  body: SpeciesBody
  pattern: 'bars' | 'stripe' | 'spots' | 'mottled' | 'plain' | 'gold'
  lengthRange: [number, number]
  /** kg = (cm / 100)^3 * weightK */
  weightK: number
  bait: string
  behavior: {
    speed: number
    depth: [number, number]
    schooling: number
    boldness: number
  }
}

export const SPECIES: Record<SpeciesId, Species> = {
  bluegill: {
    id: 'bluegill',
    name: 'Bluegill',
    latin: 'Lepomis macrochirus',
    blurb: 'A round little optimist that lives in the warm shallows and investigates anything that moves.',
    rarity: 'common',
    palette: {
      back: '#3d5346',
      mid: '#738368',
      belly: '#c9b585',
      fin: '#a96744',
      accent: '#294d46',
    },
    body: { length: 0.82, height: 0.86, width: 0.38, tail: 0.62 },
    pattern: 'bars',
    lengthRange: [15, 25],
    weightK: 15,
    bait: 'nightcrawler',
    behavior: { speed: 0.34, depth: [0.3, 0.9], schooling: 0.8, boldness: 0.9 },
  },
  bass: {
    id: 'bass',
    name: 'Smallmouth bass',
    latin: 'Micropterus dolomieu',
    blurb: 'A bronze-shouldered scrapper that patrols the granite points and makes you work for every cast.',
    rarity: 'common',
    palette: {
      back: '#37422c',
      mid: '#7c7448',
      belly: '#d8c69d',
      fin: '#7e6a45',
      accent: '#242d1f',
    },
    body: { length: 1.08, height: 0.5, width: 0.34, tail: 0.48 },
    pattern: 'bars',
    lengthRange: [28, 50],
    weightK: 16,
    bait: 'minnow',
    behavior: { speed: 0.44, depth: [0.4, 1.25], schooling: 0.12, boldness: 0.45 },
  },
  perch: {
    id: 'perch',
    name: 'Yellow perch',
    latin: 'Perca flavescens',
    blurb: 'A banded little sunbeam that travels in quiet crowds along the weed line.',
    rarity: 'common',
    palette: {
      back: '#4f5a35',
      mid: '#c1a054',
      belly: '#f0ddb3',
      fin: '#be6a42',
      accent: '#2c351f',
    },
    body: { length: 0.9, height: 0.5, width: 0.3, tail: 0.48 },
    pattern: 'bars',
    lengthRange: [18, 32],
    weightK: 13,
    bait: 'minnow',
    behavior: { speed: 0.42, depth: [0.36, 1.05], schooling: 0.9, boldness: 0.6 },
  },
  walleye: {
    id: 'walleye',
    name: 'Walleye',
    latin: 'Sander vitreus',
    blurb: 'A glassy-eyed dusk hunter with a talent for appearing exactly where you are not looking.',
    rarity: 'uncommon',
    palette: {
      back: '#535a3f',
      mid: '#a49a66',
      belly: '#ece1bb',
      fin: '#8a7d50',
      accent: '#2f3827',
    },
    body: { length: 1.28, height: 0.44, width: 0.29, tail: 0.45 },
    pattern: 'mottled',
    lengthRange: [42, 68],
    weightK: 11,
    bait: 'leech',
    behavior: { speed: 0.55, depth: [0.7, 1.7], schooling: 0.25, boldness: 0.35 },
  },
  pike: {
    id: 'pike',
    name: 'Northern pike',
    latin: 'Esox lucius',
    blurb: 'A long green shadow with more teeth than patience. You will feel it before you see it.',
    rarity: 'uncommon',
    palette: {
      back: '#3f5234',
      mid: '#88945c',
      belly: '#e7dab2',
      fin: '#a9794c',
      accent: '#2a3f27',
    },
    body: { length: 1.65, height: 0.33, width: 0.26, tail: 0.55 },
    pattern: 'spots',
    lengthRange: [62, 98],
    weightK: 8,
    bait: 'spoon',
    behavior: { speed: 0.66, depth: [0.45, 1.35], schooling: 0.02, boldness: 0.7 },
  },
  catfish: {
    id: 'catfish',
    name: 'Channel catfish',
    latin: 'Ictalurus punctatus',
    blurb: 'A patient, whiskered bottom-dweller that knows every seam and shadow of the channel.',
    rarity: 'uncommon',
    palette: {
      back: '#384447',
      mid: '#697471',
      belly: '#c6c1ad',
      fin: '#4b5754',
      accent: '#1f2b2c',
    },
    body: { length: 1.4, height: 0.45, width: 0.42, tail: 0.44 },
    pattern: 'mottled',
    lengthRange: [52, 88],
    weightK: 12,
    bait: 'stink bait',
    behavior: { speed: 0.3, depth: [0.85, 1.8], schooling: 0.1, boldness: 0.4 },
  },
  golden: {
    id: 'golden',
    name: 'Golden trout',
    latin: 'Oncorhynchus aguabonita',
    blurb: 'A rumour made of light. The family swears it appears only when the lake is completely still.',
    rarity: 'rare',
    palette: {
      back: '#9a652f',
      mid: '#dfa74e',
      belly: '#ffe5a5',
      fin: '#e58b52',
      accent: '#b04f3a',
    },
    body: { length: 1.0, height: 0.52, width: 0.31, tail: 0.48 },
    pattern: 'gold',
    lengthRange: [38, 52],
    weightK: 13,
    bait: 'mayfly',
    behavior: { speed: 0.38, depth: [0.4, 1.05], schooling: 0.02, boldness: 0.22 },
  },
}

export const SPECIES_LIST: Species[] = [
  SPECIES.bluegill,
  SPECIES.perch,
  SPECIES.bass,
  SPECIES.walleye,
  SPECIES.pike,
  SPECIES.catfish,
  SPECIES.golden,
]

/** Fixed population counts add up to 25 named residents. */
export const SPECIES_COUNTS: Record<SpeciesId, number> = {
  bluegill: 5,
  perch: 6,
  bass: 5,
  walleye: 3,
  pike: 2,
  catfish: 3,
  golden: 1,
}

export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
}

export function weightFor(species: Species, lengthCm: number): number {
  return (Math.pow(lengthCm / 100, 3) * species.weightK)
}

export function formatWeight(kg: number): string {
  if (kg < 1) return `${Math.round(kg * 1000)} g`
  return `${kg.toFixed(2)} kg`
}

export function formatLength(cm: number): string {
  return `${cm.toFixed(cm < 30 ? 1 : 0)} cm`
}

