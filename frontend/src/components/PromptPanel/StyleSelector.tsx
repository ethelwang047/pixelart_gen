const STYLES = [
  { key: 'stardew',    label: 'STARDEW',    desc: 'Cozy farming warmth' },
  { key: 'cave_story', label: 'CAVE STORY', desc: 'Retro 8-bit limited' },
  { key: 'undertale',  label: 'UNDERTALE',  desc: 'Simple bold outlines' },
  { key: 'rpg_map',    label: 'SNES RPG',   desc: 'Top-down FFVI era' },
  { key: 'sci_fi',     label: 'SCI-FI',     desc: 'Neon cyberpunk glow' },
  { key: 'horror',     label: 'HORROR',     desc: 'Dark desaturated' },
]

interface Props {
  value: string
  onChange: (key: string) => void
}

export default function StyleSelector({ value, onChange }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      {STYLES.map(s => (
        <button
          key={s.key}
          onClick={() => onChange(s.key)}
          className={`text-left px-2 py-1.5 border transition-colors flex items-baseline gap-2
            ${value === s.key
              ? 'border-pixel-green bg-pixel-green/10 text-pixel-green'
              : 'border-ink-700 text-ink-400 hover:border-ink-500 hover:text-ink-300'}`}
        >
          <span className="text-[12px] font-mono font-bold w-24 flex-shrink-0">{s.label}</span>
          <span className="text-[11px] text-ink-600 truncate">{s.desc}</span>
        </button>
      ))}
    </div>
  )
}
