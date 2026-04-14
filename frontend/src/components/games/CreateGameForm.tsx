'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import Link from 'next/link'

const DEFAULT_DM_PERSONA = 'A classic high-fantasy D&D adventure.'

const createGameSchema = z.object({
  name: z
    .string()
    .min(1, { error: 'Game name is required' })
    .max(100, { error: 'Game name must be 100 characters or less' }),
})

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

async function generateText(
  type: 'game_name' | 'dm_persona',
  setLoading: (v: boolean) => void,
  onSuccess: (v: string) => void
) {
  setLoading(true)
  try {
    const res = await fetch('/api/generate-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    })
    if (!res.ok) return
    const { suggestion } = await res.json()
    if (suggestion) onSuccess(suggestion)
  } catch {
    // silent fail
  } finally {
    setLoading(false)
  }
}

export function CreateGameForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [dmPersona, setDmPersona] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isGeneratingName, setIsGeneratingName] = useState(false)
  const [isGeneratingPersona, setIsGeneratingPersona] = useState(false)

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
    <div className="dnd-page-bg min-h-screen px-4 py-12">
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div className="dnd-fade-in mx-auto w-full max-w-lg">
        <Link
          href="/dashboard"
          className="dnd-link mb-6 inline-block text-sm"
        >
          &larr; Back to Dashboard
        </Link>

        <h1 className="dnd-heading mb-2 text-2xl font-bold">
          Begin a New Campaign
        </h1>
        <p className="dnd-subheading mb-8 text-sm">
          Name your adventure and set the tone for your AI Dungeon Master.
        </p>

        <div className="dnd-card px-6 py-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="game-name" className="dnd-label">
                Campaign Name
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="game-name"
                  type="text"
                  data-testid="game-name-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="dnd-input"
                  placeholder="The Dragon's Keep"
                  style={{ paddingRight: '38px' }}
                />
                <button
                  type="button"
                  data-testid="generate-name-btn"
                  disabled={isGeneratingName}
                  onClick={() =>
                    generateText('game_name', setIsGeneratingName, setName)
                  }
                  title="Generate campaign name"
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '26px',
                    height: '26px',
                    background: 'transparent',
                    border: 'none',
                    cursor: isGeneratingName ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    fontSize: '15px',
                    lineHeight: 1,
                    opacity: isGeneratingName ? 1 : 0.55,
                    transition: 'opacity 0.15s',
                  }}
                  onMouseOver={(e) => {
                    if (!isGeneratingName)
                      (e.currentTarget as HTMLElement).style.opacity = '1'
                  }}
                  onMouseOut={(e) => {
                    if (!isGeneratingName)
                      (e.currentTarget as HTMLElement).style.opacity = '0.55'
                  }}
                >
                  {isGeneratingName ? <SpinnerIcon /> : '✨'}
                </button>
              </div>
              <p className="dnd-helper">Give your adventure a memorable title.</p>
              {fieldErrors.name && (
                <p className="dnd-field-error">{fieldErrors.name}</p>
              )}
            </div>

            <div>
              <label htmlFor="dm-persona" className="dnd-label">
                DM Persona / Campaign Tone
              </label>
              <div style={{ position: 'relative' }}>
                <textarea
                  id="dm-persona"
                  data-testid="dm-persona-input"
                  value={dmPersona}
                  onChange={(e) => setDmPersona(e.target.value)}
                  placeholder="e.g. 'A gritty pirate adventure where death is permanent and betrayal is common.'"
                  rows={4}
                  className="dnd-input dnd-textarea"
                />
                <button
                  type="button"
                  data-testid="generate-persona-btn"
                  disabled={isGeneratingPersona}
                  onClick={() =>
                    generateText('dm_persona', setIsGeneratingPersona, setDmPersona)
                  }
                  title="Generate DM persona"
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    width: '26px',
                    height: '26px',
                    background: isGeneratingPersona
                      ? 'rgba(10,8,6,0.85)'
                      : 'rgba(10,8,6,0.85)',
                    border: 'none',
                    cursor: isGeneratingPersona ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    fontSize: '15px',
                    lineHeight: 1,
                    borderRadius: '4px',
                    opacity: isGeneratingPersona ? 1 : 0.55,
                    transition: 'opacity 0.15s',
                  }}
                  onMouseOver={(e) => {
                    if (!isGeneratingPersona)
                      (e.currentTarget as HTMLElement).style.opacity = '1'
                  }}
                  onMouseOut={(e) => {
                    if (!isGeneratingPersona)
                      (e.currentTarget as HTMLElement).style.opacity = '0.55'
                  }}
                >
                  {isGeneratingPersona ? <SpinnerIcon /> : '✨'}
                </button>
              </div>
              <p className="dnd-helper">
                This shapes how the AI DM narrates your world. Leave blank for a
                classic high-fantasy adventure.
              </p>
            </div>

            {formError && (
              <div data-testid="form-error" className="dnd-error-banner">
                {formError}
              </div>
            )}

            <button
              type="submit"
              data-testid="submit-button"
              disabled={loading}
              className="dnd-btn-primary"
            >
              {loading ? 'Forging your world\u2026' : 'Begin the Campaign'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
