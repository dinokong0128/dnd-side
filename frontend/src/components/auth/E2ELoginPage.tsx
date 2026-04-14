'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LoginForm } from './LoginForm'

/**
 * E2E-only client component that checks auth via a browser-side fetch,
 * allowing Playwright's page.route() to intercept the /auth/v1/user call.
 * Redirects to /dashboard if the user is already logged in.
 */
export function E2ELoginPage() {
  const router = useRouter()

  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: anonKey || '',
        Authorization: `Bearer ${anonKey || ''}`,
      },
    })
      .then((res) => {
        if (res.ok) router.push('/dashboard')
      })
      .catch(() => {})
  }, [router])

  return <LoginForm />
}
