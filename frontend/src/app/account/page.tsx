import { redirect } from 'next/navigation'
import { AccountView } from '@/components/account/AccountView'
import { createClient } from '@/lib/supabase/server'

export default async function AccountPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .maybeSingle()

  return (
    <div className="dnd-page-bg min-h-screen py-12">
      <div className="mx-auto w-full max-w-lg px-4">
        <AccountView
          initialUsername={profile?.username ?? ''}
          email={user.email ?? ''}
        />
      </div>
    </div>
  )
}
