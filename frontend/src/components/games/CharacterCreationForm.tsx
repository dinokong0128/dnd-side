'use client'

import { useState } from 'react'
import { z } from 'zod'

const D5E_CLASSES = [
  'Fighter',
  'Wizard',
  'Rogue',
  'Cleric',
  'Ranger',
  'Barbarian',
  'Paladin',
  'Druid',
  'Bard',
  'Monk',
  'Sorcerer',
  'Warlock',
] as const

const ABILITY_NAMES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const
const ABILITY_LABELS: Record<string, string> = {
  str: 'STR',
  dex: 'DEX',
  con: 'CON',
  int: 'INT',
  wis: 'WIS',
  cha: 'CHA',
}

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8]

const CLASS_HIT_DIE: Record<string, number> = {
  Barbarian: 12,
  Fighter: 10,
  Paladin: 10,
  Ranger: 10,
  Bard: 8,
  Cleric: 8,
  Druid: 8,
  Monk: 8,
  Rogue: 8,
  Warlock: 8,
  Sorcerer: 6,
  Wizard: 6,
}

const statSchema = z.number().int().min(1).max(20)

const characterSchema = z.object({
  character_name: z
    .string()
    .min(1, 'Character name is required')
    .max(50, 'Character name must be 50 characters or less'),
  character_class: z.string().min(1, 'Please select a class'),
  stats: z.object({
    str: statSchema,
    dex: statSchema,
    con: statSchema,
    int: statSchema,
    wis: statSchema,
    cha: statSchema,
  }),
})

type CharacterData = {
  id: string
  character_name: string
  character_class: string
  hp_current: number
  hp_max: number
  stats: Record<string, number>
}

export function CharacterCreationForm({
  gameId,
  existingCharacter,
  onSave,
}: {
  gameId: string
  existingCharacter?: CharacterData | null
  onSave: (character: CharacterData) => void
}) {
  const [characterName, setCharacterName] = useState(
    existingCharacter?.character_name ?? ''
  )
  const [characterClass, setCharacterClass] = useState(
    existingCharacter?.character_class ?? ''
  )
  const [stats, setStats] = useState<Record<string, number>>(
    existingCharacter?.stats ?? { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
  )
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)

  const isEditing = !!existingCharacter

  function handleStatChange(stat: string, value: string) {
    const num = value === '' ? 0 : parseInt(value, 10)
    setStats((prev) => ({ ...prev, [stat]: isNaN(num) ? 0 : num }))
  }

  function fillStandardArray() {
    const filled: Record<string, number> = {}
    ABILITY_NAMES.forEach((name, i) => {
      filled[name] = STANDARD_ARRAY[i]
    })
    setStats(filled)
  }

  function getHpPreview(): number | null {
    if (!characterClass || !stats.con) return null
    const hitDie = CLASS_HIT_DIE[characterClass]
    if (!hitDie) return null
    const conMod = Math.floor((stats.con - 10) / 2)
    return hitDie + conMod
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

      const character = await response.json()
      onSave(character)
    } catch {
      setFormError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const hpPreview = getHpPreview()

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="character-creation-form"
      className="space-y-5"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold tracking-tight">
          {isEditing ? 'Edit Character' : 'Create Your Character'}
        </h2>
        {hpPreview !== null && (
          <span
            data-testid="hp-preview"
            className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800"
          >
            HP {hpPreview}
          </span>
        )}
      </div>

      {/* Character Name */}
      <div>
        <label
          htmlFor="character-name"
          className="block text-sm font-medium text-gray-300"
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
          maxLength={50}
          className="mt-1 block w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-gray-100 placeholder-gray-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
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
          className="block text-sm font-medium text-gray-300"
        >
          Class
        </label>
        <select
          id="character-class"
          data-testid="character-class-select"
          value={characterClass}
          onChange={(e) => setCharacterClass(e.target.value)}
          className="mt-1 block w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-gray-100 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
        >
          <option value="">Select a class...</option>
          {D5E_CLASSES.map((cls) => (
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
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-300">
            Ability Scores
          </label>
          <button
            type="button"
            onClick={fillStandardArray}
            className="text-xs text-amber-400 hover:text-amber-300 hover:underline"
          >
            Use Standard Array
          </button>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-3">
          {ABILITY_NAMES.map((stat) => (
            <div key={stat}>
              <label
                htmlFor={`stat-${stat}`}
                className="block text-center text-xs font-bold uppercase tracking-wider text-gray-400"
              >
                {ABILITY_LABELS[stat]}
              </label>
              <input
                id={`stat-${stat}`}
                type="number"
                data-testid={`stat-${stat}-input`}
                min={1}
                max={20}
                value={stats[stat] || ''}
                onChange={(e) => handleStatChange(stat, e.target.value)}
                className="mt-1 block w-full rounded border border-gray-600 bg-gray-800 px-2 py-2 text-center text-lg font-semibold text-gray-100 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              {fieldErrors[`stats.${stat}`] && (
                <p className="mt-0.5 text-center text-xs text-red-400">
                  1-20
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
        className="w-full rounded bg-amber-600 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-amber-500 disabled:opacity-50"
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
