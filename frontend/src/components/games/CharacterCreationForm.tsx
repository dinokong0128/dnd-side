'use client'

import { useState } from 'react'
import { z } from 'zod'
import {
  CHARACTER_CLASSES,
  ABILITY_NAMES,
  ABILITY_FULL_NAMES,
  STANDARD_ARRAY,
  CLASS_ICONS,
  CLASS_FLAVOR,
  CLASS_HIT_DIE,
  abilityModifier,
  formatModifier,
  type CharacterClass,
  type AbilityName,
} from '@/lib/game-data/characters'
import type { Player, InventoryItem } from '@/lib/supabase/players'

const characterSchema = z.object({
  character_name: z
    .string()
    .min(1, 'Character name is required')
    .max(50, 'Max 50 characters'),
  character_class: z.enum(CHARACTER_CLASSES as unknown as [string, ...string[]], {
    error: 'Please select a class',
  }),
  stats: z.object({
    STR: z.number().int().min(1, 'Min 1').max(20, 'Max 20'),
    DEX: z.number().int().min(1, 'Min 1').max(20, 'Max 20'),
    CON: z.number().int().min(1, 'Min 1').max(20, 'Max 20'),
    INT: z.number().int().min(1, 'Min 1').max(20, 'Max 20'),
    WIS: z.number().int().min(1, 'Min 1').max(20, 'Max 20'),
    CHA: z.number().int().min(1, 'Min 1').max(20, 'Max 20'),
  }),
})

type Props = {
  gameId: string
  existingPlayer?: Player | null
  onSave: (player: Player, inventory: InventoryItem[]) => void
}

export function CharacterCreationForm({ gameId, existingPlayer, onSave }: Props) {
  const isEditing = !!existingPlayer

  const [characterName, setCharacterName] = useState(existingPlayer?.character_name ?? '')
  const [characterClass, setCharacterClass] = useState(existingPlayer?.character_class ?? '')
  const [stats, setStats] = useState<Record<AbilityName, string>>({
    STR: existingPlayer?.stats?.STR?.toString() ?? '',
    DEX: existingPlayer?.stats?.DEX?.toString() ?? '',
    CON: existingPlayer?.stats?.CON?.toString() ?? '',
    INT: existingPlayer?.stats?.INT?.toString() ?? '',
    WIS: existingPlayer?.stats?.WIS?.toString() ?? '',
    CHA: existingPlayer?.stats?.CHA?.toString() ?? '',
  })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleStatChange(ability: AbilityName, value: string) {
    setStats((prev) => ({ ...prev, [ability]: value }))
  }

  function fillStandardArray() {
    const entries = ABILITY_NAMES.map((name, i) => [name, STANDARD_ARRAY[i].toString()])
    setStats(Object.fromEntries(entries) as Record<AbilityName, string>)
  }

  const conScore = parseInt(stats.CON) || 10
  const hpPreview = characterClass
    ? CLASS_HIT_DIE[characterClass as CharacterClass] + abilityModifier(conScore)
    : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldErrors({})
    setFormError('')

    const parsed = {
      character_name: characterName.trim(),
      character_class: characterClass,
      stats: Object.fromEntries(
        ABILITY_NAMES.map((name) => [name, parseInt(stats[name]) || 0])
      ),
    }

    const result = characterSchema.safeParse(parsed)
    if (!result.success) {
      const errors: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const field = issue.path.join('.')
        if (!errors[field]) errors[field] = issue.message
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

      const { player, inventory } = await response.json()
      onSave(player, inventory)
    } catch {
      setFormError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} data-testid="character-creation-form" className="dnd-card">
      <h2 className="dnd-card-title">Forge Your Hero</h2>

      {/* Character Name */}
      <div className="mb-5">
        <label htmlFor="char-name" className="dnd-label">
          Character Name <span className="text-red-400">*</span>
        </label>
        <input
          id="char-name"
          type="text"
          data-testid="character-name-input"
          value={characterName}
          onChange={(e) => setCharacterName(e.target.value)}
          placeholder="Give your hero a name..."
          className="dnd-input"
          maxLength={50}
        />
        {fieldErrors.character_name && (
          <p className="dnd-field-error">{fieldErrors.character_name}</p>
        )}
      </div>

      {/* Character Class */}
      <div className="mb-5">
        <label htmlFor="char-class" className="dnd-label">
          Class <span className="text-red-400">*</span>
        </label>
        <select
          id="char-class"
          data-testid="character-class-select"
          value={characterClass}
          onChange={(e) => setCharacterClass(e.target.value)}
          className="dnd-input"
        >
          <option value="">Choose your path...</option>
          {CHARACTER_CLASSES.map((cls) => (
            <option key={cls} value={cls}>
              {CLASS_ICONS[cls]} {cls}
            </option>
          ))}
        </select>
        {characterClass && (
          <p className="mt-2 text-sm italic text-[var(--dnd-parchment-dim)]">
            {CLASS_FLAVOR[characterClass as CharacterClass]}
          </p>
        )}
        {fieldErrors.character_class && (
          <p className="dnd-field-error">{fieldErrors.character_class}</p>
        )}
      </div>

      <div className="dnd-divider" />

      {/* Ability Scores header row */}
      <div className="flex items-center justify-between mb-3">
        <span className="dnd-label mb-0">
          Ability Scores <span className="text-red-400">*</span>
        </span>
        <div className="flex items-center gap-3">
          {hpPreview !== null && (
            <span className="dnd-hp-badge" data-testid="hp-preview">
              <span className="text-base">{'\u2764'}</span> HP {hpPreview}
            </span>
          )}
          <button
            type="button"
            onClick={fillStandardArray}
            className="dnd-btn-secondary"
            data-testid="standard-array-btn"
          >
            Standard Array
          </button>
        </div>
      </div>

      {/* Stat grid 3x2 */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {ABILITY_NAMES.map((ability) => {
          const val = parseInt(stats[ability])
          const hasValue = !isNaN(val) && val >= 1 && val <= 20
          return (
            <div key={ability} className="dnd-stat-cell">
              <label className="dnd-stat-label">
                {ability}
                <span className="dnd-stat-fullname">{ABILITY_FULL_NAMES[ability]}</span>
              </label>
              <input
                type="number"
                data-testid={`stat-${ability.toLowerCase()}-input`}
                value={stats[ability]}
                onChange={(e) => handleStatChange(ability, e.target.value)}
                min={1}
                max={20}
                className="dnd-stat-input"
              />
              {hasValue && (
                <span className="text-xs text-[var(--dnd-parchment-dim)]">
                  {formatModifier(val)}
                </span>
              )}
              {fieldErrors[`stats.${ability}`] && (
                <p className="text-xs text-red-400 mt-1">{fieldErrors[`stats.${ability}`]}</p>
              )}
            </div>
          )
        })}
      </div>

      <div className="dnd-divider" />

      {formError && (
        <p data-testid="form-error" className="text-sm text-red-400 mb-4">
          {formError}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        data-testid="save-character-btn"
        className="dnd-btn-primary w-full"
      >
        {loading ? 'Saving...' : isEditing ? 'Update Character' : 'Seal Your Fate'}
      </button>
    </form>
  )
}
