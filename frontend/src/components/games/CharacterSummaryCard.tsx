'use client'

import {
  ABILITY_SCORES,
  ABILITY_LABELS,
  formatModifier,
  type AbilityScore,
} from '@/lib/game-data'
import type { Player } from '@/lib/supabase/players'

type Props = {
  player: Player
  gameStatus: string
  onEdit: () => void
}

export function CharacterSummaryCard({ player, gameStatus, onEdit }: Props) {
  const canEdit = gameStatus === 'lobby'

  return (
    <div className="dnd-card" data-testid="character-summary-card">
      <div className="dnd-card-body">
        <div className="dnd-summary-header">
          <div>
            <h2 className="dnd-char-name">{player.character_name}</h2>
            <p className="dnd-char-class">{player.character_class}</p>
          </div>
          <div className="dnd-badge-row">
            <span className="dnd-hp-badge">HP {player.hp_max}</span>
            <span className="dnd-ready-badge">Ready</span>
          </div>
        </div>

        <div className="dnd-summary-stats">
          {ABILITY_SCORES.map((score: AbilityScore) => {
            const val = player.stats[score] ?? 10
            return (
              <div key={score} className="dnd-summary-stat">
                <div className="dnd-summary-stat-label">
                  {ABILITY_LABELS[score]}
                </div>
                <div className="dnd-summary-stat-value">{val}</div>
                <div className="dnd-summary-stat-mod">
                  {formatModifier(val)}
                </div>
              </div>
            )
          })}
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="dnd-btn-secondary"
            data-testid="edit-character-btn"
          >
            Edit Character
          </button>
        )}
      </div>
    </div>
  )
}
