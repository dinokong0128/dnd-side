'use client'

import { useState } from 'react'
import { CharacterCreationForm } from './CharacterCreationForm'
import { CharacterSummaryCard } from './CharacterSummaryCard'

type PlayerData = {
  id: string
  character_name: string
  character_class: string
  hp_current: number
  hp_max: number
  stats: Record<string, number>
}

type Props = {
  gameId: string
  initialPlayer: PlayerData | null
  gameStatus: string
}

export function CharacterSection({ gameId, initialPlayer, gameStatus }: Props) {
  const [player, setPlayer] = useState<PlayerData | null>(initialPlayer)
  const [editing, setEditing] = useState(false)

  const isGameStarted = gameStatus === 'active' || gameStatus === 'ended'
  const showForm = !player || editing

  if (isGameStarted && player) {
    return (
      <CharacterSummaryCard
        characterName={player.character_name}
        characterClass={player.character_class}
        hpMax={player.hp_max}
        stats={player.stats}
        onEdit={() => {}}
      />
    )
  }

  if (showForm) {
    return (
      <CharacterCreationForm
        gameId={gameId}
        existingPlayer={player}
        onSave={(savedPlayer) => {
          setPlayer(savedPlayer)
          setEditing(false)
        }}
      />
    )
  }

  return (
    <CharacterSummaryCard
      characterName={player.character_name}
      characterClass={player.character_class}
      hpMax={player.hp_max}
      stats={player.stats}
      onEdit={() => setEditing(true)}
    />
  )
}
