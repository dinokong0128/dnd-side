'use client'

import { useState, useEffect } from 'react'
import { CharacterCreationForm } from './CharacterCreationForm'
import { CharacterSummaryCard } from './CharacterSummaryCard'
import { InventoryPanel } from './InventoryPanel'

type InventoryItem = {
  item_name: string
  quantity: number
  properties: Record<string, unknown> | null
}

type PlayerData = {
  id: string
  character_name: string | null
  character_class: string | null
  stats: Record<string, number> | null
  hp_max: number | null
  hp_current: number | null
  inventory?: InventoryItem[]
}

type Props = {
  gameId: string
  gameName: string
  dmPersona: string
}

export function GameLobby({ gameId, gameName, dmPersona }: Props) {
  const [player, setPlayer] = useState<PlayerData | null>(null)
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [editing, setEditing] = useState(false)
  const [loadingPlayer, setLoadingPlayer] = useState(true)

  useEffect(() => {
    async function loadPlayer() {
      try {
        const res = await fetch(`/api/games/${gameId}/players`)
        if (res.ok) {
          const data = await res.json()
          if (data) {
            setPlayer(data)
            setInventory(data.inventory ?? [])
          }
        }
      } catch {
        // silently fail — player will see the form
      } finally {
        setLoadingPlayer(false)
      }
    }
    loadPlayer()
  }, [gameId])

  const hasCompleteCharacter =
    player?.character_name && player?.character_class && player?.stats

  function handleSave(saved: PlayerData) {
    setPlayer(saved)
    setEditing(false)
    // Refetch to get inventory
    fetch(`/api/games/${gameId}/players`)
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          setPlayer(data)
          setInventory(data.inventory ?? [])
        }
      })
      .catch(() => {})
  }

  if (loadingPlayer) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-gold border-t-transparent" />
      </div>
    )
  }

  const showForm = !hasCompleteCharacter || editing

  return (
    <div className="space-y-6">
      {/* Game Header */}
      <div className="rounded-lg border border-card-border bg-card-bg p-5">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-wide text-foreground">
          {gameName}
        </h1>
        <p className="mt-2 text-sm italic text-muted-text">
          &ldquo;{dmPersona}&rdquo;
        </p>
        <div className="mt-3 flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-accent-gold animate-pulse" />
          <span className="text-xs uppercase tracking-wider text-muted-text">
            Lobby — Awaiting Adventurers
          </span>
        </div>
      </div>

      {/* Character Section */}
      <div className="rounded-lg border border-card-border bg-card-bg p-5">
        {showForm ? (
          <CharacterCreationForm
            gameId={gameId}
            existingPlayer={
              hasCompleteCharacter
                ? {
                    id: player!.id,
                    character_name: player!.character_name!,
                    character_class: player!.character_class!,
                    stats: player!.stats!,
                    hp_max: player!.hp_max!,
                    hp_current: player!.hp_current!,
                  }
                : null
            }
            onSave={handleSave}
          />
        ) : (
          <CharacterSummaryCard
            characterName={player!.character_name!}
            characterClass={player!.character_class!}
            stats={player!.stats!}
            hpMax={player!.hp_max!}
            onEdit={() => setEditing(true)}
          />
        )}
      </div>

      {/* Inventory Section */}
      <InventoryPanel
        items={inventory}
        hasCharacter={!!hasCompleteCharacter}
      />
    </div>
  )
}
