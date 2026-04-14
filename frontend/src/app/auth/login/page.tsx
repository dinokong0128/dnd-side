import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LoginForm } from '@/components/auth/LoginForm'

export default async function LoginPage() {
  // E2E testing: skip server-side auth check; client component handles it
  if (process.env.E2E_TESTING === 'true') {
    const { E2ELoginPage } = await import('@/components/auth/E2ELoginPage')
    return <E2ELoginPage />
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  return <LoginForm />
}
