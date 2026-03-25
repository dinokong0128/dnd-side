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
    return <InviteRequiredMessage />
  }

  const invite = await fetchInviteByCode(code)

  if (!invite) {
    return <InviteRequiredMessage />
  }

  return <SignUpForm gameId={invite.gameId} inviteCode={code} />
}
