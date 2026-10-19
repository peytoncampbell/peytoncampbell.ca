import { useEffect } from 'react'
import { formatLength, formatWeight, SPECIES, RARITY_LABEL } from '../game/species'
import { releaseCaughtFish } from '../game/fishingEngine'
import { useGameStore } from '../store/useGameStore'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { FishGlyph } from './FishGlyph'
import { IconArrow, IconClose, IconLeaf, IconSparkle } from './Icons'

export function CatchCard() {
  const summary = useGameStore((state) => state.catchCard)
  const openJournal = useGameStore((state) => state.setJournalOpen)
  const trapRef = useFocusTrap<HTMLDivElement>(Boolean(summary))

  useEffect(() => {
    if (!summary) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        releaseCaughtFish()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [summary])

  if (!summary) return null
  const species = SPECIES[summary.speciesId]
  const fish = summary.fish

  const handleJournal = () => {
    releaseCaughtFish()
    openJournal(true)
  }

  return (
    <div className="modal-layer catch-layer">
      <div
        ref={trapRef}
        className="catch-card glass-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="catch-title"
      >
        <button
          type="button"
          className="icon-button catch-close"
          onClick={() => releaseCaughtFish()}
          aria-label="Release the fish and return to the dock"
        >
          <IconClose />
        </button>

        <div className="catch-topline">
          <span className="eyebrow">
            {summary.isFirstCatch ? 'A first meeting' : 'A familiar face'}
          </span>
          <span className="catch-rule" />
          <span className="catch-rule-label">Catch &amp; release</span>
        </div>

        <div className="catch-hero">
          <div className="catch-glyph">
            <span className="catch-halo" aria-hidden="true" />
            <FishGlyph speciesId={summary.speciesId} width={160} />
          </div>
          <div className="catch-heading">
            <h2 id="catch-title">{fish.name}</h2>
            <p>
              {species.name} <span>·</span> {RARITY_LABEL[species.rarity]}
            </p>
            <div className="catch-badges">
              {summary.isFirstCatch && <span className="badge"><IconSparkle size={12} /> First hello</span>}
              {summary.isPersonalBest && <span className="badge is-warm">Personal best</span>}
              {fish.catches > 1 && <span className="badge is-quiet">{fish.catches} meetings</span>}
            </div>
          </div>
        </div>

        <p className="catch-blurb">{species.blurb}</p>

        <dl className="catch-stats">
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
            <dd className="is-text">{fish.mood}</dd>
          </div>
          <div>
            <dt>Took</dt>
            <dd className="is-text">{fish.favoriteBait}</dd>
          </div>
        </dl>

        <div className="catch-note">
          <IconLeaf size={18} />
          <p>
            A quick measurement, a quiet word, and back into the shallows.{' '}
            <span>The profile has been updated in the journal.</span>
          </p>
        </div>

        <div className="catch-actions">
          <button type="button" className="primary-btn" onClick={() => releaseCaughtFish()} autoFocus>
            Release &amp; cast again <IconArrow size={16} />
          </button>
          <button type="button" className="text-btn" onClick={handleJournal}>
            Open the journal
          </button>
        </div>
      </div>
    </div>
  )
}
