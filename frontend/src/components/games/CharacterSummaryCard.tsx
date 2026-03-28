'use client'

import { ABILITY_NAMES, ABILITY_LABELS, formatModifier } from '@/lib/game-data'

type Props = {
  characterName: string
  characterClass: string
  stats: Record<string, number>
  hpMax: number
  onEdit: () => void
  canEdit: boolean
}

export function CharacterSummaryCard({
  characterName,
  characterClass,
  stats,
  hpMax,
  onEdit,
  canEdit,
}: Props) {
  return (
    <div className="dnd-card space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <span className="dnd-ready-badge">\u2713 Character Ready</span>
          <h2 className="dnd-heading text-xl mt-2">{characterName}</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--dnd-text-dim)' }}>
            {characterClass}{' '}\u00B7{' '}
            <span className="dnd-hp-badge">{hpMax} HP</span>
          </p>
        </div>
      </div>

      <hr className="dnd-divider" />

      <div className="grid grid-cols-6 gap-2">
        {ABILITY_NAMES.map((ability) => {
          const score = stats[ability] ?? 10
          return (
            <div key={ability} className="text-center">
              <div className="dnd-stat-label">
                {ABILITY_LABELS[ability].short}
              </div>
              <div
                className="text-lg font-bold"
                style={{
                  fontFamily: "var(--font-cinzel), 'Cinzel', serif",
                  color: 'var(--dnd-text)',
                }}
              >
                {score}
              </div>
              <div className="dnd-stat-modifier">{formatModifier(score)}</div>
            </div>
          )
        })}
      </div>

      {canEdit && (
        <>
          <hr className="dnd-divider" />
          <button
            type="button"
            data-testid="edit-character-button"
            onClick={onEdit}
            className="dnd-button-ghost w-full justify-center"
          >
            Edit Character
          </button>
        </>
      )}
    </div>
  )
}
