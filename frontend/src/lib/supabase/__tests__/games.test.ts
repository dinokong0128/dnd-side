import { fetchGamesByUserId, createGame, fetchGameById } from '../games'
import type { Game } from '../games'

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

const sampleGame: Game = {
  id: 'game-1',
  name: 'Dragon Quest',
  dm_persona: 'A dark fantasy realm',
  status: 'lobby',
  created_by: 'user-xyz',
  created_at: '2026-03-22T00:00:00Z',
}

const sampleGame2: Game = {
  id: 'game-2',
  name: 'Sword Coast',
  dm_persona: 'High fantasy adventure',
  status: 'active',
  created_by: 'user-xyz',
  created_at: '2026-03-23T00:00:00Z',
}

describe('fetchGamesByUserId', () => {
  beforeEach(() => {
    mockFrom.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({ order: mockOrder })
  })

  it('returns an array of games for the user', async () => {
    mockOrder.mockResolvedValue({ data: [sampleGame, sampleGame2], error: null })

    const result = await fetchGamesByUserId('user-1')

    expect(result).toEqual([sampleGame, sampleGame2])
    expect(result).toHaveLength(2)
  })

  it('queries the games table with created_by filter', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null })

    await fetchGamesByUserId('user-xyz')

    expect(mockFrom).toHaveBeenCalledWith('games')
    expect(mockSelect).toHaveBeenCalledWith(
      'id, name, dm_persona, status, created_by, created_at'
    )
    expect(mockEq).toHaveBeenCalledWith('created_by', 'user-xyz')
    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false })
  })

  it('returns empty array when user has no games', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null })

    const result = await fetchGamesByUserId('user-no-games')

    expect(result).toEqual([])
  })

  it('returns empty array when data is null', async () => {
    mockOrder.mockResolvedValue({ data: null, error: null })

    const result = await fetchGamesByUserId('user-1')

    expect(result).toEqual([])
  })

  it('throws on Supabase error', async () => {
    mockOrder.mockResolvedValue({
      data: null,
      error: { message: 'permission denied for table games' },
    })

    await expect(fetchGamesByUserId('user-1')).rejects.toThrow(
      'Failed to fetch games: permission denied for table games'
    )
  })
})

describe('createGame', () => {
  beforeEach(() => {
    mockFrom.mockReturnValue({ insert: mockInsert })
    mockInsert.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ single: mockSingle })
  })

  it('returns the created game row', async () => {
    mockSingle.mockResolvedValue({ data: sampleGame, error: null })

    const result = await createGame({
      name: 'Dragon Quest',
      dm_persona: 'A dark fantasy realm',
      host_id: 'user-1',
    })

    expect(result).toEqual(sampleGame)
  })

  it('maps host_id to created_by in the insert call', async () => {
    mockSingle.mockResolvedValue({ data: sampleGame, error: null })

    await createGame({
      name: 'My Game',
      dm_persona: 'Some persona',
      host_id: 'user-abc',
    })

    expect(mockInsert).toHaveBeenCalledWith({
      name: 'My Game',
      dm_persona: 'Some persona',
      created_by: 'user-abc',
    })
  })

  it('selects the correct columns after insert', async () => {
    mockSingle.mockResolvedValue({ data: sampleGame, error: null })

    await createGame({
      name: 'X',
      dm_persona: 'Y',
      host_id: 'user-1',
    })

    expect(mockSelect).toHaveBeenCalledWith(
      'id, name, dm_persona, status, created_by, created_at'
    )
  })

  it('throws on Supabase error', async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: 'duplicate key value violates unique constraint' },
    })

    await expect(
      createGame({ name: 'X', dm_persona: 'Y', host_id: 'user-1' })
    ).rejects.toThrow(
      'Failed to create game: duplicate key value violates unique constraint'
    )
  })

  it('preserves special characters in game name and persona', async () => {
    mockSingle.mockResolvedValue({ data: sampleGame, error: null })

    await createGame({
      name: "Hero's Journey: The <Beginning>",
      dm_persona: 'A world where "magic" costs a price & sacrifice',
      host_id: 'user-1',
    })

    expect(mockInsert).toHaveBeenCalledWith({
      name: "Hero's Journey: The <Beginning>",
      dm_persona: 'A world where "magic" costs a price & sacrifice',
      created_by: 'user-1',
    })
  })
})

describe('fetchGameById', () => {
  beforeEach(() => {
    mockFrom.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle })
  })

  it('returns a game when found', async () => {
    mockMaybeSingle.mockResolvedValue({ data: sampleGame, error: null })

    const result = await fetchGameById('game-1')

    expect(result).toEqual(sampleGame)
  })

  it('queries with the correct game ID', async () => {
    mockMaybeSingle.mockResolvedValue({ data: sampleGame, error: null })

    await fetchGameById('game-uuid-123')

    expect(mockFrom).toHaveBeenCalledWith('games')
    expect(mockEq).toHaveBeenCalledWith('id', 'game-uuid-123')
  })

  it('returns null when the game does not exist', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })

    const result = await fetchGameById('nonexistent')

    expect(result).toBeNull()
  })

  it('throws on Supabase error', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'invalid input syntax for type uuid' },
    })

    await expect(fetchGameById('not-a-uuid')).rejects.toThrow(
      'Failed to fetch game: invalid input syntax for type uuid'
    )
  })

  it('selects the correct columns', async () => {
    mockMaybeSingle.mockResolvedValue({ data: sampleGame, error: null })

    await fetchGameById('game-1')

    expect(mockSelect).toHaveBeenCalledWith(
      'id, name, dm_persona, status, created_by, created_at'
    )
  })
})
