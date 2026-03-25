import { fetchGamesByUserId, createGame, fetchGameById } from './games'

const mockSingle = jest.fn()
const mockMaybeSingle = jest.fn()
const mockSelect = jest.fn()
const mockInsert = jest.fn()
const mockOrder = jest.fn()
const mockEq = jest.fn()
const mockFrom = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      from: mockFrom,
    })
  ),
}))

beforeEach(() => {
  jest.clearAllMocks()
})

describe('fetchGamesByUserId', () => {
  it('returns array of games for user', async () => {
    const games = [
      {
        id: 'g1',
        name: 'Game 1',
        dm_persona: 'persona',
        status: 'lobby',
        created_at: '2026-01-01',
      },
    ]
    mockFrom.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({ order: mockOrder })
    mockOrder.mockResolvedValue({ data: games, error: null })

    const result = await fetchGamesByUserId('user-1')
    expect(result).toEqual(games)
    expect(mockFrom).toHaveBeenCalledWith('games')
    expect(mockEq).toHaveBeenCalledWith('created_by', 'user-1')
  })

  it('returns empty array when user has no games', async () => {
    mockFrom.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({ order: mockOrder })
    mockOrder.mockResolvedValue({ data: [], error: null })

    const result = await fetchGamesByUserId('user-2')
    expect(result).toEqual([])
  })

  it('throws on Supabase error', async () => {
    mockFrom.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({ order: mockOrder })
    mockOrder.mockResolvedValue({
      data: null,
      error: { message: 'DB error' },
    })

    await expect(fetchGamesByUserId('user-1')).rejects.toThrow(
      'Failed to fetch games: DB error'
    )
  })
})

describe('createGame', () => {
  it('returns the created game', async () => {
    const game = {
      id: 'g-new',
      name: 'New Game',
      dm_persona: 'A persona',
      status: 'lobby',
      created_at: '2026-01-01',
    }
    mockFrom.mockReturnValue({ insert: mockInsert })
    mockInsert.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ single: mockSingle })
    mockSingle.mockResolvedValue({ data: game, error: null })

    const result = await createGame({
      name: 'New Game',
      dm_persona: 'A persona',
      host_id: 'user-1',
    })
    expect(result).toEqual(game)
    expect(mockInsert).toHaveBeenCalledWith({
      name: 'New Game',
      dm_persona: 'A persona',
      created_by: 'user-1',
    })
  })

  it('throws on Supabase error', async () => {
    mockFrom.mockReturnValue({ insert: mockInsert })
    mockInsert.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ single: mockSingle })
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: 'Insert error' },
    })

    await expect(
      createGame({ name: 'X', dm_persona: 'Y', host_id: 'user-1' })
    ).rejects.toThrow('Failed to create game: Insert error')
  })
})

describe('fetchGameById', () => {
  it('returns a game when found', async () => {
    const game = {
      id: 'g1',
      name: 'Game 1',
      dm_persona: 'persona',
      status: 'lobby',
      created_at: '2026-01-01',
    }
    mockFrom.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle })
    mockMaybeSingle.mockResolvedValue({ data: game, error: null })

    const result = await fetchGameById('g1')
    expect(result).toEqual(game)
  })

  it('returns null when not found', async () => {
    mockFrom.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle })
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })

    const result = await fetchGameById('nonexistent')
    expect(result).toBeNull()
  })

  it('throws on Supabase error', async () => {
    mockFrom.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle })
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'Fetch error' },
    })

    await expect(fetchGameById('g1')).rejects.toThrow(
      'Failed to fetch game: Fetch error'
    )
  })
})
