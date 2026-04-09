import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getInitials } from '@/lib/utils/profile'
import { ProfileDropdown } from '@/components/layout/ProfileDropdown'

export async function DashboardHeader() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let username = ''
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .maybeSingle()

    username = profile?.username ?? ''
  }

  const initials = getInitials(username)

  return (
    <header
      className="border-b"
      style={{
        borderColor: 'var(--dnd-brown)',
        background: 'var(--dnd-charcoal)',
      }}
    >
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <Link href="/dashboard" className="dnd-heading text-lg font-bold tracking-wide">
          ⚔ Realm &amp; Ruin
        </Link>
        <ProfileDropdown initials={initials} />
      </div>
    </header>
  )
}
