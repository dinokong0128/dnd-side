'use client'

import { useState } from 'react'
import { z } from 'zod'
import { CHARACTER_CLASSES } from '@/lib/game-data/characters'

const STAT_NAMES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const
const STAT_LABELS: Record<string, string> = {
  str: 'STR',
  dex: 'DEX',
  con: 'CON',
  int: 'INT',
  wis: 'WIS',
  cha: 'CHA',
}
const STAT_FULL_NAMES: Record<string, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
}
const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8]

const characterSchema = z.object({
  character_name: z
    .string()
    .min(1, { error: 'Character name is required' })
    .max(50, { error: 'Character name must be 50 characters or less' }),
  character_class: z
    .string()
    .min(1, { error: 'Please select a class' }),
  stats: z.object({
    str: z.number().int().min(1, { error: '1–20' }).max(20, { error: '1–20' }),
    dex: z.number().int().min(1, { error: '1–20' }).max(20, { error: '1–20' }),
    con: z.number().int().min(1, { error: '1–20' }).max(20, { error: '1–20' }),
    int: z.number().int().min(1, { error: '1–20' }).max(20, { error: '1–20' }),
    wis: z.number().int().min(1, { error: '1–20' }).max(20, { error: '1–20' }),
    cha: z.number().int().min(1, { error: '1–20' }).max(20, { error: '1–20' }),
  }),
})

type PlayerData = {
  id: string
  character_name: string
  character_class: string
  stats: Record<string, number>
  hp_max: number
  hp_current: number
  inventory?: { item_name: string; quantity: number; properties: Record<string, unknown> | null }[]
}

type Props = {
  gameId: string
  existingPlayer?: PlayerData | null
  onSave: (player: PlayerData) => void
}

const CLASS_ICONS: Record<string, string> = {
  Fighter: '\u2694\uFE0F',
  Wizard: '\uD83E\uDDD9',
  Rogue: '\uD83D\uDDE1\uFE0F',
  Cleric: '\u2695\uFE0F',
  Ranger: '\uD83C\uDFF9',
  Barbarian: '\uD83E\uDE93',
  Paladin: '\uD83D\uDEE1\uFE0F',
  Druid: '\uD83C\uDF3F',
  Bard: '\uD83C\uDFB5',
  Monk: '\uD83E\uDDD8',
  Sorcerer: '\uD83D\uDD2E',
  Warlock: '\uD83D\uDC7F',
}

export function CharacterCreationForm({ gameId, existingPlayer, onSave }: Props) {
  const [characterName, setCharacterName] = useState(existingPlayer?.character_name ?? '')
  const [characterClass, setCharacterClass] = useState(existingPlayer?.character_class ?? '')
  const [stats, setStats] = useState<Record<string, string>>(() => {
    if (existingPlayer?.stats) {
      const s: Record<string, string> = {}
      for (const key of STAT_NAMES) {
        s[key] = String(existingPlayer.stats[key] ?? '')
      }
      return s
    }
    return { str: '', dex: '', con: '', int: '', wis: '', cha: '' }
  })

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)

  function fillStandardArray() {
    const newStats: Record<string, string> = {}
    STAT_NAMES.forEach((name, i) => {
      newStats[name] = String(STANDARD_ARRAY[i])
    })
    setStats(newStats)
    setFieldErrors({})
  }

  function updateStat(name: string, value: string) {
    // Allow empty or numeric input only
    if (value !== '' && !/^\d{1,2}$/.test(value)) return
    setStats((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldErrors({})
    setFormError('')

    const parsedStats: Record<string, number> = {}
    for (const key of STAT_NAMES) {
      parsedStats[key] = stats[key] === '' ? 0 : parseInt(stats[key], 10)
    }

    const result = characterSchema.safeParse({
      character_name: characterName,
      character_class: characterClass,
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="border-b border-card-border pb-4">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-bold tracking-wide text-accent-gold">
          Forge Your Character
        </h2>
        <p className="mt-1 text-sm text-muted-text">
          Every legend begins with a name and a calling.
        </p>
      </div>

      {/* Character Name */}
      <div>
        <label htmlFor="character-name" className="block text-sm font-medium text-foreground/80">
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
          className="mt-1.5 block w-full rounded-md border border-input-border bg-input-bg px-3 py-2.5 text-foreground placeholder:text-muted-text/50 focus:border-input-focus focus:outline-none focus:ring-1 focus:ring-input-focus/30"
        />
        {fieldErrors.character_name && (
          <p className="mt-1 text-sm text-error">{fieldErrors.character_name}</p>
        )}
      </div>

      {/* Character Class */}
      <div>
        <label htmlFor="character-class" className="block text-sm font-medium text-foreground/80">
          Class
        </label>
        <select
          id="character-class"
          data-testid="character-class-select"
          value={characterClass}
          onChange={(e) => setCharacterClass(e.target.value)}
          className="mt-1.5 block w-full rounded-md border border-input-border bg-input-bg px-3 py-2.5 text-foreground focus:border-input-focus focus:outline-none focus:ring-1 focus:ring-input-focus/30"
        >
          <option value="">Choose your path...</option>
          {CHARACTER_CLASSES.map((cls) => (
            <option key={cls} value={cls}>
              {CLASS_ICONS[cls]} {cls}
            </option>
          ))}
        </select>
        {fieldErrors.character_class && (
          <p className="mt-1 text-sm text-error">{fieldErrors.character_class}</p>
        )}
      </div>

      {/* Ability Scores */}
      <div>
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-foreground/80">
            Ability Scores
          </label>
          <button
            type="button"
            onClick={fillStandardArray}
            className="text-xs text-accent-gold-dim hover:text-accent-gold transition-colors"
          >
            Use Standard Array
          </button>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {STAT_NAMES.map((stat) => (
            <div key={stat} className="group">
              <div className="rounded-lg border border-input-border bg-input-bg p-3 text-center transition-colors group-focus-within:border-input-focus">
                <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted-text">
                  {STAT_LABELS[stat]}
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  data-testid={`stat-${stat}-input`}
                  value={stats[stat]}
                  onChange={(e) => updateStat(stat, e.target.value)}
                  placeholder="—"
                  className="mt-1 w-full bg-transparent text-center text-2xl font-bold text-foreground placeholder:text-muted-text/30 focus:outline-none"
                />
                <span className="block text-[9px] text-muted-text/60">
                  {STAT_FULL_NAMES[stat]}
                </span>
              </div>
              {fieldErrors[`stats.${stat}`] && (
                <p className="mt-0.5 text-center text-xs text-error">
                  {fieldErrors[`stats.${stat}`]}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Form Error */}
      {formError && (
        <div data-testid="form-error" className="rounded-md border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
          {formError}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        data-testid="save-character-button"
        disabled={loading}
        className="w-full rounded-md bg-accent-gold px-4 py-3 font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-wider text-[#0d0d0f] transition-all hover:bg-accent-gold/90 hover:shadow-[0_0_20px_rgba(201,168,76,0.2)] disabled:opacity-50"
      >
        {loading ? 'Saving...' : existingPlayer ? 'Update Character' : 'Save Character'}
      </button>
    </form>
  )
}
