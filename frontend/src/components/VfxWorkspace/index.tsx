import { useState, useCallback, useEffect, useRef } from 'react'
import JSZip from 'jszip'
import { generateVfx, friendlyError } from '../../api'
import Toast, { ToastItem, ToastType } from '../Toast'

interface VfxWorkspaceProps {
  lockedPalette?: string[]
  onExtractPalette: (imageB64: string) => Promise<void>
  baseUnit?: number
  onAddToGallery?: (type: 'sprite' | 'prop' | 'tile' | 'anim', name: string, imageB64: string) => void
}

interface VfxResult {
  frames: string[]
  grid_sheet: string
  strip: string
  manifest: {
    effect: string
    frame_count: number
    fps: number
    loop: boolean
    tile_size: number
    cols: number
    rows: number
  }
}

const EFFECTS = [
  { key: 'explosion', label: 'EXPLOSION', frames: 6 },
  { key: 'sparkle',   label: 'SPARKLE',   frames: 6 },
  { key: 'heal',      label: 'HEAL',      frames: 4 },
  { key: 'smoke',     label: 'SMOKE',     frames: 6 },
  { key: 'slash',     label: 'SLASH',     frames: 4 },
  { key: 'fire',      label: 'FIRE',      frames: 6 },
  { key: 'ice',       label: 'ICE',       frames: 4 },
  { key: 'magic',     label: 'MAGIC',     frames: 6 },
]

const STYLE_LABELS: Record<string, string> = {
  stardew: 'STARDEW', cave_story: 'CAVE STORY',
  undertale: 'UNDERTALE', rpg_map: 'SNES RPG',
  sci_fi: 'SCI-FI', horror: 'HORROR',
}

function downloadPng(b64: string, filename: string) {
  const a = document.createElement('a')
  a.href = `data:image/png;base64,${b64}`; a.download = filename; a.click()
}

