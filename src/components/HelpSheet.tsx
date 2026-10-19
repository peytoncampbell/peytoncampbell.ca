import { useGameStore } from '../store/useGameStore'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { sceneBridge } from '../game/sceneBridge'
import { IconClose, IconReset, IconWaves } from './Icons'

const SHORTCUTS: Array<[string, string]> = [
  ['Space', 'Hold to cast · hold to reel'],
  ['C', 'Cinematic orbit'],
  ['P', 'Photo mode'],
  ['J', 'Field journal'],
  ['T', 'Cycle first light / late afternoon / night'],
  ['W', 'Cycle calm / rain / mist'],
  ['M', 'Mute or enable sound'],
  ['Drag', 'Orbit the camera'],
  ['Scroll / pinch', 'Zoom'],
  ['Arrows', 'Nudge the camera'],
  ['Esc', 'Close the current panel'],
  ['?', 'This panel'],
]

export function HelpSheet() {
  const open = useGameStore((state) => state.helpOpen)
  const setOpen = useGameStore((state) => state.setHelpOpen)
  const notify = useGameStore((state) => state.notify)
  const trapRef = useFocusTrap<HTMLDivElement>(open)

  if (!open) return null

  return (
    <div className="modal-layer help-layer" onClick={() => setOpen(false)}>
      <div
        ref={trapRef}
        className="help-sheet glass-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="help-head">
          <div>
            <p className="eyebrow">Field notes</p>
            <h2 id="help-title">How to sit still</h2>
            <p className="help-sub">Controls, shortcuts, and a few quiet notes.</p>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={() => setOpen(false)}
            aria-label="Close help"
          >
            <IconClose />
          </button>
        </header>

        <div className="help-scroll">
          <section className="help-section">
            <h3>Shortcuts</h3>
            <dl className="shortcut-list">
              {SHORTCUTS.map(([key, action]) => (
                <div key={key}>
                  <dt><kbd>{key}</kbd></dt>
                  <dd>{action}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="help-section credits">
            <h3>The small print</h3>
            <p>
              Built with React, Three.js, and a great deal of quiet. Every tree, plank, fish, and
              sound is generated in code — no external models, textures, or paid assets.
            </p>
            <p className="credit-line">
              <IconWaves size={14} /> Jessups Island, Lake Nipissing. The fish are not real, but
              they do remember you.
            </p>
            <div className="help-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => {
                  sceneBridge.resetView?.()
                  notify('Back to the quiet corner.', 'quiet')
                }}
              >
                <IconReset size={15} /> Reset view
              </button>
            </div>
            <p className="credit-line">
              Time, weather, quality, sound, and reduced motion live in Settings.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
