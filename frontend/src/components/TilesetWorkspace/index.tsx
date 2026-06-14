import { useState, useCallback } from 'react'
import { generateTileset, friendlyError } from '../../api'
import Toast, { ToastItem, ToastType } from '../Toast'

interface TilesetWorkspaceProps {
  lockedPalette?: string[]
  onExtractPalette: (imageB64: string) => Promise<void>
  baseUnit?: number
  onAddToGallery?: (type: 'sprite' | 'prop' | 'tile' | 'anim', name: string, imageB64: string) => void
}

interface Tile {
  name: string
  row: number
  col: number
  image_base64: string
}

interface TilesetResult {
  tiles: Tile[]
  atlas_base64: string
  tile_size: number
  manifest: Record<string, unknown>
}

const MATERIAL_PRESETS = [
  'mossy stone', 'red brick', 'oak planks', 'desert sandstone',
  'snow & ice', 'volcanic rock', 'dark crystal', 'jungle earth',
  'marble', 'wooden logs', 'metal grate', 'coral reef',
  'obsidian', 'autumn leaves',
]

const STYLE_LABELS: Record<string, string> = {
  stardew: 'STARDEW', cave_story: 'CAVE STORY',
  undertale: 'UNDERTALE', rpg_map: 'SNES RPG',
  sci_fi: 'SCI-FI', horror: 'HORROR',
}

const TILE_LABELS: Record<string, string> = {
  body:      'Body',
  top_edge:  'Top',
  bot_edge:  'Bottom',
  left_edge: 'Left',
  right_edge:'Right',
  outer_tl:  '⌜ OTL',
  outer_tr:  '⌝ OTR',
  outer_bl:  '⌞ OBL',
  outer_br:  '⌟ OBR',
  inner_tl:  '⌟ ITL',
  inner_tr:  '⌞ ITR',
  inner_bl:  '⌝ IBL',
  inner_br:  '⌜ IBR',
}

