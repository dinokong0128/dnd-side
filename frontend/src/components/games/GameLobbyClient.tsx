'use client'

import { useState } from 'react'
import { CharacterCreationForm } from '@/components/games/CharacterCreationForm'
import { CharacterSummaryCard } from '@/components/games/CharacterSummaryCard'
import { InventoryPanel } from '@/components/games/InventoryPanel'
import type { CharacterClass, AbilityScore } from '@/lib/constants/starting-inventory'
import type { Player, InventoryItem } from '@/lib/supabase/players'
import Link from 'next/link'

type CharacterData = {
  character_name: string
  character_class: CharacterClass
  stats: Record<AbilityScore, number>
  hp_max: number
}

type Props = {
  game: {
    id: string
    name: string
    dm_persona: string
    status: string
  }
  initialPlayer: Player | null
  initialInventory: InventoryItem[]
}

export function GameLobbyClient({ game, initialPlayer, initialInventory }: Props) {
  const hasCharacter = !!(initialPlayer?.character_name && initialPlayer?.character_class)

  const [characterData, setCharacterData] = useState<CharacterData | null>(
    hasCharacter
      ? {
          character_name: initialPlayer!.character_name!,
          character_class: initialPlayer!.character_class! as CharacterClass,
          stats: initialPlayer!.stats! as Record<AbilityScore, number>,
          hp_max: initialPlayer!.hp_max!,
        }
      : null
  )
  const [inventory, setInventory] = useState<InventoryItem[]>(initialInventory)
  const [editing, setEditing] = useState(!hasCharacter)

  async function handleSave(data: CharacterData) {
    setCharacterData(data)
    setEditing(false)

    // Refetch inventory after save
    try {
      const response = await fetch(`/api/games/${game.id}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character_name: data.character_name,
          character_class: data.character_class,
          stats: data.stats,
        }),
      })
      if (response.ok) {
        const result = await response.json()
        if (result.inventory) {
          setInventory(result.inventory)
        }
      }
    } catch {
      // Inventory will be stale but character is saved
    }
  }

  function handleEdit() {
    setEditing(true)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-950 via-stone-900 to-stone-950">
      {/* Decorative top bar */}
      <div className="h-1 bg-gradient-to-r from-transparent via-amber-700/60 to-transparent" />

      <div className="mx-auto max-w-lg px-6 py-10">
        {/* Back link */}
        <Link
          href="/dashboard"
          className="mb-8 inline-flex items-center gap-1 text-xs text-amber-300/40 transition-colors hover:text-amber-300/70"
        >
          &#8592; Back to Dashboard
        </Link>

        {/* Game Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-wide text-amber-50">
              {game.name}
            </h1>
            <span className="rounded-full border border-amber-700/30 px-2.5 py-0.5 text-[10px] font-bold tracking-widest text-amber-400/50 uppercase">
              {game.status}
            </span>
          </div>
          {game.dm_persona && (
            <p className="mt-2 text-sm text-amber-100/30 italic leading-relaxed">
              &ldquo;{game.dm_persona}&rdquo;
            </p>
          )}
        </div>

        {/* Character Section */}
        <div className="rounded-lg border border-amber-900/25 bg-stone-900/50 p-6 shadow-xl shadow-black/20">
          {editing ? (
            <CharacterCreationForm
              gameId={game.id}
              initialData={characterData}
              onSave={handleSave}
            />
          ) : characterData ? (
            <CharacterSummaryCard
              characterName={characterData.character_name}
              characterClass={characterData.character_class}
              stats={characterData.stats}
              hpMax={characterData.hp_max}
              onEdit={handleEdit}
            />
          ) : null}
        </div>

        {/* Inventory Section */}
        <div className="mt-6 rounded-lg border border-amber-900/25 bg-stone-900/50 p-6 shadow-xl shadow-black/20">
          <InventoryPanel
            items={inventory}
            hasCharacter={!!characterData}
          />
        </div>
      </div>

      {/* Decorative bottom bar */}
      <div className="h-1 bg-gradient-to-r from-transparent via-amber-700/60 to-transparent" />
    </div>
  )
}
