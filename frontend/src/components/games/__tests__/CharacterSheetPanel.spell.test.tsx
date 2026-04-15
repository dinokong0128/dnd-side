/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * DIN-27: Spell slot pip display tests for CharacterSheetPanel.
 */
import { render, screen, waitFor } from '@testing-library/react'
import { CharacterSheetPanel } from '../CharacterSheetPanel'

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}))

import * as supabaseModule from '@/lib/supabase/client'

const mockWizard = {
  id: 'player-1',
  game_id: 'game-1',
  profile_id: 'user-1',
  character_name: 'Elara',
  character_class: 'Wizard',
  race: 'Elf',
  level: 3,
  hp_current: 10,
  hp_max: 14,
  stats: {
    str: 8,
    dex: 14,
    con: 12,
    int: 18,
    wis: 12,
    cha: 10,
    spell_slots: {
      '1': { max: 4, used: 1 },
      '2': { max: 2, used: 0 },
      '3': { max: 0, used: 0 },
    },
    cantrips: ['Fire Bolt', 'Mage Hand'],
  },
  status: 'active' as const,
  joined_at: '2026-01-01T00:00:00Z',
}

const mockFighter = {
  id: 'player-2',
  game_id: 'game-1',
  profile_id: 'user-2',
  character_name: 'Thorin',
  character_class: 'Fighter',
  race: 'Dwarf',
  level: 1,
  hp_current: 12,
  hp_max: 12,
  stats: {
    str: 18,
    dex: 10,
    con: 16,
    int: 8,
    wis: 12,
    cha: 9,
    spell_slots: null,
  },
  status: 'active' as const,
  joined_at: '2026-01-01T00:00:00Z',
}

function buildMock(player: any) {
  const playerChain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: player, error: null }),
  }
  const inventoryChain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue({ data: [], error: null }),
  }
  const fromImpl = jest.fn((table: string) => {
    if (table === 'players') return playerChain
    if (table === 'player_inventory') return inventoryChain
    return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis() }
  })
  return {
    from: fromImpl,
    channel: jest.fn().mockReturnValue({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
    }),
    realtime: { setAuth: jest.fn() },
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: { access_token: 'tok' } } }),
    },
  }
}

describe('DIN-27: CharacterSheetPanel spell slot display', () => {
  const onClose = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders Spell Slots section for spellcasting class', async () => {
    ;(supabaseModule.createClient as jest.Mock).mockReturnValue(buildMock(mockWizard))
    render(<CharacterSheetPanel playerId="player-1" onClose={onClose} />)

    await waitFor(() => {
      expect(screen.getByText(/Spell Slots/i)).toBeInTheDocument()
    })
  })

  it('does NOT render Spell Slots section for non-spellcasting class', async () => {
    ;(supabaseModule.createClient as jest.Mock).mockReturnValue(buildMock(mockFighter))
    render(<CharacterSheetPanel playerId="player-2" onClose={onClose} />)

    await waitFor(() => {
      expect(screen.getByText('Thorin')).toBeInTheDocument()
    })
    expect(screen.queryByText(/Spell Slots/i)).not.toBeInTheDocument()
  })

  it('shows filled pips for used slots and empty pips for available', async () => {
    ;(supabaseModule.createClient as jest.Mock).mockReturnValue(buildMock(mockWizard))
    render(<CharacterSheetPanel playerId="player-1" onClose={onClose} />)

    await waitFor(() => {
      // 1st level: 1 used (●) + 3 available (○) = 4 total
      const level1Row = screen.getByTestId('spell-slot-row-1')
      const filledPips = level1Row.querySelectorAll('[data-testid="pip-used"]')
      const emptyPips = level1Row.querySelectorAll('[data-testid="pip-available"]')
      expect(filledPips).toHaveLength(1)
      expect(emptyPips).toHaveLength(3)
    })
  })

  it('shows count label for each slot level', async () => {
    ;(supabaseModule.createClient as jest.Mock).mockReturnValue(buildMock(mockWizard))
    render(<CharacterSheetPanel playerId="player-1" onClose={onClose} />)

    await waitFor(() => {
      // "1st level: 3 / 4 remaining" (4 max, 1 used → 3 remaining)
      expect(screen.getByTestId('spell-slot-label-1')).toHaveTextContent('3 / 4')
    })
  })

  it('hides slot levels with max=0', async () => {
    ;(supabaseModule.createClient as jest.Mock).mockReturnValue(buildMock(mockWizard))
    render(<CharacterSheetPanel playerId="player-1" onClose={onClose} />)

    await waitFor(() => {
      // Level 3 has max=0, should not appear
      expect(screen.queryByTestId('spell-slot-row-3')).not.toBeInTheDocument()
    })
  })

  it('renders cantrips when present', async () => {
    ;(supabaseModule.createClient as jest.Mock).mockReturnValue(buildMock(mockWizard))
    render(<CharacterSheetPanel playerId="player-1" onClose={onClose} />)

    await waitFor(() => {
      expect(screen.getByText(/Fire Bolt/)).toBeInTheDocument()
      expect(screen.getByText(/Mage Hand/)).toBeInTheDocument()
    })
  })
})
