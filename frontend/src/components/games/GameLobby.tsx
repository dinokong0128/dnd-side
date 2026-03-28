'use client'

import { useState, useCallback } from 'react'
import { CharacterCreationForm } from './CharacterCreationForm'
import { CharacterSummaryCard } from './CharacterSummaryCard'
import { InventoryPanel } from './InventoryPanel'

type Stats = {
  str: number
  dex: number
  con: number
  int: number
  wis: number
  cha: number
}

type Player = {
  id: string
  character_name: string
  character_class: string
  hp_max: number
  stats: Stats
}

type InventoryItem = {
  id: string
  item_name: string
  quantity: number
  properties: Record<string, string> | null
}

type Props = {
  gameId: string
  gameName: string
  initialPlayer: Player | null
  initialInventory: InventoryItem[]
}

export function GameLobby({
  gameId,
  gameName,
  initialPlayer,
  initialInventory,
}: Props) {
  const [player, setPlayer] = useState<Player | null>(initialPlayer)
  const [inventory, setInventory] = useState<InventoryItem[]>(initialInventory)
  const [editing, setEditing] = useState(!initialPlayer)

  const handleSaved = useCallback(async () => {
    const res = await fetch(`/api/games/${gameId}/players`)
    if (res.ok) {
      const data = await res.json()
      setPlayer(data.player)
      setInventory(data.inventory ?? [])
    }
    setEditing(false)
  }, [gameId])

  const handleEdit = useCallback(() => {
    setEditing(true)
  }, [])

  return (
    <div className="min-h-screen bg-stone-950">
      {/* Decorative top border */}
      <div className="h-1 bg-gradient-to-r from-transparent via-amber-700/60 to-transparent" />

      <div className="mx-auto max-w-lg px-4 py-8">
        {/* Game header */}
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600/50">
            Campaign Lobby
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-amber-100">
            {gameName}
          </h1>
        </div>

        {/* Character card */}
        <div className="rounded-xl border border-amber-900/30 bg-gradient-to-b from-stone-900 to-stone-950 p-6 shadow-lg shadow-amber-950/20">
          {editing ? (
            <CharacterCreationForm
              gameId={gameId}
              initialData={
                player
                  ? {
                      character_name: player.character_name,
                      character_class: player.character_class,
                      stats: player.stats,
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
              stats={player.stats}
              onEdit={handleEdit}
            />
          ) : null}
        </div>

        {/* Inventory panel */}
        <div className="mt-4 rounded-xl border border-amber-900/20 bg-stone-900/50 p-5">
          <InventoryPanel items={inventory} hasCharacter={!!player} />
        </div>
      </div>
    </div>
  )
}
