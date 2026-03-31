'use client'

import { useState } from 'react'
import { z } from 'zod'
import {
  CHARACTER_CLASSES,
  CLASS_HIT_DIE,
  calculateHpMax,
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

const characterSchema = z.object({
  character_name: z
    .string()
    .min(1, { message: 'Character name is required' })
    .max(50, { message: 'Name must be 50 characters or less' }),
  character_class: z
    .string()
    .min(1, { message: 'Please select a class' }),
  str: z.number().int().min(1, { message: '1-20' }).max(20, { message: '1-20' }),
  dex: z.number().int().min(1, { message: '1-20' }).max(20, { message: '1-20' }),
  con: z.number().int().min(1, { message: '1-20' }).max(20, { message: '1-20' }),
  int: z.number().int().min(1, { message: '1-20' }).max(20, { message: '1-20' }),
  wis: z.number().int().min(1, { message: '1-20' }).max(20, { message: '1-20' }),
  cha: z.number().int().min(1, { message: '1-20' }).max(20, { message: '1-20' }),
})

type CharacterCreationFormProps = {
  gameId: string
  existingPlayer?: {
    character_name: string | null
    character_class: string | null
    stats: Record<string, number> | null
  } | null
  onSave: () => void
}

function abilityModifier(score: number): string {
  const mod = Math.floor((score - 10) / 2)
  return mod >= 0 ? `+${mod}` : `${mod}`
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
  const [stats, setStats] = useState<Record<string, string>>(() => {
    const existing = existingPlayer?.stats
    if (existing) {
      return Object.fromEntries(
        ABILITY_NAMES.map((a) => [a, String(existing[a] ?? '')])
      )
    }
    return Object.fromEntries(ABILITY_NAMES.map((a) => [a, '']))
  })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)

  function fillStandardArray() {
    const newStats: Record<string, string> = {}
    ABILITY_NAMES.forEach((a, i) => {
      newStats[a] = String(STANDARD_ARRAY[i])
    })
    setStats(newStats)
  }

  const conValue = parseInt(stats.con) || 10
  const hpPreview =
    characterClass && CLASS_HIT_DIE[characterClass]
      ? calculateHpMax(characterClass, conValue)
      : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldErrors({})
    setFormError('')

    const parsed = {
      character_name: characterName,
      character_class: characterClass,
      str: parseInt(stats.str) || 0,
      dex: parseInt(stats.dex) || 0,
      con: parseInt(stats.con) || 0,
      int: parseInt(stats.int) || 0,
      wis: parseInt(stats.wis) || 0,
      cha: parseInt(stats.cha) || 0,
    }

    const result = characterSchema.safeParse(parsed)
    if (!result.success) {
      const errors: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const field = String(issue.path[0])
        if (!errors[field]) {
          errors[field] = issue.message
        }
      }
      setFieldErrors(errors)
      return
    }

    setLoading(true)
    try {
      const method = existingPlayer?.character_name ? 'PATCH' : 'POST'
      const response = await fetch(`/api/games/${gameId}/players`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character_name: parsed.character_name,
          character_class: parsed.character_class,
          stats: {
            str: parsed.str,
            dex: parsed.dex,
            con: parsed.con,
            int: parsed.int,
            wis: parsed.wis,
            cha: parsed.cha,
          },
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        setFormError(data.error || 'Failed to save character')
        return
      }

      onSave()
    } catch {
      setFormError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="dnd-card px-6 py-8 dnd-fade-in">
      <h2 className="dnd-heading text-lg font-bold mb-6">
        Create Your Character
      </h2>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="character-name" className="dnd-label">
            Character Name
          </label>
          <input
            id="character-name"
            type="text"
            data-testid="character-name-input"
            value={characterName}
            onChange={(e) => setCharacterName(e.target.value)}
            className="dnd-input"
            placeholder="Thorin Oakenshield"
          />
          {fieldErrors.character_name && (
            <p className="dnd-field-error">{fieldErrors.character_name}</p>
          )}
        </div>

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
            <option value="">Choose your class...</option>
            {CHARACTER_CLASSES.map((cls) => (
              <option key={cls} value={cls}>
                {cls}
              </option>
            ))}
          </select>
          {fieldErrors.character_class && (
            <p className="dnd-field-error">{fieldErrors.character_class}</p>
          )}
        </div>

        {hpPreview !== null && (
          <div className="flex items-center gap-2">
            <span className="dnd-hp-badge">HP {hpPreview}</span>
            <span className="text-xs" style={{ color: 'var(--muted)' }}>
              {CLASS_HIT_DIE[characterClass]} + CON modifier
            </span>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="dnd-label" style={{ margin: 0 }}>
              Ability Scores
            </span>
            <button
              type="button"
              onClick={fillStandardArray}
              className="dnd-btn-secondary"
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.65rem' }}
              data-testid="standard-array-btn"
            >
              Standard Array
            </button>
          </div>
          <div className="dnd-stat-grid">
            {ABILITY_NAMES.map((ability) => {
              const val = parseInt(stats[ability])
              const showMod = !isNaN(val) && val >= 1 && val <= 20
              return (
                <div key={ability} className="dnd-stat-box">
                  <div className="dnd-stat-label">{ABILITY_LABELS[ability]}</div>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    data-testid={`stat-${ability}-input`}
                    value={stats[ability]}
                    onChange={(e) =>
                      setStats((prev) => ({ ...prev, [ability]: e.target.value }))
                    }
                    className="dnd-input text-center"
                    style={{ padding: '0.375rem', fontSize: '1.1rem', fontFamily: "'Cinzel', serif" }}
                  />
                  {showMod && (
                    <div className="dnd-stat-modifier">
                      {abilityModifier(val)}
                    </div>
                  )}
                  {fieldErrors[ability] && (
                    <p className="dnd-field-error" style={{ fontSize: '0.65rem' }}>
                      {fieldErrors[ability]}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {formError && (
          <div data-testid="form-error" className="dnd-error-banner">
            {formError}
          </div>
        )}

        <button
          type="submit"
          data-testid="save-character-btn"
          disabled={loading}
          className="dnd-btn-primary"
        >
          {loading ? 'Saving\u2026' : 'Seal Your Fate'}
        </button>
      </form>
    </div>
  )
}
