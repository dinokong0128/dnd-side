'use client'

import { useState, useCallback } from 'react'
import { CharacterCreationForm } from '@/components/games/CharacterCreationForm'
import { CharacterSummaryCard } from '@/components/games/CharacterSummaryCard'
import { InventoryPanel } from '@/components/games/InventoryPanel'

type CharacterData = {
  id: string
  character_name: string
  character_class: string
  hp_current: number
  hp_max: number
  stats: Record<string, number>
}

type InventoryItem = {
  id: string
  item_name: string
  quantity: number
  properties: Record<string, unknown> | null
}

export function CharacterLobby({
  gameId,
  gameStatus,
  initialPlayer,
  initialInventory,
}: {
  gameId: string
  gameStatus: string
  initialPlayer: CharacterData | null
  initialInventory: InventoryItem[]
}) {
  const [character, setCharacter] = useState<CharacterData | null>(
    initialPlayer
  )
  const [inventory, setInventory] = useState<InventoryItem[]>(initialInventory)
  const [editing, setEditing] = useState(false)

  const canEdit = gameStatus === 'lobby' || gameStatus === 'pending'
  const showForm = canEdit && (!character || editing)

  const refreshData = useCallback(async () => {
    try {
      const res = await fetch(`/api/games/${gameId}/players`)
      if (res.ok) {
        const data = await res.json()
        setCharacter(data.player)
        setInventory(data.inventory ?? [])
      }
    } catch {
      // silently fail — stale data is acceptable
    }
  }, [gameId])

  return (
    <div data-testid="character-lobby" className="space-y-4">
      {showForm ? (
        <CharacterCreationForm
          gameId={gameId}
          existingCharacter={editing ? character : null}
          onSave={async (saved) => {
            setCharacter(saved)
            setEditing(false)
            await refreshData()
          }}
        />
      ) : character ? (
        <CharacterSummaryCard
          character={character}
          editable={canEdit}
          onEdit={() => setEditing(true)}
        />
      ) : (
        <div
          className="rounded-lg p-6 text-center"
          style={{
            background: 'rgba(25,21,15,0.6)',
            border: '1px solid #2d2518',
          }}
        >
          <p className="text-sm" style={{ color: '#6a5a3a' }}>
            The game has started. Character creation is closed.
          </p>
        </div>
      )}

      {/* Inventory Panel */}
      <InventoryPanel
        items={inventory}
        characterClass={character?.character_class ?? null}
      />
    </div>
  )
}
