'use client'

import { useState } from 'react'
import type { Game } from '@/lib/supabase/games'
import type { Player, InventoryItem } from '@/lib/supabase/players'
import { CharacterCreationForm } from './CharacterCreationForm'
import { CharacterSummaryCard } from './CharacterSummaryCard'
import { InventoryPanel } from './InventoryPanel'

type Props = {
  game: Game
  initialPlayer: Player | null
  initialInventory: InventoryItem[]
}

export function GameLobby({ game, initialPlayer, initialInventory }: Props) {
  const [player, setPlayer] = useState<Player | null>(initialPlayer)
  const [inventory, setInventory] = useState<InventoryItem[]>(initialInventory)
  const [isEditing, setIsEditing] = useState(false)

  const showForm = !player || isEditing

  function handleSave(savedPlayer: Player, savedInventory: InventoryItem[]) {
    setPlayer(savedPlayer)
    setInventory(savedInventory)
    setIsEditing(false)
  }

  function handleEdit() {
    setIsEditing(true)
  }

  return (
    <div className="dnd-lobby-container">
      {/* Game Header */}
      <div className="dnd-lobby-header">
        <a href="/dashboard" className="dnd-back-link">
          &larr; Dashboard
        </a>
        <h1 className="dnd-lobby-title">{game.name}</h1>
        {game.dm_persona && (
          <p className="dnd-lobby-persona">{game.dm_persona}</p>
        )}
        <div className="dnd-lobby-status">
          <span className="dnd-status-badge">{game.status}</span>
        </div>
      </div>

      {/* Character Section */}
      <div className="dnd-lobby-content">
        {showForm ? (
          <CharacterCreationForm
            gameId={game.id}
            existingPlayer={isEditing ? player : null}
            onSave={handleSave}
          />
        ) : (
          <CharacterSummaryCard
            player={player}
            gameStatus={game.status}
            onEdit={handleEdit}
          />
        )}

        <div className="dnd-section-gap" />

        <InventoryPanel inventory={inventory} hasCharacter={!!player && !isEditing} />
      </div>
    </div>
  )
}
