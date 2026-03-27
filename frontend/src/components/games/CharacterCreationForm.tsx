'use client'

import { useState } from 'react'
import { z } from 'zod'

const D5E_CLASSES = [
  'Fighter',
  'Wizard',
  'Rogue',
  'Cleric',
  'Ranger',
  'Barbarian',
  'Paladin',
  'Druid',
  'Bard',
  'Monk',
  'Sorcerer',
  'Warlock',
] as const

const ABILITY_NAMES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const
const ABILITY_LABELS: Record<string, string> = {
  str: 'STR',
  dex: 'DEX',
  con: 'CON',
  int: 'INT',
  wis: 'WIS',
  cha: 'CHA',
}
const ABILITY_FULL: Record<string, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
}

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8]

const CLASS_HIT_DIE: Record<string, number> = {
  Barbarian: 12,
  Fighter: 10,
  Paladin: 10,
  Ranger: 10,
  Bard: 8,
  Cleric: 8,
  Druid: 8,
  Monk: 8,
  Rogue: 8,
  Warlock: 8,
  Sorcerer: 6,
  Wizard: 6,
}

const CLASS_FLAVOR: Record<string, string> = {
  Fighter: 'A master of martial combat',
  Wizard: 'A scholarly wielder of arcane magic',
  Rogue: 'A scoundrel who uses stealth and trickery',
  Cleric: 'A priestly champion who wields divine magic',
  Ranger: 'A warrior of the wilderness',
  Barbarian: 'A fierce warrior of primitive fury',
  Paladin: 'A holy warrior bound to a sacred oath',
  Druid: 'A priest of the Old Faith',
  Bard: 'An inspiring magician of word and song',
  Monk: 'A master of martial arts and ki energy',
  Sorcerer: 'A spellcaster with innate magic',
  Warlock: 'A wielder of magic from an otherworldly patron',
}

const statSchema = z.number().int().min(1).max(20)

const characterSchema = z.object({
  character_name: z
    .string()
    .min(1, 'Character name is required')
    .max(50, 'Character name must be 50 characters or less'),
  character_class: z.string().min(1, 'Please select a class'),
  stats: z.object({
    str: statSchema,
    dex: statSchema,
    con: statSchema,
    int: statSchema,
    wis: statSchema,
    cha: statSchema,
  }),
})

type CharacterData = {
  id: string
  character_name: string
  character_class: string
  hp_current: number
  hp_max: number
  stats: Record<string, number>
}

