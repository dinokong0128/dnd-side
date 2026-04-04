'use client'

import { useState } from 'react'
import { CharacterCreationForm } from './CharacterCreationForm'
import { CharacterSummaryCard } from './CharacterSummaryCard'
import type { PlayerRow } from '@/lib/types/player'
import type { CharacterFormData } from '@/lib/validations/character'

interface CharacterLobbyPanelProps {
  gameId: string
  gameStatus: 'lobby' | 'active' | 'paused' | 'ended'
  initialPlayer: PlayerRow | null
}

export function CharacterLobbyPanel({
  gameId,
  gameStatus,
  initialPlayer,
}: CharacterLobbyPanelProps) {
  const [player, setPlayer] = useState<PlayerRow | null>(initialPlayer)
  const [isEditing, setIsEditing] = useState(!initialPlayer?.character_name)

  const handleSuccess = (updatedPlayer: PlayerRow) => {
    setPlayer(updatedPlayer)
    setIsEditing(false)
  }

  const handleEdit = () => {
    setIsEditing(true)
  }

  if (isEditing) {
    if (gameStatus !== 'lobby') {
      return (
        <div className="rounded-lg bg-yellow-50 p-4 text-center">
          <p className="text-sm text-yellow-800">
            Character creation is only available when the game is in lobby status.
          </p>
        </div>
      )
    }

    return (
      <CharacterCreationForm
        gameId={gameId}
        defaultValues={
          player
            ? {
                characterName: player.character_name,
                characterClass: player.character_class as CharacterFormData['characterClass'],
                stats: player.stats,
              }
            : undefined
        }
        onSuccess={handleSuccess}
      />
    )
  }

  return player ? (
    <CharacterSummaryCard
      player={player}
      gameStatus={gameStatus}
      onEdit={handleEdit}
    />
  ) : gameStatus === 'lobby' ? (
    <button
      onClick={handleEdit}
      className="w-full rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
    >
      Create Your Character
    </button>
  ) : (
    <div className="rounded-lg bg-yellow-50 p-4 text-center">
      <p className="text-sm text-yellow-800">
        The game has started. No new characters can be created.
      </p>
    </div>
  )
}
