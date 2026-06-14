interface Props {
  label: string
  value: number
  min: number
  max: number
  disabled?: boolean
  onChange: (v: number) => void
}

export default function BlockSizeSlider({ label, value, min, max, disabled, onChange }: Props) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-baseline">
        <span className="text-[11px] text-ink-500">{label}</span>
        <span className="text-[12px] text-pixel-green font-mono font-bold">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={e => onChange(Number(e.target.value))}
      />
    </div>
  )
}
