'use client'

import type { PlayerRow } from '@/lib/types/player'

interface CharacterSummaryCardProps {
  player: PlayerRow
  gameStatus: 'lobby' | 'active' | 'paused' | 'ended'
  onEdit: () => void
}

const STAT_NAMES = [
  { key: 'str', label: 'STR' },
  { key: 'dex', label: 'DEX' },
  { key: 'con', label: 'CON' },
  { key: 'int', label: 'INT' },
  { key: 'wis', label: 'WIS' },
  { key: 'cha', label: 'CHA' },
] as const

function getModifier(score: number): number {
  return Math.floor((score - 10) / 2)
}

function formatModifier(value: number): string {
  if (value > 0) return `+${value}`
  if (value === 0) return '+0'
  return `${value}`
}

export function CharacterSummaryCard({
  player,
  gameStatus,
  onEdit,
}: CharacterSummaryCardProps) {
  const isLobby = gameStatus === 'lobby'

  return (
    <div className="space-y-6 rounded border border-gray-300 bg-white p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {player.character_name}
          </h2>
          <p className="text-lg text-gray-600">{player.character_class}</p>
        </div>
        {isLobby && (
          <button
            onClick={onEdit}
            className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
          >
            Edit Character
          </button>
        )}
      </div>

      <div className="rounded bg-gray-50 p-4">
        <p className="text-sm font-medium text-gray-700">Hit Points</p>
        <p className="mt-1 text-2xl font-bold text-gray-900">
          {player.hp_current}/{player.hp_max}
        </p>
        <div className="mt-2 h-3 rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-green-500"
            style={{
              width: `${(player.hp_current / player.hp_max) * 100}%`,
            }}
          />
        </div>
      </div>

      <div>
        <p className="mb-3 text-sm font-medium text-gray-700">Ability Scores</p>
        <div className="grid grid-cols-3 gap-3">
          {STAT_NAMES.map(({ key, label }) => {
            const score = player.stats[key as keyof typeof player.stats]
            const modifier = getModifier(score)
            return (
              <div key={key} className="rounded bg-gray-100 p-3 text-center">
                <p className="text-xs font-medium text-gray-600">{label}</p>
                <p className="mt-1 text-lg font-bold text-gray-900">{score}</p>
                <p className="text-xs text-gray-500">
                  {formatModifier(modifier)}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      <div className="text-xs text-gray-500">
        <p>Status: {player.status}</p>
        <p>Joined: {new Date(player.joined_at).toLocaleDateString()}</p>
      </div>
    </div>
  )
}
