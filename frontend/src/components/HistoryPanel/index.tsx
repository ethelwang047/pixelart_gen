import { HistoryEntry } from '../../hooks/useHistory'

interface Props {
  entries: HistoryEntry[]
  onLoad: (entry: HistoryEntry) => void
  onRemove: (id: string) => void
}

export default function HistoryPanel({ entries, onLoad, onRemove }: Props) {
  if (entries.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <p className="panel-label">HISTORY  <span className="normal-case text-ink-700">({entries.length})</span></p>
      <div className="grid grid-cols-3 gap-1">
        {entries.map(entry => (
          <div
            key={entry.id}
            className="relative group cursor-pointer"
            onClick={() => onLoad(entry)}
            title={entry.prompt}
          >
            <img
              src={`data:image/png;base64,${entry.pixelImage}`}
              alt={entry.prompt}
              className="w-full aspect-square object-contain checker border border-ink-700
                group-hover:border-pixel-green transition-colors"
              style={{ imageRendering: 'pixelated' }}
            />
            <button
              onClick={e => { e.stopPropagation(); onRemove(entry.id) }}
              className="absolute top-0 right-0 w-4 h-4 bg-ink-950/90 text-[11px]
                text-ink-500 hover:text-pixel-red hidden group-hover:flex items-center justify-center"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
