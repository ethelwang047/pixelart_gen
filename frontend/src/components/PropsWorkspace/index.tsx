import { useState, useCallback } from 'react'
import JSZip from 'jszip'
import { generateProps, rerollProp, friendlyError } from '../../api'
import Toast, { ToastItem, ToastType } from '../Toast'
import { usePropsHistory, PropsHistoryEntry } from '../../hooks/usePropsHistory'

interface PropsWorkspaceProps {
  lockedPalette?: string[]
  onExtractPalette: (imageB64: string) => Promise<void>
  propPx?: number
  onAddToGallery?: (type: 'sprite' | 'prop' | 'tile' | 'anim', name: string, imageB64: string) => void
}

interface Prop {
  id: string
  name: string
  description: string
  category: string
  imageB64: string
}

const BIOME_PRESETS = [
  { key: 'forest glade',  label: 'FOREST' },
  { key: 'glowing cave',  label: 'CAVE' },
  { key: 'desert oasis',  label: 'DESERT' },
  { key: 'snowy peaks',   label: 'SNOW' },
  { key: 'volcanic',      label: 'VOLCANO' },
  { key: 'jungle ruins',  label: 'JUNGLE' },
  { key: 'misty swamp',   label: 'SWAMP' },
  { key: 'candy land',    label: 'CANDY' },
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

function downloadJson(obj: unknown, filename: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }))
  a.download = filename; a.click()
}

