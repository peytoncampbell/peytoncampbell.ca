import { sceneBridge } from '../game/sceneBridge'
import { TIME_META, type TimeOfDay } from '../game/types'

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Unable to read the rendered frame.'))
    image.src = source
  })
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** Saves the current canvas, with a quiet hand-printed caption baked in. */
export async function savePhoto(timeOfDay: TimeOfDay): Promise<boolean> {
  const source = sceneBridge.capture()
  if (!source) return false
  try {
    const image = await loadImage(source)
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return false
    ctx.drawImage(image, 0, 0)

    const width = canvas.width
    const height = canvas.height
    const scale = Math.max(1, width / 1500)
    const bar = Math.min(height * 0.18, 190 * scale)
    const gradient = ctx.createLinearGradient(0, height - bar, 0, height)
    gradient.addColorStop(0, 'rgba(8, 14, 13, 0)')
    gradient.addColorStop(0.58, 'rgba(8, 14, 13, 0.38)')
    gradient.addColorStop(1, 'rgba(8, 14, 13, 0.68)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, height - bar, width, bar)

    const meta = TIME_META[timeOfDay]
    ctx.fillStyle = 'rgba(245, 236, 218, 0.94)'
    ctx.font = `${34 * scale}px "Iowan Old Style", "Palatino Linotype", Georgia, serif`
    ctx.fillText('Off the Dock', 46 * scale, height - 54 * scale)

    ctx.fillStyle = 'rgba(245, 236, 218, 0.55)'
    ctx.font = `${11.5 * scale}px ui-monospace, "Cascadia Code", Consolas, monospace`
    const caption = `STILLWATER BAY  ·  ${meta.label.toUpperCase()}  ·  ${meta.clock}`
    ctx.fillText(caption, 48 * scale, height - 30 * scale)

    const stamp = new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, '-')
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((result) => resolve(result), 'image/png'),
    )
    if (!blob) return false
    download(blob, `off-the-dock-${stamp}.png`)
    return true
  } catch {
    return false
  }
}
