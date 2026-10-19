import { useMemo, useState } from 'react'
import { formatLength, formatWeight, SPECIES, SPECIES_LIST, RARITY_LABEL } from '../game/species'
import { formatRelativeTime } from '../game/rng'
import { useGameStore } from '../store/useGameStore'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { FishGlyph } from './FishGlyph'
import { IconBook, IconCheck, IconClose } from './Icons'

type Filter = 'all' | 'met' | 'caught'

export function Journal() {
  const open = useGameStore((state) => state.journalOpen)
  const setOpen = useGameStore((state) => state.setJournalOpen)
  const residents = useGameStore((state) => state.residents)
  const stats = useGameStore((state) => state.stats)
  const selectFish = useGameStore((state) => state.selectFish)
  const [filter, setFilter] = useState<Filter>('all')
  const trapRef = useFocusTrap<HTMLElement>(open)

  const sorted = useMemo(() => {
    const order = new Map(SPECIES_LIST.map((species, index) => [species.id, index]))
    return [...residents].sort((a, b) => {
      const speciesDelta = (order.get(a.speciesId) ?? 0) - (order.get(b.speciesId) ?? 0)
      return speciesDelta !== 0 ? speciesDelta : a.name.localeCompare(b.name)
    })
  }, [residents])

  const met = residents.filter((fish) => fish.lastSeen !== null).length
  const caught = residents.filter((fish) => fish.catches > 0).length
  const filtered = sorted.filter((fish) => {
    if (filter === 'met') return fish.lastSeen !== null
    if (filter === 'caught') return fish.catches > 0
    return true
  })

  if (!open) return null

  const openProfile = (id: string) => {
    selectFish(id)
    setOpen(false)
  }

  return (
    <>
      <div className="drawer-scrim" onClick={() => setOpen(false)} aria-hidden="true" />
      <aside
        ref={trapRef}
        className="journal glass-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="journal-title"
      >
        <header className="journal-head">
          <div>
            <p className="eyebrow">Jessups Island · Lake Nipissing</p>
            <h2 id="journal-title">Field journal</h2>
            <p className="journal-sub">
              {residents.length} residents · {met} met · {caught} caught &amp; released
            </p>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={() => setOpen(false)}
            aria-label="Close field journal"
          >
            <IconClose />
          </button>
        </header>

        <div className="journal-stats">
          <div>
            <strong>{String(stats.casts).padStart(2, '0')}</strong>
            <span>Casts</span>
          </div>
          <div>
            <strong>{String(stats.bites).padStart(2, '0')}</strong>
            <span>Bites</span>
          </div>
          <div>
            <strong>{String(stats.catches).padStart(2, '0')}</strong>
            <span>Caught</span>
          </div>
          <div>
            <strong>{String(stats.snaps).padStart(2, '0')}</strong>
            <span>Snaps</span>
          </div>
          <div>
            <strong>{stats.bestCm > 0 ? formatLength(stats.bestCm) : '—'}</strong>
            <span>Best</span>
          </div>
        </div>

        <div className="journal-toolbar">
          <div className="filter-tabs" role="group" aria-label="Filter residents">
            {(['all', 'met', 'caught'] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={filter === value ? 'is-active' : ''}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {value === 'all' ? 'All' : value === 'met' ? 'Met' : 'Caught'}
              </button>
            ))}
          </div>
          <span className="journal-hint">
            <IconBook size={14} /> This session
          </span>
        </div>

        <div className="resident-list">
          {filtered.length === 0 && (
            <div className="journal-empty">
              <p>No one here yet.</p>
              <span>Cast a line, or click a fish in the water to say hello.</span>
            </div>
          )}
          {filtered.map((fish) => {
            const species = SPECIES[fish.speciesId]
            const seen = fish.lastSeen !== null
            return (
              <button
                type="button"
                key={fish.id}
                className={`resident-row ${seen ? 'is-met' : ''}`}
                onClick={() => openProfile(fish.id)}
              >
                <span className="resident-glyph">
                  <FishGlyph speciesId={fish.speciesId} width={42} faded={!seen} />
                </span>
                <span className="resident-main">
                  <span className="resident-name">
                    {fish.name}
                    {fish.catches > 0 && <IconCheck size={13} className="resident-check" />}
                  </span>
                  <span className="resident-species">
                    {species.name} · {RARITY_LABEL[species.rarity]}
                  </span>
                  <span className="resident-meta">
                    {seen
                      ? `${formatLength(fish.lengthCm)} · ${formatWeight(fish.weightKg)} · ${formatRelativeTime(fish.lastSeen)}`
                      : 'Not yet met'}
                  </span>
                </span>
                <span className="resident-side">
                  {fish.catches > 0 ? (
                    <>
                      <strong>{fish.catches}</strong>
                      <small>meetings</small>
                    </>
                  ) : (
                    <span className="resident-arrow">↗</span>
                  )}
                </span>
              </button>
            )
          })}
        </div>

        <footer className="journal-foot">
          <p>Every fish here has a name. Catch-and-release is the house rule.</p>
          <span>Journal saved on this device.</span>
        </footer>
      </aside>
    </>
  )
}
