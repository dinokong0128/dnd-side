'use client'

const ABILITY_ORDER = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const

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
  stats: Record<string, number>
  onEdit: () => void
}

function abilityModifier(score: number): string {
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
    <div
      data-testid="character-summary-card"
      className="rounded-lg border border-green-200 bg-green-50 p-6 shadow-sm dark:border-green-800 dark:bg-green-950"
    >
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-green-700 dark:text-green-400">
            Character Ready
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight">
            {characterName}
          </h2>
          <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
            {characterClass} &middot; HP {hpMax}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-6 gap-2">
        {ABILITY_ORDER.map((ability) => (
          <div
            key={ability}
            className="rounded border border-gray-200 bg-white px-1 py-2 text-center dark:border-gray-700 dark:bg-gray-800"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {ABILITY_LABELS[ability]}
            </p>
            <p className="text-lg font-bold tabular-nums">{stats[ability]}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {abilityModifier(stats[ability])}
            </p>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onEdit}
        data-testid="edit-character-button"
        className="mt-4 w-full rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
      >
        Edit Character
      </button>
    </div>
  )
}
