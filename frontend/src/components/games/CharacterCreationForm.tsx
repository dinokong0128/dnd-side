'use client'

import { useState } from 'react'
import { z } from 'zod'
import {
  CHARACTER_CLASSES,
  ABILITY_NAMES,
  ABILITY_LABELS,
  ABILITY_FULL_NAMES,
  STANDARD_ARRAY,
  CLASS_HIT_DIE,
  type CharacterClass,
} from '@/lib/game-data/characters'
import type { Player } from '@/lib/supabase/players'

const abilityScore = z
  .number()
  .int()
  .min(1, { error: 'Min 1' })
  .max(20, { error: 'Max 20' })

const characterSchema = z.object({
  character_name: z
    .string()
    .min(1, { error: 'Character name is required' })
    .max(50, { error: 'Name must be 50 characters or less' }),
  character_class: z.enum(CHARACTER_CLASSES, {
    error: 'Select a class',
  }),
  stats: z.object({
    str: abilityScore,
    dex: abilityScore,
    con: abilityScore,
    int: abilityScore,
    wis: abilityScore,
    cha: abilityScore,
  }),
})

type Props = {
  gameId: string
  existingPlayer?: Player | null
  onSave: (player: Player) => void
}

export function CharacterCreationForm({
  gameId,
  existingPlayer,
  onSave,
}: Props) {
  const [name, setName] = useState(existingPlayer?.character_name ?? '')
  const [charClass, setCharClass] = useState(
    existingPlayer?.character_class ?? ''
  )
  const [stats, setStats] = useState<Record<string, string>>(() => {
    if (existingPlayer?.stats) {
      const s = existingPlayer.stats
      return {
        str: String(s.str),
        dex: String(s.dex),
        con: String(s.con),
        int: String(s.int),
        wis: String(s.wis),
        cha: String(s.cha),
      }
    }
    return { str: '', dex: '', con: '', int: '', wis: '', cha: '' }
  })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)

  function getHpPreview(): number | null {
    const con = parseInt(stats.con, 10)
    if (isNaN(con) || !charClass) return null
    const hitDie = CLASS_HIT_DIE[charClass as CharacterClass]
    if (!hitDie) return null
    const conMod = Math.floor((con - 10) / 2)
    return hitDie + conMod
  }

  function fillStandardArray() {
    const entries = ABILITY_NAMES.map((n, i) => [n, String(STANDARD_ARRAY[i])])
    setStats(Object.fromEntries(entries))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldErrors({})
    setFormError('')

    const parsedStats = Object.fromEntries(
      ABILITY_NAMES.map((k) => [k, parseInt(stats[k], 10) || 0])
    )

    const result = characterSchema.safeParse({
      character_name: name,
      character_class: charClass,
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

      const player = await response.json()
      onSave(player)
    } catch {
      setFormError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const hpPreview = getHpPreview()
  const conMod = (() => {
    const con = parseInt(stats.con, 10)
    return isNaN(con) ? 0 : Math.floor((con - 10) / 2)
  })()

  return (
    <form onSubmit={handleSubmit} data-testid="character-creation-form">
      <div className="space-y-5">
        {/* Character Name */}
        <div>
          <label
            htmlFor="character-name"
            className="block text-[11px] font-bold uppercase tracking-[0.15em]"
            style={{ color: '#8a7a55' }}
          >
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
            className="mt-1.5 block w-full rounded-md px-3.5 py-2.5 text-sm transition-colors focus:outline-none"
            style={{
              background: 'rgba(10,8,5,0.5)',
              border: '1px solid #2d2518',
              color: '#e8dcc8',
            }}
          />
          {fieldErrors.character_name && (
            <p className="mt-1 text-sm" style={{ color: '#d45050' }}>
              {fieldErrors.character_name}
            </p>
          )}
        </div>

        {/* Character Class */}
        <div>
          <label
            htmlFor="character-class"
            className="block text-[11px] font-bold uppercase tracking-[0.15em]"
            style={{ color: '#8a7a55' }}
          >
            Class
          </label>
          <select
            id="character-class"
            data-testid="character-class-select"
            value={charClass}
            onChange={(e) => setCharClass(e.target.value)}
            className="mt-1.5 block w-full rounded-md px-3.5 py-2.5 text-sm transition-colors focus:outline-none"
            style={{
              background: 'rgba(10,8,5,0.5)',
              border: '1px solid #2d2518',
              color: charClass ? '#e8dcc8' : '#5a4f3a',
            }}
          >
            <option value="">Choose your class...</option>
            {CHARACTER_CLASSES.map((cls) => (
              <option key={cls} value={cls}>
                {cls}
              </option>
            ))}
          </select>
          {fieldErrors.character_class && (
            <p className="mt-1 text-sm" style={{ color: '#d45050' }}>
              {fieldErrors.character_class}
            </p>
          )}
          {charClass && hpPreview !== null && (
            <p className="mt-1.5 text-xs" style={{ color: '#6a5a3a' }}>
              Hit Die: d{CLASS_HIT_DIE[charClass as CharacterClass]}{' '}
              &middot; HP:{' '}
              <span style={{ color: '#d07070', fontWeight: 600 }}>
                {hpPreview}
              </span>
              <span style={{ color: '#5a4f3a' }}>
                {' '}
                (d{CLASS_HIT_DIE[charClass as CharacterClass]}{' '}
                {conMod >= 0 ? '+' : ''}
                {conMod} CON)
              </span>
            </p>
          )}
        </div>

        {/* Ability Scores */}
        <div>
          <div className="flex items-center justify-between">
            <span
              className="block text-[11px] font-bold uppercase tracking-[0.15em]"
              style={{ color: '#8a7a55' }}
            >
              Ability Scores
            </span>
            <button
              type="button"
              onClick={fillStandardArray}
              data-testid="standard-array-button"
              className="text-xs font-medium transition-opacity hover:opacity-80"
              style={{ color: '#c9a84c' }}
            >
              Use Standard Array
            </button>
          </div>

          <div className="mt-2.5 grid grid-cols-3 gap-2.5">
            {ABILITY_NAMES.map((ability) => (
              <div key={ability}>
                <label
                  htmlFor={`stat-${ability}`}
                  className="block text-center text-[10px] font-bold uppercase tracking-[0.15em]"
                  style={{ color: '#5a4f3a' }}
                  title={ABILITY_FULL_NAMES[ability]}
                >
                  {ABILITY_LABELS[ability]}
                </label>
                <input
                  id={`stat-${ability}`}
                  type="number"
                  data-testid={`stat-${ability}-input`}
                  value={stats[ability]}
                  onChange={(e) =>
                    setStats((prev) => ({
                      ...prev,
                      [ability]: e.target.value,
                    }))
                  }
                  min={1}
                  max={20}
                  className="mt-1 block w-full rounded-md px-2 py-2.5 text-center text-lg font-bold tabular-nums transition-colors focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  style={{
                    background: 'rgba(10,8,5,0.5)',
                    border: '1px solid #2d2518',
                    color: '#e8dcc8',
                  }}
                />
                {fieldErrors[`stats.${ability}`] && (
                  <p
                    className="mt-0.5 text-center text-[10px]"
                    style={{ color: '#d45050' }}
                  >
                    {fieldErrors[`stats.${ability}`]}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {formError && (
          <p data-testid="form-error" className="text-sm" style={{ color: '#d45050' }}>
            {formError}
          </p>
        )}

        <button
          type="submit"
          data-testid="save-character-button"
          disabled={loading}
          className="w-full rounded-md py-3 text-sm font-bold uppercase tracking-[0.1em] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: 'linear-gradient(135deg, #8b6914, #c9a84c, #8b6914)',
            color: '#1a1408',
            boxShadow: '0 2px 8px rgba(140,100,20,0.3)',
          }}
        >
          {loading
            ? 'Saving...'
            : existingPlayer
              ? 'Update Character'
              : 'Seal Your Fate'}
        </button>
      </div>
    </form>
  )
}
