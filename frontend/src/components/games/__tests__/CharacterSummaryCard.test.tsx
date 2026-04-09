import { render, screen, fireEvent } from '@testing-library/react'
import { CharacterSummaryCard } from '../CharacterSummaryCard'
import { makePlayer } from '@/lib/__test-utils__/fixtures'

describe('CharacterSummaryCard', () => {
  const onEdit = jest.fn()

  beforeEach(() => {
    onEdit.mockClear()
  })

  describe('rendering', () => {
    it('shows the character name, level, race, and class', () => {
      render(
        <CharacterSummaryCard
          player={makePlayer({
            character_name: 'Legolas',
            level: 5,
            race: 'Elf',
            character_class: 'Ranger',
          })}
          gameStatus="lobby"
          onEdit={onEdit}
        />
      )

      expect(screen.getByRole('heading', { name: 'Legolas' })).toBeInTheDocument()
      expect(screen.getByText(/Level 5 Elf Ranger/)).toBeInTheDocument()
    })

    it('shows the HP as "current/max"', () => {
      render(
        <CharacterSummaryCard
          player={makePlayer({ hp_current: 18, hp_max: 30 })}
          gameStatus="lobby"
          onEdit={onEdit}
        />
      )

      expect(screen.getByText('18/30')).toBeInTheDocument()
    })

    it('shows all six ability scores', () => {
      render(
        <CharacterSummaryCard
          player={makePlayer({
            stats: { str: 16, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
          })}
          gameStatus="lobby"
          onEdit={onEdit}
        />
      )

      for (const label of ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']) {
        expect(screen.getByText(label)).toBeInTheDocument()
      }
      expect(screen.getByText('16')).toBeInTheDocument()
      expect(screen.getByText('14')).toBeInTheDocument()
      expect(screen.getByText('13')).toBeInTheDocument()
    })

    it('shows the player status and joined date', () => {
      render(
        <CharacterSummaryCard
          player={makePlayer({
            status: 'active',
            joined_at: '2026-03-22T00:00:00Z',
          })}
          gameStatus="lobby"
          onEdit={onEdit}
        />
      )

      expect(screen.getByText(/Status: active/)).toBeInTheDocument()
      expect(screen.getByText(/Joined:/)).toBeInTheDocument()
    })
  })

  describe('stat modifier math', () => {
    it('shows +0 for a score of 10', () => {
      render(
        <CharacterSummaryCard
          player={makePlayer({
            stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
          })}
          gameStatus="lobby"
          onEdit={onEdit}
        />
      )

      // All six stats should display +0
      expect(screen.getAllByText('+0')).toHaveLength(6)
    })

    it('shows positive modifiers for high stats', () => {
      render(
        <CharacterSummaryCard
          player={makePlayer({
            stats: { str: 18, dex: 14, con: 12, int: 10, wis: 11, cha: 8 },
          })}
          gameStatus="lobby"
          onEdit={onEdit}
        />
      )

      expect(screen.getByText('+4')).toBeInTheDocument() // 18 → +4
      expect(screen.getByText('+2')).toBeInTheDocument() // 14 → +2
      expect(screen.getByText('+1')).toBeInTheDocument() // 12 → +1
    })

    it('shows negative modifiers for low stats', () => {
      render(
        <CharacterSummaryCard
          player={makePlayer({
            stats: { str: 8, dex: 7, con: 1, int: 10, wis: 10, cha: 10 },
          })}
          gameStatus="lobby"
          onEdit={onEdit}
        />
      )

      expect(screen.getByText('-1')).toBeInTheDocument() // 8 → -1
      expect(screen.getByText('-2')).toBeInTheDocument() // 7 → -2
      expect(screen.getByText('-5')).toBeInTheDocument() // 1 → -5
    })

    it('rounds odd scores down toward -infinity', () => {
      // score 11 → (11-10)/2 = 0.5, floor → 0 → "+0"
      // score 9 → (9-10)/2 = -0.5, floor → -1 → "-1"
      render(
        <CharacterSummaryCard
          player={makePlayer({
            stats: { str: 11, dex: 9, con: 10, int: 10, wis: 10, cha: 10 },
          })}
          gameStatus="lobby"
          onEdit={onEdit}
        />
      )

      expect(screen.getByText('-1')).toBeInTheDocument()
      // Five "+0" (str 11, con/int/wis/cha 10)
      expect(screen.getAllByText('+0').length).toBe(5)
    })
  })

  describe('Edit button visibility', () => {
    it('shows the Edit button when gameStatus is lobby', () => {
      render(
        <CharacterSummaryCard
          player={makePlayer()}
          gameStatus="lobby"
          onEdit={onEdit}
        />
      )

      expect(
        screen.getByRole('button', { name: /Edit Character/i })
      ).toBeInTheDocument()
    })

    it('hides the Edit button when gameStatus is active', () => {
      render(
        <CharacterSummaryCard
          player={makePlayer()}
          gameStatus="active"
          onEdit={onEdit}
        />
      )

      expect(
        screen.queryByRole('button', { name: /Edit Character/i })
      ).not.toBeInTheDocument()
    })

    it('hides the Edit button when gameStatus is paused', () => {
      render(
        <CharacterSummaryCard
          player={makePlayer()}
          gameStatus="paused"
          onEdit={onEdit}
        />
      )

      expect(
        screen.queryByRole('button', { name: /Edit Character/i })
      ).not.toBeInTheDocument()
    })

    it('hides the Edit button when gameStatus is ended', () => {
      render(
        <CharacterSummaryCard
          player={makePlayer()}
          gameStatus="ended"
          onEdit={onEdit}
        />
      )

      expect(
        screen.queryByRole('button', { name: /Edit Character/i })
      ).not.toBeInTheDocument()
    })

    it('calls onEdit when the Edit button is clicked', () => {
      render(
        <CharacterSummaryCard
          player={makePlayer()}
          gameStatus="lobby"
          onEdit={onEdit}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: /Edit Character/i }))
      expect(onEdit).toHaveBeenCalledTimes(1)
    })
  })
})
