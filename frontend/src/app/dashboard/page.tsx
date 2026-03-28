import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { fetchGamesByUserId } from '@/lib/supabase/games'

const STATUS_CONFIG: Record<string, { label: string; badgeClass: string }> = {
  lobby: { label: 'Lobby', badgeClass: 'dnd-badge dnd-badge-lobby' },
  pending: { label: 'Lobby', badgeClass: 'dnd-badge dnd-badge-lobby' },
  active: { label: 'Active', badgeClass: 'dnd-badge dnd-badge-active' },
  paused: { label: 'Paused', badgeClass: 'dnd-badge dnd-badge-paused' },
  ended: { label: 'Ended', badgeClass: 'dnd-badge dnd-badge-ended' },
}

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] ?? STATUS_CONFIG.lobby
}

function getRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const games = await fetchGamesByUserId(user!.id)

  return (
    <div className="dnd-page min-h-screen px-4 py-8">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="dnd-heading text-3xl font-bold">Your Campaigns</h1>
            {games.length > 0 && (
              <p
                className="mt-1 text-sm"
                style={{ color: 'var(--foreground-muted)' }}
              >
                {games.length} {games.length === 1 ? 'campaign' : 'campaigns'}
              </p>
            )}
          </div>
          <Link href="/dashboard/new" className="dnd-button-secondary">
            + New Game
          </Link>
        </div>

        {games.length === 0 ? (
          /* Empty state */
          <div className="dnd-card p-12 text-center">
            <div className="mb-5 text-5xl">⚔️</div>
            <h2 className="dnd-heading text-xl font-bold mb-2">
              No Campaigns Yet
            </h2>
            <p
              className="mb-6 max-w-sm mx-auto"
              style={{ color: 'var(--foreground-muted)' }}
              data-testid="empty-state"
            >
              Every legend begins with a single step. Create your first campaign
              and let the AI Dungeon Master weave your tale.
            </p>
            <Link
              href="/dashboard/new"
              className="dnd-button-primary"
              style={{ maxWidth: '280px', margin: '0 auto' }}
            >
              Start Your Adventure
            </Link>
          </div>
        ) : (
          /* Game list */
          <div className="space-y-3">
            {games.map((game) => {
              const cfg = getStatusConfig(game.status)
              const isEnded = game.status === 'ended'

              const card = (
                <div className="dnd-game-card">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="dnd-heading text-lg font-semibold truncate">
                        {game.name}
                      </h3>
                      {game.dm_persona && (
                        <p
                          className="mt-1 text-sm truncate"
                          style={{ color: 'var(--foreground-muted)' }}
                        >
                          {game.dm_persona}
                        </p>
                      )}
                      <p
                        className="mt-2 text-xs"
                        style={{
                          color: 'var(--foreground-muted)',
                          opacity: 0.6,
                        }}
                      >
                        Created {getRelativeTime(game.created_at)}
                      </p>
                    </div>
                    <span className={cfg.badgeClass}>{cfg.label}</span>
                  </div>
                </div>
              )

              if (isEnded) {
                return (
                  <div key={game.id} style={{ opacity: 0.5, cursor: 'default' }}>
                    {card}
                  </div>
                )
              }

              return (
                <Link
                  key={game.id}
                  href={`/games/${game.id}`}
                  className="block"
                >
                  {card}
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
