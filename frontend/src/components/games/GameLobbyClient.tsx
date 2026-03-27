'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { CharacterCreationForm } from './CharacterCreationForm'
import { CharacterSummaryCard } from './CharacterSummaryCard'
import { InventoryPanel } from './InventoryPanel'
import type { Player, InventoryItem, PlayerStats } from '@/lib/supabase/players'

type Props = {
  gameId: string
  gameName: string
  gameStatus: string
  player: Player | null
  inventory: InventoryItem[]
}

export function GameLobbyClient({ gameId, gameName, gameStatus, player, inventory }: Props) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(!player?.character_name)

  const hasCharacter = !!(player?.character_name && player?.character_class && player?.stats)

  const handleSaved = useCallback(() => {
    setIsEditing(false)
    router.refresh()
  }, [router])

  const handleEdit = useCallback(() => {
    setIsEditing(true)
  }, [])

  return (
    <div data-testid="game-lobby" className="mx-auto max-w-lg p-6">
      {/* Game Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{gameName}</h1>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium uppercase tracking-wider text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
          {gameStatus}
        </span>
      </div>

      {/* Character Section */}
      {isEditing || !hasCharacter ? (
        <CharacterCreationForm
          gameId={gameId}
          existingPlayer={
            hasCharacter
              ? {
                  character_name: player!.character_name!,
                  character_class: player!.character_class!,
                  stats: player!.stats!,
                }
              : null
          }
          onSaved={handleSaved}
        />
      ) : (
        <CharacterSummaryCard
          characterName={player!.character_name!}
          characterClass={player!.character_class!}
          stats={player!.stats as PlayerStats}
          onEdit={handleEdit}
        />
      )}

      {/* Inventory Section */}
      <div className="mt-4">
        <InventoryPanel items={inventory} hasCharacter={hasCharacter} />
      </div>
    </div>
  )
}
