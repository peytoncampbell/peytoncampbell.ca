import { useEffect } from 'react'
import { useGameStore } from '../store/useGameStore'

export function Toasts() {
  const toast = useGameStore((state) => state.toast)
  const clearToast = useGameStore((state) => state.clearToast)
  const photoMode = useGameStore((state) => state.photoMode)

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => clearToast(toast.id), 3600)
    return () => window.clearTimeout(timeout)
  }, [toast, clearToast])

  if (!toast || photoMode) return null

  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="true">
      <div className={`toast tone-${toast.tone}`}>
        <span className="toast-mark" aria-hidden="true" />
        <span>{toast.text}</span>
      </div>
    </div>
  )
}
