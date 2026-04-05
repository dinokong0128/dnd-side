import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { fetchGamesByUserId } from '@/lib/supabase/games'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const games = await fetchGamesByUserId(user.id)

  return (
    <div className="mx-auto max-w-2xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your Games</h1>
        <Link
          href="/dashboard/new"
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Create New Game
        </Link>
      </div>

      {games.length === 0 ? (
        <p data-testid="empty-state" className="text-gray-600">
          No games yet. Create your first one.
        </p>
      ) : (
        <ul className="space-y-3">
          {games.map((game) => (
            <li key={game.id}>
              <Link
                href={`/games/${game.id}`}
                className="flex items-center justify-between rounded border p-4 hover:bg-gray-50"
              >
                <span className="font-medium">{game.name}</span>
                <span className="rounded bg-gray-200 px-2 py-1 text-xs uppercase">
                  {game.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
