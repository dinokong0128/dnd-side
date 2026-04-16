'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
  const router = useRouter()
  const [player, setPlayer] = useState<PlayerRow | null>(initialPlayer)
  const [isEditing, setIsEditing] = useState(!initialPlayer?.character_name)

  const handleSuccess = (updatedPlayer: PlayerRow) => {
    setPlayer(updatedPlayer)   // optimistic: character summary shows immediately
    setIsEditing(false)
    router.refresh()           // re-fetches server data so InventoryPanel appears
  }

  const handleEdit = () => {
    setIsEditing(true)
  }

  if (isEditing) {
    if (gameStatus !== 'lobby') {
      return (
        <div className="dnd-warning-box">
          <p>
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
                race: player.race as CharacterFormData['race'],
                level: player.level,
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
    <button onClick={handleEdit} className="dnd-btn-primary">
      Create Your Character
    </button>
  ) : (
    <div className="dnd-warning-box">
      <p>
        The game has started. No new characters can be created.
      </p>
    </div>
  )
}
