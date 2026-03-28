'use client'

import { useState } from 'react'
import { z } from 'zod'
import {
  CHARACTER_CLASSES,
  CLASS_HIT_DIE,
  type PlayerStats,
} from '@/lib/supabase/players'

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8]

const ABILITY_LABELS: { key: keyof PlayerStats; label: string; abbr: string }[] = [
  { key: 'str', label: 'Strength', abbr: 'STR' },
  { key: 'dex', label: 'Dexterity', abbr: 'DEX' },
  { key: 'con', label: 'Constitution', abbr: 'CON' },
  { key: 'int', label: 'Intelligence', abbr: 'INT' },
  { key: 'wis', label: 'Wisdom', abbr: 'WIS' },
  { key: 'cha', label: 'Charisma', abbr: 'CHA' },
]

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
    .max(50, { error: 'Character name must be 50 characters or less' }),
  character_class: z.enum(CHARACTER_CLASSES, {
    error: 'Please select a class',
  }),
  stats: statsSchema,
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

  function handleStatChange(key: keyof PlayerStats, value: string) {
    const num = value === '' ? 0 : parseInt(value, 10)
    setStats((prev) => ({ ...prev, [key]: isNaN(num) ? 0 : num }))
  }

  function fillStandardArray() {
    setStats({
      str: STANDARD_ARRAY[0],
      dex: STANDARD_ARRAY[1],
      con: STANDARD_ARRAY[2],
      int: STANDARD_ARRAY[3],
      wis: STANDARD_ARRAY[4],
      cha: STANDARD_ARRAY[5],
    })
  }

  function getConModifier(): number {
    return Math.floor((stats.con - 10) / 2)
  }

  function getHpPreview(): number | null {
    if (!characterClass) return null
    const hitDie = CLASS_HIT_DIE[characterClass]
    if (!hitDie) return null
    return hitDie + getConModifier()
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
      const method = isEditing ? 'PATCH' : 'POST'
      const response = await fetch(`/api/games/${gameId}/players`, {
        method,
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

  const hpPreview = getHpPreview()

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="character-creation-form"
      className="space-y-6"
    >
      <div className="border-b border-amber-900/20 pb-2">
        <h2 className="text-xl font-bold tracking-tight text-amber-100">
          {isEditing ? 'Edit Your Character' : 'Create Your Character'}
        </h2>
        <p className="mt-1 text-sm text-zinc-400">
          Forge your hero before the adventure begins.
        </p>
      </div>

      {/* Character Name */}
      <div>
        <label
          htmlFor="character-name"
          className="block text-sm font-semibold text-amber-200/80"
        >
          Character Name
        </label>
        <p className="mt-0.5 text-xs text-zinc-500">
          Give your adventurer a memorable title.
        </p>
        <input
          id="character-name"
          type="text"
          data-testid="character-name-input"
          value={characterName}
          onChange={(e) => setCharacterName(e.target.value)}
          placeholder="Thorin Oakenshield"
          maxLength={50}
          className="mt-1.5 block w-full rounded-md border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-zinc-100 placeholder:text-zinc-600 focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600/50"
        />
        {fieldErrors.character_name && (
          <p className="mt-1 text-sm text-red-400">{fieldErrors.character_name}</p>
        )}
      </div>

      {/* Character Class */}
      <div>
        <label
          htmlFor="character-class"
          className="block text-sm font-semibold text-amber-200/80"
        >
          Class
        </label>
        <select
          id="character-class"
          data-testid="character-class-select"
          value={characterClass}
          onChange={(e) => setCharacterClass(e.target.value)}
          className="mt-1.5 block w-full rounded-md border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-zinc-100 focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600/50"
        >
          <option value="" disabled>
            Choose your path...
          </option>
          {CHARACTER_CLASSES.map((cls) => (
            <option key={cls} value={cls}>
              {cls}
            </option>
          ))}
        </select>
        {fieldErrors.character_class && (
          <p className="mt-1 text-sm text-red-400">{fieldErrors.character_class}</p>
        )}
        {hpPreview !== null && (
          <p className="mt-1.5 text-xs text-zinc-400">
            Hit Die: d{CLASS_HIT_DIE[characterClass]} &middot; Starting HP:{' '}
            <span className="font-semibold text-emerald-400">{hpPreview}</span>
          </p>
        )}
      </div>

      {/* Ability Scores */}
      <div>
        <div className="flex items-center justify-between">
          <label className="block text-sm font-semibold text-amber-200/80">
            Ability Scores
          </label>
          <button
            type="button"
            onClick={fillStandardArray}
            className="text-xs text-amber-500 hover:text-amber-400 transition-colors"
          >
            Fill Standard Array ({STANDARD_ARRAY.join(', ')})
          </button>
        </div>
        <p className="mt-0.5 text-xs text-zinc-500">Each score must be between 1 and 20.</p>

        <div className="mt-3 grid grid-cols-3 gap-3">
          {ABILITY_LABELS.map(({ key, label, abbr }) => (
            <div
              key={key}
              className="rounded-lg border border-zinc-700/50 bg-zinc-800/30 p-3 text-center"
            >
              <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                {abbr}
              </div>
              <div className="mt-0.5 text-[10px] text-zinc-600">{label}</div>
              <input
                type="number"
                data-testid={`stat-${key}-input`}
                value={stats[key] || ''}
                onChange={(e) => handleStatChange(key, e.target.value)}
                min={1}
                max={20}
                className="mt-1.5 w-full rounded border border-zinc-700 bg-zinc-900/50 px-1 py-1 text-center text-lg font-bold text-zinc-100 focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600/50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <div className="mt-0.5 text-[10px] text-zinc-500">
                mod: {stats[key] >= 1 ? (Math.floor((stats[key] - 10) / 2) >= 0 ? '+' : '') : ''}
                {stats[key] >= 1 ? Math.floor((stats[key] - 10) / 2) : '—'}
              </div>
              {fieldErrors[`stats.${key}`] && (
                <p className="mt-1 text-[10px] text-red-400">
                  {fieldErrors[`stats.${key}`]}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {formError && (
        <div
          data-testid="form-error"
          className="rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-400"
        >
          {formError}
        </div>
      )}

      <button
        type="submit"
        data-testid="save-character-button"
        disabled={loading}
        className="w-full rounded-md bg-amber-700 px-4 py-2.5 font-semibold text-amber-50 transition-colors hover:bg-amber-600 disabled:opacity-50"
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
