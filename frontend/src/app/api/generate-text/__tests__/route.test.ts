/** @jest-environment node */

import { POST } from '../route'
import { NextRequest } from 'next/server'

const mockGetSession = jest.fn()
const mockCreate = jest.fn()

jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(() => ({
    auth: { getSession: mockGetSession },
  })),
}))

jest.mock('next/headers', () => ({
  cookies: jest.fn().mockResolvedValue({ getAll: () => [], set: jest.fn() }),
}))

jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: { create: mockCreate },
    })),
  }
})

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(new URL('http://localhost/api/generate-text'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

function mockAuthed() {
  mockGetSession.mockResolvedValueOnce({
    data: { session: { access_token: 'tok', user: { id: 'u1' } } },
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
    it('returns 401 when no session', async () => {
      mockGetSession.mockResolvedValueOnce({ data: { session: null } })
      const res = await POST(makeRequest({ type: 'game_name' }))
      expect(res.status).toBe(401)
    })
  })

  describe('validation', () => {
    it('returns 400 when type is missing', async () => {
      mockAuthed()
      const res = await POST(makeRequest({}))
      expect(res.status).toBe(400)
    })

    it('returns 400 when type is invalid', async () => {
      mockAuthed()
      const res = await POST(makeRequest({ type: 'invalid_type' }))
      expect(res.status).toBe(400)
    })
  })

  describe('game_name generation', () => {
    it('returns 200 with suggestion for game_name', async () => {
      mockAuthed()
      mockCreate.mockResolvedValueOnce({
        content: [{ text: 'The Dragon\u2019s Keep' }],
      })
      const res = await POST(makeRequest({ type: 'game_name' }))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.suggestion).toBe('The Dragon\u2019s Keep')
    })
  })

  describe('dm_persona generation', () => {
    it('returns 200 with suggestion for dm_persona', async () => {
      mockAuthed()
      mockCreate.mockResolvedValueOnce({
        content: [{ text: 'A gritty pirate campaign.' }],
      })
      const res = await POST(makeRequest({ type: 'dm_persona' }))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.suggestion).toBe('A gritty pirate campaign.')
    })
  })

  describe('character_name generation', () => {
    it('returns 200 with suggestion for character_name with race and class', async () => {
      mockAuthed()
      mockCreate.mockResolvedValueOnce({
        content: [{ text: 'Aelindra Starweave' }],
      })
      const res = await POST(
        makeRequest({ type: 'character_name', race: 'Elf', characterClass: 'Wizard' })
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.suggestion).toBe('Aelindra Starweave')
    })

    it('returns 200 even when race and characterClass are omitted', async () => {
      mockAuthed()
      mockCreate.mockResolvedValueOnce({
        content: [{ text: 'Aldric Stonehaven' }],
      })
      const res = await POST(makeRequest({ type: 'character_name' }))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.suggestion).toBeDefined()
    })
  })

  describe('error handling', () => {
    it('returns 500 when Anthropic SDK throws', async () => {
      mockAuthed()
      mockCreate.mockRejectedValueOnce(new Error('API overload'))
      const res = await POST(makeRequest({ type: 'game_name' }))
      expect(res.status).toBe(500)
    })
  })
})
