'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'

const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, { error: 'Password must be at least 8 characters' }),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export function ResetPasswordForm() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')

    const parsed = resetPasswordSchema.safeParse({
      password,
      confirmPassword,
    })

    if (!parsed.success) {
      setErrorMessage(parsed.error.issues[0].message)
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({
        password: parsed.data.password,
      })

      if (error) {
        setErrorMessage(error.message)
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
          <h1 className="dnd-heading text-2xl font-bold">Set a new password</h1>
        </div>

        <div className="dnd-card px-6 py-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="password" className="dnd-label">
                New password
              </label>
              <input
                id="password"
                type="password"
                className="dnd-input"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            <div>
              <label htmlFor="confirm-password" className="dnd-label">
                Confirm password
              </label>
              <input
                id="confirm-password"
                type="password"
                className="dnd-input"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>

            {errorMessage && <div className="dnd-error-banner">{errorMessage}</div>}

            <button type="submit" className="dnd-btn-primary" disabled={loading}>
              {loading ? 'Updating…' : 'Update password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
