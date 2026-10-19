import { useEffect, useRef } from 'react'
import { formatLength, formatWeight, SPECIES, RARITY_LABEL } from '../game/species'
import { formatRelativeTime } from '../game/rng'
import { useGameStore } from '../store/useGameStore'
import { FishGlyph } from './FishGlyph'
import { IconBook, IconClose, IconLeaf } from './Icons'

export function FishProfileCard() {
  const selectedId = useGameStore((state) => state.selectedFishId)
  const residents = useGameStore((state) => state.residents)
  const photoMode = useGameStore((state) => state.photoMode)
  const selectFish = useGameStore((state) => state.selectFish)
  const openJournal = useGameStore((state) => state.setJournalOpen)
  const closeRef = useRef<HTMLButtonElement>(null)

  const fish = residents.find((resident) => resident.id === selectedId)

  useEffect(() => {
    if (fish) closeRef.current?.focus({ preventScroll: true })
  }, [fish])

  if (!fish || photoMode) return null
  const species = SPECIES[fish.speciesId]
  const number = residents.findIndex((resident) => resident.id === fish.id) + 1

  return (
    <aside
      className="fish-profile glass-panel"
      role="dialog"
      aria-labelledby="fish-profile-name"
      aria-live="polite"
    >
      <button
        ref={closeRef}
        type="button"
        className="icon-button profile-close"
        onClick={() => selectFish(null)}
        aria-label="Close fish profile"
      >
        <IconClose size={16} />
      </button>
      <div className="profile-head">
        <div className="profile-glyph">
          <FishGlyph speciesId={fish.speciesId} width={94} />
        </div>
        <div>
          <p className="eyebrow">Resident no. {String(number).padStart(2, '0')}</p>
          <h2 id="fish-profile-name">{fish.name}</h2>
          <p className="profile-species">
            {species.name} <span>·</span> {RARITY_LABEL[species.rarity]}
          </p>
        </div>
      </div>

      <dl className="profile-grid">
        <div>
          <dt>Length</dt>
          <dd>{formatLength(fish.lengthCm)}</dd>
        </div>
        <div>
          <dt>Weight</dt>
          <dd>{formatWeight(fish.weightKg)}</dd>
        </div>
        <div>
          <dt>Mood</dt>
          <dd>{fish.mood}</dd>
        </div>
        <div>
          <dt>Favorite bait</dt>
          <dd>{fish.favoriteBait}</dd>
        </div>
      </dl>

      <div className="profile-footer">
        <span>
          <IconLeaf size={14} /> Last seen {formatRelativeTime(fish.lastSeen)}
        </span>
        <button
          type="button"
          className="text-btn compact"
          onClick={() => {
            selectFish(null)
            openJournal(true)
          }}
        >
          <IconBook size={14} /> Journal
        </button>
      </div>
      {fish.catches > 0 && (
        <p className="profile-history">
          You have met {fish.name} {fish.catches === 1 ? 'once' : `${fish.catches} times`}. Released
          every time.
        </p>
      )}
    </aside>
  )
}
