import { getPlayer, getPlayerInventory } from '../players'
import { makePlayer, makeInventoryRow } from '@/lib/__test-utils__/fixtures'

const mockMaybeSingle = jest.fn()
const mockEq2 = jest.fn()
const mockEq1 = jest.fn()
const mockSelect = jest.fn()
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

describe('getPlayer', () => {
  beforeEach(() => {
    mockFrom.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ eq: mockEq1 })
    mockEq1.mockReturnValue({ eq: mockEq2 })
    mockEq2.mockReturnValue({ maybeSingle: mockMaybeSingle })
  })

  it('returns the player when found', async () => {
    const player = makePlayer()
    mockMaybeSingle.mockResolvedValue({ data: player, error: null })

    const result = await getPlayer('game-1', 'user-1')

    expect(result).toEqual(player)
  })

  it('queries with game_id and profile_id filters', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })

    await getPlayer('game-xyz', 'user-abc')

    expect(mockFrom).toHaveBeenCalledWith('players')
    expect(mockSelect).toHaveBeenCalledWith(
      'id, game_id, profile_id, character_name, character_class, race, level, hp_current, hp_max, stats, status, joined_at'
    )
    expect(mockEq1).toHaveBeenCalledWith('game_id', 'game-xyz')
    expect(mockEq2).toHaveBeenCalledWith('profile_id', 'user-abc')
  })

  it('returns null when the player does not exist', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })

    const result = await getPlayer('game-1', 'user-missing')

    expect(result).toBeNull()
  })

  it('throws on Supabase error', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'permission denied' },
    })

    await expect(getPlayer('game-1', 'user-1')).rejects.toThrow(
      'Failed to fetch player: permission denied'
    )
  })
})

describe('getPlayerInventory', () => {
  function mockPlayersLookup(result: { data: unknown; error: unknown }) {
    mockFrom.mockImplementationOnce(() => ({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue(result),
          }),
        }),
      }),
    }))
  }

  function mockInventoryLookup(result: { data: unknown; error: unknown }) {
    mockFrom.mockImplementationOnce(() => ({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue(result),
        }),
      }),
    }))
  }

  it('returns inventory rows when player and items exist', async () => {
    mockPlayersLookup({ data: { id: 'player-1' }, error: null })
    const items = [
      makeInventoryRow({ id: 'inv-1', item_name: 'Longsword' }),
      makeInventoryRow({ id: 'inv-2', item_name: 'Potion' }),
    ]
    mockInventoryLookup({ data: items, error: null })

    const result = await getPlayerInventory('game-1', 'user-1')

    expect(result).toEqual(items)
  })

  it('returns empty array when player is not in the game', async () => {
    mockPlayersLookup({ data: null, error: null })

    const result = await getPlayerInventory('game-1', 'user-missing')

    expect(result).toEqual([])
    // Inventory lookup should be short-circuited — only the players lookup runs
    expect(mockFrom).toHaveBeenCalledTimes(1)
    expect(mockFrom).toHaveBeenCalledWith('players')
  })

  it('returns empty array when inventory data is null', async () => {
    mockPlayersLookup({ data: { id: 'player-1' }, error: null })
    mockInventoryLookup({ data: null, error: null })

    const result = await getPlayerInventory('game-1', 'user-1')

    expect(result).toEqual([])
  })

  it('throws when the players lookup errors', async () => {
    mockPlayersLookup({
      data: null,
      error: { message: 'players table unavailable' },
    })

    await expect(getPlayerInventory('game-1', 'user-1')).rejects.toThrow(
      'Failed to fetch player: players table unavailable'
    )
  })

  it('throws when the inventory lookup errors', async () => {
    mockPlayersLookup({ data: { id: 'player-1' }, error: null })
    mockInventoryLookup({
      data: null,
      error: { message: 'inventory table unavailable' },
    })

    await expect(getPlayerInventory('game-1', 'user-1')).rejects.toThrow(
      'Failed to fetch inventory: inventory table unavailable'
    )
  })

  it('queries inventory by player_id and orders by item_name', async () => {
    mockPlayersLookup({ data: { id: 'player-42' }, error: null })

    const selectSpy = jest.fn()
    const eqSpy = jest.fn()
    const orderSpy = jest.fn().mockResolvedValue({ data: [], error: null })

    mockFrom.mockImplementationOnce(() => ({
      select: selectSpy.mockReturnValue({
        eq: eqSpy.mockReturnValue({
          order: orderSpy,
        }),
      }),
    }))

    await getPlayerInventory('game-1', 'user-1')

    expect(mockFrom).toHaveBeenLastCalledWith('player_inventory')
    expect(selectSpy).toHaveBeenCalledWith(
      'id, player_id, item_name, quantity, properties, created_at'
    )
    expect(eqSpy).toHaveBeenCalledWith('player_id', 'player-42')
    expect(orderSpy).toHaveBeenCalledWith('item_name')
  })
})
