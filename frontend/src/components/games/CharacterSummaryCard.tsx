'use client'

import { STAT_NAMES } from '@/lib/constants/game'
import type { PlayerRow } from '@/lib/types/player'
import { formatModifier } from '@/lib/utils/dnd'

interface CharacterSummaryCardProps {
  player: PlayerRow
  gameStatus: string
  onEdit?: () => void
}

export function CharacterSummaryCard({
  player,
  gameStatus,
  onEdit,
}: CharacterSummaryCardProps) {
  const isLobby = gameStatus === 'lobby'

  return (
    <div className="dnd-card space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="dnd-heading text-2xl font-bold">
            {player.character_name}
          </h2>
          <p className="dnd-subheading text-base">
            Level {player.level} {player.race} {player.character_class}
          </p>
        </div>
        {isLobby && (
          <button
            onClick={onEdit}
            className="dnd-btn-secondary"
          >
            Edit Character
          </button>
        )}
      </div>

      <div className="space-y-2">
        <p className="dnd-stat-label">Hit Points</p>
        <span className="dnd-hp-badge">
          {'❤ '}<span>{player.hp_current}/{player.hp_max}</span>
        </span>
        <div className="mt-2 h-2 rounded-full" style={{ background: 'var(--input-border)' }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.min((player.hp_current / player.hp_max) * 100, 100)}%`,
              background: 'var(--dnd-crimson)',
            }}
          />
        </div>
      </div>

      <div>
        <p className="dnd-stat-label mb-3">Ability Scores</p>
        <div className="dnd-stat-grid">
          {STAT_NAMES.map(({ key, label }) => {
            const score = player.stats[key as 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha']
            return (
              <div key={key} className="dnd-stat-box">
                <p className="dnd-stat-label">{label}</p>
                <p className="dnd-stat-value">{score}</p>
                <p className="dnd-stat-modifier">
                  {formatModifier(score)}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      <div className="dnd-helper">
        <p>Status: {player.status}</p>
        <p>Joined: {new Date(player.joined_at).toLocaleDateString()}</p>
      </div>
    </div>
  )
}