// 4×4 display grid (null = empty cell)
const GRID: (string | null)[][] = [
  ['outer_tl', 'top_edge',  'outer_tr',  null],
  ['left_edge','body',       'right_edge', null],
  ['outer_bl', 'bot_edge',  'outer_br',  null],
  ['inner_tl', 'inner_tr',  'inner_bl',  'inner_br'],
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

export default function TilesetWorkspace({ lockedPalette, onExtractPalette, baseUnit = 16, onAddToGallery }: TilesetWorkspaceProps) {
  const [material, setMaterial] = useState('mossy stone')
  const [customMaterial, setCustomMaterial] = useState('')
  const [styleKey, setStyleKey] = useState('stardew')
  const [tileSize, setTileSize] = useState(baseUnit)
  const [isGenerating, setIsGenerating] = useState(false)
  const [result, setResult] = useState<TilesetResult | null>(null)
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const activeMaterial = customMaterial.trim() || material

  const addToast = useCallback((msg: string, type: ToastType = 'error') => {
    setToasts(t => [...t, { id: Date.now(), message: msg, type }])
  }, [])

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true)
    setResult(null)
    try {
      const res = await generateTileset({ material: activeMaterial, style_key: styleKey, tile_size: tileSize, locked_palette: lockedPalette })
      const tileResult = res as TilesetResult
      onAddToGallery?.('tile', activeMaterial, tileResult.atlas_base64)
      setResult(tileResult)
    } catch (e) {
      addToast(friendlyError(e))
    } finally {
      setIsGenerating(false)
    }
  }, [activeMaterial, styleKey, tileSize, addToast])

  const tileMap = result
    ? Object.fromEntries(result.tiles.map(t => [t.name, t]))
    : {}

  return (
    <div className="flex flex-1 overflow-hidden font-mono">

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside className="w-60 flex-shrink-0 border-r border-ink-700 flex flex-col overflow-y-auto bg-ink-900">
        <div className="p-3">
          <div className="flex items-baseline justify-between mb-2">
            <p className="panel-label">MATERIAL</p>
            <span className="text-[10px] text-pixel-green opacity-60">中文 OK</span>
          </div>
          <input
            className="w-full bg-ink-950 border border-ink-700 text-ink-300 text-[11px] font-mono
              p-1.5 focus:outline-none focus:border-pixel-green placeholder:text-ink-600 mb-1"
            placeholder="e.g. 龜裂石板 / cracked tile"
            value={customMaterial}
            onChange={e => setCustomMaterial(e.target.value)}
          />
          <p className="text-[10px] text-ink-700 mb-2">自訂或選擇下方預設</p>
          <div className="grid grid-cols-2 gap-1">
            {MATERIAL_PRESETS.map(m => (
              <button
                key={m}
                onClick={() => { setMaterial(m); setCustomMaterial('') }}
                className={`text-[10px] py-1 px-1.5 border text-left transition-colors truncate
                  ${material === m && !customMaterial
                    ? 'border-pixel-green text-pixel-green bg-pixel-green/10'
                    : 'border-ink-700 text-ink-500 hover:border-ink-500'}`}
                title={m}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="panel-divider mx-3" />

        <div className="px-3 pb-3">
          <p className="panel-label mb-2">ART STYLE</p>
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

        <div className="px-3 pb-3">
          <p className="panel-label mb-2">TILE SIZE</p>
          <div className="flex gap-1">
            {[1, 2, 4].map(mult => {
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
        </div>

        <div className="panel-divider mx-3" />

        <div className="px-3 pb-3 flex flex-col gap-1.5">
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
            ) : '⬛ GENERATE TILE SET'}
          </button>

          {result && (
            <>
              <button
                onClick={() => onExtractPalette(result.tiles[0]?.image_base64 ?? result.atlas_base64)}
                className="w-full py-1.5 text-[10px] border border-pixel-amber text-pixel-amber-bright
                  hover:bg-pixel-amber/10 transition-colors"
              >
                ↑ SET AS PALETTE
              </button>
              <button
                onClick={() => downloadPng(result.atlas_base64, `tileset_${activeMaterial.replace(/ /g,'_')}.png`)}
                className="w-full py-1.5 text-[10px] border border-ink-700 text-ink-500
                  hover:border-ink-500 hover:text-ink-300 transition-colors"
              >
                ↓ ATLAS PNG (with extrude)
              </button>
              <button
                onClick={() => {
                  result.tiles.forEach(t => downloadPng(t.image_base64, `${t.name}.png`))
                  downloadJson(result.manifest, 'tileset_manifest.json')
                }}
                className="w-full py-1.5 text-[10px] border border-ink-700 text-ink-500
                  hover:border-ink-500 hover:text-ink-300 transition-colors"
              >
                ↓ ALL TILES + MANIFEST
              </button>
            </>
          )}
        </div>
      </aside>

      {/* ── Main area ───────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto p-4 bg-ink-950">
        {!result && !isGenerating && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <p className="panel-label mb-2">NO TILE SET YET</p>
              <p className="text-[10px] text-ink-700 leading-relaxed">
                SELECT A MATERIAL AND CLICK GENERATE.<br />
                ONE AI CALL → 13 TILES (BODY + EDGES + CORNERS).
              </p>
            </div>
          </div>
        )}

        {isGenerating && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center flex flex-col items-center gap-4">
              <div className="w-8 h-8 border-2 border-pixel-green border-t-transparent rounded-full animate-spin" />
              <p className="panel-label">GENERATING {activeMaterial.toUpperCase()} TILES…</p>
              <p className="text-[10px] text-ink-600">Drawing template → Gemini restyle → Cutting 13 tiles</p>
            </div>
          </div>
        )}

        {result && (
          <div className="flex gap-6 flex-wrap">
            {/* 4×4 tile grid */}
            <div>
              <p className="panel-label mb-3">
                13 TILES — {activeMaterial.toUpperCase()} · {tileSize}px
              </p>
              <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(4, ${tileSize}px)` }}>
                {GRID.flat().map((name, i) => {
                  const tile = name ? tileMap[name] : null
                  return (
                    <div
                      key={i}
                      className={`relative flex flex-col items-center ${!name ? 'opacity-0 pointer-events-none' : ''}`}
                    >
                      <div
                        className="checker border border-ink-700 overflow-hidden"
                        style={{ width: tileSize, height: tileSize }}
                      >
                        {tile && (
                          <img
                            src={`data:image/png;base64,${tile.image_base64}`}
                            alt={name!}
                            className="w-full h-full object-contain"
                            style={{ imageRendering: 'pixelated' }}
                          />
                        )}
                      </div>
                      {name && (
                        <span className="text-[8px] text-ink-600 mt-0.5 text-center truncate w-full px-0.5">
                          {TILE_LABELS[name] ?? name}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Atlas preview */}
            <div>
              <p className="panel-label mb-3">ATLAS (with 2px extrude)</p>
              <div className="checker border border-ink-700 inline-block">
                <img
                  src={`data:image/png;base64,${result.atlas_base64}`}
                  alt="tileset atlas"
                  style={{ imageRendering: 'pixelated', display: 'block', maxWidth: 320 }}
                />
              </div>
            </div>

            {/* Platform preview mockup */}
            <PlatformPreview tileMap={tileMap} tileSize={tileSize} />
          </div>
        )}
      </main>

      <Toast toasts={toasts} onDismiss={id => setToasts(t => t.filter(x => x.id !== id))} />
    </div>
  )
}

function PlatformPreview({ tileMap, tileSize }: { tileMap: Record<string, Tile>; tileSize: number }) {
  // A simple "platform" layout: top row + body rows + bottom row
  const layout = [
    ['outer_tl','top_edge','top_edge','top_edge','outer_tr'],
    ['left_edge','body',    'body',    'body',    'right_edge'],
    ['left_edge','body',    'body',    'body',    'right_edge'],
    ['outer_bl','bot_edge', 'bot_edge','bot_edge','outer_br'],
  ]
  const scale = tileSize >= 64 ? 0.5 : 1

  return (
    <div>
      <p className="panel-label mb-3">PLATFORM PREVIEW</p>
      <div
        className="border border-ink-700 inline-block checker"
        style={{ padding: 8 }}
      >
        {layout.map((row, ri) => (
          <div key={ri} style={{ display: 'flex' }}>
            {row.map((name, ci) => {
              const tile = tileMap[name]
              const size = Math.round(tileSize * scale)
              return (
                <div
                  key={ci}
                  style={{ width: size, height: size, flexShrink: 0 }}
                >
                  {tile && (
                    <img
                      src={`data:image/png;base64,${tile.image_base64}`}
                      alt=""
                      style={{ width: size, height: size, imageRendering: 'pixelated', display: 'block' }}
                    />
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
