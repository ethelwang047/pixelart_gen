import { useState, useCallback } from 'react'

const STORAGE_KEY = 'game_palette'

interface PaletteState {
  colors: string[]
  isLocked: boolean
}

const DEFAULT_STATE: PaletteState = { colors: [], isLocked: false }

function load(): PaletteState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PaletteState) : DEFAULT_STATE
  } catch {
    return DEFAULT_STATE
  }
}

function save(s: PaletteState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch { /* ignore */ }
}

export function usePalette() {
  const [state, setState] = useState<PaletteState>(load)

  const update = useCallback((next: PaletteState) => {
    setState(next)
    save(next)
  }, [])

  const setPalette = useCallback((colors: string[]) =>
    update({ colors, isLocked: true }), [update])

  const lockPalette = useCallback(() =>
    setState(s => { const n = { ...s, isLocked: true }; save(n); return n }), [])

  const unlockPalette = useCallback(() =>
    setState(s => { const n = { ...s, isLocked: false }; save(n); return n }), [])

  const clearPalette = useCallback(() =>
    update({ colors: [], isLocked: false }), [update])

  const removeColor = useCallback((index: number) =>
    setState(s => {
      const n = { ...s, colors: s.colors.filter((_, i) => i !== index) }
      save(n)
      return n
    }), [])

  const lockedPalette = state.isLocked && state.colors.length > 0
    ? state.colors
    : undefined

  return {
    colors: state.colors,
    isLocked: state.isLocked,
    lockedPalette,
    setPalette,
    lockPalette,
    unlockPalette,
    clearPalette,
    removeColor,
  }
}
