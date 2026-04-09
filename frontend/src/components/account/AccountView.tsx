'use client'

import Link from 'next/link'
import { useState } from 'react'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { getInitials } from '@/lib/utils/profile'

const displayNameSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, { error: 'Display name is required' })
    .max(50, { error: 'Display name is too long' }),
})

const emailSchema = z.object({
  email: z.email({ error: 'Please enter a valid email address' }),
})

interface AccountViewProps {
  initialUsername: string
  email: string
}

export function AccountView({ initialUsername, email }: AccountViewProps) {
  const [username, setUsername] = useState(initialUsername)
  const [saveState, setSaveState] = useState('')
  const [passwordResetState, setPasswordResetState] = useState('')
  const [saving, setSaving] = useState(false)
  const [sendingReset, setSendingReset] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  async function handleSaveDisplayName(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaveState('')

    const parsed = displayNameSchema.safeParse({ username })
    if (!parsed.success) {
      setSaveState(parsed.error.issues[0].message)
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: parsed.data.username }),
      })

      const data = (await response.json().catch(() => null)) as
        | { error?: string }
        | null

      if (!response.ok) {
        setSaveState(data?.error ?? 'Failed to save display name')
        return
      }

      setUsername(parsed.data.username)
      setSaveState('Display name saved.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSendPasswordReset() {
    setPasswordResetState('')
    const parsedEmail = emailSchema.safeParse({ email })
    if (!parsedEmail.success) {
      setPasswordResetState(parsedEmail.error.issues[0].message)
      return
    }

    setSendingReset(true)
    try {
      const supabase = createClient()
      const redirectTo = `${window.location.origin}/auth/callback?next=/auth/reset-password`
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      })

      if (error) {
        setPasswordResetState(error.message)
        return
      }

      setPasswordResetState('Check your inbox for a password reset link.')
    } finally {
      setSendingReset(false)
    }
  }

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      window.location.assign('/')
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className="dnd-card p-6">
      <div className="mb-6 flex items-center gap-4">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full border text-base font-semibold"
          style={{
            borderColor: 'var(--dnd-gold-dim)',
            color: 'var(--dnd-parchment)',
            background: 'var(--input-bg)',
          }}
        >
          {getInitials(username)}
        </div>
        <div>
          <h1 className="dnd-heading text-xl font-bold">{username}</h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>{email}</p>
        </div>
      </div>

      <div className="mb-6 border-t pt-6" style={{ borderColor: 'var(--dnd-brown)' }}>
        <h2 className="dnd-heading mb-3 text-sm font-semibold">Display Name</h2>
        <form className="space-y-3" onSubmit={handleSaveDisplayName}>
          <div className="flex items-end gap-2">
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="dnd-input"
              aria-label="Display name"
            />
            <button type="submit" className="dnd-btn-secondary" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
          {saveState && (
            <p className="text-sm" style={{ color: saveState.includes('saved') ? 'var(--dnd-emerald)' : 'var(--error)' }}>
              {saveState}
            </p>
          )}
        </form>
      </div>

      <div className="mb-6 border-t pt-6" style={{ borderColor: 'var(--dnd-brown)' }}>
        <h2 className="dnd-heading mb-3 text-sm font-semibold">Password</h2>
        <button
          type="button"
          className="dnd-btn-secondary"
          onClick={handleSendPasswordReset}
          disabled={sendingReset}
        >
          {sendingReset ? 'Sending…' : 'Send password reset email'}
        </button>
        {passwordResetState && (
          <p className="mt-3 text-sm" style={{ color: passwordResetState.includes('inbox') ? 'var(--dnd-emerald)' : 'var(--error)' }}>
            {passwordResetState}
          </p>
        )}
      </div>

      <div className="border-t pt-6" style={{ borderColor: 'var(--dnd-brown)' }}>
        <div className="flex items-center justify-between">
          <button
            type="button"
            className="dnd-btn-secondary"
            onClick={handleSignOut}
            disabled={signingOut}
            style={{ color: 'var(--dnd-crimson-bright)', borderColor: 'rgba(139, 34, 50, 0.5)' }}
          >
            {signingOut ? 'Signing out…' : 'Sign Out'}
          </button>
          <Link href="/dashboard" className="dnd-link text-sm">
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
