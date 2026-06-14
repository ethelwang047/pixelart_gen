import { useState } from 'react'
import type { BaseUnit, GameUnit } from '../../hooks/useGameUnit'

interface Props { gameUnit: GameUnit }

const UNITS: BaseUnit[] = [8, 16, 32]

export default function GameSettings({ gameUnit }: Props) {
  const [open, setOpen] = useState(false)
  const { baseUnit, tilePx, charW, charH, propPx, animPx, setBaseUnit } = gameUnit

  const rows = [
    { label: 'TILE',  w: tilePx,  h: tilePx  },
    { label: 'CHAR',  w: charW,   h: charH   },
    { label: 'PROPS', w: propPx,  h: propPx  },
    { label: 'ANIM',  w: animPx,  h: animPx  },
  ]

  return (
    <div className="relative flex-shrink-0">
      <button
        onClick={() => setOpen(v => !v)}
        className={`px-2 py-0.5 text-[11px] border font-mono transition-colors
          ${open
            ? 'border-pixel-amber text-pixel-amber-bright bg-pixel-amber/10'
            : 'border-ink-700 text-ink-500 hover:border-ink-500 hover:text-ink-300'}`}
      >
        {baseUnit}PX ▾
      </button>

      {open && (
        <>
          {/* 點外部關閉 */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-ink-900 border border-ink-700
            shadow-xl p-3 flex flex-col gap-3 min-w-[160px]">
            {/* Unit 選擇 */}
            <div>
              <p className="panel-label mb-1.5">BASE UNIT</p>
              <div className="flex gap-1">
                {UNITS.map(u => (
                  <button
                    key={u}
                    onClick={() => setBaseUnit(u)}
                    className={`flex-1 py-1 text-[11px] border transition-colors
                      ${u === baseUnit
                        ? 'border-pixel-amber text-pixel-amber-bright bg-pixel-amber/10'
                        : 'border-ink-700 text-ink-500 hover:border-ink-500'}`}
                  >
                    {u}px
                  </button>
                ))}
              </div>
            </div>

            {/* 尺寸預覽表 */}
            <div>
              <p className="panel-label mb-1.5">EXPORT SIZES</p>
              <table className="w-full text-[10px]">
                <tbody>
                  {rows.map(r => (
                    <tr key={r.label}>
                      <td className="text-ink-600 pr-3 pb-0.5">{r.label}</td>
                      <td className="text-ink-300 font-mono pb-0.5">{r.w} × {r.h}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
