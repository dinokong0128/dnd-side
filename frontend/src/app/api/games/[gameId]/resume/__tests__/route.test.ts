/** @jest-environment node */

import { POST } from '../route'
import { setupLifecycleSuite } from '../../__test-utils__/lifecycle-harness'

const mockGetSession = jest.fn()

jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(() => ({
    auth: { getSession: mockGetSession },
  })),
}))

jest.mock('next/headers', () => ({
  cookies: jest
    .fn()
    .mockResolvedValue({ getAll: () => [], set: jest.fn() }),
}))

setupLifecycleSuite('resume', POST, { getSession: mockGetSession })
