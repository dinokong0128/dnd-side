'use client'

import { useState, useCallback } from 'react'
import { CharacterCreationForm } from './CharacterCreationForm'
import { CharacterSummaryCard } from './CharacterSummaryCard'
import { InventoryPanel } from './InventoryPanel'
import type { Player, InventoryItem, PlayerStats } from '@/lib/supabase/players'

type Props = {
  gameId: string
  initialPlayer: Player | null
  initialInventory: InventoryItem[]
}

export function CharacterSection({
  gameId,
  initialPlayer,
  initialInventory,
}: Props) {
  const [player, setPlayer] = useState<Player | null>(initialPlayer)
  const [inventory, setInventory] = useState<InventoryItem[]>(initialInventory)
  const [showForm, setShowForm] = useState(!initialPlayer)

  const refreshData = useCallback(async () => {
    try {
      const res = await fetch(`/api/games/${gameId}/players/me`)
      if (res.ok) {
        const data = await res.json()
        setPlayer(data.player)
        setInventory(data.inventory)
      }
    } catch {
      // Silent fail — data will refresh on next page load
    }
  }, [gameId])

  const handleSaved = useCallback(async () => {
    await refreshData()
    setShowForm(false)
  }, [refreshData])

  const handleEdit = useCallback(() => {
    setShowForm(true)
  }, [])

  return (
    <div className="space-y-6">
      {showForm ? (
        <CharacterCreationForm
          gameId={gameId}
          existingPlayer={
            player
              ? {
                  character_name: player.character_name,
                  character_class: player.character_class,
                  stats: player.stats as PlayerStats,
                }
              : null
          }
          onSaved={handleSaved}
        />
      ) : player ? (
        <CharacterSummaryCard
          characterName={player.character_name}
          characterClass={player.character_class}
          hpMax={player.hp_max}
          stats={player.stats as PlayerStats}
          onEdit={handleEdit}
        />
      ) : null}

      <InventoryPanel items={inventory} hasCharacter={!!player && !showForm} />
    </div>
  )
}
