'use client'

import { useEffect, useState } from 'react'
import { InviteRequiredMessage } from './InviteRequiredMessage'
import { SignUpForm } from './SignUpForm'

interface E2ESignUpPageProps {
  code: string | null
}

interface PageState {
  ready: boolean
  gameId: string | null
  gameName: string
  reason: 'missing' | 'invalid' | 'used' | null
}

/**
 * E2E-only client component that fetches invite data via a browser-side
 * fetch, allowing Playwright's page.route() to intercept the invites call.
 */
export function E2ESignUpPage({ code }: E2ESignUpPageProps) {
  const [state, setState] = useState<PageState>({
    ready: false,
    gameId: null,
    gameName: '',
    reason: null,
  })

  useEffect(() => {
    if (!code) {
      setState({ ready: true, gameId: null, gameName: '', reason: 'missing' })
      return
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    fetch(
      `${supabaseUrl}/rest/v1/invites?code=eq.${encodeURIComponent(code)}&select=game_id`,
      {
        headers: {
          apikey: anonKey || '',
          Authorization: `Bearer ${anonKey || ''}`,
        },
      }
    )
      .then((res) => res.json())
      .then((data) => {
        // Handle both array (normal Supabase response) and object (mock response)
        const invite = Array.isArray(data) ? data[0] : data
        if (!invite || !invite.game_id) {
          setState({ ready: true, gameId: null, gameName: '', reason: 'invalid' })
        } else {
          setState({
            ready: true,
            gameId: invite.game_id as string,
            gameName: (invite.game_name as string) || '',
            reason: null,
          })
        }
      })
      .catch(() =>
        setState({ ready: true, gameId: null, gameName: '', reason: 'invalid' })
      )
  }, [code])

  if (!state.ready) return null

  if (state.reason) {
    return <InviteRequiredMessage reason={state.reason} />
  }

  return (
    <SignUpForm gameId={state.gameId!} inviteCode={code!} gameName={state.gameName} />
  )
}
