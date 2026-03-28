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

type Stats = {
  str: number
  dex: number
  con: number
  int: number
  wis: number
  cha: number
}

type Props = {
  characterName: string
  characterClass: string
  hpMax: number
  stats: Stats
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
}: Props) {
  return (
    <div data-testid="character-summary-card" className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold text-amber-100">{characterName}</h2>
          <p className="text-sm text-amber-400/80">
            {characterClass}
            <span className="mx-2 text-amber-800">|</span>
            <span className="text-red-300">HP {hpMax}</span>
          </p>
        </div>
        <span className="rounded-full bg-emerald-900/50 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
          Ready
        </span>
      </div>

      <div className="grid grid-cols-6 gap-2">
        {ABILITY_ORDER.map((key) => (
          <div
            key={key}
            className="flex flex-col items-center rounded-md border border-amber-900/30 bg-amber-950/30 py-2"
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-500/60">
              {ABILITY_LABELS[key]}
            </span>
            <span className="text-lg font-bold text-amber-100">{stats[key]}</span>
            <span className="text-xs text-amber-400/60">{getModifier(stats[key])}</span>
          </div>
        ))}
      </div>

      <button
        type="button"
        data-testid="edit-character-button"
        onClick={onEdit}
        className="w-full rounded-md border border-amber-800/50 px-4 py-2 text-sm font-medium text-amber-300 transition-colors hover:bg-amber-900/30 hover:text-amber-200"
      >
        Edit Character
      </button>
    </div>
  )
}
