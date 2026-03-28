'use client'

import { useState } from 'react'
import { z } from 'zod'
import {
  CHARACTER_CLASSES,
  ABILITY_NAMES,
  ABILITY_LABELS,
  STANDARD_ARRAY,
  CLASS_HIT_DIE,
  calculateHpMax,
  formatModifier,
  type CharacterClass,
  type AbilityName,
} from '@/lib/game-data'

const characterSchema = z.object({
  character_name: z
    .string()
    .min(1, { error: 'Character name is required' })
    .max(50, { error: 'Name must be 50 characters or less' }),
  character_class: z.string().min(1, { error: 'Select a class' }),
  stats: z.object({
    str: z.number().int().min(1, { error: '1\u201320' }).max(20, { error: '1\u201320' }),
    dex: z.number().int().min(1, { error: '1\u201320' }).max(20, { error: '1\u201320' }),
    con: z.number().int().min(1, { error: '1\u201320' }).max(20, { error: '1\u201320' }),
    int: z.number().int().min(1, { error: '1\u201320' }).max(20, { error: '1\u201320' }),
    wis: z.number().int().min(1, { error: '1\u201320' }).max(20, { error: '1\u201320' }),
    cha: z.number().int().min(1, { error: '1\u201320' }).max(20, { error: '1\u201320' }),
  }),
})

type Props = {
  gameId: string
  initialData?: {
    character_name: string
    character_class: string
    stats: Record<string, number>
  }
  isEdit?: boolean
  onSaved: () => void
}

export function CharacterCreationForm({
  gameId,
  initialData,
  isEdit,
  onSaved,
}: Props) {
  const [name, setName] = useState(initialData?.character_name ?? '')
  const [characterClass, setCharacterClass] = useState(
    initialData?.character_class ?? ''
  )
  const [stats, setStats] = useState<Record<AbilityName, string>>({
    str: initialData?.stats?.str?.toString() ?? '',
    dex: initialData?.stats?.dex?.toString() ?? '',
    con: initialData?.stats?.con?.toString() ?? '',
    int: initialData?.stats?.int?.toString() ?? '',
    wis: initialData?.stats?.wis?.toString() ?? '',
    cha: initialData?.stats?.cha?.toString() ?? '',
  })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)

  const conValue = parseInt(stats.con) || 10
  const hpPreview =
    characterClass && CLASS_HIT_DIE[characterClass as CharacterClass]
      ? calculateHpMax(characterClass as CharacterClass, conValue)
      : null

  function fillStandardArray() {
    const names = [...ABILITY_NAMES]
    setStats(
      Object.fromEntries(
        names.map((n, i) => [n, STANDARD_ARRAY[i].toString()])
      ) as Record<AbilityName, string>
    )
  }

  function updateStat(ability: AbilityName, value: string) {
    setStats((prev) => ({ ...prev, [ability]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldErrors({})
    setFormError('')

    const parsedStats = Object.fromEntries(
      ABILITY_NAMES.map((n) => [n, parseInt(stats[n]) || 0])
    )

    const result = characterSchema.safeParse({
      character_name: name,
      character_class: characterClass,
      stats: parsedStats,
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
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.data),
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

  return (
    <form onSubmit={handleSubmit} className="dnd-card space-y-6">
      <div>
        <h2 className="dnd-heading text-xl">
          {isEdit ? 'Edit Your Character' : 'Create Your Character'}
        </h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--dnd-text-dim)' }}>
          Define who you are before the adventure begins
        </p>
      </div>

      {/* Character Name */}
      <div>
        <label htmlFor="character-name" className="dnd-label">
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
          className="dnd-input"
        />
        {fieldErrors.character_name && (
          <p className="dnd-error">{fieldErrors.character_name}</p>
        )}
      </div>

      {/* Class Selection */}
      <div>
        <label htmlFor="character-class" className="dnd-label">
          Class
        </label>
        <select
          id="character-class"
          data-testid="character-class-select"
          value={characterClass}
          onChange={(e) => setCharacterClass(e.target.value)}
          className="dnd-input"
        >
          <option value="">Choose your calling\u2026</option>
          {CHARACTER_CLASSES.map((cls) => (
            <option key={cls} value={cls}>
              {cls}
            </option>
          ))}
        </select>
        {fieldErrors.character_class && (
          <p className="dnd-error">{fieldErrors.character_class}</p>
        )}
        {hpPreview !== null && (
          <p className="mt-2 text-sm">
            <span style={{ color: 'var(--dnd-text-dim)' }}>Hit Points: </span>
            <span className="dnd-hp-badge">{hpPreview} HP</span>
          </p>
        )}
      </div>

      {/* Ability Scores */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="dnd-label" style={{ marginBottom: 0 }}>
            Ability Scores
          </span>
          <button
            type="button"
            onClick={fillStandardArray}
            className="dnd-button-ghost"
          >
            Standard Array
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {ABILITY_NAMES.map((ability) => {
            const value = parseInt(stats[ability])
            const hasValue = !isNaN(value) && value >= 1 && value <= 20
            return (
              <div key={ability} className="dnd-stat-input">
                <label
                  htmlFor={`stat-${ability}`}
                  className="dnd-stat-label"
                >
                  {ABILITY_LABELS[ability].short}
                </label>
                <input
                  id={`stat-${ability}`}
                  type="number"
                  min={1}
                  max={20}
                  data-testid={`stat-${ability}-input`}
                  value={stats[ability]}
                  onChange={(e) => updateStat(ability, e.target.value)}
                  className="dnd-stat-value"
                />
                {hasValue && (
                  <span className="dnd-stat-modifier">
                    {formatModifier(value)}
                  </span>
                )}
                {fieldErrors[`stats.${ability}`] && (
                  <p className="dnd-error text-xs mt-1">
                    {fieldErrors[`stats.${ability}`]}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {formError && (
        <p data-testid="form-error" className="dnd-error">
          {formError}
        </p>
      )}

      <button
        type="submit"
        data-testid="submit-button"
        disabled={loading}
        className="dnd-button-primary w-full"
      >
        {loading
          ? 'Saving\u2026'
          : isEdit
            ? 'Update Character'
            : 'Seal Your Fate'}
      </button>
    </form>
  )
}
