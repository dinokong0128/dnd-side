import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CharacterCreationForm } from '../CharacterCreationForm'
import { makePlayer } from '@/lib/__test-utils__/fixtures'

const onSuccess = jest.fn()

// The form renders labels without htmlFor, so we query by the
// underlying input name attribute via a CSS selector instead.
function getField<T extends HTMLElement>(name: string): T {
  const el = document.querySelector(`[name="${name}"]`)
  if (!el) throw new Error(`No field named "${name}"`)
  return el as T
}

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = jest.fn() as jest.Mock
})

describe('CharacterCreationForm', () => {
  describe('rendering', () => {
    it('renders all required fields with sensible defaults', () => {
      render(<CharacterCreationForm gameId="game-1" onSuccess={onSuccess} />)

      expect(getField<HTMLInputElement>('characterName')).toBeInTheDocument()
      expect(getField<HTMLSelectElement>('characterClass').value).toBe('Fighter')
      expect(getField<HTMLSelectElement>('race').value).toBe('Human')
      expect(getField<HTMLInputElement>('level').value).toBe('1')
    })

    it('pre-populates fields from defaultValues', () => {
      render(
        <CharacterCreationForm
          gameId="game-1"
          onSuccess={onSuccess}
          defaultValues={{
            characterName: 'Gandalf',
            characterClass: 'Wizard',
            race: 'Human',
            level: 5,
            stats: { str: 8, dex: 10, con: 12, int: 18, wis: 16, cha: 14 },
          }}
        />
      )

      expect(getField<HTMLInputElement>('characterName').value).toBe('Gandalf')
      expect(getField<HTMLSelectElement>('characterClass').value).toBe('Wizard')
      expect(getField<HTMLInputElement>('level').value).toBe('5')
    })
  })

  describe('validation', () => {
    it('shows required error when name is empty on submit', async () => {
      const user = userEvent.setup()
      render(<CharacterCreationForm gameId="game-1" onSuccess={onSuccess} />)

      await user.click(screen.getByRole('button', { name: /Save Character/i }))

      expect(
        await screen.findByText(/Name is required/i)
      ).toBeInTheDocument()
      expect(global.fetch).not.toHaveBeenCalled()
    })
  })

  describe('submission', () => {
    async function fillName(user: ReturnType<typeof userEvent.setup>) {
      await user.type(getField<HTMLInputElement>('characterName'), 'Aragorn')
    }

    it('POSTs to /api/games/:id/players with the correct body shape', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => makePlayer(),
      })
      const user = userEvent.setup()
      render(<CharacterCreationForm gameId="game-abc" onSuccess={onSuccess} />)

      await fillName(user)
      await user.click(screen.getByRole('button', { name: /Save Character/i }))

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1)
      })

      const [url, init] = (global.fetch as jest.Mock).mock.calls[0]
      expect(url).toBe('/api/games/game-abc/players')
      expect(init.method).toBe('POST')
      expect(init.headers).toEqual({ 'Content-Type': 'application/json' })

      const body = JSON.parse(init.body as string)
      expect(body).toEqual({
        character_name: 'Aragorn',
        character_class: 'Fighter',
        race: 'Human',
        level: 1,
        stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      })
    })

    it('calls onSuccess with the returned player on success', async () => {
      const player = makePlayer({ character_name: 'Aragorn' })
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => player,
      })
      const user = userEvent.setup()
      render(<CharacterCreationForm gameId="game-1" onSuccess={onSuccess} />)

      await fillName(user)
      await user.click(screen.getByRole('button', { name: /Save Character/i }))

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith(player)
      })
    })

    it('shows the server error message and does not call onSuccess', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Character name already taken' }),
      })
      const user = userEvent.setup()
      render(<CharacterCreationForm gameId="game-1" onSuccess={onSuccess} />)

      await fillName(user)
      await user.click(screen.getByRole('button', { name: /Save Character/i }))

      await waitFor(() => {
        expect(
          screen.getByText(/Character name already taken/i)
        ).toBeInTheDocument()
      })
      expect(onSuccess).not.toHaveBeenCalled()
    })

    it('falls back to a generic error message when response lacks error field', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: async () => ({}),
      })
      const user = userEvent.setup()
      render(<CharacterCreationForm gameId="game-1" onSuccess={onSuccess} />)

      await fillName(user)
      await user.click(screen.getByRole('button', { name: /Save Character/i }))

      await waitFor(() => {
        expect(screen.getByText(/Failed to save character/i)).toBeInTheDocument()
      })
    })

    it('shows a network error banner when fetch rejects', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValue(new Error('boom'))
      const user = userEvent.setup()
      render(<CharacterCreationForm gameId="game-1" onSuccess={onSuccess} />)

      await fillName(user)
      await user.click(screen.getByRole('button', { name: /Save Character/i }))

      await waitFor(() => {
        expect(
          screen.getByText(/Network error\. Please try again/i)
        ).toBeInTheDocument()
      })
    })

    it('shows "Saving..." while the request is in flight', async () => {
      let resolveFetch: (value: unknown) => void = () => {}
      ;(global.fetch as jest.Mock).mockReturnValue(
        new Promise((resolve) => {
          resolveFetch = resolve
        })
      )
      const user = userEvent.setup()
      render(<CharacterCreationForm gameId="game-1" onSuccess={onSuccess} />)

      await fillName(user)
      await user.click(screen.getByRole('button', { name: /Save Character/i }))

      expect(
        screen.getByRole('button', { name: /Saving/i })
      ).toBeDisabled()

      resolveFetch({
        ok: true,
        json: async () => makePlayer(),
      })
      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled()
      })
    })
  })

  describe('✨ auto-generate character name (DIN-63)', () => {
    it('renders ✨ button next to Character Name input', () => {
      render(<CharacterCreationForm gameId="game-1" onSuccess={onSuccess} />)
      expect(screen.getByTestId('generate-char-name-btn')).toBeInTheDocument()
    })

    it('clicking ✨ calls fetch with character_name, race, and class', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ suggestion: 'Kael Dawnstrider' }),
      })
      const user = userEvent.setup()
      render(<CharacterCreationForm gameId="game-1" onSuccess={onSuccess} />)

      await user.click(screen.getByTestId('generate-char-name-btn'))

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/generate-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'character_name',
            race: 'Human',
            characterClass: 'Fighter',
          }),
        })
      })
    })

    it('populates characterName field via setValue after successful generation', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ suggestion: 'Thorin Ironforge' }),
      })
      const user = userEvent.setup()
      render(<CharacterCreationForm gameId="game-1" onSuccess={onSuccess} />)

      await user.click(screen.getByTestId('generate-char-name-btn'))

      await waitFor(() => {
        expect(getField<HTMLInputElement>('characterName').value).toBe(
          'Thorin Ironforge'
        )
      })
    })

    it('silently fails: field unchanged when fetch returns ok:false', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false })
      const user = userEvent.setup()
      render(<CharacterCreationForm gameId="game-1" onSuccess={onSuccess} />)

      await user.click(screen.getByTestId('generate-char-name-btn'))

      await waitFor(() => {
        expect(getField<HTMLInputElement>('characterName').value).toBe('')
      })
    })

    it('disables ✨ button while request is in flight', async () => {
      let resolveFetch: (value: unknown) => void
      ;(global.fetch as jest.Mock).mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFetch = resolve
        })
      )
      const user = userEvent.setup()
      render(<CharacterCreationForm gameId="game-1" onSuccess={onSuccess} />)

      await user.click(screen.getByTestId('generate-char-name-btn'))

      expect(screen.getByTestId('generate-char-name-btn')).toBeDisabled()

      resolveFetch!({ ok: false })
      await waitFor(() => {
        expect(screen.getByTestId('generate-char-name-btn')).not.toBeDisabled()
      })
    })
  })
})
