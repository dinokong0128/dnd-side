'use client'

import { useState } from 'react'
import { z } from 'zod'
import {
  CHARACTER_CLASSES,
  CLASS_HIT_DIE,
} from '@/lib/constants/starting-inventory'

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
  character_class: z.enum(CHARACTER_CLASSES as [string, ...string[]], {
    error: 'Please select a class',
  }),
  stats: statsSchema,
})

type Stats = z.infer<typeof statsSchema>

type Props = {
  gameId: string
  initialData?: {
    character_name: string
    character_class: string
    stats: Stats
  } | null
  onSaved: () => void
}

export function CharacterCreationForm({ gameId, initialData, onSaved }: Props) {
  const [name, setName] = useState(initialData?.character_name ?? '')
  const [characterClass, setCharacterClass] = useState(
    initialData?.character_class ?? ''
  )
  const [stats, setStats] = useState<Stats>(
    initialData?.stats ?? { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
  )
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleStatChange(key: keyof Stats, value: string) {
    const num = value === '' ? 0 : parseInt(value, 10)
    if (!isNaN(num)) {
      setStats((prev) => ({ ...prev, [key]: num }))
    }
  }

  function fillStandardArray() {
    const shuffled = [...STANDARD_ARRAY]
    setStats({
      str: shuffled[0],
      dex: shuffled[1],
      con: shuffled[2],
      int: shuffled[3],
      wis: shuffled[4],
      cha: shuffled[5],
    })
  }

  function getHpPreview(): number | null {
    if (!characterClass) return null
    const hitDie = CLASS_HIT_DIE[characterClass] ?? 8
    const conMod = Math.floor((stats.con - 10) / 2)
    return hitDie + conMod
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldErrors({})
    setFormError('')

    const result = characterSchema.safeParse({
      character_name: name,
      character_class: characterClass,
      stats,
    })

    if (!result.success) {
      const errors: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const path = issue.path.join('.')
        if (!errors[path]) {
          errors[path] = issue.message
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
        body: JSON.stringify({
          character_name: name,
          character_class: characterClass,
          stats,
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

  const hpPreview = getHpPreview()

  return (
    <form onSubmit={handleSubmit} data-testid="character-creation-form" className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight text-amber-100">
          Create Your Character
        </h2>
        {hpPreview !== null && (
          <span
            data-testid="hp-preview"
            className="rounded-full bg-red-900/60 px-3 py-1 text-xs font-medium text-red-200"
          >
            HP {hpPreview}
          </span>
        )}
      </div>

      {/* Character Name */}
      <div>
        <label htmlFor="character-name" className="mb-1 block text-sm font-medium text-amber-200/80">
          Character Name
        </label>
        <input
          id="character-name"
          type="text"
          data-testid="character-name-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Thorin Oakenshield"
          maxLength={50}
          className="block w-full rounded-md border border-amber-900/40 bg-amber-950/40 px-3 py-2 text-amber-50 placeholder:text-amber-800/60 focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600"
        />
        {fieldErrors.character_name && (
          <p className="mt-1 text-sm text-red-400">{fieldErrors.character_name}</p>
        )}
      </div>

      {/* Character Class */}
      <div>
        <label htmlFor="character-class" className="mb-1 block text-sm font-medium text-amber-200/80">
          Class
        </label>
        <select
          id="character-class"
          data-testid="character-class-select"
          value={characterClass}
          onChange={(e) => setCharacterClass(e.target.value)}
          className="block w-full rounded-md border border-amber-900/40 bg-amber-950/40 px-3 py-2 text-amber-50 focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600"
        >
          <option value="">Select a class...</option>
          {CHARACTER_CLASSES.map((cls) => (
            <option key={cls} value={cls}>
              {cls}
            </option>
          ))}
        </select>
        {fieldErrors.character_class && (
          <p className="mt-1 text-sm text-red-400">{fieldErrors.character_class}</p>
        )}
      </div>

      {/* Ability Scores */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-amber-200/80">Ability Scores</span>
          <button
            type="button"
            onClick={fillStandardArray}
            className="rounded border border-amber-800/50 px-2 py-0.5 text-xs text-amber-400 transition-colors hover:bg-amber-900/30 hover:text-amber-300"
          >
            Standard Array
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {ABILITY_NAMES.map((key) => (
            <div key={key}>
              <label
                htmlFor={`stat-${key}`}
                className="mb-1 block text-center text-xs font-semibold uppercase tracking-wider text-amber-400/70"
              >
                {ABILITY_LABELS[key]}
              </label>
              <input
                id={`stat-${key}`}
                type="number"
                data-testid={`stat-${key}-input`}
                value={stats[key]}
                min={1}
                max={20}
                onChange={(e) => handleStatChange(key, e.target.value)}
                className="block w-full rounded-md border border-amber-900/40 bg-amber-950/40 px-2 py-2 text-center text-lg font-bold text-amber-100 focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              {fieldErrors[`stats.${key}`] && (
                <p className="mt-0.5 text-xs text-red-400">1-20</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {formError && (
        <p data-testid="form-error" className="rounded-md bg-red-950/60 px-3 py-2 text-sm text-red-300">
          {formError}
        </p>
      )}

      <button
        type="submit"
        data-testid="save-character-button"
        disabled={loading}
        className="w-full rounded-md bg-amber-700 px-4 py-2.5 font-semibold text-amber-50 transition-colors hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-stone-900 disabled:opacity-50"
      >
        {loading ? 'Saving...' : initialData ? 'Update Character' : 'Save Character'}
      </button>
    </form>
  )
}
