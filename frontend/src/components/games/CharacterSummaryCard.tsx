'use client'

import type { PlayerStats } from '@/lib/supabase/players'

const ABILITY_ABBRS: { key: keyof PlayerStats; abbr: string }[] = [
  { key: 'str', abbr: 'STR' },
  { key: 'dex', abbr: 'DEX' },
  { key: 'con', abbr: 'CON' },
  { key: 'int', abbr: 'INT' },
  { key: 'wis', abbr: 'WIS' },
  { key: 'cha', abbr: 'CHA' },
]

type Props = {
  characterName: string
  characterClass: string
  hpMax: number
  stats: PlayerStats
  onEdit: () => void
}

export function CharacterSummaryCard({
  characterName,
  characterClass,
  hpMax,
  stats,
  onEdit,
}: Props) {
  return (
    <div data-testid="character-summary-card" className="space-y-4">
      <div className="border-b border-amber-900/20 pb-2">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
            Character Ready
          </span>
        </div>
      </div>

      <div>
        <h3 className="text-2xl font-bold tracking-tight text-amber-100">
          {characterName}
        </h3>
        <div className="mt-1 flex items-center gap-3 text-sm text-zinc-400">
          <span className="font-medium text-amber-400/80">{characterClass}</span>
          <span className="text-zinc-600">&middot;</span>
          <span>
            HP{' '}
            <span className="font-semibold text-emerald-400">{hpMax}</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-6 gap-2">
        {ABILITY_ABBRS.map(({ key, abbr }) => {
          const value = stats[key]
          const mod = Math.floor((value - 10) / 2)
          return (
            <div
              key={key}
              className="rounded-md border border-zinc-700/50 bg-zinc-800/30 py-2 text-center"
            >
              <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                {abbr}
              </div>
              <div className="mt-0.5 text-lg font-bold text-zinc-100">{value}</div>
              <div className="text-[10px] text-zinc-500">
                {mod >= 0 ? '+' : ''}
                {mod}
              </div>
            </div>
          )
        })}
      </div>

      <button
        onClick={onEdit}
        data-testid="edit-character-button"
        className="w-full rounded-md border border-zinc-700 bg-zinc-800/50 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-amber-700/50 hover:text-amber-200"
      >
        Edit Character
      </button>
    </div>
  )
}
