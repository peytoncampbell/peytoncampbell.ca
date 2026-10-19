import { useState } from 'react'
import { savePhoto } from '../utils/photo'
import { TIME_META } from '../game/types'
import { useGameStore } from '../store/useGameStore'
import { sceneBridge } from '../game/sceneBridge'
import { IconCamera, IconClose, IconReset } from './Icons'

export function PhotoBar() {
  const active = useGameStore((state) => state.photoMode)
  const setPhotoMode = useGameStore((state) => state.setPhotoMode)
  const timeOfDay = useGameStore((state) => state.timeOfDay)
  const notify = useGameStore((state) => state.notify)
  const [saving, setSaving] = useState(false)

  if (!active) return null
  const meta = TIME_META[timeOfDay]

  const capture = async () => {
    if (saving) return
    setSaving(true)
    const ok = await savePhoto(timeOfDay)
    setSaving(false)
    notify(ok ? 'Photograph saved. Keep it somewhere quiet.' : 'The frame could not be saved.', ok ? 'warm' : 'warn')
  }

  return (
    <div className="photo-ui" role="region" aria-label="Photo mode">
      <div className="photo-bar photo-bar-top">
        <div className="photo-brand">
          <span className="photo-dot" aria-hidden="true" />
          <span>Off the Dock</span>
          <em>{meta.label} · {meta.clock}</em>
        </div>
        <div className="photo-actions">
          <button type="button" className="photo-icon-btn" onClick={() => sceneBridge.resetView?.()} aria-label="Reset camera" title="Reset camera">
            <IconReset size={17} />
          </button>
          <button type="button" className="photo-exit" onClick={() => setPhotoMode(false)} aria-label="Exit photo mode">
            <IconClose size={16} /> Exit photo
          </button>
        </div>
      </div>

      <div className="photo-guides" aria-hidden="true">
        <span className="guide-v guide-v-1" />
        <span className="guide-v guide-v-2" />
        <span className="guide-h guide-h-1" />
        <span className="guide-h guide-h-2" />
        <span className="guide-frame" />
      </div>

      <div className="photo-bar photo-bar-bottom">
        <p className="photo-hint">Drag to frame · Scroll or pinch to zoom</p>
        <button type="button" className="shutter" onClick={capture} disabled={saving} aria-label="Save a PNG photograph">
          <span className="shutter-ring">
            <span className="shutter-core">{saving ? '…' : <IconCamera size={20} />}</span>
          </span>
          <span>{saving ? 'Saving' : 'Save PNG'}</span>
        </button>
        <p className="photo-hint photo-shortcut"><kbd>P</kbd> or <kbd>Esc</kbd> to return</p>
      </div>
    </div>
  )
}
