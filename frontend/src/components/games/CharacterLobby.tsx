'use client'

import { useState, useCallback } from 'react'
import { CharacterCreationForm } from './CharacterCreationForm'
import { CharacterSummaryCard } from './CharacterSummaryCard'
import { InventoryPanel } from './InventoryPanel'
import type { Player, InventoryItem } from '@/lib/supabase/players'

type Props = {
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
}: Props) {
  const [player, setPlayer] = useState<Player | null>(initialPlayer)
  const [inventory, setInventory] = useState<InventoryItem[]>(initialInventory)
  const [editing, setEditing] = useState(false)

  const refreshInventory = useCallback(async () => {
    try {
      const res = await fetch(`/api/games/${gameId}/players/inventory`)
      if (res.ok) {
        const data = await res.json()
        setInventory(data.items ?? [])
      }
    } catch {
      // Silently fail — inventory will show on next page load
    }
  }, [gameId])

  const handleSave = useCallback(
    async (saved: Player) => {
      setPlayer(saved)
      setEditing(false)
      await refreshInventory()
    },
    [refreshInventory]
  )

  const showForm = !player || editing
  const isLobby = gameStatus === 'lobby'

  return (
    <div className="space-y-5">
      {/* Character Card */}
      <div
        className="relative overflow-hidden rounded-lg"
        style={{
          background:
            'linear-gradient(165deg, #1c1710 0%, #231d14 50%, #19150f 100%)',
          border: '1px solid #3d3425',
          boxShadow:
            '0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(212,168,67,0.06)',
        }}
      >
        {/* Decorative top bar */}
        <div
          style={{
            height: '3px',
            background:
              'linear-gradient(90deg, transparent, #8b6914 20%, #d4a843 50%, #8b6914 80%, transparent)',
          }}
        />

        <div className="p-5">
          <h2
            className="mb-4 text-[11px] font-bold uppercase tracking-[0.15em]"
            style={{ color: '#6a5a3a' }}
          >
            {showForm ? 'Create Your Character' : 'Your Character'}
          </h2>

          {showForm ? (
            <CharacterCreationForm
              gameId={gameId}
              existingPlayer={editing ? player : null}
              onSave={handleSave}
            />
          ) : (
            player && (
              <CharacterSummaryCard
                player={player}
                onEdit={() => setEditing(true)}
                editable={isLobby}
              />
            )
          )}
        </div>
      </div>

      {/* Inventory Card */}
      <div
        className="relative overflow-hidden rounded-lg"
        style={{
          background:
            'linear-gradient(165deg, #1c1710 0%, #231d14 50%, #19150f 100%)',
          border: '1px solid #3d3425',
          boxShadow:
            '0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(212,168,67,0.06)',
        }}
      >
        <div
          style={{
            height: '3px',
            background:
              'linear-gradient(90deg, transparent, #8b6914 20%, #d4a843 50%, #8b6914 80%, transparent)',
          }}
        />
        <div className="p-5">
          <InventoryPanel items={inventory} hasCharacter={!!player} />
        </div>
      </div>
    </div>
  )
}
