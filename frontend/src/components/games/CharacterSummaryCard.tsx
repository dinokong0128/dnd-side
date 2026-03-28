'use client'

const ABILITY_LABELS: Record<string, string> = {
  str: 'STR',
  dex: 'DEX',
  con: 'CON',
  int: 'INT',
  wis: 'WIS',
  cha: 'CHA',
}

const ABILITY_ORDER = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const

type Props = {
  characterName: string
  characterClass: string
  hpMax: number
  stats: Record<string, number>
  onEdit: () => void
}

function getModifier(score: number): string {
  const mod = Math.floor((score - 10) / 2)
  return mod >= 0 ? `+${mod}` : String(mod)
}

export function CharacterSummaryCard({
  characterName,
  characterClass,
  hpMax,
  stats,
  onEdit,
}: Props) {
  return (
    <div
      data-testid="character-summary-card"
      className="rounded-lg border border-green-200 bg-green-50 p-6 shadow-sm"
    >
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
            Character Ready
          </p>
          <h2 className="mt-1 text-xl font-bold text-gray-900">
            {characterName}
          </h2>
          <p className="mt-0.5 text-sm text-gray-600">
            {characterClass} &middot; HP: {hpMax}
          </p>
        </div>
        <button
          onClick={onEdit}
          data-testid="edit-character-button"
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Edit Character
        </button>
      </div>

      <div className="grid grid-cols-6 gap-2">
        {ABILITY_ORDER.map((key) => (
          <div
            key={key}
            className="rounded-md border border-gray-200 bg-white p-2 text-center"
          >
            <p className="text-xs font-semibold uppercase text-gray-500">
              {ABILITY_LABELS[key]}
            </p>
            <p className="text-lg font-bold text-gray-900">{stats[key]}</p>
            <p className="text-xs text-gray-500">
              {getModifier(stats[key])}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
