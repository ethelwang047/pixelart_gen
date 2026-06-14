const TAGS = ['cozy farming', 'dark dungeon', 'sci-fi', 'forest', 'workshop']

interface Props {
  value: string
  onChange: (v: string) => void
}

export default function StyleTags({ value, onChange }: Props) {
  const selected = value ? value.split(', ').filter(Boolean) : []

  const toggle = (tag: string) => {
    const next = selected.includes(tag)
      ? selected.filter(t => t !== tag)
      : [...selected, tag]
    onChange(next.join(', '))
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {TAGS.map(tag => (
        <button
          key={tag}
          onClick={() => toggle(tag)}
          className={`px-2 py-0.5 rounded-full text-xs transition-colors
            ${selected.includes(tag)
              ? 'bg-amber-500 text-gray-900 font-medium'
              : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
        >
          {tag}
        </button>
      ))}
    </div>
  )
}
