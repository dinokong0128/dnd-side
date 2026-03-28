'use client'

import { useState } from 'react'
import { z } from 'zod'
import {
  CHARACTER_CLASSES,
  ABILITY_SCORES,
  ABILITY_LABELS,
  STANDARD_ARRAY,
  CLASS_HIT_DIE,
  calculateHpMax,
  formatModifier,
  type CharacterClass,
} from '@/lib/game-data'
import type { Player, InventoryItem } from '@/lib/supabase/players'

const characterSchema = z.object({
  character_name: z
    .string()
    .min(1, { error: 'Character name is required' })
    .max(50, { error: 'Name must be 50 characters or less' }),
  character_class: z.enum(CHARACTER_CLASSES, {
    error: 'Please select a class',
  }),
  stats: z.object({
    str: z.number().int().min(1).max(20),
    dex: z.number().int().min(1).max(20),
    con: z.number().int().min(1).max(20),
    int: z.number().int().min(1).max(20),
    wis: z.number().int().min(1).max(20),
    cha: z.number().int().min(1).max(20),
  }),
})

type Props = {
  gameId: string
  existingPlayer?: Player | null
  onSave: (player: Player, inventory: InventoryItem[]) => void
}

export function CharacterCreationForm({ gameId, existingPlayer, onSave }: Props) {
  const [name, setName] = useState(existingPlayer?.character_name ?? '')
  const [characterClass, setCharacterClass] = useState(
    existingPlayer?.character_class ?? ''
  )
  const [stats, setStats] = useState<Record<string, string>>(() => {
    const existing = existingPlayer?.stats
    if (existing) {
      return Object.fromEntries(
        ABILITY_SCORES.map((s) => [s, String(existing[s] ?? '')])
      )
    }
    return Object.fromEntries(ABILITY_SCORES.map((s) => [s, '']))
  })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)

  function fillStandardArray() {
    const filled: Record<string, string> = {}
    ABILITY_SCORES.forEach((score, i) => {
      filled[score] = String(STANDARD_ARRAY[i])
    })
    setStats(filled)
  }

  function getHpPreview(): number | null {
    const cls = characterClass as CharacterClass
    const con = parseInt(stats.con, 10)
    if (!CLASS_HIT_DIE[cls] || isNaN(con) || con < 1 || con > 20) return null
    return calculateHpMax(cls, con)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldErrors({})
    setFormError('')

    const parsedStats: Record<string, number> = {}
    for (const key of ABILITY_SCORES) {
      parsedStats[key] = parseInt(stats[key], 10) || 0
    }

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
          if (path.startsWith('stats.')) {
            errors['stats'] = 'Each ability score must be between 1 and 20'
          } else {
            errors[path] = issue.message
          }
        }
      }
      setFieldErrors(errors)
      return
    }

    setLoading(true)
    try {
      const method = existingPlayer ? 'PATCH' : 'POST'
      const response = await fetch(`/api/games/${gameId}/players`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character_name: result.data.character_name,
          character_class: result.data.character_class,
          stats: result.data.stats,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        setFormError(data.error || 'Failed to save character')
        return
      }

      const data = await response.json()
      onSave(data.player, data.inventory)
    } catch {
      setFormError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const hpPreview = getHpPreview()

  return (
    <form onSubmit={handleSubmit} className="dnd-card" data-testid="character-creation-form">
      <div className="dnd-card-body">
        <h2 className="dnd-heading-lg">Create Your Character</h2>
        <p className="dnd-text-muted mt-1">Define who you are before the adventure begins.</p>

        {/* Character Name */}
        <div className="dnd-form-group">
          <label htmlFor="character-name" className="dnd-label">
            Character Name
          </label>
          <input
            id="character-name"
            type="text"
            data-testid="character-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Thorin Oakenshield"
            className={`dnd-input ${fieldErrors.character_name ? 'dnd-input-error' : ''}`}
            maxLength={50}
          />
          {fieldErrors.character_name && (
            <p className="dnd-error">{fieldErrors.character_name}</p>
          )}
        </div>

        {/* Class */}
        <div className="dnd-form-group">
          <label htmlFor="character-class" className="dnd-label">
            Class
          </label>
          <select
            id="character-class"
            data-testid="character-class-select"
            value={characterClass}
            onChange={(e) => setCharacterClass(e.target.value)}
            className={`dnd-input ${fieldErrors.character_class ? 'dnd-input-error' : ''}`}
          >
            <option value="" disabled>
              Select a class...
            </option>
            {CHARACTER_CLASSES.map((cls) => (
              <option key={cls} value={cls}>
                {cls}
              </option>
            ))}
          </select>
          {fieldErrors.character_class && (
            <p className="dnd-error">{fieldErrors.character_class}</p>
          )}
        </div>

        {/* Ability Scores */}
        <div className="dnd-form-group">
          <div className="dnd-stats-header">
            <span className="dnd-label" style={{ marginBottom: 0 }}>
              Ability Scores
            </span>
            <button
              type="button"
              onClick={fillStandardArray}
              className="dnd-btn-std-array"
              data-testid="standard-array-btn"
            >
              Standard Array
            </button>
          </div>
          <div className="dnd-stat-grid">
            {ABILITY_SCORES.map((score) => {
              const val = parseInt(stats[score], 10)
              const isValid = !isNaN(val) && val >= 1 && val <= 20
              return (
                <div
                  key={score}
                  className={`dnd-stat-cell ${
                    fieldErrors.stats && (!isValid || stats[score] === '') ? 'dnd-stat-cell-error' : ''
                  }`}
                >
                  <div className="dnd-stat-label">{ABILITY_LABELS[score]}</div>
                  <input
                    type="number"
                    data-testid={`stat-${score}-input`}
                    value={stats[score]}
                    onChange={(e) => setStats({ ...stats, [score]: e.target.value })}
                    className="dnd-stat-input"
                    min={1}
                    max={20}
                  />
                  <div className="dnd-stat-modifier">
                    {isValid ? formatModifier(val) : ''}
                  </div>
                </div>
              )
            })}
          </div>
          {fieldErrors.stats && (
            <p className="dnd-error mt-2">{fieldErrors.stats}</p>
          )}
        </div>

        {/* HP Preview */}
        {hpPreview !== null && (
          <div className="dnd-hp-row">
            <span className="dnd-hp-badge" data-testid="hp-preview">
              HP {hpPreview}
            </span>
          </div>
        )}

        {/* Form Error */}
        {formError && (
          <p data-testid="form-error" className="dnd-error mt-4">
            {formError}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          data-testid="save-character-btn"
          className="dnd-btn-primary"
        >
          {loading ? 'Saving...' : existingPlayer ? 'Update Character' : 'Seal Your Fate'}
        </button>
      </div>
    </form>
  )
}
