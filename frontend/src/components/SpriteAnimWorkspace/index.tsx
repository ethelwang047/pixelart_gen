import { useState, useCallback, useEffect, useRef } from 'react'
import { lockCharacter, generateSheet, friendlyError } from '../../api'
import Toast, { ToastItem, ToastType } from '../Toast'

interface SpriteAnimWorkspaceProps {
  lockedPalette?: string[]
  onExtractPalette: (imageB64: string) => Promise<void>
  baseUnit?: number
  onAddToGallery?: (type: 'sprite' | 'prop' | 'tile' | 'anim', name: string, imageB64: string) => void
}

interface SheetResult {
  frames: string[]
  grid_sheet: string
  strip: string
  manifest: {
    animation: string
    frame_count: number
    fps: number
    loop: boolean
    tile_size: number
    cols: number
    rows: number
  }
}

const CHARACTER_PRESETS = [
  { label: 'KNIGHT',   prompt: 'a medieval knight in silver plate armor with a sword' },
  { label: 'MAGE',     prompt: 'an old wizard in a blue starry robe holding a glowing staff' },
  { label: 'GOBLIN',   prompt: 'a sneaky green goblin with a small dagger and big ears' },
  { label: 'SLIME',    prompt: 'a round green slime creature with cute eyes' },
  { label: 'ENGINEER', prompt: 'a cheerful female engineer in overalls holding a wrench' },
]

const ANIMS = [
  { key: 'idle',   label: 'IDLE',  frames: 4, fps: 6  },
  { key: 'walk',   label: 'WALK',  frames: 6, fps: 10 },
  { key: 'run',    label: 'RUN',   frames: 6, fps: 12 },
  { key: 'attack', label: 'ATK',   frames: 4, fps: 12 },
  { key: 'hurt',   label: 'HURT',  frames: 2, fps: 10 },
  { key: 'death',  label: 'DEATH', frames: 4, fps: 8  },
]

const STYLE_LABELS: Record<string, string> = {
  stardew: 'STARDEW', cave_story: 'CAVE STORY',
  undertale: 'UNDERTALE', rpg_map: 'SNES RPG',
  sci_fi: 'SCI-FI', horror: 'HORROR',
}

const IMAGE_MODELS = [
  { value: 'imagen-4.0-generate-001',      label: 'QUALITY' },
  { value: 'imagen-4.0-fast-generate-001', label: 'FAST'    },
]

function downloadPng(b64: string, filename: string) {
  const a = document.createElement('a')
  a.href = `data:image/png;base64,${b64}`; a.download = filename; a.click()
}

function downloadJson(obj: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = filename; a.click()
}

