'use client'

import { useState } from 'react'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'

const signUpSchema = z.object({
  email: z.email({ error: 'Please enter a valid email address' }),
  password: z
    .string()
    .min(8, { error: 'Password must be at least 8 characters' }),
})

type SignUpFormProps = {
  gameId: string
  inviteCode: string
}

export function SignUpForm({ gameId }: SignUpFormProps) {
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
      const supabase = createClient()
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/games/${gameId}`,
        },
      })

      if (error) {
        setFormError(error.message)
        return
      }

      setSuccess(true)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div data-testid="success-message" className="mx-auto max-w-md p-8">
        <p>Check your email to confirm your account.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-md space-y-4 p-8">
      <h1 className="text-2xl font-bold">Create account</h1>

      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          data-testid="email-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block w-full rounded border px-3 py-2"
        />
        {fieldErrors.email && (
          <p className="mt-1 text-sm text-red-600">{fieldErrors.email}</p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          type="password"
          data-testid="password-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 block w-full rounded border px-3 py-2"
        />
        {fieldErrors.password && (
          <p className="mt-1 text-sm text-red-600">{fieldErrors.password}</p>
        )}
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
        Create account
      </button>
    </form>
  )
}
