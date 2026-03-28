'use client'

import { useState } from 'react'
import { z } from 'zod'
import {
  CHARACTER_CLASSES,
  calculateHpMax,
  type PlayerStats,
} from '@/lib/game-data'

const ABILITY_NAMES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const
const ABILITY_LABELS: Record<string, string> = {
  str: 'STR',
  dex: 'DEX',
  con: 'CON',
  int: 'INT',
  wis: 'WIS',
  cha: 'CHA',
}
const ABILITY_FULL_NAMES: Record<string, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
}

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8]

const statsSchema = z.object({
  str: z.number().int().min(1).max(20),
  dex: z.number().int().min(1).max(20),
  con: z.number().int().min(1).max(20),
  int: z.number().int().min(1).max(20),
  wis: z.number().int().min(1).max(20),
  cha: z.number().int().min(1).max(20),
})

const characterSchema = z.object({
  character_name: z
    .string()
    .min(1, { error: 'Character name is required' })
    .max(50, { error: 'Name must be 50 characters or less' }),
  character_class: z.enum(
    CHARACTER_CLASSES as unknown as [string, ...string[]],
    {
      error: 'Please select a class',
    }
  ),
  stats: statsSchema,
})

type CharacterCreationFormProps = {
  gameId: string
  existingPlayer?: {
    character_name: string
    character_class: string
    stats: PlayerStats
  } | null
  onSaved: () => void
}

export function CharacterCreationForm({
  gameId,
  existingPlayer,
  onSaved,
}: CharacterCreationFormProps) {
  const isEditing = !!existingPlayer

  const [characterName, setCharacterName] = useState(
    existingPlayer?.character_name ?? ''
  )
  const [characterClass, setCharacterClass] = useState(
    existingPlayer?.character_class ?? ''
  )
  const [stats, setStats] = useState<PlayerStats>(
    existingPlayer?.stats ?? { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
  )
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleStatChange(ability: string, value: string) {
    const num = value === '' ? 0 : parseInt(value, 10)
    if (!isNaN(num)) {
      setStats((prev) => ({ ...prev, [ability]: num }))
    }
  }

  function fillStandardArray() {
    const newStats: PlayerStats = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 }
    setStats(newStats)
  }

  function getModifier(score: number): string {
    const mod = Math.floor((score - 10) / 2)
    return mod >= 0 ? `+${mod}` : `${mod}`
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldErrors({})
    setFormError('')

    const result = characterSchema.safeParse({
      character_name: characterName,
      character_class: characterClass,
      stats,
    })

    if (!result.success) {
      const errors: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const field = issue.path.join('.')
        if (!errors[field]) {
          errors[field] = issue.message
        }
      }
      setFieldErrors(errors)
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/games/${gameId}/players`, {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character_name: characterName,
          character_class: characterClass,
          stats,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        if (data.errors) {
          setFieldErrors(data.errors)
        } else {
          setFormError(data.error || 'Failed to save character')
        }
        return
      }

      onSaved()
    } catch {
      setFormError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const hpPreview =
    characterClass && stats.con
      ? calculateHpMax(characterClass, stats.con)
      : null

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl tracking-wide text-amber-200">
          {isEditing ? 'Edit Character' : 'Create Your Character'}
        </h2>
        {hpPreview !== null && (
          <span className="rounded-full border border-red-900/50 bg-red-950/40 px-3 py-1 text-sm text-red-300">
            HP {hpPreview}
          </span>
        )}
      </div>

      {/* Character Name */}
      <div>
        <label
          htmlFor="character-name"
          className="mb-1 block text-sm font-medium text-stone-300"
        >
          Character Name
        </label>
        <input
          id="character-name"
          type="text"
          data-testid="character-name-input"
          value={characterName}
          onChange={(e) => setCharacterName(e.target.value)}
          placeholder="Thorin Oakenshield"
          className="block w-full rounded-md border border-stone-700 bg-stone-900/60 px-3 py-2.5 text-stone-100 placeholder-stone-600 outline-none transition focus:border-amber-600 focus:ring-1 focus:ring-amber-600/50"
        />
        {fieldErrors.character_name && (
          <p className="mt-1 text-sm text-red-400">
            {fieldErrors.character_name}
          </p>
        )}
      </div>

      {/* Character Class */}
      <div>
        <label
          htmlFor="character-class"
          className="mb-1 block text-sm font-medium text-stone-300"
        >
          Class
        </label>
        <select
          id="character-class"
          data-testid="character-class-select"
          value={characterClass}
          onChange={(e) => setCharacterClass(e.target.value)}
          className="block w-full rounded-md border border-stone-700 bg-stone-900/60 px-3 py-2.5 text-stone-100 outline-none transition focus:border-amber-600 focus:ring-1 focus:ring-amber-600/50"
        >
          <option value="" disabled>
            Choose your class...
          </option>
          {CHARACTER_CLASSES.map((cls) => (
            <option key={cls} value={cls}>
              {cls}
            </option>
          ))}
        </select>
        {fieldErrors.character_class && (
          <p className="mt-1 text-sm text-red-400">
            {fieldErrors.character_class}
          </p>
        )}
      </div>

      {/* Ability Scores */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium text-stone-300">
            Ability Scores
          </span>
          <button
            type="button"
            onClick={fillStandardArray}
            className="rounded border border-stone-700 bg-stone-800/60 px-2.5 py-1 text-xs text-stone-400 transition hover:border-amber-700 hover:text-amber-300"
          >
            Standard Array ({STANDARD_ARRAY.join(', ')})
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {ABILITY_NAMES.map((ability) => (
            <div
              key={ability}
              className="group rounded-lg border border-stone-700/60 bg-stone-900/40 p-3 text-center transition hover:border-stone-600"
            >
              <label
                htmlFor={`stat-${ability}`}
                className="mb-0.5 block text-[10px] font-bold tracking-widest text-stone-500 uppercase"
                title={ABILITY_FULL_NAMES[ability]}
              >
                {ABILITY_LABELS[ability]}
              </label>
              <input
                id={`stat-${ability}`}
                type="number"
                min={1}
                max={20}
                data-testid={`stat-${ability}-input`}
                value={stats[ability]}
                onChange={(e) => handleStatChange(ability, e.target.value)}
                className="w-full rounded border-0 bg-transparent py-1 text-center text-2xl font-bold text-stone-100 outline-none transition focus:text-amber-200 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span className="text-xs text-stone-500">
                {getModifier(stats[ability])}
              </span>
              {fieldErrors[`stats.${ability}`] && (
                <p className="mt-1 text-[11px] text-red-400">
                  {fieldErrors[`stats.${ability}`]}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {formError && (
        <p data-testid="form-error" className="text-sm text-red-400">
          {formError}
        </p>
      )}

      <button
        type="submit"
        data-testid="save-character-button"
        disabled={loading}
        className="w-full rounded-md bg-amber-700 px-4 py-3 font-medium tracking-wide text-amber-50 transition hover:bg-amber-600 disabled:opacity-50"
      >
        {loading
          ? 'Saving...'
          : isEditing
            ? 'Update Character'
            : 'Save Character'}
      </button>
    </form>
  )
}
