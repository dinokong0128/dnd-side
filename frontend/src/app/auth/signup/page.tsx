import { fetchInviteByCode } from '@/lib/supabase/invites'
import { InviteRequiredMessage } from '@/components/auth/InviteRequiredMessage'
import { SignUpForm } from '@/components/auth/SignUpForm'

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { code } = await searchParams

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
