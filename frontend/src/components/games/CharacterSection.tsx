'use client'

import { useState } from 'react'
import { CharacterCreationForm } from './CharacterCreationForm'
import { CharacterSummaryCard } from './CharacterSummaryCard'
import { InventoryPanel } from './InventoryPanel'

type PlayerData = {
  id: string
  character_name: string
  character_class: string
  hp_current: number
  hp_max: number
  stats: Record<string, number>
}

type InventoryItemData = {
  id: string
  item_name: string
  quantity: number
  properties: Record<string, unknown> | null
}

type Props = {
  gameId: string
  initialPlayer: PlayerData | null
  initialInventory: InventoryItemData[]
  gameStatus: string
}

export function CharacterSection({
  gameId,
  initialPlayer,
  initialInventory,
  gameStatus,
}: Props) {
  const [player, setPlayer] = useState<PlayerData | null>(initialPlayer)
  const [inventory, setInventory] = useState<InventoryItemData[]>(initialInventory)
  const [editing, setEditing] = useState(false)

  const isGameStarted = gameStatus === 'active' || gameStatus === 'ended'
  const showForm = !player || editing

  async function handleSave(savedPlayer: PlayerData) {
    setPlayer(savedPlayer)
    setEditing(false)

    // Refetch inventory after save (inventory was reset server-side)
    try {
      const res = await fetch(`/api/games/${gameId}/players/inventory`)
      if (res.ok) {
        const data = await res.json()
        setInventory(data)
      }
    } catch {
      // Inventory will show on next page load
    }
  }

  return (
    <div className="space-y-4">
      {isGameStarted && player ? (
        <CharacterSummaryCard
          characterName={player.character_name}
          characterClass={player.character_class}
          hpMax={player.hp_max}
          stats={player.stats}
          onEdit={() => {}}
        />
      ) : showForm ? (
        <CharacterCreationForm
          gameId={gameId}
          existingPlayer={player}
          onSave={handleSave}
        />
      ) : (
        <CharacterSummaryCard
          characterName={player.character_name}
          characterClass={player.character_class}
          hpMax={player.hp_max}
          stats={player.stats}
          onEdit={() => setEditing(true)}
        />
      )}

      <InventoryPanel items={inventory} hasCharacter={!!player && !editing} />
    </div>
  )
}
