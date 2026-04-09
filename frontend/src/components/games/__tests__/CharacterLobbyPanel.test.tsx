import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CharacterLobbyPanel } from '../CharacterLobbyPanel'
import { makePlayer } from '@/lib/__test-utils__/fixtures'

const mockRefresh = jest.fn()
const mockPush = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}))

jest.mock('../CharacterCreationForm', () => ({
  CharacterCreationForm: ({
    gameId,
    onSuccess,
  }: {
    gameId: string
    onSuccess: (player: unknown) => void
  }) => (
    <div data-testid="character-creation-form">
      <span data-testid="form-game-id">{gameId}</span>
      <button
        type="button"
        onClick={() =>
          onSuccess({
            id: 'player-new',
            game_id: gameId,
            profile_id: 'user-1',
            character_name: 'Shiny',
            character_class: 'Fighter',
            race: 'Human',
            level: 1,
            hp_current: 10,
            hp_max: 10,
            stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
            status: 'active',
            joined_at: '2026-01-01T00:00:00Z',
          })
        }
      >
        Trigger Success
      </button>
    </div>
  ),
}))

jest.mock('../CharacterSummaryCard', () => ({
  CharacterSummaryCard: ({
    player,
    onEdit,
  }: {
    player: { character_name: string }
    onEdit: () => void
  }) => (
    <div data-testid="character-summary-card">
      <span>{player.character_name}</span>
      <button type="button" onClick={onEdit}>
        Edit from summary
      </button>
    </div>
  ),
}))

beforeEach(() => {
  jest.clearAllMocks()
})

describe('CharacterLobbyPanel', () => {
  describe('initial render — no existing character', () => {
    it('renders the creation form when the game is in lobby and no player exists', () => {
      render(
        <CharacterLobbyPanel
          gameId="game-1"
          gameStatus="lobby"
          initialPlayer={null}
        />
      )

      expect(
        screen.getByTestId('character-creation-form')
      ).toBeInTheDocument()
      expect(screen.getByTestId('form-game-id')).toHaveTextContent('game-1')
    })

    it('renders the creation form when player has no character_name yet', () => {
      const blankPlayer = makePlayer({ character_name: '' })
      render(
        <CharacterLobbyPanel
          gameId="game-1"
          gameStatus="lobby"
          initialPlayer={blankPlayer}
        />
      )

      expect(
        screen.getByTestId('character-creation-form')
      ).toBeInTheDocument()
    })
  })

  describe('initial render — existing character', () => {
    it('renders the summary card when a named player exists', () => {
      render(
        <CharacterLobbyPanel
          gameId="game-1"
          gameStatus="active"
          initialPlayer={makePlayer({ character_name: 'Aragorn' })}
        />
      )

      expect(
        screen.getByTestId('character-summary-card')
      ).toBeInTheDocument()
      expect(screen.getByText('Aragorn')).toBeInTheDocument()
    })
  })

  describe('non-lobby game states with no character', () => {
    it('shows the lobby-only warning when game is active and initialPlayer is null', () => {
      // initialPlayer=null → isEditing initializes to true → we enter the
      // editing branch. gameStatus !== 'lobby' inside the editing branch
      // shows the "lobby-only" warning.
      render(
        <CharacterLobbyPanel
          gameId="game-1"
          gameStatus="active"
          initialPlayer={null}
        />
      )

      expect(
        screen.getByText(
          /Character creation is only available when the game is in lobby status/i
        )
      ).toBeInTheDocument()
    })

    it('shows the lobby-only warning when editing a blank character in a non-lobby game', () => {
      const blankPlayer = makePlayer({ character_name: '' })
      render(
        <CharacterLobbyPanel
          gameId="game-1"
          gameStatus="paused"
          initialPlayer={blankPlayer}
        />
      )

      expect(
        screen.getByText(
          /Character creation is only available when the game is in lobby status/i
        )
      ).toBeInTheDocument()
    })
  })

  describe('editing flow from summary card', () => {
    it('switches to the creation form when Edit is clicked', async () => {
      const user = userEvent.setup()
      render(
        <CharacterLobbyPanel
          gameId="game-1"
          gameStatus="lobby"
          initialPlayer={makePlayer({ character_name: 'Aragorn' })}
        />
      )

      expect(screen.getByTestId('character-summary-card')).toBeInTheDocument()

      await user.click(
        screen.getByRole('button', { name: /Edit from summary/i })
      )

      expect(
        screen.getByTestId('character-creation-form')
      ).toBeInTheDocument()
    })
  })

  describe('handleSuccess', () => {
    it('shows the summary card and calls router.refresh on success', async () => {
      const user = userEvent.setup()
      render(
        <CharacterLobbyPanel
          gameId="game-1"
          gameStatus="lobby"
          initialPlayer={null}
        />
      )

      await user.click(
        screen.getByRole('button', { name: /Trigger Success/i })
      )

      expect(
        screen.getByTestId('character-summary-card')
      ).toBeInTheDocument()
      expect(mockRefresh).toHaveBeenCalledTimes(1)
    })
  })
})
