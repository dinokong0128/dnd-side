'use client'

import { useState } from 'react'
import { z } from 'zod'

const CHARACTER_CLASSES = [
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

const characterSchema = z.object({
  character_name: z
    .string()
    .min(1, { message: 'Character name is required' })
    .max(50, { message: 'Character name must be 50 characters or less' }),
  character_class: z.enum(CHARACTER_CLASSES, {
    message: 'Please select a class',
  }),
  stats: z.object(
    Object.fromEntries(
      ABILITY_NAMES.map((name) => [
        name,
        z
          .number({ message: `${ABILITY_LABELS[name]} is required` })
          .int({ message: `${ABILITY_LABELS[name]} must be a whole number` })
          .min(1, { message: `${ABILITY_LABELS[name]} must be at least 1` })
          .max(20, { message: `${ABILITY_LABELS[name]} must be at most 20` }),
      ])
    ) as Record<(typeof ABILITY_NAMES)[number], z.ZodNumber>
  ),
})

type SavedCharacter = {
  id: string
  character_name: string
  character_class: string
  hp_max: number
  stats: Record<string, number>
}

type CharacterCreationFormProps = {
  gameId: string
  existingPlayer?: SavedCharacter | null
  onSave: (player: SavedCharacter, inventory: InventoryItem[]) => void
}

type InventoryItem = {
  id: string
  player_id: string
  item_name: string
  quantity: number
  properties: Record<string, unknown> | null
  created_at: string
}

export function CharacterCreationForm({
  gameId,
  existingPlayer,
  onSave,
}: CharacterCreationFormProps) {
  const [characterName, setCharacterName] = useState(
    existingPlayer?.character_name ?? ''
  )
  const [characterClass, setCharacterClass] = useState(
    existingPlayer?.character_class ?? ''
  )
  const [stats, setStats] = useState<Record<string, string>>(
    Object.fromEntries(
      ABILITY_NAMES.map((name) => [
        name,
        existingPlayer?.stats[name]?.toString() ?? '',
      ])
    )
  )
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleStatChange(ability: string, value: string) {
    setStats((prev) => ({ ...prev, [ability]: value }))
  }

  function fillStandardArray() {
    const newStats: Record<string, string> = {}
    ABILITY_NAMES.forEach((name, i) => {
      newStats[name] = STANDARD_ARRAY[i].toString()
    })
    setStats(newStats)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldErrors({})
    setFormError('')

    const parsedStats: Record<string, number> = {}
    for (const name of ABILITY_NAMES) {
      const val = stats[name]
      parsedStats[name] = val === '' ? NaN : parseInt(val, 10)
    }

    const result = characterSchema.safeParse({
      character_name: characterName,
      character_class: characterClass || undefined,
      stats: parsedStats,
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.data),
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

      const { player, inventory } = await response.json()
      onSave(
        {
          id: player.id,
          character_name: player.character_name,
          character_class: player.character_class,
          hp_max: player.hp_max,
          stats: player.stats,
        },
        inventory
      )
    } catch {
      setFormError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} data-testid="character-creation-form">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <h2 className="mb-1 text-lg font-bold tracking-tight">
          Create Your Character
        </h2>
        <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">
          Define who you are before the adventure begins.
        </p>

        <div className="space-y-4">
          {/* Character Name */}
          <div>
            <label
              htmlFor="character-name"
              className="mb-1 block text-sm font-medium"
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
              className="block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
            />
            <p className="mt-0.5 text-xs text-gray-400">
              Give your adventurer a memorable title.
            </p>
            {fieldErrors.character_name && (
              <p
                data-testid="error-character-name"
                className="mt-1 text-sm text-red-600"
              >
                {fieldErrors.character_name}
              </p>
            )}
          </div>

          {/* Character Class */}
          <div>
            <label
              htmlFor="character-class"
              className="mb-1 block text-sm font-medium"
            >
              Class
            </label>
            <select
              id="character-class"
              data-testid="character-class-select"
              value={characterClass}
              onChange={(e) => setCharacterClass(e.target.value)}
              className="block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
            >
              <option value="">Select a class...</option>
              {CHARACTER_CLASSES.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>
            {fieldErrors.character_class && (
              <p
                data-testid="error-character-class"
                className="mt-1 text-sm text-red-600"
              >
                {fieldErrors.character_class}
              </p>
            )}
          </div>

          {/* Ability Scores */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-sm font-medium">
                Ability Scores
              </label>
              <button
                type="button"
                onClick={fillStandardArray}
                className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                data-testid="standard-array-button"
              >
                Standard Array
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {ABILITY_NAMES.map((ability) => (
                <div key={ability}>
                  <label
                    htmlFor={`stat-${ability}`}
                    className="mb-1 block text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
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
                    className="block w-full rounded border border-gray-300 px-2 py-2 text-center text-sm font-mono tabular-nums focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
                  />
                  {fieldErrors[`stats.${ability}`] && (
                    <p className="mt-0.5 text-center text-xs text-red-600">
                      {fieldErrors[`stats.${ability}`]}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Each score must be between 1 and 20.
            </p>
          </div>
        </div>

        {formError && (
          <p
            data-testid="form-error"
            className="mt-4 text-sm text-red-600"
          >
            {formError}
          </p>
        )}

        <button
          type="submit"
          data-testid="save-character-button"
          disabled={loading}
          className="mt-5 w-full rounded bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save Character'}
        </button>
      </div>
    </form>
  )
}
