import { useState, useCallback } from 'react'
import ImageCompare from './ImageCompare'

interface Props {
  originalImage: string | null
  originalImages: string[]
  selectedIdx: number
  onSelectImage: (i: number) => void
  pixelImage: string | null
  isGenerating: boolean
  isPixelating: boolean
  onPixelImageChange: (b64: string) => void
  onUndo: () => void
  canUndo: boolean
  onUpload: (b64: string) => void
  swapMode?: boolean
  onColorPick?: (hex: string) => void
}

function floodFillTransparent(imageData: ImageData, startX: number, startY: number) {
  const { data, width, height } = imageData
  const idx = (x: number, y: number) => (y * width + x) * 4
  const si = idx(startX, startY)
  const tr = data[si], tg = data[si + 1], tb = data[si + 2], ta = data[si + 3]
  if (ta === 0) return

  const visited = new Uint8Array(width * height)
  const queue: number[] = [startY * width + startX]
  visited[startY * width + startX] = 1
  let head = 0

  while (head < queue.length) {
    const pos = queue[head++]
    const x = pos % width, y = Math.floor(pos / width)
    const i = idx(x, y)
    if (data[i] !== tr || data[i+1] !== tg || data[i+2] !== tb || data[i+3] !== ta) continue
    data[i+3] = 0
    for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const nx = x + dx, ny = y + dy
      const npos = ny * width + nx
      if (nx >= 0 && nx < width && ny >= 0 && ny < height && !visited[npos]) {
        visited[npos] = 1
        queue.push(npos)
      }
    }
  }
}

export default function CanvasPreview({
  originalImage, originalImages, selectedIdx, onSelectImage,
  pixelImage, isGenerating, isPixelating,
  onPixelImageChange, onUndo, canUndo, onUpload,
  swapMode, onColorPick,
}: Props) {
  const [zoom, setZoom] = useState(1)
  const [eraseMode, setEraseMode] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    setZoom(z => Math.min(4, Math.max(0.5, z - e.deltaY * 0.001)))
  }

  const handleErase = useCallback((clickX: number, clickY: number, imgEl: HTMLImageElement) => {
    const canvas = document.createElement('canvas')
    canvas.width = imgEl.naturalWidth
    canvas.height = imgEl.naturalHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(imgEl, 0, 0)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    floodFillTransparent(imageData, clickX, clickY)
    ctx.putImageData(imageData, 0, 0)
    canvas.toBlob(blob => {
      if (!blob) return
      const reader = new FileReader()
      reader.onload = () => {
        onPixelImageChange((reader.result as string).split(',')[1])
      }
      reader.readAsDataURL(blob!)
    }, 'image/png')
  }, [onPixelImageChange])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (!file?.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => onUpload((reader.result as string).split(',')[1])
    reader.readAsDataURL(file)
  }, [onUpload])

  return (
    <div
      className="flex flex-col flex-1 overflow-hidden relative p-3 gap-2"
      onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false) }}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 z-10 border-2 border-dashed border-pixel-green
          bg-ink-950/80 flex items-center justify-center pointer-events-none">
          <span className="text-[12px] text-pixel-green font-mono tracking-widest">DROP TO UPLOAD</span>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-shrink-0 h-7">
        <button
          onClick={() => setEraseMode(m => !m)}
          disabled={!pixelImage}
          className={`px-2 py-1 text-[11px] border transition-colors
            ${eraseMode
              ? 'border-pixel-red text-pixel-red bg-pixel-red/10'
              : 'border-ink-700 text-ink-500 hover:border-ink-500'}
            disabled:opacity-25 disabled:cursor-not-allowed`}
        >
          ERASE {eraseMode ? 'ON' : 'OFF'}
        </button>
        {canUndo && (
          <button
            onClick={onUndo}
            className="px-2 py-1 text-[11px] border border-ink-700 text-ink-500 hover:border-ink-500 transition-colors"
          >
            ↩ UNDO
          </button>
        )}
        {eraseMode && (
          <span className="text-[11px] text-pixel-red">CLICK PIXEL IMAGE TO ERASE AREA</span>
        )}
        {swapMode && (
          <span className="text-[11px] text-pixel-amber-bright">CLICK PIXEL IMAGE TO PICK COLOR</span>
        )}
        <div className="flex-1" />
        <span className="text-[11px] text-ink-700">SCROLL TO ZOOM</span>
        <button
          onClick={() => setZoom(1)}
          className="px-2 py-1 text-[11px] border border-ink-700 text-ink-500 hover:border-ink-500 font-mono transition-colors"
        >
          {Math.round(zoom * 100)}%
        </button>
      </div>

      {/* Variant thumbnails */}
      {originalImages.length > 1 && (
        <div className="flex gap-1.5 items-center flex-shrink-0">
          <span className="panel-label">VARIANTS</span>
          {originalImages.map((b64, i) => (
            <button
              key={i}
              onClick={() => onSelectImage(i)}
              className={`relative border transition-colors overflow-hidden flex-shrink-0
                ${i === selectedIdx ? 'border-pixel-green' : 'border-ink-700 hover:border-ink-500'}`}
              style={{ width: 44, height: 44 }}
              title={`Variant ${i + 1}`}
            >
              <img src={`data:image/png;base64,${b64}`} alt="" className="w-full h-full object-cover" />
              {i === selectedIdx && (
                <span className="absolute bottom-0 right-0 text-[8px] bg-pixel-green text-ink-950 px-1 font-bold leading-tight">
                  {i + 1}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Image panels */}
      <div className="flex-1 overflow-auto" onWheel={handleWheel}>
        <div
          className="flex gap-3 h-full"
          style={{ minWidth: `${zoom * 100}%`, minHeight: `${zoom * 100}%` }}
        >
          <ImageCompare
            label="ORIGINAL"
            image={originalImage}
            isLoading={isGenerating}
            placeholder="GENERATE OR UPLOAD AN IMAGE"
          />
          <ImageCompare
            label="PIXELATED"
            image={pixelImage}
            isLoading={isPixelating}
            placeholder="RESULT APPEARS HERE"
            pixelated
            eraseMode={eraseMode}
            onErase={handleErase}
            swapMode={swapMode}
            onColorPick={onColorPick}
          />
        </div>
      </div>
    </div>
  )
}
