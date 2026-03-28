'use client'

import Link from 'next/link'

export function InviteRequiredMessage() {
  return (
    <div className="dnd-page flex min-h-screen items-center justify-center px-4">
      <div
        className="w-full max-w-md text-center"
        data-testid="invite-required-message"
      >
        <div className="dnd-card p-8">
          <div className="mb-5 text-5xl">🛡️</div>
          <h1 className="dnd-heading text-2xl font-bold mb-3">
            Invite Required
          </h1>
          <p className="mb-6" style={{ color: 'var(--foreground-muted)' }}>
            You need a valid invite link to sign up. Ask your Dungeon Master for
            one.
          </p>
          <div className="dnd-divider" />
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            Already have an account?{' '}
            <Link href="/auth/login" className="dnd-link">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
