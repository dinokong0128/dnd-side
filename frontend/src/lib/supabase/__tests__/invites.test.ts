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
    it('returns a valid result with gameId and gameName', async () => {
      mockRpc.mockResolvedValue({
        data: {
          status: 'valid',
          game_id: 'game-abc-123',
          game_name: 'Dragon Quest',
        },
        error: null,
      })

      const result = await fetchInviteByCode('VALID_CODE')

      expect(result).toEqual({
        status: 'valid',
        gameId: 'game-abc-123',
        gameName: 'Dragon Quest',
      })
    })

    it('defaults gameName to empty string when missing', async () => {
      mockRpc.mockResolvedValue({
        data: {
          status: 'valid',
          game_id: 'game-abc-123',
        },
        error: null,
      })

      const result = await fetchInviteByCode('VALID_CODE')

      expect(result).toEqual({
        status: 'valid',
        gameId: 'game-abc-123',
        gameName: '',
      })
    })

    it('calls the validate_invite_code_v2 RPC with the correct argument', async () => {
      mockRpc.mockResolvedValue({
        data: {
          status: 'valid',
          game_id: 'game-abc-123',
          game_name: 'Dragon Quest',
        },
        error: null,
      })

      await fetchInviteByCode('MY_CODE')

      expect(mockRpc).toHaveBeenCalledWith('validate_invite_code_v2', {
        invite_code: 'MY_CODE',
      })
    })
  })

  describe('when the code does not exist', () => {
    it('returns an invalid result', async () => {
      mockRpc.mockResolvedValue({
        data: { status: 'invalid' },
        error: null,
      })

      const result = await fetchInviteByCode('NONEXISTENT')

      expect(result).toEqual({ status: 'invalid' })
    })

    it('returns an invalid result when RPC data is null', async () => {
      mockRpc.mockResolvedValue({ data: null, error: null })

      const result = await fetchInviteByCode('NONEXISTENT')

      expect(result).toEqual({ status: 'invalid' })
    })
  })

  describe('when the code has already been used', () => {
    it('returns a used result', async () => {
      mockRpc.mockResolvedValue({
        data: { status: 'used' },
        error: null,
      })

      const result = await fetchInviteByCode('USED_CODE')

      expect(result).toEqual({ status: 'used' })
    })
  })

  describe('when Supabase returns an error', () => {
    it('throws with a descriptive error message', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'function "validate_invite_code_v2" does not exist' },
      })

      await expect(fetchInviteByCode('any')).rejects.toThrow(
        'Failed to validate invite: function "validate_invite_code_v2" does not exist'
      )
    })

    it('throws even when data is also present alongside the error', async () => {
      mockRpc.mockResolvedValue({
        data: { status: 'valid', game_id: 'x' },
        error: { message: 'partial failure' },
      })

      await expect(fetchInviteByCode('any')).rejects.toThrow(
        'Failed to validate invite: partial failure'
      )
    })
  })

  describe('when the code is an empty string', () => {
    it('still calls the RPC and returns the status it receives', async () => {
      mockRpc.mockResolvedValue({
        data: { status: 'invalid' },
        error: null,
      })

      const result = await fetchInviteByCode('')

      expect(result).toEqual({ status: 'invalid' })
      expect(mockRpc).toHaveBeenCalledWith('validate_invite_code_v2', {
        invite_code: '',
      })
    })
  })
})
