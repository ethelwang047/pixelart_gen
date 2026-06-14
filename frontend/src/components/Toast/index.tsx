import { useEffect } from 'react'

export type ToastType = 'error' | 'warning' | 'info'

export interface ToastItem {
  id: number
  message: string
  type: ToastType
}

interface Props {
  toasts: ToastItem[]
  onDismiss: (id: number) => void
}

const ACCENT: Record<ToastType, string> = {
  error:   'border-l-2 border-pixel-red   text-ink-300',
  warning: 'border-l-2 border-pixel-amber text-ink-300',
  info:    'border-l-2 border-ink-500     text-ink-400',
}

const PREFIX: Record<ToastType, string> = {
  error:   'ERR',
  warning: 'WARN',
  info:    'INFO',
}

function ToastBubble({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), 4000)
    return () => clearTimeout(t)
  }, [toast.id, onDismiss])

  return (
    <div className={`flex items-start gap-2 px-3 py-2 bg-ink-900 border border-ink-700
      min-w-64 max-w-xs animate-fade-in text-[12px] font-mono ${ACCENT[toast.type]}`}>
      <span className="font-bold flex-shrink-0 text-ink-500">[{PREFIX[toast.type]}]</span>
      <span className="flex-1 leading-relaxed">{toast.message}</span>
      <button onClick={() => onDismiss(toast.id)} className="flex-shrink-0 text-ink-600 hover:text-ink-300">✕</button>
    </div>
  )
}

export default function Toast({ toasts, onDismiss }: Props) {
  if (toasts.length === 0) return null
  return (
    <div className="fixed bottom-7 right-4 flex flex-col gap-1 z-50">
      {toasts.map(t => <ToastBubble key={t.id} toast={t} onDismiss={onDismiss} />)}
    </div>
  )
}
