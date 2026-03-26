import { fetchInviteByCode } from '../invites'

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
  describe('when the code is valid and unused', () => {
    it('returns an object with the gameId', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { game_id: 'game-abc-123' },
        error: null,
      })

      const result = await fetchInviteByCode('VALID_CODE')

      expect(result).toEqual({ gameId: 'game-abc-123' })
    })

    it('queries the invites table with correct filters', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { game_id: 'game-abc-123' },
        error: null,
      })

      await fetchInviteByCode('MY_CODE')

      expect(mockFrom).toHaveBeenCalledWith('invites')
      expect(mockSelect).toHaveBeenCalledWith('game_id')
      expect(mockEq).toHaveBeenCalledWith('code', 'MY_CODE')
      expect(mockIs).toHaveBeenCalledWith('used_at', null)
    })
  })

  describe('when the code does not exist', () => {
    it('returns null', async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: null })

      const result = await fetchInviteByCode('NONEXISTENT')

      expect(result).toBeNull()
    })
  })

  describe('when the code has already been used (used_at is set)', () => {
    it('returns null because the is(used_at, null) filter excludes it', async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: null })

      const result = await fetchInviteByCode('USED_CODE')

      expect(result).toBeNull()
      expect(mockIs).toHaveBeenCalledWith('used_at', null)
    })
  })

  describe('when Supabase returns an error', () => {
    it('throws with a descriptive error message', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: null,
        error: { message: 'relation "invites" does not exist' },
      })

      await expect(fetchInviteByCode('any')).rejects.toThrow(
        'Failed to fetch invite: relation "invites" does not exist'
      )
    })

    it('throws even when data is also present alongside the error', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { game_id: 'some-id' },
        error: { message: 'partial failure' },
      })

      await expect(fetchInviteByCode('any')).rejects.toThrow(
        'Failed to fetch invite: partial failure'
      )
    })
  })

  describe('when the code is an empty string', () => {
    it('still queries Supabase and returns null if no match', async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: null })

      const result = await fetchInviteByCode('')

      expect(result).toBeNull()
      expect(mockEq).toHaveBeenCalledWith('code', '')
    })
  })
})
