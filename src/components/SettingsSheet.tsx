import { audio } from '../audio/audio'
import {
  QUALITY_LABEL,
  QUALITY_ORDER,
  TIME_META,
  TIME_ORDER,
  WEATHER_LABEL,
  WEATHER_ORDER,
} from '../game/types'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useGameStore } from '../store/useGameStore'
import { IconClose } from './Icons'

export function SettingsSheet() {
  const open = useGameStore((state) => state.settingsOpen)
  const setOpen = useGameStore((state) => state.setSettingsOpen)
  const timeOfDay = useGameStore((state) => state.timeOfDay)
  const weather = useGameStore((state) => state.weather)
  const quality = useGameStore((state) => state.quality)
  const soundOn = useGameStore((state) => state.soundOn)
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  const setTimeOfDay = useGameStore((state) => state.setTimeOfDay)
  const setWeather = useGameStore((state) => state.setWeather)
  const setQuality = useGameStore((state) => state.setQuality)
  const setSoundOn = useGameStore((state) => state.setSoundOn)
  const setReducedMotion = useGameStore((state) => state.setReducedMotion)
  const trapRef = useFocusTrap<HTMLDivElement>(open)

  if (!open) return null

  const toggleSound = () => {
    const next = !soundOn
    if (next) audio.ensureStarted(true)
    audio.setEnabled(next)
    setSoundOn(next)
  }

  return (
    <div className="modal-layer settings-layer" onClick={() => setOpen(false)}>
      <div
        ref={trapRef}
        className="help-sheet settings-sheet glass-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="help-head">
          <div>
            <p className="eyebrow">Settings</p>
            <h2 id="settings-title">Scene &amp; comfort</h2>
            <p className="help-sub">Changes save automatically.</p>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={() => setOpen(false)}
            aria-label="Close settings"
          >
            <IconClose />
          </button>
        </header>

        <div className="help-scroll">
          <section className="help-section">
            <h3>Scene</h3>
            <div className="setting-row is-stacked">
              <div>
                <strong>Time of day</strong>
                <span>The light, clock, and fish activity.</span>
              </div>
              <div className="segmented" role="group" aria-label="Time of day">
                {TIME_ORDER.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={timeOfDay === value ? 'is-active' : ''}
                    onClick={() => setTimeOfDay(value)}
                    aria-pressed={timeOfDay === value}
                  >
                    {TIME_META[value].short}
                  </button>
                ))}
              </div>
            </div>
            <div className="setting-row is-stacked">
              <div>
                <strong>Weather</strong>
                <span>Calm water, light rain, or low mist.</span>
              </div>
              <div className="segmented" role="group" aria-label="Weather">
                {WEATHER_ORDER.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={weather === value ? 'is-active' : ''}
                    onClick={() => setWeather(value)}
                    aria-pressed={weather === value}
                  >
                    {WEATHER_LABEL[value]}
                  </button>
                ))}
              </div>
            </div>
            <div className="setting-row is-stacked">
              <div>
                <strong>Quality</strong>
                <span>Shadows, water detail, and postprocessing.</span>
              </div>
              <div className="segmented" role="group" aria-label="Quality">
                {QUALITY_ORDER.map((value) => (
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
            <h3>Comfort</h3>
            <div className="setting-row">
              <div>
                <strong>Ambient sound</strong>
                <span>Water, wind, loons, and reel clicks.</span>
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
            <div className="setting-row">
              <div>
                <strong>Reduced motion</strong>
                <span>Calmer water, softer camera, shorter drifts.</span>
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
          </section>
        </div>
      </div>
    </div>
  )
}
