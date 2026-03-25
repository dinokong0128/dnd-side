import { fetchInviteByCode } from './invites'

const mockMaybeSingle = jest.fn()
const mockIs = jest.fn(() => ({ maybeSingle: mockMaybeSingle }))
const mockEq = jest.fn(() => ({ is: mockIs }))
const mockSelect = jest.fn(() => ({ eq: mockEq }))
const mockFrom = jest.fn(() => ({ select: mockSelect }))

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      from: mockFrom,
    })
  ),
}))

beforeEach(() => {
  jest.clearAllMocks()
  mockFrom.mockReturnValue({ select: mockSelect })
  mockSelect.mockReturnValue({ eq: mockEq })
  mockEq.mockReturnValue({ is: mockIs })
  mockIs.mockReturnValue({ maybeSingle: mockMaybeSingle })
})

describe('fetchInviteByCode', () => {
  it('returns gameId for a valid unused code', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { game_id: 'game-123' },
      error: null,
    })

    const result = await fetchInviteByCode('valid-code')
    expect(result).toEqual({ gameId: 'game-123' })
    expect(mockFrom).toHaveBeenCalledWith('invites')
    expect(mockEq).toHaveBeenCalledWith('code', 'valid-code')
    expect(mockIs).toHaveBeenCalledWith('used_at', null)
  })

  it('returns null for an unknown code', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })

    const result = await fetchInviteByCode('unknown-code')
    expect(result).toBeNull()
  })

  it('returns null for a used code', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })

    const result = await fetchInviteByCode('used-code')
    expect(result).toBeNull()
  })

  it('throws on unexpected Supabase error', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'Database error' },
    })

    await expect(fetchInviteByCode('any-code')).rejects.toThrow(
      'Failed to fetch invite: Database error'
    )
  })
})
