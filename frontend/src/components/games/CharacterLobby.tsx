'use client'

import { useState, useCallback } from 'react'
import { CharacterCreationForm } from './CharacterCreationForm'
import { CharacterSummaryCard } from './CharacterSummaryCard'
import { InventoryPanel } from './InventoryPanel'

type PlayerData = {
  id: string
  character_name: string | null
  character_class: string | null
  stats: Record<string, number> | null
  hp_max: number | null
}

type InventoryItem = {
  id: string
  item_name: string
  quantity: number
  properties: Record<string, unknown>
}

type Props = {
  gameId: string
  gameStatus: string
  initialPlayer: PlayerData | null
  initialInventory: InventoryItem[]
}

export function CharacterLobby({
  gameId,
  gameStatus,
  initialPlayer,
  initialInventory,
}: Props) {
  const [player, setPlayer] = useState<PlayerData | null>(initialPlayer)
  const [inventory, setInventory] =
    useState<InventoryItem[]>(initialInventory)
  const [isEditing, setIsEditing] = useState(false)

  const hasCharacter =
    player?.character_name != null && player?.character_class != null
  const showForm = !hasCharacter || isEditing
  const canEdit = gameStatus === 'pending'

  const refreshData = useCallback(async () => {
    try {
      const res = await fetch(`/api/games/${gameId}/players`)
      if (res.ok) {
        const data = await res.json()
        setPlayer(data.player)
        setInventory(data.inventory)
      }
    } catch {
      // Data will be stale but not broken
    }
  }, [gameId])

  function handleSaved() {
    refreshData()
    setIsEditing(false)
  }

  return (
    <div className="space-y-4">
      {showForm ? (
        <CharacterCreationForm
          gameId={gameId}
          initialData={
            hasCharacter
              ? {
                  character_name: player!.character_name!,
                  character_class: player!.character_class!,
                  stats: player!.stats!,
                }
              : undefined
          }
          isEdit={hasCharacter && isEditing}
          onSaved={handleSaved}
        />
      ) : (
        <CharacterSummaryCard
          characterName={player!.character_name!}
          characterClass={player!.character_class!}
          stats={player!.stats!}
          hpMax={player!.hp_max!}
          onEdit={() => setIsEditing(true)}
          canEdit={canEdit}
        />
      )}

      <InventoryPanel
        items={inventory}
        hasCharacter={hasCharacter && !showForm}
      />
    </div>
  )
}
