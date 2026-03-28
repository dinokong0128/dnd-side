'use client'

import type { PlayerStats } from '@/lib/game-data'

const ABILITY_LABELS: Record<string, string> = {
  str: 'STR',
  dex: 'DEX',
  con: 'CON',
  int: 'INT',
  wis: 'WIS',
  cha: 'CHA',
}

type CharacterSummaryCardProps = {
  characterName: string
  characterClass: string
  hpMax: number
  stats: PlayerStats
  onEdit: () => void
}

function getModifier(score: number): string {
  const mod = Math.floor((score - 10) / 2)
  return mod >= 0 ? `+${mod}` : `${mod}`
}

export function CharacterSummaryCard({
  characterName,
  characterClass,
  hpMax,
  stats,
  onEdit,
}: CharacterSummaryCardProps) {
  return (
    <div data-testid="character-summary-card" className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold tracking-widest text-emerald-500/80 uppercase">
            Character Ready
          </p>
          <h2 className="mt-1 font-serif text-xl tracking-wide text-amber-100">
            {characterName}
          </h2>
          <p className="mt-0.5 text-sm text-stone-400">
            {characterClass}
            <span className="mx-2 text-stone-600">|</span>
            <span className="text-red-400">HP {hpMax}</span>
          </p>
        </div>
      </div>

      {/* Stat Grid */}
      <div className="grid grid-cols-6 gap-2">
        {(Object.keys(ABILITY_LABELS) as (keyof PlayerStats)[]).map(
          (ability) => (
            <div
              key={ability}
              className="rounded-md border border-stone-700/50 bg-stone-900/30 p-2 text-center"
            >
              <p className="text-[10px] font-bold tracking-widest text-stone-500 uppercase">
                {ABILITY_LABELS[ability]}
              </p>
              <p className="text-lg font-bold text-stone-200">
                {stats[ability]}
              </p>
              <p className="text-[11px] text-stone-500">
                {getModifier(stats[ability])}
              </p>
            </div>
          )
        )}
      </div>

      <button
        type="button"
        data-testid="edit-character-button"
        onClick={onEdit}
        className="w-full rounded-md border border-stone-700 bg-stone-800/50 px-4 py-2.5 text-sm font-medium text-stone-300 transition hover:border-amber-700 hover:text-amber-200"
      >
        Edit Character
      </button>
    </div>
  )
}
