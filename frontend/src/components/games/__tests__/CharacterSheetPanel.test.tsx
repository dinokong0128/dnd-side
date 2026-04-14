/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { CharacterSheetPanel } from '../CharacterSheetPanel'

// Mock Supabase client — CharacterSheetPanel reads directly from Supabase
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}))

import * as supabaseModule from '@/lib/supabase/client'

const mockPlayer = {
  id: 'player-1',
  game_id: 'game-1',
  profile_id: 'user-1',
  character_name: 'Thorin Ironforge',
  character_class: 'Fighter',
  race: 'Dwarf',
  level: 3,
  hp_current: 24,
  hp_max: 28,
  stats: { str: 18, dex: 10, con: 16, int: 8, wis: 12, cha: 9 },
  status: 'active' as const,
  joined_at: '2026-01-01T00:00:00Z',
}

const mockInventory = [
  { id: 'inv-1', player_id: 'player-1', item_name: 'Longsword', quantity: 1 },
  { id: 'inv-2', player_id: 'player-1', item_name: 'Shield', quantity: 1 },
]

function buildMockSupabase(opts: {
  playerData?: any
  inventoryData?: any
  noPlayer?: boolean
}) {
  const subscribeImpl = jest.fn().mockReturnValue({ unsubscribe: jest.fn() })
  const channelImpl = jest.fn().mockReturnValue({
    on: jest.fn().mockReturnThis(),
    subscribe: subscribeImpl,
  })

  const playerSelectChain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: opts.noPlayer ? null : (opts.playerData ?? mockPlayer),
      error: opts.noPlayer ? { message: 'Not found' } : null,
    }),
  }

  const inventorySelectChain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue({
      data: opts.inventoryData ?? mockInventory,
      error: null,
    }),
  }

  const fromImpl = jest.fn((table: string) => {
    if (table === 'players') return playerSelectChain
    if (table === 'player_inventory') return inventorySelectChain
    return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis() }
  })

  const authImpl = {
    getSession: jest.fn().mockResolvedValue({ data: { session: { access_token: 'tok' } } }),
  }

  return { from: fromImpl, channel: channelImpl, realtime: { setAuth: jest.fn() }, auth: authImpl }
}

