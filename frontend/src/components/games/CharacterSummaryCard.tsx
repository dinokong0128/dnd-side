'use client'

import {
  ABILITY_NAMES,
  ABILITY_LABELS,
  formatModifier,
} from '@/lib/game-data/characters'
import type { Player } from '@/lib/supabase/players'

type Props = {
  player: Player
  onEdit: () => void
  editable?: boolean
}

export function CharacterSummaryCard({
  player,
  onEdit,
  editable = true,
}: Props) {
  const stats = player.stats

  return (
    <div data-testid="character-summary-card">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p
            className="text-[10px] font-bold uppercase tracking-[0.2em]"
            style={{ color: '#5a8a3a' }}
          >
            Character Ready
          </p>
          <h3
            className="mt-1 text-xl font-bold"
            style={{
              color: '#e8d5a3',
              fontFamily: 'Georgia, "Times New Roman", serif',
            }}
          >
            {player.character_name}
          </h3>
          <p className="mt-0.5 text-sm" style={{ color: '#b09050' }}>
            {player.character_class}
          </p>
        </div>
        <div
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5"
          style={{
            background:
              'linear-gradient(135deg, rgba(180,40,40,0.15), rgba(120,20,20,0.1))',
            border: '1px solid rgba(180,60,60,0.25)',
          }}
        >
          <span
            className="text-[10px] font-bold uppercase tracking-widest"
            style={{ color: '#a05050' }}
          >
            HP
          </span>
          <span
            className="text-sm font-bold tabular-nums"
            style={{ color: '#e07070' }}
          >
            {player.hp_current}/{player.hp_max}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div
        className="my-4"
        style={{
          height: '1px',
          background:
            'linear-gradient(90deg, transparent, #3d3425, transparent)',
        }}
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-6 gap-2">
        {ABILITY_NAMES.map((ability) => {
          const score = stats[ability]
          return (
            <div
              key={ability}
              className="rounded-md py-2.5 text-center"
              style={{
                background: 'rgba(10,8,5,0.4)',
                border: '1px solid #2d2518',
              }}
            >
              <div
                className="text-[10px] font-bold uppercase tracking-[0.15em]"
                style={{ color: '#6a5a3a' }}
              >
                {ABILITY_LABELS[ability]}
              </div>
              <div
                className="mt-0.5 text-lg font-bold tabular-nums"
                style={{ color: '#e8dcc8' }}
              >
                {score}
              </div>
              <div
                className="text-[11px] font-medium tabular-nums"
                style={{ color: '#7a6a45' }}
              >
                {formatModifier(score)}
              </div>
            </div>
          )
        })}
      </div>

      {/* Edit Button */}
      {editable && (
        <button
          type="button"
          data-testid="edit-character-button"
          onClick={onEdit}
          className="mt-4 w-full rounded-md py-2 text-xs font-bold uppercase tracking-[0.12em] transition-all hover:opacity-80"
          style={{
            color: '#b09050',
            background: 'rgba(180,130,50,0.06)',
            border: '1px solid #3d3425',
          }}
        >
          Edit Character
        </button>
      )}
    </div>
  )
}
