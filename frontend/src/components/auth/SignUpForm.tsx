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
      <div className="dnd-page-bg flex min-h-screen items-center justify-center px-4">
        <div className="dnd-fade-in w-full max-w-sm text-center">
          <div className="dnd-card px-6 py-8" data-testid="success-message">
            <div className="mb-4 text-4xl">&#x1F4DC;</div>
            <h2 className="dnd-heading text-xl font-bold mb-2">Check Your Scrolls</h2>
            <p className="dnd-subheading text-sm">
              We&apos;ve sent a confirmation message to your email.
              Verify your identity to join the adventure.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="dnd-page-bg flex min-h-screen items-center justify-center px-4">
      <div className="dnd-fade-in w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="dnd-brand mb-3">Realm &amp; Ruin</p>
          <h1 className="dnd-heading text-2xl font-bold">Join the Adventure</h1>
          {gameName && (
            <p className="mt-2 text-sm" style={{ color: 'var(--dnd-gold)' }}>
              Joining: {gameName}
            </p>
          )}
        </div>

        <div className="dnd-card px-6 py-8">
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
                <p className="dnd-field-error">{fieldErrors.email}</p>
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
                placeholder="Minimum 8 characters"
              />
              {fieldErrors.password && (
                <p className="dnd-field-error">{fieldErrors.password}</p>
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
              className="dnd-btn-primary"
            >
              {loading ? 'Creating account\u2026' : 'Join the Adventure'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
