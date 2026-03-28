'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

const loginSchema = z.object({
  email: z.email({ error: 'Please enter a valid email address' }),
  password: z.string().min(1, { error: 'Password is required' }),
})

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldErrors({})
    setFormError('')

    const result = loginSchema.safeParse({ email, password })
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
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setFormError('Invalid email or password')
        return
      }

      router.push('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="dnd-page-bg flex min-h-screen items-center justify-center px-4">
      <div className="dnd-fade-in w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="dnd-brand mb-3">Realm &amp; Ruin</p>
          <h1 className="dnd-heading text-2xl font-bold">Welcome Back</h1>
          <p className="dnd-subheading mt-1 text-sm">
            Your quest awaits, adventurer.
          </p>
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
                placeholder="Your secret passphrase"
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
              {loading ? 'Signing in\u2026' : 'Enter the Realm'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm" style={{ color: 'var(--muted)' }}>
          New to the game? You&apos;ll need an invite link from your DM.
          <br />
          <Link href="/auth/signup" className="dnd-link">
            Sign up with invite
          </Link>
        </p>
      </div>
    </div>
  )
}
