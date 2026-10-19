import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../store/useGameStore'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { FishGlyph } from './FishGlyph'
import { IconArrow, IconClose, IconCompass, IconHook } from './Icons'

const STEPS = [
  {
    kicker: 'One · The cast',
    title: 'Send a line.',
    body: 'Hold on the water or press Space. Release to cast.',
    hint: 'Aim left or right while you charge. Drag to look around.',
  },
  {
    kicker: 'Two · The reel',
    title: 'Let it go.',
    body: 'When the bobber dips, hold to set the hook. Ease off when the line tightens.',
    hint: 'Every fish goes back. The journal remembers it.',
  },
]

function Illustration({ step }: { step: number }) {
  if (step === 0) {
    return (
      <svg viewBox="0 0 360 220" fill="none" className="onboard-art">
        <circle cx="288" cy="58" r="22" fill="#e7b879" opacity="0.4" />
        <path d="M0 147c34-9 62 5 95 0s51-9 87-2 51 8 85 1 57-8 93 1v73H0Z" fill="#2c4b47" opacity="0.6" />
        <path d="M34 118c56 17 92 39 145 45" stroke="#d8c8a6" strokeWidth="1.7" strokeLinecap="round" opacity="0.8" />
        <path d="M186 153c26 1 43 8 62 20" stroke="#d8c8a6" strokeWidth="1.2" strokeDasharray="3 4" opacity="0.55" />
        <g>
          <ellipse cx="256" cy="183" rx="31" ry="6" stroke="#dccfae" strokeOpacity="0.35" />
          <ellipse cx="256" cy="183" rx="53" ry="10" stroke="#dccfae" strokeOpacity="0.16" />
          <ellipse cx="256" cy="183" rx="75" ry="14" stroke="#dccfae" strokeOpacity="0.08" />
          <path d="M256 174v-11" stroke="#dccfae" strokeWidth="1.5" />
          <ellipse cx="256" cy="175" rx="4.5" ry="5.5" fill="#b15642" />
          <path d="M252 175a4.5 5.5 0 0 1 8 0" fill="#e8ddc3" />
        </g>
        <path d="M59 121c11-2 17 2 17 9 0 9-8 15-17 18" stroke="#cebd98" strokeWidth="1" opacity="0.25" />
        <text x="48" y="70" fill="#e6d7b8" opacity="0.52" fontFamily="Georgia, serif" fontSize="13" fontStyle="italic">
          read the water
        </text>
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 360 220" fill="none" className="onboard-art">
      <circle cx="86" cy="62" r="25" fill="#e7b879" opacity="0.3" />
      <path d="M0 160c40-7 73 4 111-1s62-7 96-1 50 7 80 1 49-6 73 0v61H0Z" fill="#294744" opacity="0.55" />
      <ellipse cx="230" cy="164" rx="92" ry="16" stroke="#cfc3a6" strokeOpacity="0.15" />
      <ellipse cx="230" cy="164" rx="64" ry="11" stroke="#cfc3a6" strokeOpacity="0.22" />
      <g transform="translate(166 100)">
        <FishGlyph speciesId="golden" width={132} />
      </g>
      <path d="M128 158c19 4 33 9 47 15M304 170c-16 2-28 5-38 10" stroke="#d8c9a7" strokeWidth="1" strokeOpacity="0.25" />
      <text x="42" y="194" fill="#e6d7b8" opacity="0.42" fontFamily="Georgia, serif" fontSize="12" fontStyle="italic">
        every fish has a name
      </text>
    </svg>
  )
}

export function Onboarding() {
  const open = useGameStore((state) => state.onboardingOpen)
  const complete = useGameStore((state) => state.completeOnboarding)
  const [step, setStep] = useState(0)
  const trapRef = useFocusTrap<HTMLDivElement>(open)
  const primaryRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    primaryRef.current?.focus({ preventScroll: true })
  }, [open, step])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        complete()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, complete])

  if (!open) return null
  const current = STEPS[step] ?? STEPS[0]!

  const next = () => {
    if (step >= STEPS.length - 1) complete()
    else setStep(step + 1)
  }

  return (
    <div className="modal-layer onboarding-layer">
      <div
        ref={trapRef}
        className="onboarding glass-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
      >
        <button
          type="button"
          className="onboarding-skip"
          onClick={complete}
          aria-label="Skip introduction"
        >
          Skip intro <IconClose size={14} />
        </button>

        <div className="onboarding-copy">
          <div className="onboarding-brand">
            <span className="brand-seed" aria-hidden="true"><IconHook size={18} /></span>
            <span>Off the Dock</span>
          </div>
          <p className="eyebrow">{current.kicker}</p>
          <h2 id="onboarding-title">{current.title}</h2>
          <p className="onboarding-body">{current.body}</p>
          <p className="onboarding-hint">{current.hint}</p>

          <div className="onboarding-nav">
            <div className="progress-dots" role="group" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
              {STEPS.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  className={index === step ? 'is-active' : ''}
                  onClick={() => setStep(index)}
                  aria-label={`Go to step ${index + 1}`}
                  aria-current={index === step ? 'step' : undefined}
                />
              ))}
            </div>
            <div className="onboarding-actions">
              {step > 0 && (
                <button type="button" className="text-btn" onClick={() => setStep(step - 1)}>
                  Back
                </button>
              )}
              <button ref={primaryRef} type="button" className="primary-btn" onClick={next}>
                {step === STEPS.length - 1 ? (
                  <>Start fishing <IconCompass size={15} /></>
                ) : (
                  <>Next <IconArrow size={15} /></>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="onboarding-visual">
          <Illustration step={step} />
          <div className="onboarding-caption">
            <span>Jessups Island</span>
            <span>First light</span>
          </div>
        </div>
      </div>
    </div>
  )
}
