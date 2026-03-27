'use client'

import { useState } from 'react'
import { CharacterCreationForm } from '@/components/games/CharacterCreationForm'
import { CharacterSummaryCard } from '@/components/games/CharacterSummaryCard'

type CharacterData = {
  id: string
  character_name: string
  character_class: string
  hp_current: number
  hp_max: number
  stats: Record<string, number>
}

export function CharacterLobby({
  gameId,
  gameStatus,
  initialPlayer,
}: {
  gameId: string
  gameStatus: string
  initialPlayer: CharacterData | null
}) {
  const [character, setCharacter] = useState<CharacterData | null>(
    initialPlayer
  )
  const [editing, setEditing] = useState(false)

  const canEdit = gameStatus === 'lobby' || gameStatus === 'pending'
  const showForm = canEdit && (!character || editing)

  return (
    <div data-testid="character-lobby">
      {showForm ? (
        <CharacterCreationForm
          gameId={gameId}
          existingCharacter={editing ? character : null}
          onSave={(saved) => {
            setCharacter(saved)
            setEditing(false)
          }}
        />
      ) : character ? (
        <CharacterSummaryCard
          character={character}
          editable={canEdit}
          onEdit={() => setEditing(true)}
        />
      ) : (
        <div className="rounded-lg border border-gray-700 bg-gray-800/30 p-6 text-center">
          <p className="text-sm text-gray-400">
            The game has started. Character creation is closed.
          </p>
        </div>
      )}
    </div>
  )
}
