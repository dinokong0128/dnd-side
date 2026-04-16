'use client'

import { useState } from 'react'

interface InviteSectionProps {
  gameId: string
}

export function InviteSection({ gameId }: InviteSectionProps) {
  const [inviteUrl, setInviteUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  async function handleGenerate() {
    setLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/games/${gameId}/invites`, {
        method: 'POST',
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Failed to generate invite')
        return
      }

      const data = await response.json()
      setInviteUrl(data.invite_url)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: select the text in the input
    }
  }

  return (
    <div className="dnd-card p-6">
      <h2 className="dnd-heading mb-4 text-lg font-semibold">⚔ Invite Players</h2>

      {!inviteUrl ? (
        <div>
          <p className="dnd-subheading mb-4 text-sm">
            Generate an invite link to share with your players. Each link is
            single-use.
          </p>
          <button
            data-testid="generate-invite-button"
            onClick={handleGenerate}
            disabled={loading}
            className="dnd-btn-primary"
            style={{ width: 'auto' }}
          >
            {loading ? 'Generating...' : 'Generate Invite Link'}
          </button>
        </div>
      ) : (
        <div>
          <p className="dnd-subheading mb-2 text-sm">
            Share this link with a player:
          </p>
          <div className="flex gap-2">
            <input
              data-testid="invite-url-input"
              type="text"
              readOnly
              value={inviteUrl}
              className="dnd-input flex-1 text-sm"
            />
            <button
              data-testid="copy-button"
              onClick={handleCopy}
              className="dnd-btn-copy"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <button
            data-testid="generate-another-link"
            onClick={() => {
              setInviteUrl('')
              setCopied(false)
            }}
            className="dnd-link mt-3 text-sm"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            Generate another link
          </button>
        </div>
      )}

      {error && (
        <div
          data-testid="invite-error"
          className="dnd-error-banner mt-3 text-sm"
        >
          {error}
        </div>
      )}
    </div>
  )
}
