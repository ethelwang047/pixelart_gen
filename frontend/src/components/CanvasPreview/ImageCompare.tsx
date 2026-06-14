interface Props {
  label: string
  image: string | null
  isLoading: boolean
  placeholder: string
  pixelated?: boolean
  eraseMode?: boolean
  onErase?: (x: number, y: number, img: HTMLImageElement) => void
  swapMode?: boolean
  onColorPick?: (hex: string) => void
}

export default function ImageCompare({
  label, image, isLoading, placeholder, pixelated, eraseMode, onErase, swapMode, onColorPick,
}: Props) {
  const handleClick = (e: React.MouseEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    const rect = img.getBoundingClientRect()
    const scaleX = img.naturalWidth / rect.width
    const scaleY = img.naturalHeight / rect.height
    const x = Math.floor((e.clientX - rect.left) * scaleX)
    const y = Math.floor((e.clientY - rect.top) * scaleY)

    if (eraseMode && onErase) {
      onErase(x, y, img)
    } else if (swapMode && onColorPick) {
      const c = document.createElement('canvas')
      c.width = img.naturalWidth; c.height = img.naturalHeight
      const ctx = c.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      const px = ctx.getImageData(x, y, 1, 1).data
      const hex = `#${px[0].toString(16).padStart(2, '0')}${px[1].toString(16).padStart(2, '0')}${px[2].toString(16).padStart(2, '0')}`
      onColorPick(hex)
    }
  }

  return (
    <div className="flex flex-col gap-1 flex-1 min-w-0">
      <span className="panel-label">{label}</span>
      <div className={`flex-1 border border-ink-700 flex items-center justify-center overflow-hidden min-h-48
        ${image ? 'checker' : 'bg-ink-900'}`}>
        {isLoading ? (
          <div className="flex flex-col items-center gap-2 text-ink-500">
            <div className="w-5 h-5 border-2 border-pixel-green border-t-transparent rounded-full animate-spin" />
            <span className="text-[11px]">PROCESSING…</span>
          </div>
        ) : image ? (
          <img
            src={`data:image/png;base64,${image}`}
            alt={label}
            className="max-w-full max-h-full object-contain"
            style={{
              imageRendering: pixelated ? 'pixelated' : undefined,
              cursor: (eraseMode || swapMode) ? 'crosshair' : 'default',
            }}
            onClick={handleClick}
          />
        ) : (
          <span className="text-[11px] text-ink-700 text-center px-4">{placeholder}</span>
        )}
      </div>
    </div>
  )
}
