'use client'

import { useState } from 'react'
import { z } from 'zod'
import {
  CHARACTER_CLASSES,
  ABILITY_SCORES,
  calculateHpMax,
  type CharacterClass,
  type AbilityScore,
} from '@/lib/constants/starting-inventory'

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8]

const characterSchema = z.object({
  character_name: z
    .string()
    .min(1, { error: 'Character name is required' })
    .max(50, { error: 'Name must be 50 characters or less' }),
  character_class: z.enum(CHARACTER_CLASSES, {
    error: 'Please select a class',
  }),
  stats: z.object({
    STR: z.number().int().min(1, { error: '1-20' }).max(20, { error: '1-20' }),
    DEX: z.number().int().min(1, { error: '1-20' }).max(20, { error: '1-20' }),
    CON: z.number().int().min(1, { error: '1-20' }).max(20, { error: '1-20' }),
    INT: z.number().int().min(1, { error: '1-20' }).max(20, { error: '1-20' }),
    WIS: z.number().int().min(1, { error: '1-20' }).max(20, { error: '1-20' }),
    CHA: z.number().int().min(1, { error: '1-20' }).max(20, { error: '1-20' }),
  }),
})

type CharacterData = {
  character_name: string
  character_class: CharacterClass
  stats: Record<AbilityScore, number>
  hp_max: number
}

type Props = {
  gameId: string
  initialData?: CharacterData | null
  onSave: (data: CharacterData) => void
}

const CLASS_ICONS: Record<CharacterClass, string> = {
  Fighter: '\u2694\uFE0F',
  Wizard: '\uD83E\uDDD9',
  Rogue: '\uD83D\uDDE1\uFE0F',
  Cleric: '\u271D\uFE0F',
  Ranger: '\uD83C\uDFF9',
  Barbarian: '\uD83E\uDE93',
  Paladin: '\uD83D\uDEE1\uFE0F',
  Druid: '\uD83C\uDF3F',
  Bard: '\uD83C\uDFB5',
  Monk: '\uD83E\uDD4B',
  Sorcerer: '\u2728',
  Warlock: '\uD83D\uDD2E',
}

