'use client'

import { useState, useCallback } from 'react'
import { CharacterCreationForm } from './CharacterCreationForm'
import { CharacterSummaryCard } from './CharacterSummaryCard'
import { InventoryPanel } from './InventoryPanel'
import type { PlayerStats } from '@/lib/game-data'

type Player = {
  id: string
  game_id: string
  profile_id: string
  character_name: string
  character_class: string
  hp_current: number
  hp_max: number
  stats: PlayerStats
  status: string
  joined_at: string
}

type InventoryItem = {
  id: string
  player_id: string
  item_name: string
  quantity: number
  properties: Record<string, unknown> | null
}

type CharacterPanelProps = {
  gameId: string
  initialPlayer: Player | null
  initialInventory: InventoryItem[]
}

export function CharacterPanel({
  gameId,
  initialPlayer,
  initialInventory,
}: CharacterPanelProps) {
  const [player, setPlayer] = useState<Player | null>(initialPlayer)
  const [inventory, setInventory] = useState<InventoryItem[]>(initialInventory)
  const [isEditing, setIsEditing] = useState(!initialPlayer)

  const refreshData = useCallback(async () => {
    const res = await fetch(`/api/games/${gameId}/players/me`)
    if (res.ok) {
      const data = await res.json()
      setPlayer(data.player)
      setInventory(data.inventory)
    }
    setIsEditing(false)
  }, [gameId])

  if (isEditing) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-stone-800 bg-stone-950/60 p-6 shadow-lg shadow-black/20">
          <CharacterCreationForm
            gameId={gameId}
            existingPlayer={
              player
                ? {
                    character_name: player.character_name,
                    character_class: player.character_class,
                    stats: player.stats,
                  }
                : null
            }
            onSaved={refreshData}
          />
        </div>

        {/* Show inventory even while editing if player exists */}
        {player && (
          <div className="rounded-xl border border-stone-800 bg-stone-950/60 p-6 shadow-lg shadow-black/20">
            <InventoryPanel items={inventory} hasCharacter={true} />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {player && (
        <>
          <div className="rounded-xl border border-stone-800 bg-stone-950/60 p-6 shadow-lg shadow-black/20">
            <CharacterSummaryCard
              characterName={player.character_name}
              characterClass={player.character_class}
              hpMax={player.hp_max}
              stats={player.stats}
              onEdit={() => setIsEditing(true)}
            />
          </div>

          <div className="rounded-xl border border-stone-800 bg-stone-950/60 p-6 shadow-lg shadow-black/20">
            <InventoryPanel items={inventory} hasCharacter={true} />
          </div>
        </>
      )}
    </div>
  )
}
