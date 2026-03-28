'use client'

import { useState } from 'react'
import { z } from 'zod'

const signUpSchema = z.object({
  email: z.email({ error: 'Please enter a valid email address' }),
  password: z
    .string()
    .min(8, { error: 'Password must be at least 8 characters' }),
})

type SignUpFormProps = {
  gameId: string
  inviteCode: string
  gameName?: string
}

export function SignUpForm({ gameId, inviteCode, gameName }: SignUpFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldErrors({})
    setFormError('')

    const result = signUpSchema.safeParse({ email, password })
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
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          invite_code: inviteCode,
          game_id: gameId,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        setFormError(data.error || 'Failed to create account')
        return
      }

      setSuccess(true)
    } catch {
      setFormError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="dnd-page flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="dnd-card p-8" data-testid="success-message">
            <div className="mb-4 text-4xl">📜</div>
            <h2 className="dnd-heading text-xl font-bold mb-3">
              Check Your Scrolls
            </h2>
            <p style={{ color: 'var(--foreground-muted)' }}>
              Check your email to confirm your account.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="dnd-page flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Branding */}
        <div className="mb-8 text-center">
          <p
            className="mb-3 text-sm tracking-[0.3em] uppercase"
            style={{ color: 'var(--gold-dim)' }}
          >
            ⚔ Realm & Ruin ⚔
          </p>
          <h1 className="dnd-heading text-3xl font-bold mb-2">
            Join the Adventure
          </h1>
          {gameName && (
            <div
              className="mt-3 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm"
              style={{
                background: 'rgba(201, 168, 76, 0.1)',
                border: '1px solid rgba(201, 168, 76, 0.2)',
                color: 'var(--gold)',
              }}
            >
              Joining: {gameName}
            </div>
          )}
        </div>

        {/* Form card */}
        <div className="dnd-card p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="dnd-label">
                Email
              </label>
              <input
                id="email"
                type="email"
                data-testid="email-input"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="dnd-input"
                placeholder="adventurer@realm.com"
              />
              {fieldErrors.email && (
                <p className="dnd-error">{fieldErrors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="dnd-label">
                Password
              </label>
              <input
                id="password"
                type="password"
                data-testid="password-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="dnd-input"
                placeholder="Min. 8 characters"
              />
              {fieldErrors.password && (
                <p className="dnd-error">{fieldErrors.password}</p>
              )}
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
              className="dnd-button-primary"
            >
              {loading ? 'Creating account…' : 'Join the Adventure'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