export default function VfxWorkspace({ lockedPalette, onExtractPalette, baseUnit = 16, onAddToGallery }: VfxWorkspaceProps) {
  const [effectType, setEffectType] = useState('explosion')
  const [customDesc, setCustomDesc] = useState('')
  const [styleKey, setStyleKey] = useState('stardew')
  const [tileSize, setTileSize] = useState(baseUnit * 2)
  const [isGenerating, setIsGenerating] = useState(false)
  const [result, setResult] = useState<VfxResult | null>(null)
  const [playFrame, setPlayFrame] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const addToast = useCallback((msg: string, type: ToastType = 'error') => {
    setToasts(t => [...t, { id: Date.now(), message: msg, type }])
  }, [])

  // Animation player
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (!result || !isPlaying) return
    setPlayFrame(0)
    intervalRef.current = setInterval(() => {
      setPlayFrame(f => {
        const next = f + 1
        if (next >= result.manifest.frame_count) {
          if (!result.manifest.loop) {
            clearInterval(intervalRef.current!)
            setIsPlaying(false)
            return f
          }
          return 0
        }
        return next
      })
    }, 1000 / result.manifest.fps)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [result, isPlaying])

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true)
    setResult(null)
    setIsPlaying(true)
    try {
      const res = await generateVfx({
        effect_type: effectType,
        custom_description: customDesc,
        style_key: styleKey,
        tile_size: tileSize,
        locked_palette: lockedPalette,
      })
      const vfxResult = res as VfxResult
      onAddToGallery?.('anim', effectType, vfxResult.strip)
      setResult(vfxResult)
      setPlayFrame(0)
    } catch (e) {
      addToast(friendlyError(e))
    } finally {
      setIsGenerating(false)
    }
  }, [effectType, customDesc, styleKey, tileSize, lockedPalette, addToast, onAddToGallery])

  const handleExportAll = useCallback(async () => {
    if (!result) return
    const zip = new JSZip()
    const b64ToBytes = (b64: string) => Uint8Array.from(atob(b64), c => c.charCodeAt(0))
    result.frames.forEach((b64, i) =>
      zip.file(`${effectType}_${String(i).padStart(2, '0')}.png`, b64ToBytes(b64))
    )
    zip.file(`${effectType}_grid.png`, b64ToBytes(result.grid_sheet))
    zip.file(`${effectType}_strip.png`, b64ToBytes(result.strip))
    zip.file(`${effectType}_manifest.json`, JSON.stringify(result.manifest, null, 2))
    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${effectType}_vfx.zip`; a.click()
    URL.revokeObjectURL(url)
  }, [result, effectType])

  const currentEffect = EFFECTS.find(e => e.key === effectType)!

  return (
    <div className="flex flex-1 overflow-hidden font-mono">

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside className="w-60 flex-shrink-0 border-r border-ink-700 flex flex-col overflow-y-auto bg-ink-900">

        {/* Effect type */}
        <div className="p-3">
          <p className="panel-label mb-1.5">EFFECT TYPE</p>
          <div className="grid grid-cols-2 gap-1 mb-3">
            {EFFECTS.map(e => (
              <button
                key={e.key}
                onClick={() => setEffectType(e.key)}
                className={`py-1.5 text-[10px] border transition-colors
                  ${effectType === e.key
                    ? 'border-pixel-green text-pixel-green bg-pixel-green/10'
                    : 'border-ink-700 text-ink-500 hover:border-ink-500'}`}
              >
                {e.label}
              </button>
            ))}
          </div>

          <p className="panel-label mb-1">CUSTOM DETAIL</p>
          <textarea
            className="w-full bg-ink-950 border border-ink-700 text-ink-300 text-[11px] font-mono
              resize-none p-1.5 focus:outline-none focus:border-pixel-green
              placeholder:text-ink-600 leading-relaxed"
            rows={2}
            placeholder={'e.g. 紅色魔法火焰\ne.g. blue electric arc'}
            value={customDesc}
            onChange={e => setCustomDesc(e.target.value)}
          />
          <p className="text-[10px] text-ink-700 mt-0.5">留空使用預設描述</p>
        </div>

        <div className="panel-divider mx-3" />

        {/* Art style */}
        <div className="px-3 pb-3">
          <p className="panel-label mb-1.5">ART STYLE</p>
          <div className="flex flex-col gap-1">
            {Object.entries(STYLE_LABELS).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setStyleKey(key)}
                className={`text-[10px] py-1 px-2 border text-left transition-colors
                  ${styleKey === key
                    ? 'border-pixel-green text-pixel-green bg-pixel-green/10'
                    : 'border-ink-700 text-ink-500 hover:border-ink-500'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="panel-divider mx-3" />

        {/* Frame size + Generate */}
        <div className="px-3 pb-3 flex flex-col gap-1.5">
          <p className="panel-label mb-0">FRAME SIZE</p>
          <div className="flex gap-1 mb-1">
            {[2, 4].map(mult => {
              const s = baseUnit * mult
              return (
                <button
                  key={mult}
                  onClick={() => setTileSize(s)}
                  className={`flex-1 py-1 text-[10px] border transition-colors
                    ${tileSize === s
                      ? 'border-pixel-amber text-pixel-amber-bright bg-pixel-amber/10'
                      : 'border-ink-700 text-ink-500 hover:border-ink-500'}`}
                >
                  ×{mult} {s}
                </button>
              )
            })}
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full py-2.5 text-[11px] font-bold tracking-widest uppercase
              bg-pixel-green text-ink-950 hover:bg-pixel-green-dim
              disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {isGenerating ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-2.5 h-2.5 border-2 border-ink-950 border-t-transparent rounded-full animate-spin" />
                GENERATING…
              </span>
            ) : `✦ GENERATE ${currentEffect.label}`}
          </button>
        </div>

        {/* Export */}
        {result && (
          <>
            <div className="panel-divider mx-3" />
            <div className="px-3 pb-3 flex flex-col gap-1">
              <button
                onClick={() => onExtractPalette(result.frames[0])}
                className="w-full py-1.5 text-[10px] border border-pixel-amber text-pixel-amber-bright
                  hover:bg-pixel-amber/10 transition-colors"
              >
                ↑ SET AS PALETTE
              </button>
              <button
                onClick={() => downloadPng(result.grid_sheet, `${effectType}_grid.png`)}
                className="w-full py-1.5 text-[10px] border border-ink-700 text-ink-500
                  hover:border-ink-500 hover:text-ink-300 transition-colors"
              >
                ↓ GRID SHEET PNG
              </button>
              <button
                onClick={() => downloadPng(result.strip, `${effectType}_strip.png`)}
                className="w-full py-1.5 text-[10px] border border-ink-700 text-ink-500
                  hover:border-ink-500 hover:text-ink-300 transition-colors"
              >
                ↓ STRIP PNG
              </button>
              <button
                onClick={handleExportAll}
                className="w-full py-1.5 text-[10px] border border-ink-700 text-ink-500
                  hover:border-ink-500 hover:text-ink-300 transition-colors"
              >
                ↓ ALL FRAMES + MANIFEST (ZIP)
              </button>
            </div>
          </>
        )}
      </aside>

      {/* ── Main area ───────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto p-4 bg-ink-950">

        {!result && !isGenerating && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <p className="panel-label mb-2">NO VFX YET</p>
              <p className="text-[10px] text-ink-700 leading-relaxed">
                SELECT AN EFFECT TYPE AND CLICK GENERATE.<br />
                ONE CALL → MULTI-FRAME VFX SHEET.
              </p>
            </div>
          </div>
        )}

        {isGenerating && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center flex flex-col items-center gap-4">
              <div className="w-8 h-8 border-2 border-pixel-green border-t-transparent rounded-full animate-spin" />
              <p className="panel-label">GENERATING {effectType.toUpperCase()} VFX…</p>
              <p className="text-[10px] text-ink-600">
                {currentEffect.frames} frames · Gemini Flash Image
              </p>
            </div>
          </div>
        )}

        {result && !isGenerating && (
          <div className="flex gap-6 flex-wrap">

            {/* Animation player */}
            <div className="flex flex-col gap-3">
              <p className="panel-label">
                {result.manifest.effect.toUpperCase()} · {result.manifest.frame_count} FRAMES · {result.manifest.fps} FPS
                {!result.manifest.loop && ' · ONE-SHOT'}
              </p>

              <div
                className="checker border border-ink-700 overflow-hidden"
                style={{ width: 192, height: 192 }}
              >
                <img
                  src={`data:image/png;base64,${result.frames[playFrame]}`}
                  alt={`frame ${playFrame}`}
                  className="w-full h-full object-contain"
                  style={{ imageRendering: 'pixelated' }}
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPlaying(p => !p)}
                  className="px-3 py-1 text-[11px] border border-ink-700 text-ink-400
                    hover:border-ink-500 hover:text-ink-200 transition-colors"
                >
                  {isPlaying ? '⏸ PAUSE' : '▶ PLAY'}
                </button>
                <span className="text-[10px] text-ink-600">
                  {playFrame + 1} / {result.manifest.frame_count}
                </span>
              </div>

              <div>
                <p className="panel-label mb-1.5">FRAMES</p>
                <div className="flex gap-1 flex-wrap">
                  {result.frames.map((b64, i) => (
                    <button
                      key={i}
                      onClick={() => { setIsPlaying(false); setPlayFrame(i) }}
                      className={`checker overflow-hidden border transition-colors
                        ${playFrame === i ? 'border-pixel-amber' : 'border-ink-700 hover:border-ink-500'}`}
                      style={{ width: 48, height: 48 }}
                    >
                      <img
                        src={`data:image/png;base64,${b64}`}
                        alt={`frame ${i}`}
                        className="w-full h-full object-contain"
                        style={{ imageRendering: 'pixelated' }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Grid sheet + strip */}
            <div className="flex flex-col gap-3">
              <p className="panel-label">GRID SHEET ({result.manifest.cols}×{result.manifest.rows})</p>
              <div className="checker border border-ink-700 inline-block">
                <img
                  src={`data:image/png;base64,${result.grid_sheet}`}
                  alt="grid sheet"
                  style={{ imageRendering: 'pixelated', display: 'block', maxWidth: 320 }}
                />
              </div>

              <p className="panel-label">HORIZONTAL STRIP</p>
              <div className="checker border border-ink-700 inline-block">
                <img
                  src={`data:image/png;base64,${result.strip}`}
                  alt="strip"
                  style={{ imageRendering: 'pixelated', display: 'block', maxWidth: 400 }}
                />
              </div>
            </div>
          </div>
        )}
      </main>

      <Toast toasts={toasts} onDismiss={id => setToasts(t => t.filter(x => x.id !== id))} />
    </div>
  )
}
