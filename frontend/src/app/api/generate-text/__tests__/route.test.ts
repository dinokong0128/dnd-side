/** @jest-environment node */

import { POST } from '../route'
import { NextRequest } from 'next/server'

const mockGetSession = jest.fn()

jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(() => ({
    auth: { getSession: mockGetSession },
  })),
}))

jest.mock('next/headers', () => ({
  cookies: jest.fn().mockResolvedValue({ getAll: () => [], set: jest.fn() }),
}))

const mockAnthropicCreate = jest.fn()

jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: { create: mockAnthropicCreate },
  }))
})

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(new URL('http://localhost/api/generate-text'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

function mockAuthed() {
  mockGetSession.mockResolvedValueOnce({
    data: { session: { access_token: 'bearer-tok', user: { id: 'u' } } },
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://test.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
  process.env.ANTHROPIC_API_KEY = 'test-key'
})

describe('POST /api/generate-text', () => {
  describe('auth', () => {
    it('returns 401 when not authenticated', async () => {
      mockGetSession.mockResolvedValueOnce({ data: { session: null } })

      const res = await POST(makeRequest({ type: 'game_name' }))

      expect(res.status).toBe(401)
      expect(await res.json()).toEqual({ error: 'Unauthorized' })
    })
  })

  describe('validation', () => {
    it('returns 400 when body is missing type', async () => {
      mockAuthed()

      const res = await POST(makeRequest({ race: 'Elf' }))

      expect(res.status).toBe(400)
    })

    it('returns 400 when type is invalid', async () => {
      mockAuthed()

      const res = await POST(makeRequest({ type: 'invalid_type' }))

      expect(res.status).toBe(400)
    })
  })

  describe('game_name generation', () => {
    it('returns a suggestion for game_name type', async () => {
      mockAuthed()
      mockAnthropicCreate.mockResolvedValueOnce({
        content: [{ text: 'The Dragon\'s Keep' }],
      })

      const res = await POST(makeRequest({ type: 'game_name' }))

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json).toEqual({ suggestion: "The Dragon's Keep" })
    })

    it('calls Anthropic with correct model and max_tokens for game_name', async () => {
      mockAuthed()
      mockAnthropicCreate.mockResolvedValueOnce({
        content: [{ text: 'Echoes of the Void' }],
      })

      await POST(makeRequest({ type: 'game_name' }))

      expect(mockAnthropicCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 30,
        })
      )
    })
  })

  describe('dm_persona generation', () => {
    it('returns a suggestion for dm_persona type', async () => {
      mockAuthed()
      mockAnthropicCreate.mockResolvedValueOnce({
        content: [{ text: 'A gritty world of shadows.' }],
      })

      const res = await POST(makeRequest({ type: 'dm_persona' }))

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json).toEqual({ suggestion: 'A gritty world of shadows.' })
    })

    it('calls Anthropic with max_tokens 150 for dm_persona', async () => {
      mockAuthed()
      mockAnthropicCreate.mockResolvedValueOnce({
        content: [{ text: 'A dark world.' }],
      })

      await POST(makeRequest({ type: 'dm_persona' }))

      expect(mockAnthropicCreate).toHaveBeenCalledWith(
        expect.objectContaining({ max_tokens: 150 })
      )
    })
  })

  describe('character_name generation', () => {
    it('returns a suggestion for character_name with race and class', async () => {
      mockAuthed()
      mockAnthropicCreate.mockResolvedValueOnce({
        content: [{ text: 'Kael Dawnstrider' }],
      })

      const res = await POST(
        makeRequest({ type: 'character_name', race: 'Elf', characterClass: 'Wizard' })
      )

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json).toEqual({ suggestion: 'Kael Dawnstrider' })
    })

    it('includes race and class in prompt for character_name', async () => {
      mockAuthed()
      mockAnthropicCreate.mockResolvedValueOnce({
        content: [{ text: 'Elara' }],
      })

      await POST(
        makeRequest({ type: 'character_name', race: 'Elf', characterClass: 'Ranger' })
      )

      expect(mockAnthropicCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          max_tokens: 20,
          system: expect.stringContaining('Elf'),
        })
      )
    })

    it('uses default Human Fighter when race/class are not provided', async () => {
      mockAuthed()
      mockAnthropicCreate.mockResolvedValueOnce({
        content: [{ text: 'Aldric' }],
      })

      await POST(makeRequest({ type: 'character_name' }))

      expect(mockAnthropicCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining('Human'),
        })
      )
    })
  })

  describe('error handling', () => {
    it('returns 500 when Anthropic call throws', async () => {
      mockAuthed()
      mockAnthropicCreate.mockRejectedValueOnce(new Error('API failure'))

      const res = await POST(makeRequest({ type: 'game_name' }))

      expect(res.status).toBe(500)
      expect(await res.json()).toEqual({ error: 'Internal server error' })
    })
  })
})
