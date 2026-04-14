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
          <div className="rounded bg-red-50 p-4 text-red-800">{formError}</div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-900">
            Character Name
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              {...register('characterName')}
              className="mt-2 w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <p className="mt-1 text-sm text-red-600">
              {errors.characterName.message}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900">
            Character Class
          </label>
          <select
            {...register('characterClass')}
            className="mt-2 w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {CHARACTER_CLASSES.map((cls) => (
              <option key={cls} value={cls}>
                {cls}
              </option>
            ))}
          </select>
          {errors.characterClass && (
            <p className="mt-1 text-sm text-red-600">
              {errors.characterClass.message}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900">
            Race
          </label>
          <select
            {...register('race')}
            className="mt-2 w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {CHARACTER_RACES.map((race) => (
              <option key={race} value={race}>
                {race}
              </option>
            ))}
          </select>
          {errors.race && (
            <p className="mt-1 text-sm text-red-600">
              {errors.race.message}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900">
            Level
          </label>
          <input
            type="number"
            {...register('level', { valueAsNumber: true })}
            min="1"
            max="20"
            className="mt-2 w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.level && (
            <p className="mt-1 text-sm text-red-600">
              {errors.level.message}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 mb-3">
            Ability Scores
          </label>
          <div className="grid grid-cols-3 gap-4">
            {STAT_NAMES.map(({ key, label }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {label}
                </label>
                <input
                  type="number"
                  {...register(`stats.${key}`, { valueAsNumber: true })}
                  min="1"
                  max="20"
                  className="w-full rounded border border-gray-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {(errors.stats?.[key as keyof typeof errors.stats] as any)?.message && (
                  <p className="mt-1 text-xs text-red-600">
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
          className="w-full rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? 'Saving...' : 'Save Character'}
        </button>
      </form>
    </>
  )
}
