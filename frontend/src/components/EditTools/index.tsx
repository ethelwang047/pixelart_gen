import { useState, useCallback } from 'react'

interface EditToolsProps {
  pixelImage: string | null
  onImageChange: (b64: string) => void
  swapMode: boolean
  onSwapModeChange: (v: boolean) => void
  swapSourceColor: string | null
  onSwapSourceColorChange: (hex: string | null) => void
}

// ── Canvas helpers ─────────────────────────────────────────────────────────────

function blobToB64(canvas: HTMLCanvasElement): Promise<string> {
  return new Promise(resolve => {
    canvas.toBlob(blob => {
      const r = new FileReader()
      r.onload = () => resolve((r.result as string).split(',')[1])
      r.readAsDataURL(blob!)
    }, 'image/png')
  })
}

function loadImg(b64: string): Promise<HTMLImageElement> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.src = `data:image/png;base64,${b64}`
  })
}

async function flipImage(b64: string, horizontal: boolean): Promise<string> {
  const img = await loadImg(b64)
  const c = document.createElement('canvas')
  c.width = img.naturalWidth
  c.height = img.naturalHeight
  const ctx = c.getContext('2d')!
  if (horizontal) { ctx.translate(c.width, 0); ctx.scale(-1, 1) }
  else             { ctx.translate(0, c.height); ctx.scale(1, -1) }
  ctx.drawImage(img, 0, 0)
  return blobToB64(c)
}

async function trimImage(b64: string): Promise<string> {
  const img = await loadImg(b64)
  const c = document.createElement('canvas')
  c.width = img.naturalWidth
  c.height = img.naturalHeight
  const ctx = c.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height)
  let minX = width, minY = height, maxX = -1, maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 0) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return b64
  const out = document.createElement('canvas')
  out.width = maxX - minX + 1
  out.height = maxY - minY + 1
  out.getContext('2d')!.drawImage(c, minX, minY, out.width, out.height, 0, 0, out.width, out.height)
  return blobToB64(out)
}

async function outlineImage(b64: string, color: string): Promise<string> {
  const img = await loadImg(b64)
  const pad = 1
  const c = document.createElement('canvas')
  c.width = img.naturalWidth + pad * 2
  c.height = img.naturalHeight + pad * 2
  const ctx = c.getContext('2d')!
  ctx.drawImage(img, pad, pad)
  const imageData = ctx.getImageData(0, 0, c.width, c.height)
  const { data, width, height } = imageData
  const hex = color.replace('#', '')
  const or = parseInt(hex.slice(0, 2), 16)
  const og = parseInt(hex.slice(2, 4), 16)
  const ob = parseInt(hex.slice(4, 6), 16)
  const orig = new Uint8ClampedArray(data)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      if (orig[i + 3] === 0) {
        const hasOpaque = (
          (x > 0          && orig[((y) * width + (x-1)) * 4 + 3] > 0) ||
          (x < width - 1  && orig[((y) * width + (x+1)) * 4 + 3] > 0) ||
          (y > 0          && orig[((y-1) * width + x) * 4 + 3] > 0) ||
          (y < height - 1 && orig[((y+1) * width + x) * 4 + 3] > 0)
        )
        if (hasOpaque) {
          data[i] = or; data[i + 1] = og; data[i + 2] = ob; data[i + 3] = 255
        }
      }
    }
  }
  ctx.putImageData(imageData, 0, 0)
  return blobToB64(c)
}

