'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'

const loginSchema = z.object({
  email: z.email({ error: 'Please enter a valid email address' }),
  password: z.string().min(1, { error: 'Password is required' }),
})

const forgotPasswordSchema = z.object({
  email: z.email({ error: 'Please enter a valid email address' }),
})

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'password' | 'magic'>('password')
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [forgotPasswordStatus, setForgotPasswordStatus] = useState('')
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

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setFieldErrors({})
    setFormError('')

    const emailResult = forgotPasswordSchema.safeParse({ email })
    if (!emailResult.success) {
      setFieldErrors({ email: emailResult.error.issues[0].message })
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const siteUrl = window.location.origin
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${siteUrl}/auth/callback?next=/dashboard`,
        },
      })

      if (error) {
        setFormError(error.message)
        return
      }

      setMagicLinkSent(true)
    } finally {
      setLoading(false)
    }
  }

  async function handleForgotPasswordSubmit() {
    setForgotPasswordStatus('')
    setFieldErrors((prev) => {
      const next = { ...prev }
      delete next.email
      return next
    })

    const parsed = forgotPasswordSchema.safeParse({ email })
    if (!parsed.success) {
      setFieldErrors({ email: parsed.error.issues[0].message })
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const redirectTo = `${window.location.origin}/auth/callback?next=/auth/reset-password`
      const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
        redirectTo,
      })

      if (error) {
        setForgotPasswordStatus(error.message)
        return
      }

      setForgotPasswordStatus('Check your inbox for a password reset link.')
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
          {mode === 'password' && !magicLinkSent ? (
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

              <div>
                <button
                  type="button"
                  className="dnd-link text-xs"
                  onClick={() => {
                    setShowForgotPassword((prev) => !prev)
                    setForgotPasswordStatus('')
                  }}
                >
                  Forgot password?
                </button>
              </div>

              {showForgotPassword && (
                <div className="space-y-3 rounded-md border p-3" style={{ borderColor: 'var(--dnd-brown)' }}>
                  <div className="space-y-3">
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>
                      Send a password reset link to your email.
                    </p>
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="dnd-input"
                      aria-label="Forgot password email"
                    />
                    <button type="button" className="dnd-btn-secondary" disabled={loading} onClick={handleForgotPasswordSubmit}>
                      {loading ? 'Sending…' : 'Send reset email'}
                    </button>
                    {forgotPasswordStatus && (
                      <p className="text-xs" style={{ color: forgotPasswordStatus.includes('inbox') ? 'var(--dnd-emerald)' : 'var(--error)' }}>
                        {forgotPasswordStatus}
                      </p>
                    )}
                  </div>
                </div>
              )}

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
                {loading ? 'Signing in…' : 'Enter the Realm'}
              </button>

              <p className="mt-4 text-center text-xs" style={{ color: 'var(--muted)' }}>
                <button
                  type="button"
                  onClick={() => {
                    setMode('magic')
                    setFormError('')
                    setFieldErrors({})
                    setShowForgotPassword(false)
                    setForgotPasswordStatus('')
                  }}
                  className="dnd-link"
                  data-testid="magic-link-toggle"
                >
                  Use magic link instead
                </button>
              </p>
            </form>
          ) : mode === 'magic' && !magicLinkSent ? (
            <form onSubmit={handleMagicLink} className="space-y-5">
              <div>
                <label htmlFor="magic-email" className="dnd-label">
                  Email
                </label>
                <input
                  id="magic-email"
                  type="email"
                  data-testid="magic-email-input"
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

              {formError && (
                <div data-testid="form-error" className="dnd-error-banner">
                  {formError}
                </div>
              )}

              <button
                type="submit"
                data-testid="magic-link-submit"
                disabled={loading}
                className="dnd-btn-primary"
              >
                {loading ? 'Sending…' : 'Send Magic Link'}
              </button>

              <p className="mt-4 text-center text-xs" style={{ color: 'var(--muted)' }}>
                <button
                  type="button"
                  onClick={() => {
                    setMode('password')
                    setMagicLinkSent(false)
                    setFormError('')
                    setFieldErrors({})
                  }}
                  className="dnd-link"
                  data-testid="password-toggle"
                >
                  Use password instead
                </button>
              </p>
            </form>
          ) : (
            <div className="text-center" data-testid="magic-link-success">
              <div className="mb-4 text-4xl">✨</div>
              <h2 className="dnd-heading text-xl font-bold mb-2">
                Check Your Inbox
              </h2>
              <p className="dnd-subheading text-sm mb-6">
                We sent a magic link to <strong>{email}</strong>. Click it to
                sign in and continue your adventure.
              </p>
              <button
                type="button"
                onClick={() => {
                  setMode('magic')
                  setMagicLinkSent(false)
                  setFormError('')
                  setFieldErrors({})
                  setEmail('')
                }}
                className="dnd-link text-sm"
              >
                Try another email
              </button>
            </div>
          )}
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
