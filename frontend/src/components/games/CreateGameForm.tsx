'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'

const DEFAULT_DM_PERSONA = 'A classic high-fantasy D&D adventure.'

const createGameSchema = z.object({
  name: z
    .string()
    .min(1, { error: 'Game name is required' })
    .max(100, { error: 'Game name must be 100 characters or less' }),
})

export function CreateGameForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [dmPersona, setDmPersona] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldErrors({})
    setFormError('')

    const result = createGameSchema.safeParse({ name })
    if (!result.success) {
      const errors: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const field = issue.path[0]
        if (typeof field === 'string' && !errors[field]) {
          errors[field] = issue.message
        }
      }
      setFieldErrors(errors)
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          dm_persona: dmPersona.trim() || DEFAULT_DM_PERSONA,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        setFormError(data.error || 'Failed to create game')
        return
      }

      const game = await response.json()
      router.push(`/games/${game.id}`)
    } catch {
      setFormError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-md space-y-4 p-8">
      <h1 className="text-2xl font-bold">Create New Game</h1>

      <div>
        <label htmlFor="game-name" className="block text-sm font-medium">
          Game Name
        </label>
        <input
          id="game-name"
          type="text"
          data-testid="game-name-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 block w-full rounded border px-3 py-2"
        />
        {fieldErrors.name && (
          <p className="mt-1 text-sm text-red-600">{fieldErrors.name}</p>
        )}
      </div>

      <div>
        <label htmlFor="dm-persona" className="block text-sm font-medium">
          DM Persona / Campaign Tone
        </label>
        <textarea
          id="dm-persona"
          data-testid="dm-persona-input"
          value={dmPersona}
          onChange={(e) => setDmPersona(e.target.value)}
          placeholder="A gritty dark fantasy world where magic is forbidden..."
          rows={3}
          className="mt-1 block w-full rounded border px-3 py-2"
        />
      </div>

      {formError && (
        <p data-testid="form-error" className="text-sm text-red-600">
          {formError}
        </p>
      )}

      <button
        type="submit"
        data-testid="submit-button"
        disabled={loading}
        className="w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        Create Game
      </button>
    </form>
  )
}
