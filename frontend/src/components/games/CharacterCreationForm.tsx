'use client'

import { useState } from 'react'
import { z } from 'zod'
import {
  CHARACTER_CLASSES,
  STANDARD_ARRAY,
  calculateModifier,
  formatModifier,
  calculateHpMax,
  type PlayerStats,
} from '@/lib/supabase/players'

const ABILITY_NAMES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const

const characterSchema = z.object({
  character_name: z
    .string()
    .min(1, { error: 'Character name is required' })
    .max(50, { error: 'Character name must be 50 characters or less' }),
  character_class: z
    .string()
    .min(1, { error: 'Please select a class' }),
  str: z.number().int().min(1).max(20),
  dex: z.number().int().min(1).max(20),
  con: z.number().int().min(1).max(20),
  int: z.number().int().min(1).max(20),
  wis: z.number().int().min(1).max(20),
  cha: z.number().int().min(1).max(20),
})

type Props = {
  gameId: string
  existingPlayer?: {
    character_name: string
    character_class: string
    stats: PlayerStats
  } | null
  onSaved: () => void
}

export function CharacterCreationForm({ gameId, existingPlayer, onSaved }: Props) {
  const [characterName, setCharacterName] = useState(existingPlayer?.character_name ?? '')
  const [characterClass, setCharacterClass] = useState(existingPlayer?.character_class ?? '')
  const [stats, setStats] = useState<Record<string, number | string>>({
    str: existingPlayer?.stats?.str ?? '',
    dex: existingPlayer?.stats?.dex ?? '',
    con: existingPlayer?.stats?.con ?? '',
    int: existingPlayer?.stats?.int ?? '',
    wis: existingPlayer?.stats?.wis ?? '',
    cha: existingPlayer?.stats?.cha ?? '',
  })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleStatChange(stat: string, value: string) {
    if (value === '') {
      setStats((prev) => ({ ...prev, [stat]: '' }))
      return
    }
    const num = parseInt(value, 10)
    if (!isNaN(num)) {
      setStats((prev) => ({ ...prev, [stat]: num }))
    }
  }

  function fillStandardArray() {
    const names = [...ABILITY_NAMES]
    names.forEach((name, i) => {
      setStats((prev) => ({ ...prev, [name]: STANDARD_ARRAY[i] }))
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldErrors({})
    setFormError('')

    const parsed = characterSchema.safeParse({
      character_name: characterName,
      character_class: characterClass,
      str: typeof stats.str === 'number' ? stats.str : NaN,
      dex: typeof stats.dex === 'number' ? stats.dex : NaN,
      con: typeof stats.con === 'number' ? stats.con : NaN,
      int: typeof stats.int === 'number' ? stats.int : NaN,
      wis: typeof stats.wis === 'number' ? stats.wis : NaN,
      cha: typeof stats.cha === 'number' ? stats.cha : NaN,
    })

    if (!parsed.success) {
      const errors: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0])
        if (!errors[field]) {
          if (ABILITY_NAMES.includes(field as typeof ABILITY_NAMES[number])) {
            errors.stats = 'All ability scores must be between 1 and 20'
          } else {
            errors[field] = issue.message
          }
        }
      }
      setFieldErrors(errors)
      return
    }

    setLoading(true)
    try {
      const conScore = parsed.data.con
      const hpMax = calculateHpMax(parsed.data.character_class, conScore)

      const response = await fetch(`/api/games/${gameId}/players`, {
        method: existingPlayer ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character_name: parsed.data.character_name,
          character_class: parsed.data.character_class,
          stats: {
            str: parsed.data.str,
            dex: parsed.data.dex,
            con: parsed.data.con,
            int: parsed.data.int,
            wis: parsed.data.wis,
            cha: parsed.data.cha,
            hp_max: hpMax,
          },
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        setFormError(data.error || 'Failed to save character')
        return
      }

      onSaved()
    } catch {
      setFormError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const conValue = typeof stats.con === 'number' ? stats.con : 0
  const hpPreview = characterClass ? calculateHpMax(characterClass, conValue) : null

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="character-creation-form"
      className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900"
    >
      <h3 className="text-lg font-bold">Create Your Character</h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Define your hero before the adventure begins.
      </p>

      <div className="mt-5 space-y-4">
        {/* Character Name */}
        <div>
          <label htmlFor="character-name" className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Character Name
          </label>
          <input
            id="character-name"
            type="text"
            data-testid="character-name-input"
            value={characterName}
            onChange={(e) => setCharacterName(e.target.value)}
            placeholder="e.g. Thorin Oakenshield"
            maxLength={50}
            className="mt-1 block w-full rounded border px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
          />
          {fieldErrors.character_name && (
            <p className="mt-1 text-sm text-red-600">{fieldErrors.character_name}</p>
          )}
        </div>

        {/* Character Class */}
        <div>
          <label htmlFor="character-class" className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Class
          </label>
          <select
            id="character-class"
            data-testid="character-class-select"
            value={characterClass}
            onChange={(e) => setCharacterClass(e.target.value)}
            className="mt-1 block w-full rounded border px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
          >
            <option value="">Select a class...</option>
            {CHARACTER_CLASSES.map((cls) => (
              <option key={cls} value={cls}>
                {cls}
              </option>
            ))}
          </select>
          {fieldErrors.character_class && (
            <p className="mt-1 text-sm text-red-600">{fieldErrors.character_class}</p>
          )}
        </div>

        {/* Ability Scores */}
        <div>
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Ability Scores
            </label>
            <button
              type="button"
              onClick={fillStandardArray}
              className="rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
            >
              Standard Array
            </button>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {ABILITY_NAMES.map((ability) => {
              const val = stats[ability]
              const numVal = typeof val === 'number' ? val : null
              const hasError = fieldErrors.stats && (val === '' || (typeof val === 'number' && (val < 1 || val > 20)))
              return (
                <div
                  key={ability}
                  className={`rounded border p-3 text-center ${
                    hasError
                      ? 'border-red-400 dark:border-red-500'
                      : 'border-gray-200 dark:border-gray-600'
                  }`}
                >
                  <div className="text-xs font-bold uppercase tracking-widest text-gray-400">
                    {ability}
                  </div>
                  <input
                    type="number"
                    data-testid={`stat-${ability}-input`}
                    value={val}
                    onChange={(e) => handleStatChange(ability, e.target.value)}
                    min={1}
                    max={20}
                    className="mt-1 w-full bg-transparent text-center text-xl font-bold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <div className="mt-0.5 text-xs text-gray-400">
                    {numVal !== null && numVal >= 1 && numVal <= 20
                      ? formatModifier(numVal)
                      : '\u00A0'}
                  </div>
                </div>
              )
            })}
          </div>
          {fieldErrors.stats && (
            <p className="mt-1 text-sm text-red-600">{fieldErrors.stats}</p>
          )}
        </div>

        {/* HP Preview */}
        {hpPreview !== null && conValue >= 1 && conValue <= 20 && (
          <div className="rounded border border-gray-200 bg-gray-50 px-4 py-2 text-sm dark:border-gray-600 dark:bg-gray-800">
            <span className="text-gray-500 dark:text-gray-400">Estimated HP: </span>
            <span className="font-bold">{hpPreview}</span>
            <span className="ml-1 text-xs text-gray-400">
              ({characterClass} hit die + CON modifier)
            </span>
          </div>
        )}

        {formError && (
          <p data-testid="form-error" className="text-sm text-red-600">
            {formError}
          </p>
        )}

        <button
          type="submit"
          data-testid="save-character-button"
          disabled={loading}
          className="w-full rounded bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Saving...' : existingPlayer ? 'Update Character' : 'Save Character'}
        </button>
      </div>
    </form>
  )
}
