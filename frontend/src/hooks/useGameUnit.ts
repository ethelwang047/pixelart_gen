const STORAGE_KEY = 'game_base_unit'

export type BaseUnit = 8 | 16 | 32

export interface GameUnit {
  baseUnit: BaseUnit
  tilePx:  number   // 1×1 unit  — used by TileSet
  charW:   number   // 2×base    — character export width
  charH:   number   // 4×base    — character export height
  propPx:  number   // base/2    — small prop export size (min 4)
  animPx:  number   // 2×base    — ANIM square frame
  setBaseUnit: (u: BaseUnit) => void
}

function load(): BaseUnit {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw === '8' || raw === '32') return Number(raw) as BaseUnit
  return 16
}

import { useState, useCallback } from 'react'

export function useGameUnit(): GameUnit {
  const [baseUnit, setBaseUnitState] = useState<BaseUnit>(load)

  const setBaseUnit = useCallback((u: BaseUnit) => {
    localStorage.setItem(STORAGE_KEY, String(u))
    setBaseUnitState(u)
  }, [])

  return {
    baseUnit,
    tilePx:  baseUnit,
    charW:   baseUnit * 2,
    charH:   baseUnit * 4,
    propPx:  Math.max(4, baseUnit / 2),
    animPx:  baseUnit * 2,
    setBaseUnit,
  }
}
