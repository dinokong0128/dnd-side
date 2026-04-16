import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LevelUpModal } from '../LevelUpModal'
import type { PlayerRow } from '@/lib/types/player'

jest.mock('@/components/dice/DiceRoller', () => ({
  DiceRoller: ({ dieType }: { dieType: string }) => (
    <div data-testid="mock-dice-roller">{dieType}</div>
  ),
}))

const mockWizardPlayer: PlayerRow = {
  id: 'player-1',
  game_id: 'game-1',
  profile_id: 'user-1',
  character_name: 'Elara',
  character_class: 'Wizard',
  race: 'Elf',
  level: 1,
  hp_current: 7,
  hp_max: 7,
  stats: {
    str: 8,
    dex: 14,
    con: 12,
    int: 18,
    wis: 12,
    cha: 10,
    spell_slots: { '1': { max: 2, used: 0 } },
    xp: 300,
  },
  status: 'active',
  joined_at: '2026-01-01T00:00:00Z',
}

const mockFighterPlayer: PlayerRow = {
  id: 'player-2',
  game_id: 'game-1',
  profile_id: 'user-2',
  character_name: 'Thorin',
  character_class: 'Fighter',
  race: 'Dwarf',
  level: 1,
  hp_current: 12,
  hp_max: 12,
  stats: { str: 18, dex: 10, con: 16, int: 8, wis: 12, cha: 9 },
  status: 'active',
  joined_at: '2026-01-01T00:00:00Z',
}

describe('LevelUpModal (DIN-28)', () => {
  const onClose = jest.fn()
  const onConfirmed = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn()
  })

  it('renders correct level heading', () => {
    render(
      <LevelUpModal
        gameId="game-1"
        payload={{ character_id: 'player-1', new_level: 2 }}
        player={mockWizardPlayer}
        onClose={onClose}
        onConfirmed={onConfirmed}
      />
    )
    expect(screen.getByText(/You've reached Level 2/i)).toBeInTheDocument()
  })

  it('Confirm button is disabled until HP choice is selected', () => {
    render(
      <LevelUpModal
        gameId="game-1"
        payload={{ character_id: 'player-1', new_level: 2 }}
        player={mockWizardPlayer}
        onClose={onClose}
        onConfirmed={onConfirmed}
      />
    )
    const confirmBtn = screen.getByRole('button', { name: /confirm level up/i })
    expect(confirmBtn).toBeDisabled()

    fireEvent.click(screen.getByTestId('hp-choice-roll'))
    expect(confirmBtn).not.toBeDisabled()
  })

  it('shows spell slot diff for Wizard, not for Fighter', () => {
    const { rerender } = render(
      <LevelUpModal
        gameId="game-1"
        payload={{ character_id: 'player-1', new_level: 2 }}
        player={mockWizardPlayer}
        onClose={onClose}
        onConfirmed={onConfirmed}
      />
    )
    expect(screen.getByTestId('spell-slot-diff')).toBeInTheDocument()

    rerender(
      <LevelUpModal
        gameId="game-1"
        payload={{ character_id: 'player-2', new_level: 2 }}
        player={mockFighterPlayer}
        onClose={onClose}
        onConfirmed={onConfirmed}
      />
    )
    expect(screen.queryByTestId('spell-slot-diff')).not.toBeInTheDocument()
  })

  it('POSTs on confirm, shows loading state, calls onConfirmed on success', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ level: 2, hp_max: 15, hp_gained: 8 }),
    })

    render(
      <LevelUpModal
        gameId="game-1"
        payload={{ character_id: 'player-1', new_level: 2 }}
        player={mockWizardPlayer}
        onClose={onClose}
        onConfirmed={onConfirmed}
      />
    )

    fireEvent.click(screen.getByTestId('hp-choice-roll'))
    fireEvent.click(screen.getByRole('button', { name: /confirm level up/i }))

    expect(screen.getByRole('button', { name: /levelling up/i })).toBeDisabled()

    await waitFor(() => expect(onConfirmed).toHaveBeenCalledTimes(1))

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/games/game-1/level-up',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"hp_choice":"roll"'),
      })
    )
  })

  it('shows error message on API failure', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ detail: 'Something went wrong' }),
    })

    render(
      <LevelUpModal
        gameId="game-1"
        payload={{ character_id: 'player-1', new_level: 2 }}
        player={mockWizardPlayer}
        onClose={onClose}
        onConfirmed={onConfirmed}
      />
    )

    fireEvent.click(screen.getByTestId('hp-choice-roll'))
    fireEvent.click(screen.getByRole('button', { name: /confirm level up/i }))

    await waitFor(() =>
      expect(screen.getByTestId('level-up-error')).toBeInTheDocument()
    )
    expect(onConfirmed).not.toHaveBeenCalled()
  })
})
