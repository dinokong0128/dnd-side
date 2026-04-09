import Link from 'next/link'
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm'
import { createClient } from '@/lib/supabase/server'

export default async function ResetPasswordPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="dnd-page-bg flex min-h-screen items-center justify-center px-4">
        <div className="dnd-card w-full max-w-sm px-6 py-8">
          <div className="mb-6 text-center">
            <p className="dnd-brand mb-3">Realm &amp; Ruin</p>
            <h1 className="dnd-heading text-2xl font-bold">Set a new password</h1>
          </div>
          <div className="dnd-error-banner">
            Your reset session has expired or is invalid. Please request a new reset email.
          </div>
          <div className="mt-4 text-center">
            <Link className="dnd-link text-sm" href="/auth/login">
              Return to login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return <ResetPasswordForm />
}
