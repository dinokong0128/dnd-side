'use client'

import { useState } from 'react'
import { CharacterCreationForm } from './CharacterCreationForm'
import { CharacterSummaryCard } from './CharacterSummaryCard'
import type { PlayerRow } from '@/lib/types/player'

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
    return (
      <CharacterCreationForm
        gameId={gameId}
        defaultValues={
          player
            ? {
                characterName: player.character_name,
                characterClass: player.character_class as unknown as typeof player.character_class,
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
  ) : null
}
