import { useState, useCallback } from 'react'

export interface HistoryEntry {
  id: string
  timestamp: string
  prompt: string
  aspectRatio: string
  pixelImage: string  // base64
}

const STORAGE_KEY = 'pixelart_history'
const MAX_ENTRIES = 10

function load(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function persist(entries: HistoryEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // localStorage 空間不足時，移除最舊的一筆再重試
    const trimmed = entries.slice(1)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed)) } catch { /* 放棄 */ }
  }
}

export function useHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>(load)

  const addEntry = useCallback((data: Omit<HistoryEntry, 'id' | 'timestamp'>) => {
    setEntries(prev => {
      const next = [
        { ...data, id: Date.now().toString(), timestamp: new Date().toLocaleString('zh-TW') },
        ...prev,
      ].slice(0, MAX_ENTRIES)
      persist(next)
      return next
    })
  }, [])

  const removeEntry = useCallback((id: string) => {
    setEntries(prev => {
      const next = prev.filter(e => e.id !== id)
      persist(next)
      return next
    })
  }, [])

  return { entries, addEntry, removeEntry }
}