async function swapColor(b64: string, oldHex: string, newHex: string): Promise<string> {
  const img = await loadImg(b64)
  const c = document.createElement('canvas')
  c.width = img.naturalWidth; c.height = img.naturalHeight
  const ctx = c.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  const imageData = ctx.getImageData(0, 0, c.width, c.height)
  const { data } = imageData
  const oh = oldHex.replace('#', '')
  const or = parseInt(oh.slice(0, 2), 16), og = parseInt(oh.slice(2, 4), 16), ob = parseInt(oh.slice(4, 6), 16)
  const nh = newHex.replace('#', '')
  const nr = parseInt(nh.slice(0, 2), 16), ng = parseInt(nh.slice(2, 4), 16), nb = parseInt(nh.slice(4, 6), 16)
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] === or && data[i+1] === og && data[i+2] === ob && data[i+3] > 0) {
      data[i] = nr; data[i+1] = ng; data[i+2] = nb
    }
  }
  ctx.putImageData(imageData, 0, 0)
  return blobToB64(c)
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function EditTools({
  pixelImage, onImageChange,
  swapMode, onSwapModeChange,
  swapSourceColor, onSwapSourceColorChange,
}: EditToolsProps) {
  const [outlineColor, setOutlineColor] = useState('#000000')
  const [swapTargetColor, setSwapTargetColor] = useState('#ffffff')
  const [busy, setBusy] = useState(false)

  const disabled = !pixelImage || busy

  const apply = useCallback(async (fn: (b64: string) => Promise<string>) => {
    if (!pixelImage || busy) return
    setBusy(true)
    try { onImageChange(await fn(pixelImage)) }
    finally { setBusy(false) }
  }, [pixelImage, onImageChange, busy])

  const handleApplySwap = useCallback(async () => {
    if (!swapSourceColor) return
    await apply(b => swapColor(b, swapSourceColor, swapTargetColor))
    onSwapSourceColorChange(null)
    onSwapModeChange(false)
  }, [swapSourceColor, swapTargetColor, apply, onSwapSourceColorChange, onSwapModeChange])

  const btnBase = 'py-1 text-[11px] border transition-colors disabled:opacity-25 disabled:cursor-not-allowed'
  const btnGrey = `${btnBase} border-ink-700 text-ink-500 hover:border-ink-500 hover:text-ink-300`

  return (
    <div className="flex flex-col gap-2">
      <p className="panel-label">EDIT TOOLS</p>

      {/* Flip */}
      <div className="grid grid-cols-2 gap-1">
        <button disabled={disabled} onClick={() => apply(b => flipImage(b, true))} className={btnGrey}>
          ↔ FLIP H
        </button>
        <button disabled={disabled} onClick={() => apply(b => flipImage(b, false))} className={btnGrey}>
          ↕ FLIP V
        </button>
      </div>

      {/* Trim */}
      <button disabled={disabled} onClick={() => apply(trimImage)} className={btnGrey}>
        ✂ TRIM TRANSPARENT BORDER
      </button>

      {/* Outline */}
      <div className="flex gap-1 items-center">
        <span className="text-[10px] text-ink-600 flex-shrink-0">OUTLINE</span>
        <input
          type="color"
          value={outlineColor}
          onChange={e => setOutlineColor(e.target.value)}
          disabled={disabled}
          className="w-6 h-5 cursor-pointer border border-ink-700 bg-transparent p-0 flex-shrink-0
            disabled:opacity-25 disabled:cursor-not-allowed"
        />
        <button
          disabled={disabled}
          onClick={() => apply(b => outlineImage(b, outlineColor))}
          className={`flex-1 ${btnGrey}`}
        >
          ADD OUTLINE
        </button>
      </div>

      {/* Swap Color */}
      <div className="flex flex-col gap-1">
        <button
          disabled={!pixelImage || busy}
          onClick={() => {
            onSwapModeChange(!swapMode)
            onSwapSourceColorChange(null)
          }}
          className={`${btnBase} ${swapMode
            ? 'border-pixel-amber text-pixel-amber-bright bg-pixel-amber/10'
            : 'border-ink-700 text-ink-500 hover:border-ink-500'}`}
        >
          {swapMode ? '🎨 CLICK IMAGE TO PICK…' : '🎨 SWAP COLOR'}
        </button>

        {swapSourceColor && (
          <div className="flex gap-1 items-center">
            <div
              className="w-5 h-5 border border-ink-600 flex-shrink-0"
              style={{ backgroundColor: swapSourceColor }}
            />
            <span className="text-[10px] text-ink-500 font-mono flex-shrink-0">{swapSourceColor}</span>
            <span className="text-[10px] text-ink-600 flex-shrink-0">→</span>
            <input
              type="color"
              value={swapTargetColor}
              onChange={e => setSwapTargetColor(e.target.value)}
              className="w-6 h-5 cursor-pointer border border-ink-700 bg-transparent p-0 flex-shrink-0"
            />
            <button
              onClick={handleApplySwap}
              disabled={busy}
              className="flex-1 py-0.5 text-[10px] border border-pixel-green
                text-pixel-green hover:bg-pixel-green/10 transition-colors
                disabled:opacity-25 disabled:cursor-not-allowed"
            >
              APPLY
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
