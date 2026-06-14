import { useRef } from 'react'
import StyleSelector from './StyleSelector'

const TEMPLATES = [
  { label: 'TOOLBOX', prompt: 'a small wooden toolbox with brass fittings, top-down view, slightly open lid' },
  { label: 'FIREPLACE', prompt: 'a stone fireplace with burning fire, side view, warm glowing embers' },
  { label: 'CHARACTER', prompt: 'a cheerful female engineer character, front-facing idle pose, holding a wrench' },
]

const ASPECT_RATIOS = [
  { value: '1:1', label: '1:1', hint: 'SPRITE' },
  { value: '3:4', label: '3:4', hint: 'CHAR' },
  { value: '4:3', label: '4:3', hint: 'SCENE' },
]

const IMAGE_MODELS = [
  { value: 'imagen-4.0-generate-001',      label: 'QUALITY' },
  { value: 'imagen-4.0-fast-generate-001', label: 'FAST'    },
]

interface Props {
  prompt: string
  styleKey: string
  aspectRatio: string
  model: string
  isGenerating: boolean
  onPromptChange: (v: string) => void
  onStyleKeyChange: (v: string) => void
  onAspectRatioChange: (v: string) => void
  onModelChange: (v: string) => void
  onGenerate: () => void
  onUpload: (b64: string) => void
}

export default function PromptPanel({
  prompt, styleKey, aspectRatio, model, isGenerating,
  onPromptChange, onStyleKeyChange, onAspectRatioChange, onModelChange, onGenerate, onUpload,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const b64 = (reader.result as string).split(',')[1]
      onUpload(b64)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  return (
    <div className="flex flex-col gap-0 p-3">

      {/* Prompt */}
      <div className="flex items-baseline justify-between mb-1.5">
        <p className="panel-label">PROMPT</p>
        <span className="text-[10px] text-pixel-green opacity-60">中文 OK</span>
      </div>
      <div className="flex gap-1 mb-1.5 flex-wrap">
        {TEMPLATES.map(t => (
          <button
            key={t.label}
            onClick={() => onPromptChange(t.prompt)}
            className="px-1.5 py-0.5 text-[13px] border border-ink-700 text-ink-500
              hover:border-ink-500 hover:text-ink-300 transition-colors"
            title={t.prompt}
          >
            {t.label}
          </button>
        ))}
      </div>

      <textarea
        className="w-full bg-ink-950 border border-ink-700 text-ink-300 text-[13px] font-mono
          resize-none p-2 focus:outline-none focus:border-pixel-green
          placeholder:text-ink-600 leading-relaxed"
        rows={5}
        maxLength={500}
        placeholder={'描述你的遊戲素材，例如：\na wooden crate with brass fittings, top-down\n木製工具箱配銅扣，俯視角'}
        value={prompt}
        onChange={e => onPromptChange(e.target.value)}
      />
      <div className="flex justify-between mt-0.5 mb-0.5">
        <span className="text-[10px] text-ink-700">角色 · 道具 · 場景 · 圖示皆可</span>
        <span className={`text-[10px] ${prompt.length > 450 ? 'text-pixel-amber-bright' : 'text-ink-700'}`}>
          {prompt.length}/500
        </span>
      </div>

      {/* Aspect ratio */}
      <div className="flex gap-1 mt-2">
        {ASPECT_RATIOS.map(ar => (
          <button
            key={ar.value}
            onClick={() => onAspectRatioChange(ar.value)}
            className={`flex-1 py-1.5 text-[13px] border transition-colors flex flex-col items-center
              ${aspectRatio === ar.value
                ? 'border-pixel-amber text-pixel-amber-bright bg-pixel-amber/10'
                : 'border-ink-700 text-ink-500 hover:border-ink-500'}`}
          >
            <span className="font-bold">{ar.label}</span>
            <span className="opacity-50">{ar.hint}</span>
          </button>
        ))}
      </div>

      {/* Generate */}
      <button
        onClick={onGenerate}
        disabled={isGenerating || !prompt.trim()}
        className="mt-2 w-full py-2.5 text-[12px] font-bold tracking-widest uppercase
          bg-pixel-green text-ink-950 hover:bg-pixel-green-dim
          disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        {isGenerating ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block w-2.5 h-2.5 border-2 border-ink-950 border-t-transparent rounded-full animate-spin" />
            GENERATING…
          </span>
        ) : 'GENERATE  ⌃↵'}
      </button>

      {/* Upload */}
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={isGenerating}
        className="mt-1.5 w-full py-1.5 text-[13px] tracking-widest uppercase
          border border-ink-700 text-ink-500 hover:border-ink-500 hover:text-ink-300
          disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        ↑ UPLOAD IMAGE
      </button>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      {/* Model */}
      <p className="panel-label mt-2 mb-1">IMAGE MODEL</p>
      <div className="flex gap-1">
        {IMAGE_MODELS.map(m => (
          <button
            key={m.value}
            onClick={() => onModelChange(m.value)}
            className={`flex-1 py-1 text-[11px] border transition-colors
              ${model === m.value
                ? 'border-pixel-amber text-pixel-amber-bright bg-pixel-amber/10'
                : 'border-ink-700 text-ink-500 hover:border-ink-500'}`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Style */}
      <div className="panel-divider" />
      <p className="panel-label mb-1.5">ART STYLE</p>
      <StyleSelector value={styleKey} onChange={onStyleKeyChange} />
    </div>
  )
}
