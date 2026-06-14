import type { GameUnit } from '../../hooks/useGameUnit'

interface Props {
  pixelImage: string | null
  gameUnit: GameUnit
}

function downloadAtSize(b64: string, w: number, h: number, filename: string) {
  const img = new Image()
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(img, 0, 0, w, h)
    canvas.toBlob(blob => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }
  img.src = `data:image/png;base64,${b64}`
}

export default function ExportPanel({ pixelImage, gameUnit }: Props) {
  const { tilePx, charW, charH } = gameUnit

  const sizes = [
    { label: 'ORIGINAL',        w: 0,       h: 0       },
    { label: `TILE  ${tilePx}×${tilePx}`,    w: tilePx,  h: tilePx  },
    { label: `CHAR  ${charW}×${charH}`,      w: charW,   h: charH   },
    { label: `2×   ${tilePx*2}×${tilePx*2}`, w: tilePx*2, h: tilePx*2 },
  ]

  return (
    <div className="flex flex-col gap-2">
      <p className="panel-label">EXPORT</p>
      <div className="grid grid-cols-2 gap-1">
        {sizes.map(({ label, w, h }) => (
          <button
            key={label}
            disabled={!pixelImage}
            onClick={() => {
              if (!pixelImage) return
              const actualW = w || undefined
              const actualH = h || undefined
              const img = new Image()
              img.onload = () => {
                const fw = actualW ?? img.naturalWidth
                const fh = actualH ?? img.naturalHeight
                downloadAtSize(pixelImage, fw, fh, `sprite_${fw}x${fh}.png`)
              }
              img.src = `data:image/png;base64,${pixelImage}`
            }}
            className="py-1.5 text-[10px] border border-ink-700 text-ink-500
              hover:border-ink-500 hover:text-ink-300
              disabled:opacity-25 disabled:cursor-not-allowed transition-colors leading-tight"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