describe('CharacterSheetPanel', () => {
  const onClose = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders skeleton while loading', () => {
    // Supabase calls never resolve → stays in loading state
    const pendingChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnValue(new Promise(() => {})),
    }
    ;(supabaseModule.createClient as jest.Mock).mockReturnValue({
      from: jest.fn(() => pendingChain),
      channel: jest.fn().mockReturnValue({ on: jest.fn().mockReturnThis(), subscribe: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }) }),
      auth: { getSession: jest.fn().mockResolvedValue({ data: { session: null } }) },
      realtime: { setAuth: jest.fn() },
    })

    render(<CharacterSheetPanel playerId="player-1" onClose={onClose} />)
    expect(screen.getByTestId('character-sheet-skeleton')).toBeInTheDocument()
  })

  it('renders character data once loaded', async () => {
    ;(supabaseModule.createClient as jest.Mock).mockReturnValue(
      buildMockSupabase({})
    )

    render(<CharacterSheetPanel playerId="player-1" onClose={onClose} />)

    await waitFor(() => {
      expect(screen.getByText('Thorin Ironforge')).toBeInTheDocument()
    })
    expect(screen.getByText(/Level 3 Dwarf Fighter/)).toBeInTheDocument()
    expect(screen.getByText(/24/)).toBeInTheDocument() // hp_current
    expect(screen.getByText(/28/)).toBeInTheDocument() // hp_max
  })

  it('shows empty state when no players row', async () => {
    ;(supabaseModule.createClient as jest.Mock).mockReturnValue(
      buildMockSupabase({ noPlayer: true })
    )

    render(<CharacterSheetPanel playerId="player-1" onClose={onClose} />)

    await waitFor(() => {
      expect(screen.getByTestId('character-sheet-empty')).toBeInTheDocument()
    })
  })

  it('calls onClose when × button is clicked', async () => {
    ;(supabaseModule.createClient as jest.Mock).mockReturnValue(
      buildMockSupabase({})
    )

    render(<CharacterSheetPanel playerId="player-1" onClose={onClose} />)

    await waitFor(() => screen.getByText('Thorin Ironforge'))

    fireEvent.click(screen.getByTestId('character-sheet-close'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when Escape key is pressed', async () => {
    ;(supabaseModule.createClient as jest.Mock).mockReturnValue(
      buildMockSupabase({})
    )

    render(<CharacterSheetPanel playerId="player-1" onClose={onClose} />)

    await waitFor(() => screen.getByText('Thorin Ironforge'))

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('HP bar has emerald class when HP > 50%', async () => {
    ;(supabaseModule.createClient as jest.Mock).mockReturnValue(
      buildMockSupabase({ playerData: { ...mockPlayer, hp_current: 24, hp_max: 28 } }) // 85%
    )

    render(<CharacterSheetPanel playerId="player-1" onClose={onClose} />)

    await waitFor(() => screen.getByText('Thorin Ironforge'))

    expect(screen.getByTestId('hp-bar')).toHaveAttribute('data-hp-state', 'high')
  })

  it('HP bar has amber class when HP is 25–50%', async () => {
    ;(supabaseModule.createClient as jest.Mock).mockReturnValue(
      buildMockSupabase({ playerData: { ...mockPlayer, hp_current: 10, hp_max: 28 } }) // 35%
    )

    render(<CharacterSheetPanel playerId="player-1" onClose={onClose} />)

    await waitFor(() => screen.getByText('Thorin Ironforge'))

    expect(screen.getByTestId('hp-bar')).toHaveAttribute('data-hp-state', 'medium')
  })

  it('HP bar has crimson class when HP < 25%', async () => {
    ;(supabaseModule.createClient as jest.Mock).mockReturnValue(
      buildMockSupabase({ playerData: { ...mockPlayer, hp_current: 5, hp_max: 28 } }) // 17%
    )

    render(<CharacterSheetPanel playerId="player-1" onClose={onClose} />)

    await waitFor(() => screen.getByText('Thorin Ironforge'))

    expect(screen.getByTestId('hp-bar')).toHaveAttribute('data-hp-state', 'low')
  })

  it('shows Unconscious label at 0 HP', async () => {
    ;(supabaseModule.createClient as jest.Mock).mockReturnValue(
      buildMockSupabase({ playerData: { ...mockPlayer, hp_current: 0 } })
    )

    render(<CharacterSheetPanel playerId="player-1" onClose={onClose} />)

    await waitFor(() => screen.getByText('Thorin Ironforge'))

    expect(screen.getByTestId('unconscious-label')).toBeInTheDocument()
  })

  it('collapsed: ability scores and inventory not rendered, HP strip is rendered', async () => {
    ;(supabaseModule.createClient as jest.Mock).mockReturnValue(
      buildMockSupabase({})
    )

    render(<CharacterSheetPanel playerId="player-1" onClose={onClose} />)

    await waitFor(() => screen.getByText('Thorin Ironforge'))

    // Collapse the panel
    fireEvent.click(screen.getByTestId('character-sheet-collapse'))

    // Ability scores section hidden, HP strip visible
    expect(screen.queryByTestId('ability-scores-grid')).not.toBeInTheDocument()
    expect(screen.getByTestId('hp-bar')).toBeInTheDocument()
  })

  it('has role=dialog and aria-label', async () => {
    ;(supabaseModule.createClient as jest.Mock).mockReturnValue(
      buildMockSupabase({})
    )

    render(<CharacterSheetPanel playerId="player-1" onClose={onClose} />)

    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Character Sheet')
  })
})
