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

const ABILITY_SCORES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const

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
    .min(1, { error: 'Character name is required' })
    .max(50, { error: 'Character name must be 50 characters or less' }),
  character_class: z.enum(CHARACTER_CLASSES, {
    error: 'Please select a class',
  }),
  stats: z.object({
    str: z
      .number({ error: 'Required' })
      .int()
      .min(1, { error: 'Min 1' })
      .max(20, { error: 'Max 20' }),
    dex: z
      .number({ error: 'Required' })
      .int()
      .min(1, { error: 'Min 1' })
      .max(20, { error: 'Max 20' }),
    con: z
      .number({ error: 'Required' })
      .int()
      .min(1, { error: 'Min 1' })
      .max(20, { error: 'Max 20' }),
    int: z
      .number({ error: 'Required' })
      .int()
      .min(1, { error: 'Min 1' })
      .max(20, { error: 'Max 20' }),
    wis: z
      .number({ error: 'Required' })
      .int()
      .min(1, { error: 'Min 1' })
      .max(20, { error: 'Max 20' }),
    cha: z
      .number({ error: 'Required' })
      .int()
      .min(1, { error: 'Min 1' })
      .max(20, { error: 'Max 20' }),
  }),
})

type PlayerData = {
  id: string
  character_name: string
  character_class: string
  hp_current: number
  hp_max: number
  stats: Record<string, number>
}

type Props = {
  gameId: string
  existingPlayer?: PlayerData | null
  onSave: (player: PlayerData) => void
}

export function CharacterCreationForm({ gameId, existingPlayer, onSave }: Props) {
  const isEditing = !!existingPlayer

  const [characterName, setCharacterName] = useState(
    existingPlayer?.character_name ?? ''
  )
  const [characterClass, setCharacterClass] = useState(
    existingPlayer?.character_class ?? ''
  )
  const [stats, setStats] = useState<Record<string, string>>(() => {
    if (existingPlayer?.stats) {
      return Object.fromEntries(
        ABILITY_SCORES.map((key) => [
          key,
          String(existingPlayer.stats[key] ?? ''),
        ])
      )
    }
    return Object.fromEntries(ABILITY_SCORES.map((key) => [key, '']))
  })

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)

  function fillStandardArray() {
    const newStats: Record<string, string> = {}
    ABILITY_SCORES.forEach((key, i) => {
      newStats[key] = String(STANDARD_ARRAY[i])
    })
    setStats(newStats)
  }

  function handleStatChange(key: string, value: string) {
    const cleaned = value.replace(/[^0-9]/g, '')
    setStats((prev) => ({ ...prev, [key]: cleaned }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldErrors({})
    setFormError('')

    const parsedStats = Object.fromEntries(
      ABILITY_SCORES.map((key) => [
        key,
        stats[key] === '' ? undefined : Number(stats[key]),
      ])
    )

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
      const method = isEditing ? 'PATCH' : 'POST'
      const response = await fetch(`/api/games/${gameId}/players`, {
        method,
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

      const player = await response.json()
      onSave(player)
    } catch {
      setFormError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="character-creation-form"
      className="space-y-5 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
    >
      <h2 className="text-xl font-bold text-gray-900">
        {isEditing ? 'Edit Your Character' : 'Create Your Character'}
      </h2>

      <div>
        <label
          htmlFor="character-name"
          className="block text-sm font-medium text-gray-700"
        >
          Character Name <span className="text-red-500">*</span>
        </label>
        <input
          id="character-name"
          type="text"
          data-testid="character-name-input"
          value={characterName}
          onChange={(e) => setCharacterName(e.target.value)}
          placeholder="Thorin Oakenshield"
          maxLength={50}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {fieldErrors.character_name && (
          <p className="mt-1 text-sm text-red-600">
            {fieldErrors.character_name}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="character-class"
          className="block text-sm font-medium text-gray-700"
        >
          Class <span className="text-red-500">*</span>
        </label>
        <select
          id="character-class"
          data-testid="character-class-select"
          value={characterClass}
          onChange={(e) => setCharacterClass(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Select a class...</option>
          {CHARACTER_CLASSES.map((cls) => (
            <option key={cls} value={cls}>
              {cls}
            </option>
          ))}
        </select>
        {fieldErrors.character_class && (
          <p className="mt-1 text-sm text-red-600">
            {fieldErrors.character_class}
          </p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700">
            Ability Scores <span className="text-red-500">*</span>
          </label>
          <button
            type="button"
            onClick={fillStandardArray}
            className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
          >
            Use Standard Array [15, 14, 13, 12, 10, 8]
          </button>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-3">
          {ABILITY_SCORES.map((key) => (
            <div key={key}>
              <label
                htmlFor={`stat-${key}`}
                className="block text-center text-xs font-semibold uppercase tracking-wide text-gray-500"
              >
                {ABILITY_LABELS[key]}
              </label>
              <input
                id={`stat-${key}`}
                type="text"
                inputMode="numeric"
                data-testid={`stat-${key}-input`}
                value={stats[key]}
                onChange={(e) => handleStatChange(key, e.target.value)}
                placeholder="10"
                className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-2 text-center text-lg font-bold text-gray-900 placeholder-gray-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {fieldErrors[`stats.${key}`] && (
                <p className="mt-0.5 text-center text-xs text-red-600">
                  {fieldErrors[`stats.${key}`]}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {formError && (
        <p data-testid="form-error" className="text-sm text-red-600">
          {formError}
        </p>
      )}

      <button
        type="submit"
        data-testid="save-character-button"
        disabled={loading}
        className="w-full rounded-md bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
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
