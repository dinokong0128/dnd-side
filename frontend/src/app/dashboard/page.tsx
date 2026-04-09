import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { fetchGamesByUserId } from '@/lib/supabase/games'
import type { Game } from '@/lib/supabase/games'
import { DashboardHeader } from '@/components/layout/DashboardHeader'

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'lobby':
    case 'pending':
      return 'dnd-badge dnd-badge-lobby'
    case 'active':
      return 'dnd-badge dnd-badge-active'
    case 'paused':
      return 'dnd-badge dnd-badge-paused'
    case 'ended':
      return 'dnd-badge dnd-badge-ended'
    default:
      return 'dnd-badge dnd-badge-lobby'
  }
}

function getStatusLabel(status: string): string {
  if (status === 'pending') return 'lobby'
  return status
}

function isClickable(status: string): boolean {
  return status !== 'ended'
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffMins = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 30) return `${diffDays}d ago`
  return new Date(dateStr).toLocaleDateString()
}

function GameCard({ game }: { game: Game }) {
  const clickable = isClickable(game.status)
  const inner = (
    <div className={`dnd-game-card ${!clickable ? 'dnd-game-card-ended' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="dnd-heading text-base font-semibold leading-tight">
          {game.name}
        </h3>
        <span className={getStatusBadgeClass(game.status)}>
          {getStatusLabel(game.status)}
        </span>
      </div>
      {game.dm_persona && (
        <p
          className="mt-2 truncate text-xs"
          style={{ color: 'var(--muted)' }}
        >
          {game.dm_persona}
        </p>
      )}
      <p className="mt-3 text-xs" style={{ color: 'var(--dnd-parchment-dim)' }}>
        Updated {formatRelativeTime(game.updated_at)}
      </p>
    </div>
  )

  if (!clickable) {
    return <div>{inner}</div>
  }

  return (
    <Link href={`/games/${game.id}`} className="dnd-game-card-link block">
      {inner}
    </Link>
  )
}

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
    <div className="dnd-page-bg min-h-screen">
      <DashboardHeader />
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="dnd-heading text-2xl font-bold">Your Campaigns</h1>
            {games.length > 0 && (
              <p className="dnd-subheading mt-1 text-sm">
                {games.length} campaign{games.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          <Link href="/dashboard/new" className="dnd-btn-secondary">
            + New Game
          </Link>
        </div>

        {games.length === 0 ? (
          <div className="dnd-card px-8 py-12 text-center dnd-fade-in">
            <div className="mb-4 text-4xl">&#x2694;&#xFE0F;</div>
            <h2 className="dnd-heading text-lg font-bold mb-2">
              No Campaigns Yet
            </h2>
            <p
              data-testid="empty-state"
              className="mb-6 text-sm"
              style={{ color: 'var(--muted)' }}
            >
              Every legend begins with a single step. Create your first campaign
              and let the AI Dungeon Master bring your world to life.
            </p>
            <Link href="/dashboard/new" className="dnd-btn-primary inline-block" style={{ width: 'auto', padding: '0.75rem 2rem' }}>
              Start Your Adventure
            </Link>
          </div>
        ) : (
          <div className="space-y-3 dnd-fade-in">
            {games.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