export function CharacterCreationForm({
  gameId,
  existingCharacter,
  onSave,
}: {
  gameId: string
  existingCharacter?: CharacterData | null
  onSave: (character: CharacterData) => void
}) {
  const [characterName, setCharacterName] = useState(
    existingCharacter?.character_name ?? ''
  )
  const [characterClass, setCharacterClass] = useState(
    existingCharacter?.character_class ?? ''
  )
  const [stats, setStats] = useState<Record<string, number>>(
    existingCharacter?.stats ?? { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
  )
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)

  const isEditing = !!existingCharacter

  function handleStatChange(stat: string, value: string) {
    const num = value === '' ? 0 : parseInt(value, 10)
    setStats((prev) => ({ ...prev, [stat]: isNaN(num) ? 0 : num }))
  }

  function fillStandardArray() {
    const filled: Record<string, number> = {}
    ABILITY_NAMES.forEach((name, i) => {
      filled[name] = STANDARD_ARRAY[i]
    })
    setStats(filled)
  }

  function getHpPreview(): number | null {
    if (!characterClass || !stats.con) return null
    const hitDie = CLASS_HIT_DIE[characterClass]
    if (!hitDie) return null
    const conMod = Math.floor((stats.con - 10) / 2)
    return hitDie + conMod
  }

  function getModifier(score: number): string {
    const mod = Math.floor((score - 10) / 2)
    return mod >= 0 ? `+${mod}` : `${mod}`
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
      const response = await fetch(`/api/games/${gameId}/players`, {
        method: isEditing ? 'PATCH' : 'POST',
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

      const character = await response.json()
      onSave(character)
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
    >
      <div
        className="relative overflow-hidden rounded-lg"
        style={{
          background: 'linear-gradient(165deg, #1c1710 0%, #231d14 50%, #19150f 100%)',
          border: '1px solid #3d3425',
          boxShadow: '0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(212,168,67,0.06)',
        }}
      >
        {/* Decorative top bar */}
        <div
          style={{
            height: '3px',
            background: 'linear-gradient(90deg, transparent, #8b6914 20%, #d4a843 50%, #8b6914 80%, transparent)',
          }}
        />

        {/* Header */}
        <div className="px-6 pt-5 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h2
                className="text-xl font-bold"
                style={{ color: '#e8d5a3', fontFamily: 'Georgia, "Times New Roman", serif' }}
              >
                {isEditing ? 'Edit Character' : 'Forge Your Hero'}
              </h2>
              <p className="mt-1 text-xs" style={{ color: '#7a6a45' }}>
                {isEditing ? 'Revise your champion before the adventure continues' : 'Every legend begins with a name and a calling'}
              </p>
            </div>
            {hpPreview !== null && (
              <div
                data-testid="hp-preview"
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5"
                style={{
                  background: 'linear-gradient(135deg, rgba(180,40,40,0.2), rgba(120,20,20,0.15))',
                  border: '1px solid rgba(180,60,60,0.3)',
                }}
              >
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#a05050' }}>HP</span>
                <span className="text-sm font-bold" style={{ color: '#e07070' }}>{hpPreview}</span>
              </div>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="mx-6" style={{ height: '1px', background: 'linear-gradient(90deg, transparent, #3d3425, transparent)' }} />

        <div className="space-y-5 p-6">
          {/* Character Name */}
          <div>
            <label
              htmlFor="character-name"
              className="mb-1.5 block text-xs font-bold uppercase tracking-widest"
              style={{ color: '#9a8a60' }}
            >
              Name
            </label>
            <input
              id="character-name"
              type="text"
              data-testid="character-name-input"
              value={characterName}
              onChange={(e) => setCharacterName(e.target.value)}
              placeholder="Thorin Oakenshield"
              maxLength={50}
              className="block w-full rounded-md px-3 py-2.5 text-sm transition-colors focus:outline-none"
              style={{
                background: 'rgba(10,8,5,0.6)',
                border: fieldErrors.character_name ? '1px solid #b04040' : '1px solid #3d3425',
                color: '#e8dcc8',
                fontFamily: 'Georgia, "Times New Roman", serif',
                fontSize: '15px',
                letterSpacing: '0.02em',
              }}
            />
            {fieldErrors.character_name && (
              <p className="mt-1.5 text-xs" style={{ color: '#d06060' }}>
                {fieldErrors.character_name}
              </p>
            )}
          </div>

          {/* Character Class */}
          <div>
            <label
              htmlFor="character-class"
              className="mb-1.5 block text-xs font-bold uppercase tracking-widest"
              style={{ color: '#9a8a60' }}
            >
              Class
            </label>
            <select
              id="character-class"
              data-testid="character-class-select"
              value={characterClass}
              onChange={(e) => setCharacterClass(e.target.value)}
              className="block w-full rounded-md px-3 py-2.5 text-sm transition-colors focus:outline-none"
              style={{
                background: 'rgba(10,8,5,0.6)',
                border: fieldErrors.character_class ? '1px solid #b04040' : '1px solid #3d3425',
                color: characterClass ? '#e8dcc8' : '#6a5a3a',
              }}
            >
              <option value="">Choose your calling...</option>
              {D5E_CLASSES.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>
            {characterClass && CLASS_FLAVOR[characterClass] && (
              <p className="mt-1.5 text-xs italic" style={{ color: '#7a6a45' }}>
                {CLASS_FLAVOR[characterClass]}
              </p>
            )}
            {fieldErrors.character_class && (
              <p className="mt-1.5 text-xs" style={{ color: '#d06060' }}>
                {fieldErrors.character_class}
              </p>
            )}
          </div>

          {/* Ability Scores */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <label
                className="text-xs font-bold uppercase tracking-widest"
                style={{ color: '#9a8a60' }}
              >
                Ability Scores
              </label>
              <button
                type="button"
                onClick={fillStandardArray}
                className="rounded-sm px-2 py-0.5 text-[11px] font-medium transition-all hover:opacity-80"
                style={{
                  color: '#c4a050',
                  background: 'rgba(180,130,50,0.08)',
                  border: '1px solid rgba(180,130,50,0.2)',
                }}
              >
                Standard Array
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {ABILITY_NAMES.map((stat) => (
                <div
                  key={stat}
                  className="relative rounded-md text-center transition-all"
                  style={{
                    background: 'rgba(10,8,5,0.4)',
                    border: fieldErrors[`stats.${stat}`] ? '1px solid #b04040' : '1px solid #2d2518',
                    padding: '10px 8px 8px',
                  }}
                >
                  <label
                    htmlFor={`stat-${stat}`}
                    className="mb-0.5 block text-[10px] font-bold uppercase tracking-[0.15em]"
                    style={{ color: '#6a5a3a' }}
                    title={ABILITY_FULL[stat]}
                  >
                    {ABILITY_LABELS[stat]}
                  </label>
                  <input
                    id={`stat-${stat}`}
                    type="number"
                    data-testid={`stat-${stat}-input`}
                    min={1}
                    max={20}
                    value={stats[stat] || ''}
                    onChange={(e) => handleStatChange(stat, e.target.value)}
                    className="block w-full bg-transparent text-center text-lg font-bold focus:outline-none"
                    style={{ color: '#e8dcc8' }}
                  />
                  <div className="text-[11px] font-medium" style={{ color: '#7a6a45' }}>
                    {stats[stat] ? getModifier(stats[stat]) : ''}
                  </div>
                  {fieldErrors[`stats.${stat}`] && (
                    <p className="mt-0.5 text-[10px]" style={{ color: '#d06060' }}>
                      1-20
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {formError && (
            <div
              data-testid="form-error"
              className="rounded-md px-3 py-2 text-sm"
              style={{
                background: 'rgba(180,40,40,0.1)',
                border: '1px solid rgba(180,60,60,0.25)',
                color: '#d06060',
              }}
            >
              {formError}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            data-testid="save-character-button"
            disabled={loading}
            className="w-full rounded-md py-3 text-sm font-bold uppercase tracking-widest transition-all disabled:opacity-40"
            style={{
              background: loading
                ? '#4a3d20'
                : 'linear-gradient(135deg, #9a7a20 0%, #c4a040 50%, #9a7a20 100%)',
              color: '#1a1207',
              boxShadow: loading ? 'none' : '0 2px 8px rgba(180,130,50,0.25)',
              letterSpacing: '0.12em',
            }}
          >
            {loading
              ? 'Saving...'
              : isEditing
                ? 'Update Character'
                : 'Save Character'}
          </button>
        </div>
      </div>
    </form>
  )
}
