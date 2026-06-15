import { useState, useCallback, useEffect, useRef } from 'react'
import { useDebouncedCallback } from 'use-debounce'
import { generateImage, pixelateImage, extractPalette, getUsage, friendlyError } from './api'
import PromptPanel from './components/PromptPanel'
import CanvasPreview from './components/CanvasPreview'
import PixelControls from './components/PixelControls'
import ExportPanel from './components/ExportPanel'
import Toast, { ToastItem, ToastType } from './components/Toast'
import HistoryPanel from './components/HistoryPanel'
import PropsWorkspace from './components/PropsWorkspace'
import TilesetWorkspace from './components/TilesetWorkspace'
import SpriteAnimWorkspace from './components/SpriteAnimWorkspace'
import GalleryWorkspace from './components/GalleryWorkspace'
import VfxWorkspace from './components/VfxWorkspace'
import PaletteBar from './components/PaletteBar'
import EditTools from './components/EditTools'
import GameSettings from './components/GameSettings'
import { useHistory, HistoryEntry } from './hooks/useHistory'
import type { GlobalCharacter } from './types'
import { usePalette } from './hooks/usePalette'
import { useGameUnit } from './hooks/useGameUnit'
import { useGallery } from './hooks/useGallery'

type Mode = 'sprite' | 'tileset' | 'props' | 'anim' | 'vfx' | 'gallery'

const MODES: { key: Mode; label: string }[] = [
  { key: 'sprite',  label: 'SPRITE'   },
  { key: 'tileset', label: 'TILE SET' },
  { key: 'props',   label: 'PROPS'    },
  { key: 'anim',    label: 'ANIM'     },
  { key: 'vfx',     label: 'VFX'      },
  { key: 'gallery', label: 'GALLERY'  },
]

