'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { characterSchema, type CharacterFormData } from '@/lib/validations/character'
import { CHARACTER_CLASSES, STAT_NAMES } from '@/lib/constants/game'
import type { PlayerRow } from '@/lib/types/player'

interface CharacterCreationFormProps {
  gameId: string
  defaultValues?: Partial<CharacterFormData>
  onSuccess: (player: PlayerRow) => void
}

export function CharacterCreationForm({
  gameId,
  defaultValues,
  onSuccess,
}: CharacterCreationFormProps) {
  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CharacterFormData>({
    resolver: zodResolver(characterSchema),
    defaultValues: {
      characterName: defaultValues?.characterName || '',
      characterClass: defaultValues?.characterClass || CHARACTER_CLASSES[0],
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {formError && (
        <div className="rounded bg-red-50 p-4 text-red-800">{formError}</div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-900">
          Character Name
        </label>
        <input
          type="text"
          {...register('characterName')}
          className="mt-2 w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter character name"
        />
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
              {(errors.stats?.[key as keyof typeof errors.stats] as any)?.message && (
                <p className="mt-1 text-xs text-red-600">
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
  )
}
