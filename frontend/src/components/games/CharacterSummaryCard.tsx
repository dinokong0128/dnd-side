'use client'

import { formatModifier, type PlayerStats } from '@/lib/supabase/players'

const ABILITY_NAMES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const

type Props = {
  characterName: string
  characterClass: string
  stats: PlayerStats
  onEdit: () => void
}

export function CharacterSummaryCard({ characterName, characterClass, stats, onEdit }: Props) {
  return (
    <div
      data-testid="character-summary-card"
      className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-5 py-4 dark:border-gray-700 dark:bg-gray-800/50">
        <span className="text-lg font-bold">{characterName}</span>
        <span className="flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
          Ready
        </span>
      </div>

      {/* Meta */}
      <div className="flex gap-4 border-b border-gray-200 px-5 py-3 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
        <span>{characterClass}</span>
        <span>HP: {stats.hp_max}</span>
      </div>

      {/* Ability Scores */}
      <div className="grid grid-cols-6 gap-2 px-5 py-4">
        {ABILITY_NAMES.map((ability) => (
          <div key={ability} className="rounded border border-gray-100 bg-gray-50 py-2 text-center dark:border-gray-700 dark:bg-gray-800">
            <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              {ability}
            </div>
            <div className="text-lg font-bold">{stats[ability]}</div>
            <div className="text-[10px] text-gray-400">{formatModifier(stats[ability])}</div>
          </div>
        ))}
      </div>

      {/* Edit Button */}
      <div className="border-t border-gray-200 px-5 py-3 dark:border-gray-700">
        <button
          type="button"
          data-testid="edit-character-button"
          onClick={onEdit}
          className="w-full rounded border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Edit Character
        </button>
      </div>
    </div>
  )
}
