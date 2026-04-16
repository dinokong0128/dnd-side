'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { characterSchema, type CharacterFormData } from '@/lib/validations/character'
import { CHARACTER_CLASSES, CHARACTER_RACES, STAT_NAMES } from '@/lib/constants/game'
import type { PlayerRow } from '@/lib/types/player'

interface CharacterCreationFormProps {
  gameId: string
  defaultValues?: Partial<CharacterFormData>
  onSuccess: (player: PlayerRow) => void
}

function SpinnerIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 15 15"
      fill="none"
      style={{ animation: 'spin 0.75s linear infinite', display: 'block' }}
    >
      <circle
        cx="7.5"
        cy="7.5"
        r="5.5"
        stroke="#8a7234"
        strokeWidth="1.5"
        strokeDasharray="16 18"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function CharacterCreationForm({
  gameId,
  defaultValues,
  onSuccess,
}: CharacterCreationFormProps) {
  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState('')
  const [isGeneratingCharName, setIsGeneratingCharName] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<CharacterFormData>({
    resolver: zodResolver(characterSchema),
    defaultValues: {
      characterName: defaultValues?.characterName || '',
      characterClass: defaultValues?.characterClass || CHARACTER_CLASSES[0],
      race: defaultValues?.race || CHARACTER_RACES[0],
      level: defaultValues?.level || 1,
      stats: defaultValues?.stats || {
        str: 10,
        dex: 10,
        con: 10,
        int: 10,
        wis: 10,
        cha: 10,
      },
    },
  })

  const watchedRace = watch('race')
  const watchedClass = watch('characterClass')

  async function handleGenerateCharName() {
    setIsGeneratingCharName(true)
    try {
      const res = await fetch('/api/generate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'character_name',
          race: watchedRace,
          characterClass: watchedClass,
        }),
      })
      if (!res.ok) return
      const { suggestion } = await res.json()
      if (suggestion) setValue('characterName', suggestion)
    } catch {
      // silent fail
    } finally {
      setIsGeneratingCharName(false)
    }
  }

  async function onSubmit(data: CharacterFormData) {
    setLoading(true)
    setFormError('')

    try {
      const response = await fetch(`/api/games/${gameId}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character_name: data.characterName,
          character_class: data.characterClass,
          race: data.race,
          level: data.level,
          stats: data.stats,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        setFormError(errorData.error || 'Failed to save character')
        return
      }

      const player: PlayerRow = await response.json()
      onSuccess(player)
    } catch (err) {
      setFormError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {formError && (
          <div className="dnd-error-banner">{formError}</div>
        )}

        <div>
          <label className="dnd-label">
            Character Name
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              {...register('characterName')}
              className="dnd-input mt-2"
              placeholder="Enter character name"
              style={{ paddingRight: '38px' }}
            />
            <button
              type="button"
              data-testid="generate-char-name-btn"
              disabled={isGeneratingCharName}
              onClick={handleGenerateCharName}
              title="Generate character name"
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '26px',
                height: '26px',
                background: 'transparent',
                border: 'none',
                cursor: isGeneratingCharName ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                fontSize: '15px',
                lineHeight: 1,
                opacity: isGeneratingCharName ? 1 : 0.55,
                transition: 'opacity 0.15s',
                marginTop: '8px',
              }}
            >
              {isGeneratingCharName ? <SpinnerIcon /> : '✨'}
            </button>
          </div>
          {errors.characterName && (
            <p className="dnd-field-error mt-1">
              {errors.characterName.message}
            </p>
          )}
        </div>

        <div>
          <label className="dnd-label">
            Character Class
          </label>
          <select
            {...register('characterClass')}
            className="dnd-input mt-2"
          >
            {CHARACTER_CLASSES.map((cls) => (
              <option key={cls} value={cls}>
                {cls}
              </option>
            ))}
          </select>
          {errors.characterClass && (
            <p className="dnd-field-error mt-1">
              {errors.characterClass.message}
            </p>
          )}
        </div>

        <div>
          <label className="dnd-label">
            Race
          </label>
          <select
            {...register('race')}
            className="dnd-input mt-2"
          >
            {CHARACTER_RACES.map((race) => (
              <option key={race} value={race}>
                {race}
              </option>
            ))}
          </select>
          {errors.race && (
            <p className="dnd-field-error mt-1">
              {errors.race.message}
            </p>
          )}
        </div>

        <div>
          <label className="dnd-label">
            Level
          </label>
          <input
            type="number"
            {...register('level', { valueAsNumber: true })}
            min="1"
            max="20"
            className="dnd-input mt-2"
          />
          {errors.level && (
            <p className="dnd-field-error mt-1">
              {errors.level.message}
            </p>
          )}
        </div>

        <div>
          <label className="dnd-label mb-3">
            Ability Scores
          </label>
          <div className="dnd-stat-grid">
            {STAT_NAMES.map(({ key, label }) => (
              <div key={key} className="dnd-stat-box">
                <label className="dnd-stat-label">{label}</label>
                <input
                  type="number"
                  {...register(`stats.${key}`, { valueAsNumber: true })}
                  min="1"
                  max="20"
                  className="dnd-stat-input"
                />
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {(errors.stats?.[key as keyof typeof errors.stats] as any)?.message && (
                  <p className="dnd-field-error mt-1 text-xs">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(errors.stats?.[key as keyof typeof errors.stats] as any)?.message}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="dnd-btn-primary"
        >
          {loading ? 'Saving...' : 'Save Character'}
        </button>
      </form>
    </>
  )
}
