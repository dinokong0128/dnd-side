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

type ViewMode = 'form' | 'summary'

export function CharacterLobbyPanel({
  gameId,
  gameStatus,
  initialPlayer,
}: CharacterLobbyPanelProps) {
  const [player, setPlayer] = useState<PlayerRow | null>(initialPlayer)
  const [view, setView] = useState<ViewMode>(
    initialPlayer?.character_name ? 'summary' : 'form'
  )

  const handleSuccess = (updatedPlayer: PlayerRow) => {
    setPlayer(updatedPlayer)
    setView('summary')
  }

  const handleEdit = () => {
    setView('form')
  }

  return (
    <div>
      {view === 'form' ? (
        <CharacterCreationForm
          gameId={gameId}
          defaultValues={
            player
              ? {
                  characterName: player.character_name,
                  characterClass: player.character_class as any,
                  stats: player.stats,
                }
              : undefined
          }
          onSuccess={handleSuccess}
        />
      ) : player ? (
        <CharacterSummaryCard
          player={player}
          gameStatus={gameStatus}
          onEdit={handleEdit}
        />
      ) : null}
    </div>
  )
}
