'use client'

import { useState } from 'react'
import { CharacterCreationForm } from '@/components/games/CharacterCreationForm'
import { CharacterSummaryCard } from '@/components/games/CharacterSummaryCard'
import { InventoryPanel } from '@/components/games/InventoryPanel'

type PlayerData = {
  id: string
  character_name: string
  character_class: string
  hp_max: number
  stats: Record<string, number>
}

type InventoryItemData = {
  id: string
  player_id: string
  item_name: string
  quantity: number
  properties: Record<string, unknown> | null
  created_at: string
}

type CharacterLobbyProps = {
  gameId: string
  gameName: string
  initialPlayer: PlayerData | null
  initialInventory: InventoryItemData[]
}

export function CharacterLobby({
  gameId,
  gameName,
  initialPlayer,
  initialInventory,
}: CharacterLobbyProps) {
  const [player, setPlayer] = useState<PlayerData | null>(initialPlayer)
  const [inventory, setInventory] =
    useState<InventoryItemData[]>(initialInventory)
  const [editing, setEditing] = useState(!initialPlayer)

  function handleSave(savedPlayer: PlayerData, savedInventory: InventoryItemData[]) {
    setPlayer(savedPlayer)
    setInventory(savedInventory)
    setEditing(false)
  }

  function handleEdit() {
    setEditing(true)
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 p-6 sm:p-8">
      {/* Game header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{gameName}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Game Lobby — prepare your character before the adventure begins.
        </p>
      </div>

      {/* Character form or summary */}
      {editing ? (
        <CharacterCreationForm
          gameId={gameId}
          existingPlayer={player}
          onSave={handleSave}
        />
      ) : player ? (
        <CharacterSummaryCard
          characterName={player.character_name}
          characterClass={player.character_class}
          hpMax={player.hp_max}
          stats={player.stats}
          onEdit={handleEdit}
        />
      ) : null}

      {/* Inventory panel */}
      <InventoryPanel items={inventory} hasCharacter={!!player && !editing} />
    </div>
  )
}
