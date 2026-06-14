import { useState, useCallback } from 'react'

export interface PropsHistoryProp {
  name: string
  category: string
  description: string
  imageB64: string
}

export interface PropsHistoryEntry {
  id: string
  timestamp: string
  biome: string
  styleKey: string
  props: PropsHistoryProp[]
}

const STORAGE_KEY = 'props_history'
const MAX_ENTRIES = 5

function load(): PropsHistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function persist(entries: PropsHistoryEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // 空間不足時移除最舊一筆再重試
    const trimmed = entries.slice(1)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed)) } catch { /* 放棄 */ }
  }
}

export function usePropsHistory() {
  const [entries, setEntries] = useState<PropsHistoryEntry[]>(load)

  const addEntry = useCallback((biome: string, styleKey: string, props: PropsHistoryProp[]) => {
    setEntries(prev => {
      const next = [
        {
          id: Date.now().toString(),
          timestamp: new Date().toLocaleString('zh-TW'),
          biome,
          styleKey,
          props,
        },
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
