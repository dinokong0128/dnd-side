import { fetchInviteByCode } from '../invites'

const mockRpc = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      rpc: mockRpc,
    })
  ),
}))

beforeEach(() => {
  jest.clearAllMocks()
})

describe('fetchInviteByCode', () => {
  describe('when the code is valid and unused', () => {
    it('returns an object with the gameId', async () => {
      mockRpc.mockResolvedValue({
        data: 'game-abc-123',
        error: null,
      })

      const result = await fetchInviteByCode('VALID_CODE')

      expect(result).toEqual({ gameId: 'game-abc-123' })
    })

    it('calls the validate_invite_code RPC with the correct argument', async () => {
      mockRpc.mockResolvedValue({
        data: 'game-abc-123',
        error: null,
      })

      await fetchInviteByCode('MY_CODE')

      expect(mockRpc).toHaveBeenCalledWith('validate_invite_code', {
        invite_code: 'MY_CODE',
      })
    })
  })

  describe('when the code does not exist', () => {
    it('returns null', async () => {
      mockRpc.mockResolvedValue({ data: null, error: null })

      const result = await fetchInviteByCode('NONEXISTENT')

      expect(result).toBeNull()
    })
  })

  describe('when the code has already been used', () => {
    it('returns null because the RPC filters by used_at is null', async () => {
      mockRpc.mockResolvedValue({ data: null, error: null })

      const result = await fetchInviteByCode('USED_CODE')

      expect(result).toBeNull()
    })
  })

  describe('when Supabase returns an error', () => {
    it('throws with a descriptive error message', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'function "validate_invite_code" does not exist' },
      })

      await expect(fetchInviteByCode('any')).rejects.toThrow(
        'Failed to fetch invite: function "validate_invite_code" does not exist'
      )
    })

    it('throws even when data is also present alongside the error', async () => {
      mockRpc.mockResolvedValue({
        data: 'some-id',
        error: { message: 'partial failure' },
      })

      await expect(fetchInviteByCode('any')).rejects.toThrow(
        'Failed to fetch invite: partial failure'
      )
    })
  })

  describe('when the code is an empty string', () => {
    it('still calls the RPC and returns null if no match', async () => {
      mockRpc.mockResolvedValue({ data: null, error: null })

      const result = await fetchInviteByCode('')

      expect(result).toBeNull()
      expect(mockRpc).toHaveBeenCalledWith('validate_invite_code', {
        invite_code: '',
      })
    })
  })
})