export default function SpriteAnimWorkspace({ lockedPalette, onExtractPalette, baseUnit = 16, onAddToGallery }: SpriteAnimWorkspaceProps) {
  const [description, setDescription] = useState('')
  const [styleKey, setStyleKey] = useState('stardew')
  const [model, setModel] = useState('imagen-4.0-generate-001')
  const [character, setCharacter] = useState<string | null>(null)
  const [isLocking, setIsLocking] = useState(false)
  const [animation, setAnimation] = useState('idle')
  const [tileSize, setTileSize] = useState(baseUnit * 2)
  const [isGenerating, setIsGenerating] = useState(false)
  const [result, setResult] = useState<SheetResult | null>(null)
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

  const handleLock = useCallback(async () => {
    if (!description.trim()) return
    setIsLocking(true)
    setCharacter(null)
    setResult(null)
    try {
      const res = await lockCharacter({ description: description.trim(), style_key: styleKey, model, locked_palette: lockedPalette })
      setCharacter((res as { character_base64: string }).character_base64)
    } catch (e) {
      addToast(friendlyError(e))
    } finally {
      setIsLocking(false)
    }
  }, [description, styleKey, model, addToast])

  const handleGenerate = useCallback(async () => {
    if (!character) return
    setIsGenerating(true)
    setResult(null)
    setIsPlaying(true)
    try {
      const res = await generateSheet({
        anchor_image_base64: character,
        animation,
        style_key: styleKey,
        tile_size: tileSize,
        locked_palette: lockedPalette,
      })
      const sheetResult = res as SheetResult
      onAddToGallery?.('anim', animation, sheetResult.strip)
      setResult(sheetResult)
      setPlayFrame(0)
    } catch (e) {
      addToast(friendlyError(e))
    } finally {
      setIsGenerating(false)
    }
  }, [character, animation, styleKey, tileSize, addToast])

  const handleExportAll = useCallback(() => {
    if (!result) return
    result.frames.forEach((b64, i) =>
      downloadPng(b64, `${animation}_${String(i).padStart(2, '0')}.png`)
    )
    downloadPng(result.grid_sheet, `${animation}_grid.png`)
    downloadPng(result.strip, `${animation}_strip.png`)
    downloadJson(result.manifest, `${animation}_manifest.json`)
  }, [result, animation])

  const currentAnim = ANIMS.find(a => a.key === animation)!

  return (
    <div className="flex flex-1 overflow-hidden font-mono">

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside className="w-60 flex-shrink-0 border-r border-ink-700 flex flex-col overflow-y-auto bg-ink-900">

        {/* Character description */}
        <div className="p-3">
          <div className="flex items-baseline justify-between mb-1.5">
            <p className="panel-label">CHARACTER</p>
            <span className="text-[10px] text-pixel-green opacity-60">中文 OK</span>
          </div>
          <div className="flex flex-wrap gap-1 mb-1.5">
            {CHARACTER_PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => setDescription(p.prompt)}
                className="px-1.5 py-0.5 text-[10px] border border-ink-700 text-ink-500
                  hover:border-ink-500 hover:text-ink-300 transition-colors"
                title={p.prompt}
              >
                {p.label}
              </button>
            ))}
          </div>
          <textarea
            className="w-full bg-ink-950 border border-ink-700 text-ink-300 text-[11px] font-mono
              resize-none p-1.5 focus:outline-none focus:border-pixel-green
              placeholder:text-ink-600 leading-relaxed"
            rows={3}
            placeholder={'描述角色外觀，例如：\n身著紅甲的女騎士，手持長劍\na knight in red armor with a sword'}
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
          <p className="text-[10px] text-ink-700 mt-0.5">描述外觀即可，動作由動畫決定</p>
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

        {/* Model + Lock */}
        <div className="px-3 pb-3 flex flex-col gap-1.5">
          <p className="panel-label mb-0">IMAGE MODEL</p>
          <div className="flex gap-1">
            {IMAGE_MODELS.map(m => (
              <button
                key={m.value}
                onClick={() => setModel(m.value)}
                className={`flex-1 py-1 text-[11px] border transition-colors
                  ${model === m.value
                    ? 'border-pixel-amber text-pixel-amber-bright bg-pixel-amber/10'
                    : 'border-ink-700 text-ink-500 hover:border-ink-500'}`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <button
            onClick={handleLock}
            disabled={isLocking || !description.trim()}
            className="w-full py-2 text-[11px] font-bold tracking-widest
              border border-pixel-green text-pixel-green hover:bg-pixel-green/10
              disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {isLocking ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-2 h-2 border-2 border-pixel-green border-t-transparent rounded-full animate-spin" />
                LOCKING…
              </span>
            ) : '🔒 LOCK CHARACTER'}
          </button>

          {/* Anchor thumbnail + re-roll */}
          {character && (
            <div className="flex items-center gap-2">
              <div className="w-12 h-12 checker border border-pixel-green/50 flex-shrink-0 overflow-hidden">
                <img
                  src={`data:image/png;base64,${character}`}
                  alt="character anchor"
                  className="w-full h-full object-contain"
                  style={{ imageRendering: 'pixelated' }}
                />
              </div>
              <div className="flex flex-col gap-1 flex-1 min-w-0">
                <span className="text-[10px] text-pixel-green">LOCKED ✓</span>
                <button
                  onClick={handleLock}
                  disabled={isLocking}
                  className="text-[10px] border border-ink-700 text-ink-500
                    hover:border-ink-500 hover:text-ink-300 py-0.5 transition-colors"
                >
                  ↻ RE-ROLL
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="panel-divider mx-3" />

        {/* Animation selection */}
        <div className="px-3 pb-3">
          <p className="panel-label mb-1.5">ANIMATION</p>
          <div className="grid grid-cols-3 gap-1 mb-3">
            {ANIMS.map(a => (
              <button
                key={a.key}
                onClick={() => setAnimation(a.key)}
                className={`py-1 text-[10px] border transition-colors
                  ${animation === a.key
                    ? 'border-pixel-amber text-pixel-amber-bright bg-pixel-amber/10'
                    : 'border-ink-700 text-ink-500 hover:border-ink-500'}`}
              >
                {a.label}
              </button>
            ))}
          </div>

          <p className="panel-label mb-1.5">FRAME SIZE</p>
          <div className="flex gap-1 mb-3">
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
            disabled={isGenerating || !character}
            className="w-full py-2.5 text-[11px] font-bold tracking-widest uppercase
              bg-pixel-green text-ink-950 hover:bg-pixel-green-dim
              disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {isGenerating ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-2.5 h-2.5 border-2 border-ink-950 border-t-transparent rounded-full animate-spin" />
                GENERATING…
              </span>
            ) : `▶ GENERATE ${currentAnim.label}`}
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
                onClick={() => downloadPng(result.grid_sheet, `${animation}_grid.png`)}
                className="w-full py-1.5 text-[10px] border border-ink-700 text-ink-500
                  hover:border-ink-500 hover:text-ink-300 transition-colors"
              >
                ↓ GRID SHEET PNG
              </button>
              <button
                onClick={() => downloadPng(result.strip, `${animation}_strip.png`)}
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
                ↓ ALL FRAMES + MANIFEST
              </button>
            </div>
          </>
        )}
      </aside>

      {/* ── Main area ───────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto p-4 bg-ink-950">

        {/* Empty state */}
        {!character && !isLocking && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <p className="panel-label mb-2">NO CHARACTER LOCKED</p>
              <p className="text-[10px] text-ink-700 leading-relaxed">
                DESCRIBE YOUR CHARACTER AND CLICK LOCK CHARACTER.<br />
                THEN SELECT AN ANIMATION AND GENERATE THE SHEET.
              </p>
            </div>
          </div>
        )}

        {/* Locking spinner */}
        {isLocking && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center flex flex-col items-center gap-4">
              <div className="w-8 h-8 border-2 border-pixel-green border-t-transparent rounded-full animate-spin" />
              <p className="panel-label">GENERATING CHARACTER…</p>
            </div>
          </div>
        )}

        {/* Character locked, no sheet yet */}
        {character && !isGenerating && !result && (
          <div className="h-full flex flex-col items-center justify-center gap-4">
            <div className="w-32 h-32 checker border border-pixel-green/50 overflow-hidden">
              <img
                src={`data:image/png;base64,${character}`}
                alt="character anchor"
                className="w-full h-full object-contain"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
            <p className="panel-label text-pixel-green">CHARACTER LOCKED</p>
            <p className="text-[10px] text-ink-600">SELECT AN ANIMATION AND CLICK GENERATE</p>
          </div>
        )}

        {/* Generating spinner */}
        {isGenerating && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center flex flex-col items-center gap-4">
              <div className="w-8 h-8 border-2 border-pixel-green border-t-transparent rounded-full animate-spin" />
              <p className="panel-label">GENERATING {animation.toUpperCase()} ANIMATION…</p>
              <p className="text-[10px] text-ink-600">
                {currentAnim.frames} frames · {currentAnim.fps} FPS
              </p>
            </div>
          </div>
        )}

        {/* Result */}
        {result && !isGenerating && (
          <div className="flex gap-6 flex-wrap">

            {/* Animation player */}
            <div className="flex flex-col gap-3">
              <p className="panel-label">
                {result.manifest.animation.toUpperCase()} · {result.manifest.frame_count} FRAMES · {result.manifest.fps} FPS
                {!result.manifest.loop && ' · ONE-SHOT'}
              </p>

              {/* Player */}
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

              {/* Player controls */}
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

              {/* Frame strip */}
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

            {/* Grid sheet */}
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
