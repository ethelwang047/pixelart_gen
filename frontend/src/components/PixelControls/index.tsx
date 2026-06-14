import BlockSizeSlider from './BlockSizeSlider'

interface Props {
  pixelWidth: number
  numColors: number
  scaleResult: number
  transparentBg: boolean
  isPixelating: boolean
  disabled: boolean
  onPixelWidthChange: (v: number) => void
  onNumColorsChange: (v: number) => void
  onScaleResultChange: (v: number) => void
  onTransparentBgChange: (v: boolean) => void
}

export default function PixelControls({
  pixelWidth, numColors, scaleResult, transparentBg,
  isPixelating, disabled,
  onPixelWidthChange, onNumColorsChange, onScaleResultChange, onTransparentBgChange,
}: Props) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="panel-label">PIXEL CONTROLS</p>
        {isPixelating && (
          <span className="text-[11px] text-pixel-amber flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 border border-pixel-amber border-t-transparent rounded-full animate-spin" />
            PROCESSING
          </span>
        )}
      </div>

      <BlockSizeSlider
        label="PIXEL WIDTH  [ / ]"
        value={pixelWidth}
        min={2}
        max={32}
        disabled={disabled}
        onChange={onPixelWidthChange}
      />

      <BlockSizeSlider
        label="COLOR COUNT"
        value={numColors}
        min={4}
        max={64}
        disabled={disabled}
        onChange={onNumColorsChange}
      />

      <div className="flex flex-col gap-1">
        <span className="text-[11px] text-ink-500">SCALE RESULT</span>
        <div className="flex gap-1">
          {[1, 2, 4, 8].map(v => (
            <button
              key={v}
              disabled={disabled}
              onClick={() => onScaleResultChange(v)}
              className={`flex-1 py-1 text-[11px] font-bold border transition-colors
                ${scaleResult === v
                  ? 'border-pixel-amber text-pixel-amber-bright bg-pixel-amber/10'
                  : 'border-ink-700 text-ink-500 hover:border-ink-500'}
                disabled:opacity-25 disabled:cursor-not-allowed`}
            >
              {v}×
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[11px] text-ink-500">TRANSPARENT BG</span>
        <button
          disabled={disabled}
          onClick={() => onTransparentBgChange(!transparentBg)}
          className={`relative w-9 h-4 transition-colors border
            ${transparentBg ? 'bg-pixel-green/20 border-pixel-green' : 'bg-ink-800 border-ink-600'}
            disabled:opacity-25 disabled:cursor-not-allowed`}
        >
          <span className={`absolute top-0.5 w-3 h-3 transition-transform
            ${transparentBg ? 'translate-x-4 bg-pixel-green' : 'translate-x-0.5 bg-ink-500'}`}
          />
        </button>
      </div>
    </div>
  )
}