export default function App() {
  const [mode, setMode] = useState<Mode>('sprite')

  // ── Sprite state ────────────────────────────────────────────────
  const [prompt, setPrompt] = useState('')
  const [styleKey, setStyleKey] = useState('stardew')
  const [aspectRatio, setAspectRatio] = useState('1:1')
  const [originalImages, setOriginalImages] = useState<string[]>([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const originalImage = originalImages[selectedIdx] ?? null
  const [pixelImage, setPixelImage] = useState<string | null>(null)
  const [pixelWidth, setPixelWidth] = useState(8)
  const [numColors, setNumColors] = useState(16)
  const [scaleResult, setScaleResult] = useState(4)
  const [transparentBg, setTransparentBg] = useState(true)
  const [spriteModel, setSpriteModel] = useState('imagen-4.0-generate-001')
  const [swapMode, setSwapMode] = useState(false)
  const [swapSourceColor, setSwapSourceColor] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isPixelating, setIsPixelating] = useState(false)
  const [pixelImageHistory, setPixelImageHistory] = useState<string[]>([])
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const toastId = useRef(0)
  const { entries: historyEntries, addEntry, removeEntry } = useHistory()
  const palette = usePalette()
  const gameUnit = useGameUnit()
  const gallery = useGallery()
  const [totalCostUsd, setTotalCostUsd] = useState<number | null>(null)
  const [globalCharacter, setGlobalCharacter] = useState<GlobalCharacter | null>(null)

  useEffect(() => {
    getUsage().then(r => setTotalCostUsd((r as { total_cost_usd: number }).total_cost_usd)).catch(() => {})
  }, [])

  const addToast = useCallback((message: string, type: ToastType = 'error') => {
    const id = ++toastId.current
    setToasts(t => [...t, { id, message, type }])
  }, [])

  useEffect(() => {
    const onOffline = () => addToast('網路連線已中斷', 'warning')
    const onOnline  = () => addToast('網路連線已恢復', 'info')
    window.addEventListener('offline', onOffline)
    window.addEventListener('online',  onOnline)
    return () => {
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online',  onOnline)
    }
  }, [addToast])

  const runPixelate = useCallback(async (
    b64: string, pw: number, nc: number, sr: number, tb: boolean
  ): Promise<string | null> => {
    setIsPixelating(true)
    try {
      const res = await pixelateImage({
        image_base64: b64, pixel_width: pw, num_colors: nc,
        scale_result: sr, transparent_background: tb,
        locked_palette: palette.lockedPalette,
      })
      const pixelB64 = (res as { image_base64: string }).image_base64
      setPixelImage(pixelB64)
      return pixelB64
    } catch (e) {
      addToast(friendlyError(e))
      return null
    } finally {
      setIsPixelating(false)
    }
  }, [addToast, palette.lockedPalette])

  const handleExtractPalette = useCallback(async (imageB64: string) => {
    try {
      const res = await extractPalette(imageB64)
      palette.setPalette((res as { palette: string[] }).palette)
      addToast('調色盤已更新並鎖定', 'info')
    } catch (e) {
      addToast(friendlyError(e))
    }
  }, [palette, addToast])

  const handlePixelImageChange = useCallback((newB64: string) => {
    setPixelImageHistory(h => [...h.slice(-4), pixelImage].filter(Boolean) as string[])
    setPixelImage(newB64)
  }, [pixelImage])

  const handleUndo = useCallback(() => {
    if (pixelImageHistory.length === 0) return
    setPixelImage(pixelImageHistory[pixelImageHistory.length - 1])
    setPixelImageHistory(h => h.slice(0, -1))
  }, [pixelImageHistory])

  const handleSelectImage = useCallback((idx: number) => {
    setSelectedIdx(idx)
    setPixelImage(null)
    setPixelImageHistory([])
    const b64 = originalImages[idx]
    if (b64) runPixelate(b64, pixelWidth, numColors, scaleResult, transparentBg)
  }, [originalImages, pixelWidth, numColors, scaleResult, transparentBg, runPixelate])

  const handleUpload = useCallback((b64: string) => {
    setOriginalImages([b64])
    setSelectedIdx(0)
    setPixelImage(null)
    setPixelImageHistory([])
    runPixelate(b64, pixelWidth, numColors, scaleResult, transparentBg)
  }, [pixelWidth, numColors, scaleResult, transparentBg, runPixelate])

  const handleLoadHistory = useCallback((entry: HistoryEntry) => {
    setPixelImage(entry.pixelImage)
    setPrompt(entry.prompt)
    setAspectRatio(entry.aspectRatio)
    setOriginalImages([])
    setSelectedIdx(0)
    setPixelImageHistory([])
  }, [])

  const debouncedPixelate = useDebouncedCallback(
    (b64: string, pw: number, nc: number, sr: number, tb: boolean) => runPixelate(b64, pw, nc, sr, tb),
    300
  )

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return
    setIsGenerating(true)
    setOriginalImages([])
    setSelectedIdx(0)
    setPixelImage(null)
    try {
      const res = await generateImage(prompt.trim(), styleKey, aspectRatio, 2, spriteModel, palette.lockedPalette)
      const images = (res as { images: string[] }).images
      setOriginalImages(images)
      setSelectedIdx(0)
      const pixelB64 = await runPixelate(images[0], pixelWidth, numColors, scaleResult, transparentBg)
      if (pixelB64) {
        addEntry({ prompt: prompt.trim(), aspectRatio, pixelImage: pixelB64 })
        gallery.addItem('sprite', prompt.trim().slice(0, 24), pixelB64)
      }
    } catch (e) {
      addToast(friendlyError(e))
    } finally {
      setIsGenerating(false)
    }
  }, [prompt, styleKey, aspectRatio, pixelWidth, numColors, scaleResult, transparentBg, spriteModel, palette.lockedPalette, runPixelate, addToast, addEntry])

  useEffect(() => {
    if (!originalImage) return
    debouncedPixelate(originalImage, pixelWidth, numColors, scaleResult, transparentBg)
  }, [pixelWidth, numColors, scaleResult, transparentBg, originalImage])

  useEffect(() => {
    if (mode !== 'sprite') return
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); handleGenerate() }
      if (!originalImage) return
      if (e.key === '[') setPixelWidth(w => Math.max(2, w - 1))
      if (e.key === ']') setPixelWidth(w => Math.min(32, w + 1))
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [mode, handleGenerate, originalImage])

  return (
    <div className="h-screen bg-ink-950 text-ink-300 flex flex-col overflow-hidden font-mono">

      {/* ── Top bar ──────────────────────────────────────────────── */}
      <header className="h-9 border-b border-ink-700 flex items-stretch px-4 flex-shrink-0">
        <div className="flex items-center mr-6">
          <span className="font-pixel text-[11px] text-pixel-green tracking-wide leading-none">
            PIXEL ART<br />STUDIO
          </span>
        </div>

        <nav className="flex items-stretch">
          {MODES.map(m => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`px-4 text-[12px] tracking-widest border-b-2 transition-colors flex items-center gap-1.5
                ${mode === m.key
                  ? 'border-pixel-green text-pixel-green'
                  : 'border-transparent text-ink-500 hover:text-ink-300'}`}
            >
              {m.label}
              {m.key === 'gallery' && gallery.items.length > 0 && (
                <span className={`text-[10px] px-1 rounded-sm tabular-nums
                  ${mode === 'gallery' ? 'bg-pixel-green/20 text-pixel-green' : 'bg-ink-700 text-ink-400'}`}>
                  {gallery.items.length}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="flex-1" />

        <div className="flex items-center gap-3">
          <PaletteBar
            colors={palette.colors}
            isLocked={palette.isLocked}
            onLockToggle={() => palette.isLocked ? palette.unlockPalette() : palette.lockPalette()}
            onClearPalette={palette.clearPalette}
            onRemoveColor={palette.removeColor}
          />
          <GameSettings gameUnit={gameUnit} />
          <span className="text-[11px] text-ink-600">IMAGEN-4.0</span>
        </div>
      </header>

      {/* ── Workspace ────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sprite ─ always mounted, hidden when inactive */}
        <div className={mode !== 'sprite' ? 'hidden' : 'flex flex-1 overflow-hidden'}>
            <aside className="w-64 flex-shrink-0 border-r border-ink-700 flex flex-col overflow-y-auto bg-ink-900">
              <PromptPanel
                prompt={prompt}
                styleKey={styleKey}
                aspectRatio={aspectRatio}
                model={spriteModel}
                isGenerating={isGenerating}
                onPromptChange={setPrompt}
                onStyleKeyChange={setStyleKey}
                onAspectRatioChange={setAspectRatio}
                onModelChange={setSpriteModel}
                onGenerate={handleGenerate}
                onUpload={handleUpload}
              />
              <div className="panel-divider mx-3" />
              <div className="px-3 pb-3">
                <PixelControls
                  pixelWidth={pixelWidth}
                  numColors={numColors}
                  scaleResult={scaleResult}
                  transparentBg={transparentBg}
                  isPixelating={isPixelating}
                  disabled={!originalImage}
                  onPixelWidthChange={setPixelWidth}
                  onNumColorsChange={setNumColors}
                  onScaleResultChange={setScaleResult}
                  onTransparentBgChange={setTransparentBg}
                />
              </div>
              <div className="panel-divider mx-3" />
              <div className="px-3 pb-3">
                <EditTools
                  pixelImage={pixelImage}
                  onImageChange={handlePixelImageChange}
                  swapMode={swapMode}
                  onSwapModeChange={setSwapMode}
                  swapSourceColor={swapSourceColor}
                  onSwapSourceColorChange={setSwapSourceColor}
                />
              </div>
              <div className="panel-divider mx-3" />
              <div className="px-3 pb-3">
                <ExportPanel pixelImage={pixelImage} gameUnit={gameUnit} />
              </div>
              {pixelImage && (
                <>
                  <div className="panel-divider mx-3" />
                  <div className="px-3 pb-2 flex flex-col gap-1">
                    <button
                      onClick={() => handleExtractPalette(pixelImage)}
                      className="w-full py-1.5 text-[11px] border border-pixel-amber
                        text-pixel-amber-bright hover:bg-pixel-amber/10 transition-colors"
                    >
                      ↑ SET AS PALETTE
                    </button>
                    <button
                      onClick={() => setGlobalCharacter({ imageB64: pixelImage, description: prompt, styleKey })}
                      className={`w-full py-1.5 text-[11px] border transition-colors
                        ${globalCharacter?.imageB64 === pixelImage
                          ? 'border-pixel-green text-pixel-green bg-pixel-green/10'
                          : 'border-ink-700 text-ink-500 hover:border-pixel-green hover:text-pixel-green'}`}
                    >
                      {globalCharacter?.imageB64 === pixelImage ? '✓ CHARACTER SET' : '→ SET AS CHARACTER'}
                    </button>
                  </div>
                </>
              )}
              <div className="panel-divider mx-3" />
              <div className="px-3 pb-4">
                <HistoryPanel
                  entries={historyEntries}
                  onLoad={handleLoadHistory}
                  onRemove={removeEntry}
                />
              </div>
            </aside>

            <main className="flex-1 flex flex-col overflow-hidden bg-ink-950">
              <CanvasPreview
                originalImage={originalImage}
                originalImages={originalImages}
                selectedIdx={selectedIdx}
                onSelectImage={handleSelectImage}
                pixelImage={pixelImage}
                isGenerating={isGenerating}
                isPixelating={isPixelating}
                onPixelImageChange={handlePixelImageChange}
                onUndo={handleUndo}
                canUndo={pixelImageHistory.length > 0}
                onUpload={handleUpload}
                swapMode={swapMode}
                onColorPick={(hex) => { setSwapSourceColor(hex); setSwapMode(false) }}
              />
            </main>
        </div>

        {/* Tileset / Props / Anim / Gallery ─ always mounted, hidden when inactive */}
        <div className={mode !== 'tileset' ? 'hidden' : 'flex flex-1 overflow-hidden'}>
          <TilesetWorkspace lockedPalette={palette.lockedPalette} onExtractPalette={handleExtractPalette} baseUnit={gameUnit.baseUnit} onAddToGallery={gallery.addItem} />
        </div>
        <div className={mode !== 'props' ? 'hidden' : 'flex flex-1 overflow-hidden'}>
          <PropsWorkspace lockedPalette={palette.lockedPalette} onExtractPalette={handleExtractPalette} propPx={gameUnit.propPx} onAddToGallery={gallery.addItem} globalCharacter={globalCharacter} />
        </div>
        <div className={mode !== 'anim' ? 'hidden' : 'flex flex-1 overflow-hidden'}>
          <SpriteAnimWorkspace lockedPalette={palette.lockedPalette} onExtractPalette={handleExtractPalette} baseUnit={gameUnit.baseUnit} onAddToGallery={gallery.addItem} globalCharacter={globalCharacter} onSetGlobalCharacter={setGlobalCharacter} />
        </div>
        <div className={mode !== 'vfx' ? 'hidden' : 'flex flex-1 overflow-hidden'}>
          <VfxWorkspace lockedPalette={palette.lockedPalette} onExtractPalette={handleExtractPalette} baseUnit={gameUnit.baseUnit} onAddToGallery={gallery.addItem} />
        </div>
        <div className={mode !== 'gallery' ? 'hidden' : 'flex flex-1 overflow-hidden'}>
          <GalleryWorkspace items={gallery.items} onRemoveItem={gallery.removeItem} onClearAll={gallery.clearAll} />
        </div>
      </div>

      {/* ── Status bar ───────────────────────────────────────────── */}
      <footer className="h-5 border-t border-ink-700 flex items-center px-4 gap-6 flex-shrink-0 bg-ink-900">
        {mode === 'sprite' && (
          <>
            <span className="text-[11px] text-ink-600">⌃↵  GENERATE</span>
            <span className="text-[11px] text-ink-600">[/]  PIXEL SIZE</span>
            <span className="text-[11px] text-ink-600">SCROLL  ZOOM</span>
          </>
        )}
        <div className="flex-1" />
        <span className="text-[11px] text-ink-600">STYLE: {styleKey.toUpperCase()}</span>
        {totalCostUsd !== null && (
          <span className="text-[11px] text-ink-700" title="本機累計 Imagen 4 費用">
            $ {totalCostUsd.toFixed(4)}
          </span>
        )}
      </footer>

      <Toast toasts={toasts} onDismiss={id => setToasts(t => t.filter(x => x.id !== id))} />
    </div>
  )
}

