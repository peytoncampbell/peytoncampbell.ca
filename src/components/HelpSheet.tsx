import { audio } from '../audio/audio'
import { QUALITY_LABEL, WEATHER_LABEL } from '../game/types'
import { useGameStore } from '../store/useGameStore'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { sceneBridge } from '../game/sceneBridge'
import { IconClose, IconMute, IconReset, IconSound, IconWaves } from './Icons'

const SHORTCUTS: Array<[string, string]> = [
  ['Space', 'Hold to cast · hold to reel'],
  ['F', 'Toggle bait · then click the water'],
  ['C', 'Cinematic orbit'],
  ['P', 'Photo mode'],
  ['J', 'Field journal'],
  ['T', 'Cycle golden hour / blue hour / night'],
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
  const quality = useGameStore((state) => state.quality)
  const setQuality = useGameStore((state) => state.setQuality)
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  const setReducedMotion = useGameStore((state) => state.setReducedMotion)
  const soundOn = useGameStore((state) => state.soundOn)
  const setSoundOn = useGameStore((state) => state.setSoundOn)
  const timeOfDay = useGameStore((state) => state.timeOfDay)
  const weather = useGameStore((state) => state.weather)
  const notify = useGameStore((state) => state.notify)
  const trapRef = useFocusTrap<HTMLDivElement>(open)

  if (!open) return null

  const toggleSound = () => {
    const next = !soundOn
    if (next) audio.ensureStarted(true)
    audio.setEnabled(next)
    setSoundOn(next)
  }

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
            <p className="help-sub">
              {WEATHER_LABEL[weather]} · {timeOfDay === 'golden' ? 'Golden hour' : timeOfDay === 'blue' ? 'Blue hour' : 'Night'} · {QUALITY_LABEL[quality]} quality
            </p>
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
            <h3>Comfort</h3>
            <div className="setting-row">
              <div>
                <strong>Reduced motion</strong>
                <span>Calmer water, soft camera, shorter drifts.</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={reducedMotion}
                className={`switch ${reducedMotion ? 'is-on' : ''}`}
                onClick={() => setReducedMotion(!reducedMotion)}
              >
                <span />
              </button>
            </div>
            <div className="setting-row">
              <div>
                <strong>Ambient sound</strong>
                <span>Water, wind, loons, reel clicks. All synthesized.</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={soundOn}
                className={`switch ${soundOn ? 'is-on' : ''}`}
                onClick={toggleSound}
              >
                <span />
              </button>
            </div>
            <div className="setting-row is-stacked">
              <div>
                <strong>Quality</strong>
                <span>Shadows, water detail, and postprocessing.</span>
              </div>
              <div className="segmented" role="group" aria-label="Quality">
                {(['low', 'medium', 'high'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={quality === value ? 'is-active' : ''}
                    onClick={() => setQuality(value)}
                    aria-pressed={quality === value}
                  >
                    {QUALITY_LABEL[value]}
                  </button>
                ))}
              </div>
            </div>
          </section>

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
              <IconWaves size={14} /> Stillwater Bay is fictional. The fish are not real, but they
              do remember you.
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
              <button type="button" className="text-btn" onClick={toggleSound}>
                {soundOn ? <IconSound size={15} /> : <IconMute size={15} />}
                {soundOn ? 'Sound on' : 'Sound off'}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
