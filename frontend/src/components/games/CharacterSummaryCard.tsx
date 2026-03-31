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

function abilityModifier(score: number): string {
  const mod = Math.floor((score - 10) / 2)
  return mod >= 0 ? `+${mod}` : `${mod}`
}

type CharacterSummaryCardProps = {
  characterName: string
  characterClass: string
  hpMax: number
  stats: Record<string, number>
  canEdit: boolean
  onEdit: () => void
}

export function CharacterSummaryCard({
  characterName,
  characterClass,
  hpMax,
  stats,
  canEdit,
  onEdit,
}: CharacterSummaryCardProps) {
  return (
    <div className="dnd-card px-6 py-6 dnd-fade-in" data-testid="character-summary">
      <div className="flex items-center justify-between mb-4">
        <span className="dnd-ready-badge">Ready</span>
        {canEdit && (
          <button
            onClick={onEdit}
            className="dnd-btn-secondary"
            data-testid="edit-character-btn"
            style={{ padding: '0.25rem 0.6rem', fontSize: '0.65rem' }}
          >
            Edit Character
          </button>
        )}
      </div>

      <h2
        className="dnd-heading text-xl font-bold"
        style={{ fontFamily: "'Cinzel', serif" }}
      >
        {characterName}
      </h2>
      <div className="mt-1 flex items-center gap-3">
        <span className="text-sm" style={{ color: 'var(--muted)' }}>
          {characterClass}
        </span>
        <span className="dnd-hp-badge">HP {hpMax}</span>
      </div>

      <div className="dnd-stat-grid mt-4">
        {ABILITY_ORDER.map((ability) => {
          const val = stats[ability] ?? 10
          return (
            <div key={ability} className="dnd-stat-box">
              <div className="dnd-stat-label">{ABILITY_LABELS[ability]}</div>
              <div className="dnd-stat-value">{val}</div>
              <div className="dnd-stat-modifier">{abilityModifier(val)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
