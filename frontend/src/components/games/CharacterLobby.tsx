'use client'

import { useState, useCallback } from 'react'
import { CharacterCreationForm } from './CharacterCreationForm'
import { CharacterSummaryCard } from './CharacterSummaryCard'
import { InventoryPanel } from './InventoryPanel'
import type { Player, InventoryItem } from '@/lib/supabase/players'

type CharacterLobbyProps = {
  gameId: string
  gameStatus: string
  initialPlayer: Player | null
  initialInventory: InventoryItem[]
}

export function CharacterLobby({
  gameId,
  gameStatus,
  initialPlayer,
  initialInventory,
}: CharacterLobbyProps) {
  const [player, setPlayer] = useState<Player | null>(initialPlayer)
  const [inventory, setInventory] = useState<InventoryItem[]>(initialInventory)
  const [editing, setEditing] = useState(false)

  const hasCharacter = !!(player?.character_name && player?.character_class)
  const canEdit = gameStatus === 'pending' || gameStatus === 'lobby'
  const showForm = !hasCharacter || editing

  const refreshData = useCallback(async () => {
    try {
      const res = await fetch(`/api/games/${gameId}/players`)
      if (res.ok) {
        const data = await res.json()
        setPlayer(data.player)
        setInventory(data.inventory ?? [])
      }
    } catch {
      // silent refresh failure
    }
  }, [gameId])

  function handleSave() {
    setEditing(false)
    refreshData()
  }

  return (
    <div className="space-y-4">
      {showForm ? (
        <CharacterCreationForm
          gameId={gameId}
          existingPlayer={hasCharacter ? player : null}
          onSave={handleSave}
        />
      ) : (
        <CharacterSummaryCard
          characterName={player!.character_name!}
          characterClass={player!.character_class!}
          hpMax={player!.hp_max ?? 0}
          stats={(player!.stats as Record<string, number>) ?? {}}
          canEdit={canEdit}
          onEdit={() => setEditing(true)}
        />
      )}

      <InventoryPanel items={inventory} hasCharacter={hasCharacter && !editing} />
    </div>
  )
}
