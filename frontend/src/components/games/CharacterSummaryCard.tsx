'use client'

const STAT_LABELS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const
const STAT_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const

const CLASS_ICONS: Record<string, string> = {
  Fighter: '\u2694\uFE0F',
  Wizard: '\uD83E\uDDD9',
  Rogue: '\uD83D\uDDE1\uFE0F',
  Cleric: '\u2695\uFE0F',
  Ranger: '\uD83C\uDFF9',
  Barbarian: '\uD83E\uDE93',
  Paladin: '\uD83D\uDEE1\uFE0F',
  Druid: '\uD83C\uDF3F',
  Bard: '\uD83C\uDFB5',
  Monk: '\uD83E\uDDD8',
  Sorcerer: '\uD83D\uDD2E',
  Warlock: '\uD83D\uDC7F',
}

function getModifier(score: number): string {
  const mod = Math.floor((score - 10) / 2)
  return mod >= 0 ? `+${mod}` : `${mod}`
}

type Props = {
  characterName: string
  characterClass: string
  stats: Record<string, number>
  hpMax: number
  onEdit: () => void
}

export function CharacterSummaryCard({ characterName, characterClass, stats, hpMax, onEdit }: Props) {
  const icon = CLASS_ICONS[characterClass] ?? ''

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="border-b border-card-border pb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-gold/10 text-lg">
            {icon}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-success">
              Character Ready
            </p>
          </div>
        </div>
        <h2 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-bold tracking-wide text-foreground">
          {characterName}
        </h2>
        <div className="mt-1 flex items-center gap-3 text-sm text-muted-text">
          <span>{icon} {characterClass}</span>
          <span className="text-card-border">|</span>
          <span className="text-accent-red">HP {hpMax}</span>
        </div>
      </div>

      {/* Stat Grid */}
      <div className="grid grid-cols-6 gap-1.5">
        {STAT_KEYS.map((key, i) => {
          const value = stats[key] ?? 10
          const mod = getModifier(value)
          return (
            <div
              key={key}
              className="rounded-lg border border-card-border bg-input-bg p-2 text-center"
            >
              <span className="block text-[9px] font-bold uppercase tracking-widest text-muted-text">
                {STAT_LABELS[i]}
              </span>
              <span className="block text-lg font-bold text-foreground">{value}</span>
              <span className="block text-[10px] font-medium text-accent-gold-dim">{mod}</span>
            </div>
          )
        })}
      </div>

      {/* Edit Button */}
      <button
        type="button"
        data-testid="edit-character-button"
        onClick={onEdit}
        className="w-full rounded-md border border-card-border bg-card-bg px-4 py-2.5 text-sm font-medium text-muted-text transition-colors hover:border-accent-gold-dim hover:text-foreground"
      >
        Edit Character
      </button>
    </div>
  )
}