export function CharacterCreationForm({ gameId, initialData, onSave }: Props) {
  const [characterName, setCharacterName] = useState(initialData?.character_name ?? '')
  const [characterClass, setCharacterClass] = useState<string>(initialData?.character_class ?? '')
  const [stats, setStats] = useState<Record<AbilityScore, string>>({
    STR: initialData?.stats.STR?.toString() ?? '',
    DEX: initialData?.stats.DEX?.toString() ?? '',
    CON: initialData?.stats.CON?.toString() ?? '',
    INT: initialData?.stats.INT?.toString() ?? '',
    WIS: initialData?.stats.WIS?.toString() ?? '',
    CHA: initialData?.stats.CHA?.toString() ?? '',
  })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)

  function fillStandardArray() {
    const scores = [...STANDARD_ARRAY]
    const newStats: Record<string, string> = {}
    ABILITY_SCORES.forEach((ability, i) => {
      newStats[ability] = scores[i].toString()
    })
    setStats(newStats as Record<AbilityScore, string>)
  }

  function handleStatChange(ability: AbilityScore, value: string) {
    if (value === '' || /^\d{0,2}$/.test(value)) {
      setStats((prev) => ({ ...prev, [ability]: value }))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldErrors({})
    setFormError('')

    const parsedStats: Record<string, number> = {}
    for (const ability of ABILITY_SCORES) {
      parsedStats[ability] = parseInt(stats[ability], 10) || 0
    }

    const result = characterSchema.safeParse({
      character_name: characterName,
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.data),
      })

      if (!response.ok) {
        const data = await response.json()
        setFormError(data.error || 'Failed to save character')
        return
      }

      const hp_max = calculateHpMax(
        result.data.character_class,
        result.data.stats.CON
      )

      onSave({
        character_name: result.data.character_name,
        character_class: result.data.character_class,
        stats: result.data.stats,
        hp_max,
      })
    } catch {
      setFormError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const hpPreview =
    characterClass && stats.CON
      ? calculateHpMax(characterClass as CharacterClass, parseInt(stats.CON, 10) || 10)
      : null

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="border-b border-amber-800/30 pb-4">
        <h2
          className="text-xl font-bold tracking-wide text-amber-100"
          style={{ fontVariant: 'small-caps' }}
        >
          Forge Your Character
        </h2>
        <p className="mt-1 text-sm text-amber-100/50">
          Every legend begins with a name and a calling.
        </p>
      </div>

      {/* Character Name */}
      <div>
        <label htmlFor="character-name" className="mb-1 block text-sm font-semibold text-amber-200/80">
          Character Name
        </label>
        <input
          id="character-name"
          type="text"
          data-testid="character-name-input"
          value={characterName}
          onChange={(e) => setCharacterName(e.target.value)}
          placeholder="Thorin Oakenshield"
          maxLength={50}
          className="block w-full rounded border border-amber-900/40 bg-stone-900/60 px-3 py-2.5 text-amber-50 placeholder-amber-100/25 outline-none transition-colors focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30"
        />
        {fieldErrors.character_name && (
          <p className="mt-1 text-sm text-red-400">{fieldErrors.character_name}</p>
        )}
      </div>

      {/* Character Class */}
      <div>
        <label htmlFor="character-class" className="mb-1 block text-sm font-semibold text-amber-200/80">
          Class
        </label>
        <select
          id="character-class"
          data-testid="character-class-select"
          value={characterClass}
          onChange={(e) => setCharacterClass(e.target.value)}
          className="block w-full cursor-pointer rounded border border-amber-900/40 bg-stone-900/60 px-3 py-2.5 text-amber-50 outline-none transition-colors focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30"
        >
          <option value="" disabled>
            Choose your path...
          </option>
          {CHARACTER_CLASSES.map((cls) => (
            <option key={cls} value={cls}>
              {CLASS_ICONS[cls]} {cls}
            </option>
          ))}
        </select>
        {fieldErrors.character_class && (
          <p className="mt-1 text-sm text-red-400">{fieldErrors.character_class}</p>
        )}
        {hpPreview !== null && (
          <p className="mt-1.5 text-xs text-amber-300/60">
            Starting HP: <span className="font-bold text-emerald-400">{hpPreview}</span>
          </p>
        )}
      </div>

      {/* Ability Scores */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <label className="text-sm font-semibold text-amber-200/80">Ability Scores</label>
          <button
            type="button"
            onClick={fillStandardArray}
            className="rounded border border-amber-700/40 px-2 py-0.5 text-xs text-amber-300/70 transition-colors hover:border-amber-500/50 hover:text-amber-200"
          >
            Standard Array
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {ABILITY_SCORES.map((ability) => (
            <div key={ability} className="group relative">
              <label
                htmlFor={`stat-${ability}`}
                className="mb-1 block text-center text-[11px] font-bold tracking-widest text-amber-300/50"
              >
                {ability}
              </label>
              <input
                id={`stat-${ability}`}
                type="text"
                inputMode="numeric"
                data-testid={`stat-${ability}-input`}
                value={stats[ability]}
                onChange={(e) => handleStatChange(ability, e.target.value)}
                className="block w-full rounded border border-amber-900/40 bg-stone-900/60 py-3 text-center text-lg font-bold text-amber-50 outline-none transition-colors focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30"
              />
              {fieldErrors[`stats.${ability}`] && (
                <p className="mt-0.5 text-center text-[10px] text-red-400">
                  {fieldErrors[`stats.${ability}`]}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Form Error */}
      {formError && (
        <div className="rounded border border-red-800/50 bg-red-950/40 px-3 py-2">
          <p data-testid="form-error" className="text-sm text-red-300">
            {formError}
          </p>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        data-testid="save-character-button"
        disabled={loading}
        className="w-full rounded bg-amber-700 px-4 py-3 font-semibold tracking-wide text-amber-50 transition-all hover:bg-amber-600 hover:shadow-lg hover:shadow-amber-900/30 disabled:opacity-50"
        style={{ fontVariant: 'small-caps' }}
      >
        {loading ? 'Inscribing...' : 'Save Character'}
      </button>
    </form>
  )
}
