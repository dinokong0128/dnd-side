'use client'

import { ABILITY_NAMES, ABILITY_LABELS } from '@/lib/config/character'
import type { CharacterData } from '@/types/player'

function getModifier(score: number): string {
  const mod = Math.floor((score - 10) / 2)
  return mod >= 0 ? `+${mod}` : `${mod}`
}

export function CharacterSummaryCard({
  character,
  onEdit,
  editable = true,
}: {
  character: CharacterData
  onEdit?: () => void
  editable?: boolean
}) {
  return (
    <div
      data-testid="character-summary-card"
      className="rounded-lg border border-gray-700 bg-gray-800/50 p-5"
    >
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-100">
            {character.character_name}
          </h3>
          <p className="text-sm text-amber-400">{character.character_class}</p>
        </div>
        <span className="rounded-full bg-red-900/40 px-3 py-1 text-sm font-semibold text-red-300">
          HP {character.hp_current}/{character.hp_max}
        </span>
      </div>

      <div className="grid grid-cols-6 gap-2">
        {ABILITY_NAMES.map((stat) => {
          const score = character.stats[stat] ?? 10
          return (
            <div
              key={stat}
              className="rounded border border-gray-700 bg-gray-900/50 py-2 text-center"
            >
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                {ABILITY_LABELS[stat]}
              </div>
              <div className="text-lg font-bold text-gray-100">{score}</div>
              <div className="text-xs text-gray-400">
                {getModifier(score)}
              </div>
            </div>
          )
        })}
      </div>

      {editable && onEdit && (
        <button
          onClick={onEdit}
          data-testid="edit-character-button"
          className="mt-4 w-full rounded border border-gray-600 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-amber-500 hover:text-amber-400"
        >
          Edit Character
        </button>
      )}
    </div>
  )
}