function resizeAndDownload(b64: string, size: number, filename: string) {
  const img = new Image()
  img.onload = () => {
    const c = document.createElement('canvas')
    c.width = size; c.height = size
    const ctx = c.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(img, 0, 0, size, size)
    c.toBlob(blob => {
      const url = URL.createObjectURL(blob!)
      const a = document.createElement('a')
      a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }
  img.src = `data:image/png;base64,${b64}`
}

export default function PropsWorkspace({ lockedPalette, onExtractPalette, propPx = 8, onAddToGallery }: PropsWorkspaceProps) {
  const [props, setProps] = useState<Prop[]>([])
  const [biome, setBiome] = useState('forest glade')
  const [customBiome, setCustomBiome] = useState('')
  const [styleKey, setStyleKey] = useState('stardew')
  const [model, setModel] = useState('imagen-4.0-generate-001')
  const [isGenerating, setIsGenerating] = useState(false)
  const [rerollingId, setRerollingId] = useState<string | null>(null)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const { entries: historyEntries, addEntry: addHistoryEntry, removeEntry: removeHistoryEntry } = usePropsHistory()

  const activeBiome = customBiome.trim() || biome

  const addToast = useCallback((msg: string, type: ToastType = 'error') => {
    const id = Date.now()
    setToasts(t => [...t, { id, message: msg, type }])
  }, [])

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true)
    try {
      const existing = props.map(p => p.name)
      const res = await generateProps({ biome: activeBiome, style_key: styleKey, existing_names: existing, model, locked_palette: lockedPalette })
      const newProps = (res as { props: Array<{ name: string; description: string; category: string; image_base64: string }> }).props.map(p => ({
        id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
        name: p.name,
        description: p.description,
        category: p.category,
        imageB64: p.image_base64,
      }))
      newProps.forEach(p => onAddToGallery?.('prop', p.name, p.imageB64))
      setProps(prev => {
        const next = [...prev, ...newProps]
        addHistoryEntry(activeBiome, styleKey, next.map(p => ({
          name: p.name, category: p.category, description: p.description, imageB64: p.imageB64,
        })))
        return next
      })
    } catch (e) {
      addToast(friendlyError(e))
    } finally {
      setIsGenerating(false)
    }
  }, [activeBiome, styleKey, model, props, addToast, addHistoryEntry])

  const handleReroll = useCallback(async (prop: Prop) => {
    setRerollingId(prop.id)
    try {
      const res = await rerollProp({ name: prop.name, description: prop.description, biome: activeBiome, style_key: styleKey, model, locked_palette: lockedPalette })
      const newB64 = (res as { image_base64: string }).image_base64
      onAddToGallery?.('prop', prop.name, newB64)
      setProps(prev => prev.map(p => p.id === prop.id ? { ...p, imageB64: newB64 } : p))
    } catch (e) {
      addToast(friendlyError(e))
    } finally {
      setRerollingId(null)
    }
  }, [activeBiome, styleKey, model, addToast])

  const handleLoadHistory = useCallback((entry: PropsHistoryEntry) => {
    setProps(entry.props.map((p, i) => ({
      ...p,
      id: `h_${entry.id}_${i}`,
    })))
    setBiome(entry.biome)
    setStyleKey(entry.styleKey)
    setCustomBiome('')
  }, [])

  const handleExportAll = useCallback(async () => {
    const zip = new JSZip()
    const b64ToBytes = (b64: string) => Uint8Array.from(atob(b64), c => c.charCodeAt(0))
    props.forEach(p => zip.file(`${p.name}.png`, b64ToBytes(p.imageB64)))
    zip.file('props_manifest.json', JSON.stringify(
      props.map((p, i) => ({ index: i, name: p.name, description: p.description, category: p.category, file: `${p.name}.png` })),
      null, 2,
    ))
    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'props.zip'; a.click()
    URL.revokeObjectURL(url)
  }, [props])

  const handleExportGameSize = useCallback(() => {
    props.forEach(p => resizeAndDownload(p.imageB64, propPx, `${p.name}_${propPx}x${propPx}.png`))
    downloadJson(
      props.map((p, i) => ({
        index: i, name: p.name, description: p.description,
        category: p.category, file: `${p.name}_${propPx}x${propPx}.png`,
        size: propPx,
      })),
      `props_manifest_${propPx}px.json`,
    )
  }, [props, propPx])

  return (
    <div className="flex flex-1 overflow-hidden font-mono">
      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside className="w-56 flex-shrink-0 border-r border-ink-700 flex flex-col gap-0 overflow-y-auto bg-ink-900">
        <div className="p-3">
          <div className="flex items-baseline justify-between mb-2">
            <p className="panel-label">BIOME</p>
            <span className="text-[10px] text-pixel-green opacity-60">中文 OK</span>
          </div>
          <input
            className="w-full bg-ink-950 border border-ink-700 text-ink-300 text-[12px] font-mono
              p-1.5 focus:outline-none focus:border-pixel-green placeholder:text-ink-600 mb-1"
            placeholder="e.g. 鬼魅森林 / haunted ruins"
            value={customBiome}
            onChange={e => setCustomBiome(e.target.value)}
          />
          <p className="text-[10px] text-ink-700 mb-2">自訂或選擇下方預設</p>
          <div className="grid grid-cols-2 gap-1">
            {BIOME_PRESETS.map(b => (
              <button
                key={b.key}
                onClick={() => { setBiome(b.key); setCustomBiome('') }}
                className={`text-[11px] py-1 border transition-colors
                  ${biome === b.key && !customBiome
                    ? 'border-pixel-green text-pixel-green bg-pixel-green/10'
                    : 'border-ink-700 text-ink-500 hover:border-ink-500'}`}
              >
                {b.label}
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
                className={`text-[11px] py-1 px-2 border text-left transition-colors
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
          <p className="panel-label mb-2">IMAGE MODEL</p>
          <div className="flex gap-1">
            {[
              { value: 'imagen-4.0-generate-001',      label: 'QUALITY' },
              { value: 'imagen-4.0-fast-generate-001', label: 'FAST'    },
            ].map(m => (
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
        </div>

        <div className="panel-divider mx-3" />

        <div className="px-3 pb-3 flex flex-col gap-1.5">
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full py-2 text-[11px] font-bold tracking-widest uppercase
              bg-pixel-green text-ink-950 hover:bg-pixel-green-dim
              disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {isGenerating ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-2 h-2 border-2 border-ink-950 border-t-transparent rounded-full animate-spin" />
                GENERATING…
              </span>
            ) : `✦ ADD MORE  (${props.length})`}
          </button>

          {props.length > 0 && (
            <>
              <button
                onClick={() => onExtractPalette(props[0].imageB64)}
                className="w-full py-1.5 text-[11px] border border-pixel-amber text-pixel-amber-bright
                  hover:bg-pixel-amber/10 transition-colors"
              >
                ↑ SET AS PALETTE
              </button>
              <button
                onClick={handleExportAll}
                className="w-full py-1.5 text-[11px] border border-ink-700 text-ink-500
                  hover:border-ink-500 hover:text-ink-300 transition-colors"
              >
                ↓ EXPORT ZIP
              </button>
              <button
                onClick={handleExportGameSize}
                className="w-full py-1.5 text-[11px] border border-ink-700 text-ink-500
                  hover:border-ink-500 hover:text-ink-300 transition-colors"
              >
                ↓ EXPORT {propPx}×{propPx}px + MANIFEST
              </button>
            </>
          )}
        </div>

        {historyEntries.length > 0 && (
          <>
            <div className="panel-divider mx-3" />
            <div className="px-3 pb-3">
              <p className="panel-label mb-2">HISTORY</p>
              <div className="flex flex-col gap-1.5">
                {historyEntries.map(entry => (
                  <div key={entry.id} className="relative group/hist border border-ink-700 hover:border-ink-500 transition-colors">
                    <button
                      onClick={() => handleLoadHistory(entry)}
                      className="w-full text-left p-1.5"
                    >
                      <div className="text-[10px] text-ink-400 group-hover/hist:text-ink-200 mb-1 uppercase truncate pr-4">
                        {entry.biome} · {entry.props.length}
                      </div>
                      <div className="flex gap-0.5 mb-1">
                        {entry.props.slice(0, 5).map((p, i) => (
                          <div key={i} className="w-7 h-7 checker overflow-hidden flex-shrink-0">
                            <img
                              src={`data:image/png;base64,${p.imageB64}`}
                              alt={p.name}
                              className="w-full h-full object-contain"
                              style={{ imageRendering: 'pixelated' }}
                            />
                          </div>
                        ))}
                      </div>
                      <div className="text-[9px] text-ink-700">{entry.timestamp}</div>
                    </button>
                    <button
                      onClick={() => removeHistoryEntry(entry.id)}
                      className="absolute top-1 right-1 text-[10px] text-ink-700 hover:text-pixel-red
                        opacity-0 group-hover/hist:opacity-100 transition-all leading-none px-0.5"
                      title="刪除記錄"
                    >✕</button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </aside>

      {/* ── Prop grid ───────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto p-3 bg-ink-950">
        {props.length === 0 && !isGenerating ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <p className="panel-label mb-2">NO PROPS YET</p>
              <p className="text-[11px] text-ink-700">SELECT A BIOME AND CLICK ADD MORE</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {props.map(prop => (
              <PropCard
                key={prop.id}
                prop={prop}
                isRerolling={rerollingId === prop.id}
                onReroll={() => handleReroll(prop)}
                onDelete={() => setProps(prev => prev.filter(p => p.id !== prop.id))}
                onDownload={() => downloadPng(prop.imageB64, `${prop.name}.png`)}
              />
            ))}
            {isGenerating && (
              <div className="w-28 h-36 border border-ink-700 checker flex items-center justify-center flex-shrink-0">
                <span className="inline-block w-4 h-4 border-2 border-pixel-green border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        )}
      </main>

      <Toast toasts={toasts} onDismiss={id => setToasts(t => t.filter(x => x.id !== id))} />
    </div>
  )
}

function PropCard({ prop, isRerolling, onReroll, onDelete, onDownload }: {
  prop: Prop; isRerolling: boolean
  onReroll: () => void; onDelete: () => void; onDownload: () => void
}) {
  return (
    <div className="flex flex-col gap-1 flex-shrink-0 w-28">
      <div className="relative group w-28 h-28 border border-ink-700 checker overflow-hidden">
        {isRerolling ? (
          <div className="w-full h-full flex items-center justify-center">
            <span className="inline-block w-4 h-4 border-2 border-pixel-green border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <img
              src={`data:image/png;base64,${prop.imageB64}`}
              alt={prop.name}
              className="w-full h-full object-contain p-1"
              style={{ imageRendering: 'pixelated' }}
            />
            <div className="absolute inset-0 bg-ink-950/80 opacity-0 group-hover:opacity-100
              transition-opacity flex flex-col items-center justify-center gap-1">
              <button onClick={onReroll}
                className="w-16 py-0.5 text-[11px] bg-pixel-green text-ink-950 font-bold">↻ REROLL</button>
              <button onClick={onDownload}
                className="w-16 py-0.5 text-[11px] border border-ink-600 text-ink-400 hover:border-ink-400">↓ ORIG</button>
              <button onClick={onDelete}
                className="w-16 py-0.5 text-[11px] border border-ink-700 text-ink-600 hover:text-pixel-red hover:border-pixel-red">✕ DEL</button>
            </div>
          </>
        )}
      </div>
      <span className="text-[11px] text-ink-500 text-center truncate" title={prop.name}>{prop.name}</span>
      <span className="text-[8px] text-ink-700 text-center truncate">{prop.category}</span>
    </div>
  )
}
