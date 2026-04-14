import { fetchInviteByCode } from '@/lib/supabase/invites'
import { InviteRequiredMessage } from '@/components/auth/InviteRequiredMessage'
import { SignUpForm } from '@/components/auth/SignUpForm'

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { code } = await searchParams

  // E2E testing: skip server-side invite validation; client component handles it
  if (process.env.E2E_TESTING === 'true') {
    const { E2ESignUpPage } = await import('@/components/auth/E2ESignUpPage')
    return <E2ESignUpPage code={typeof code === 'string' ? code : null} />
  }

  if (!code || typeof code !== 'string') {
    return <InviteRequiredMessage reason="missing" />
  }

  const result = await fetchInviteByCode(code)

  if (result.status === 'invalid') {
    return <InviteRequiredMessage reason="invalid" />
  }

  if (result.status === 'used') {
    return <InviteRequiredMessage reason="used" />
  }

  return (
    <SignUpForm
      gameId={result.gameId}
      inviteCode={code}
      gameName={result.gameName}
    />
  )
}
