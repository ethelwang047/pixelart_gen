interface PaletteBarProps {
  colors: string[]
  isLocked: boolean
  onLockToggle: () => void
  onClearPalette: () => void
  onRemoveColor: (index: number) => void
}

export default function PaletteBar({
  colors, isLocked, onLockToggle, onClearPalette, onRemoveColor,
}: PaletteBarProps) {
  if (colors.length === 0 && !isLocked) return null

  return (
    <div className="flex items-center gap-1.5 flex-shrink min-w-0">
      {/* 色塊列 */}
      <div className="flex items-center gap-0.5 flex-wrap max-w-xs">
        {colors.map((color, i) => (
          <button
            key={i}
            title={`${color} — 點擊移除`}
            onClick={() => onRemoveColor(i)}
            className="group relative w-3.5 h-3.5 border border-ink-600 hover:border-red-400
              transition-colors flex-shrink-0"
            style={{ backgroundColor: color }}
          >
            <span className="absolute inset-0 flex items-center justify-center
              opacity-0 group-hover:opacity-100 text-[7px] font-bold
              text-white drop-shadow-[0_0_1px_black]">
              ✕
            </span>
          </button>
        ))}
      </div>

      {/* Lock / unlock */}
      <button
        onClick={onLockToggle}
        title={isLocked ? '調色盤已鎖定，點擊解鎖' : '調色盤未鎖定，點擊鎖定'}
        className={`text-[11px] px-1.5 py-0.5 border transition-colors flex-shrink-0
          ${isLocked
            ? 'border-pixel-green text-pixel-green bg-pixel-green/10 hover:bg-pixel-green/20'
            : 'border-ink-600 text-ink-500 hover:border-ink-400'}`}
      >
        {isLocked ? '🔒' : '🔓'}
      </button>

      {/* Clear */}
      {colors.length > 0 && (
        <button
          onClick={onClearPalette}
          title="清除調色盤"
          className="text-[10px] px-1.5 py-0.5 border border-ink-700 text-ink-600
            hover:border-red-500 hover:text-red-400 transition-colors flex-shrink-0"
        >
          ✕
        </button>
      )}
    </div>
  )
}
