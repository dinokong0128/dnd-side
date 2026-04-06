'use client'

import Link from 'next/link'

type InviteRequiredMessageProps = {
  reason?: 'missing' | 'invalid' | 'used'
}

export function InviteRequiredMessage({
  reason = 'missing',
}: InviteRequiredMessageProps) {
  const messages = {
    missing:
      'This game is invite-only. Ask your Dungeon Master for a link to join.',
    invalid:
      'This invite link is invalid. Ask your Dungeon Master for a new link.',
    used: 'This invite link has already been used. Ask your Dungeon Master for a new link.',
  }

  return (
    <div className="dnd-page-bg flex min-h-screen items-center justify-center px-4">
      <div className="dnd-fade-in w-full max-w-sm text-center" data-testid="invite-required-message">
        <div className="dnd-card px-6 py-8">
          <div className="mb-4 text-4xl">&#x1F6E1;&#xFE0F;</div>
          <h1 className="dnd-heading text-xl font-bold mb-2">Invite Required</h1>
          <p className="dnd-subheading text-sm mb-4">{messages[reason]}</p>
          <Link href="/auth/login" className="dnd-link text-sm">
            Already have an account? Sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
