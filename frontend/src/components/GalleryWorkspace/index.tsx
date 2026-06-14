import { useState, useRef, useCallback } from 'react'
import type { GalleryItem, GalleryItemType } from '../../hooks/useGallery'

interface SceneItem {
  id: string
  imageB64: string
  label: string
  x: number
  y: number
  scale: number
  zIndex: number
}

const SCENE_W = 640
const SCENE_H = 360

const BG_PRESETS = [
  { label: 'DARK',   value: '#0d0d14' },
  { label: 'FOREST', value: '#1a3a1a' },
  { label: 'SKY',    value: '#1a3050' },
  { label: 'SAND',   value: '#3a2a14' },
  { label: 'CAVE',   value: '#0d0a0a' },
  { label: 'WHITE',  value: '#f0f0f0' },
]

const TYPE_LABELS: Record<string, string> = {
  all: 'ALL', sprite: 'SPRITE', prop: 'PROPS', tile: 'TILE', anim: 'ANIM',
}

interface Props {
  items: GalleryItem[]
  onRemoveItem: (id: string) => void
  onClearAll: () => void
}

export default function GalleryWorkspace({ items, onRemoveItem, onClearAll }: Props) {
  const [filter, setFilter] = useState<'all' | GalleryItemType>('all')
  const [sceneItems, setSceneItems] = useState<SceneItem[]>([])
  const [bgColor, setBgColor] = useState('#0d0d14')
  const [selected, setSelected] = useState<string | null>(null)
  const [dragging, setDragging] = useState<{ id: string; ox: number; oy: number } | null>(null)
  const sceneRef = useRef<HTMLDivElement>(null)

  const filteredItems = filter === 'all' ? items : items.filter(i => i.type === filter)

  const typeCounts: Record<string, number> = {
    all: items.length,
    sprite: items.filter(i => i.type === 'sprite').length,
    prop:   items.filter(i => i.type === 'prop').length,
    tile:   items.filter(i => i.type === 'tile').length,
    anim:   items.filter(i => i.type === 'anim').length,
  }

  const handleAddToScene = useCallback((item: GalleryItem) => {
    setSceneItems(prev => [...prev, {
      id: `s_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      imageB64: item.imageB64,
      label: item.name,
      x: Math.round(SCENE_W / 2 - 32),
      y: Math.round(SCENE_H / 2 - 32),
      scale: 1,
      zIndex: prev.length + 1,
    }])
  }, [])

  const handleSceneMouseDown = useCallback((e: React.MouseEvent, itemId: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (!sceneRef.current) return
    const rect = sceneRef.current.getBoundingClientRect()
    const item = sceneItems.find(i => i.id === itemId)
    if (!item) return
    setSelected(itemId)
    const maxZ = sceneItems.reduce((m, i) => Math.max(m, i.zIndex), 0)
    setSceneItems(prev => prev.map(i =>
      i.id === itemId ? { ...i, zIndex: maxZ + 1 } : i
    ))
    setDragging({
      id: itemId,
      ox: e.clientX - rect.left - item.x,
      oy: e.clientY - rect.top - item.y,
    })
  }, [sceneItems])

  const handleSceneMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging || !sceneRef.current) return
    const rect = sceneRef.current.getBoundingClientRect()
    setSceneItems(prev => prev.map(i =>
      i.id === dragging.id
        ? { ...i, x: e.clientX - rect.left - dragging.ox, y: e.clientY - rect.top - dragging.oy }
        : i
    ))
  }, [dragging])

  const handleMouseUp = useCallback(() => setDragging(null), [])

  const handleScaleChange = useCallback((id: string, delta: number) => {
    setSceneItems(prev => prev.map(i =>
      i.id === id ? { ...i, scale: Math.max(0.25, Math.min(8, parseFloat((i.scale + delta).toFixed(2)))) } : i
    ))
  }, [])

  const handleRemoveSceneItem = useCallback((id: string) => {
    setSceneItems(prev => prev.filter(i => i.id !== id))
    setSelected(s => s === id ? null : s)
  }, [])

  const handleExportScene = useCallback(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = SCENE_W
    canvas.height = SCENE_H
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, SCENE_W, SCENE_H)

    const sorted = [...sceneItems].sort((a, b) => a.zIndex - b.zIndex)
    await Promise.all(sorted.map(item => new Promise<void>(resolve => {
      const img = new Image()
      img.onload = () => {
        ctx.imageSmoothingEnabled = false
        const w = img.naturalWidth * item.scale
        const h = img.naturalHeight * item.scale
        ctx.drawImage(img, Math.round(item.x), Math.round(item.y), Math.round(w), Math.round(h))
        resolve()
      }
      img.src = `data:image/png;base64,${item.imageB64}`
    })))

    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob!)
      const a = document.createElement('a')
      a.href = url
      a.download = 'scene_preview.png'
      a.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }, [sceneItems, bgColor])

  const selectedItem = selected ? sceneItems.find(i => i.id === selected) ?? null : null

  return (
    <div className="flex flex-1 overflow-hidden font-mono">

      {/* ── Gallery sidebar ───────────────────────────────────── */}
      <aside className="w-56 flex-shrink-0 border-r border-ink-700 flex flex-col overflow-hidden bg-ink-900">

        {/* Type filter */}
        <div className="p-2 flex flex-wrap gap-1 border-b border-ink-700 flex-shrink-0">
          {(['all', 'sprite', 'prop', 'tile', 'anim'] as const).map(t => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-1.5 py-0.5 text-[10px] border transition-colors
                ${filter === t
                  ? 'border-pixel-green text-pixel-green bg-pixel-green/10'
                  : 'border-ink-700 text-ink-600 hover:border-ink-500'}`}
            >
              {TYPE_LABELS[t]}{typeCounts[t] > 0 ? ` ${typeCounts[t]}` : ''}
            </button>
          ))}
        </div>

        {/* Thumbnail grid */}
        <div className="flex-1 overflow-y-auto p-2">
          {items.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-[10px] text-ink-700 text-center leading-relaxed px-4">
                生成素材後<br />自動加入此處
              </p>
            </div>
          ) : filteredItems.length === 0 ? (
            <p className="text-[10px] text-ink-700 text-center py-6">此分類無素材</p>
          ) : (
            <div className="grid grid-cols-3 gap-1">
              {filteredItems.map(item => (
                <div key={item.id} className="relative group">
                  <div
                    className="w-full aspect-square checker border border-ink-700 overflow-hidden
                      cursor-pointer hover:border-pixel-green transition-colors"
                    onClick={() => handleAddToScene(item)}
                    title={`${item.name}  ·  點擊加入場景`}
                  >
                    <img
                      src={`data:image/png;base64,${item.imageB64}`}
                      className="w-full h-full object-contain"
                      style={{ imageRendering: 'pixelated' }}
                      alt={item.name}
                    />
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); onRemoveItem(item.id) }}
                    className="absolute top-0 right-0 w-4 h-4 bg-ink-950/90
                      text-ink-600 hover:text-pixel-red text-[9px] flex items-center justify-center
                      opacity-0 group-hover:opacity-100 transition-opacity"
                  >✕</button>
                  <p className="text-[9px] text-ink-600 truncate mt-0.5 leading-none">{item.name}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="p-2 border-t border-ink-700 flex-shrink-0">
            <button
              onClick={onClearAll}
              className="w-full py-1 text-[10px] border border-ink-700 text-ink-600
                hover:border-pixel-red hover:text-pixel-red transition-colors"
            >
              CLEAR ALL
            </button>
          </div>
        )}
      </aside>

      {/* ── Scene preview ─────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden bg-ink-950 p-3 gap-2">

        {/* Controls bar */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <p className="panel-label mr-1">SCENE</p>
          {BG_PRESETS.map(b => (
            <button
              key={b.label}
              onClick={() => setBgColor(b.value)}
              className={`px-2 py-0.5 text-[10px] border transition-colors flex items-center gap-1
                ${bgColor === b.value
                  ? 'border-pixel-amber text-pixel-amber-bright bg-pixel-amber/10'
                  : 'border-ink-700 text-ink-600 hover:border-ink-500'}`}
            >
              <span
                className="inline-block w-2.5 h-2.5 border border-ink-600 flex-shrink-0"
                style={{ background: b.value }}
              />
              {b.label}
            </button>
          ))}
          <div className="flex-1" />
          {sceneItems.length > 0 && (
            <>
              <button
                onClick={() => { setSceneItems([]); setSelected(null) }}
                className="px-2 py-1 text-[10px] border border-ink-700 text-ink-600
                  hover:border-pixel-red hover:text-pixel-red transition-colors"
              >
                CLEAR SCENE
              </button>
              <button
                onClick={handleExportScene}
                className="px-3 py-1 text-[10px] font-bold border border-pixel-green
                  text-pixel-green hover:bg-pixel-green/10 transition-colors"
              >
                ↓ EXPORT 640×360
              </button>
            </>
          )}
        </div>

        {/* Canvas area */}
        <div className="flex-1 flex items-center justify-center overflow-hidden min-h-0">
          <div
            ref={sceneRef}
            className="relative flex-shrink-0 overflow-hidden select-none"
            style={{
              width: SCENE_W,
              height: SCENE_H,
              background: bgColor,
              cursor: dragging ? 'grabbing' : 'default',
              maxWidth: '100%',
              maxHeight: '100%',
            }}
            onMouseMove={handleSceneMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={() => setSelected(null)}
          >
            {sceneItems.map(item => (
              <div
                key={item.id}
                className="absolute"
                style={{
                  left: item.x,
                  top: item.y,
                  zIndex: item.zIndex,
                  outline: selected === item.id ? '1px solid #39ff8e' : undefined,
                  outlineOffset: '2px',
                  cursor: 'grab',
                }}
                onMouseDown={e => handleSceneMouseDown(e, item.id)}
              >
                <img
                  src={`data:image/png;base64,${item.imageB64}`}
                  style={{
                    imageRendering: 'pixelated',
                    transform: `scale(${item.scale})`,
                    transformOrigin: 'top left',
                    display: 'block',
                  }}
                  alt={item.label}
                  draggable={false}
                />
              </div>
            ))}

            {sceneItems.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-[11px] text-ink-700 text-center leading-relaxed">
                  點擊左側素材加入場景<br />
                  <span className="text-[10px]">拖曳移動 · 選取後可縮放</span>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Selected item toolbar */}
        <div
          className={`flex items-center gap-2 flex-shrink-0 border-t border-ink-700 pt-2
            transition-opacity ${selectedItem ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          style={{ minHeight: 32 }}
        >
          {selectedItem && (
            <>
              <span className="text-[10px] text-ink-500 max-w-[120px] truncate">{selectedItem.label}</span>
              <span className="text-[10px] text-ink-700 ml-2">SCALE</span>
              <button
                onClick={() => handleScaleChange(selectedItem.id, -0.25)}
                className="w-6 h-6 border border-ink-700 text-ink-400 hover:border-ink-400 text-[14px] leading-none flex items-center justify-center"
              >−</button>
              <span className="text-[11px] text-ink-300 w-10 text-center tabular-nums">
                {selectedItem.scale}×
              </span>
              <button
                onClick={() => handleScaleChange(selectedItem.id, 0.25)}
                className="w-6 h-6 border border-ink-700 text-ink-400 hover:border-ink-400 text-[14px] leading-none flex items-center justify-center"
              >+</button>
              <button
                onClick={() => handleRemoveSceneItem(selectedItem.id)}
                className="ml-2 px-2 py-0.5 text-[10px] border border-ink-700 text-ink-600
                  hover:border-pixel-red hover:text-pixel-red transition-colors"
              >
                ✕ REMOVE
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
