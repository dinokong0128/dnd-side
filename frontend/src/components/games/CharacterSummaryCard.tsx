'use client'

import {
  ABILITY_NAMES,
  CLASS_ICONS,
  formatModifier,
  type CharacterClass,
} from '@/lib/game-data/characters'
import type { Player } from '@/lib/supabase/players'

type Props = {
  player: Player
  gameStatus: string
  onEdit: () => void
}

export function CharacterSummaryCard({ player, gameStatus, onEdit }: Props) {
  const canEdit = gameStatus === 'pending'
  const characterClass = player.character_class as CharacterClass
  const icon = CLASS_ICONS[characterClass] ?? ''

  return (
    <div data-testid="character-summary-card" className="dnd-card">
      {/* Header: name + ready badge */}
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-[var(--font-display)] text-xl font-bold text-[var(--dnd-parchment)] tracking-wide" style={{ fontFamily: 'Cinzel, serif' }}>
          {player.character_name}
        </h2>
        <span className="dnd-badge-ready">{'\u2713'} Ready</span>
      </div>

      {/* Meta: class + HP */}
      <div className="flex items-center gap-3 text-[var(--dnd-parchment-dim)] text-sm mb-4">
        <span className="text-lg">{icon}</span>
        <span>{player.character_class}</span>
        <span className="text-[var(--dnd-border-subtle)]">{'\u2022'}</span>
        <span className="dnd-hp-badge">
          <span className="text-base">{'\u2764'}</span> HP {player.hp_max}
        </span>
      </div>

      {/* Stat grid 6-column */}
      <div className="grid grid-cols-6 gap-2 my-4" data-testid="summary-stat-grid">
        {ABILITY_NAMES.map((ability) => {
          const val = player.stats?.[ability] ?? 10
          return (
            <div key={ability} className="text-center bg-[var(--dnd-bg-input)] border border-[var(--dnd-border-subtle)] rounded-lg py-2 px-1">
              <span className="block text-[0.6rem] font-bold tracking-widest text-[var(--dnd-gold-dim)] uppercase" style={{ fontFamily: 'Cinzel, serif' }}>
                {ability}
              </span>
              <span className="block text-xl font-bold text-[var(--dnd-parchment)] leading-tight">
                {val}
              </span>
              <span className="text-xs text-[var(--dnd-parchment-dim)]">
                {formatModifier(val)}
              </span>
            </div>
          )
        })}
      </div>

      {/* Edit button */}
      {canEdit && (
        <div className="flex justify-end mt-4">
          <button
            type="button"
            onClick={onEdit}
            data-testid="edit-character-btn"
            className="dnd-btn-secondary"
          >
            {'\u270E'} Edit Character
          </button>
        </div>
      )}
    </div>
  )
}
