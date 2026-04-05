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
    <div className="rounded-lg bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-semibold text-gray-900">
        Invite Players
      </h2>

      {!inviteUrl ? (
        <div>
          <p className="mb-4 text-sm text-gray-600">
            Generate an invite link to share with your players. Each link is
            single-use.
          </p>
          <button
            data-testid="generate-invite-button"
            onClick={handleGenerate}
            disabled={loading}
            className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? 'Generating...' : 'Generate Invite Link'}
          </button>
        </div>
      ) : (
        <div>
          <p className="mb-2 text-sm text-gray-600">
            Share this link with a player:
          </p>
          <div className="flex gap-2">
            <input
              data-testid="invite-url-input"
              type="text"
              readOnly
              value={inviteUrl}
              className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm text-gray-700"
            />
            <button
              data-testid="copy-button"
              onClick={handleCopy}
              className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
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
            className="mt-3 text-sm text-blue-600 hover:text-blue-800"
          >
            Generate another link
          </button>
        </div>
      )}

      {error && (
        <div
          data-testid="invite-error"
          className="mt-3 rounded bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}
    </div>
  )
}
