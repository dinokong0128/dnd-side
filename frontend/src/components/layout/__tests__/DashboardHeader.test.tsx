import { render, screen } from '@testing-library/react'
import { DashboardHeader } from '../DashboardHeader'
import { createClient } from '@/lib/supabase/server'

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/components/layout/ProfileDropdown', () => ({
  ProfileDropdown: ({ initials }: { initials: string }) => (
    <div data-testid="profile-dropdown-mock">{initials}</div>
  ),
}))

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>

function mockSupabase(options: {
  user: { id: string } | null
  profile?: { username: string } | null
}) {
  const maybeSingle = jest.fn().mockResolvedValue({
    data: options.profile ?? null,
    error: null,
  })

  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: options.user } }),
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle,
        }),
      }),
    }),
  } as unknown as Awaited<ReturnType<typeof createClient>>)
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('DashboardHeader', () => {
  it('renders the brand link to /dashboard', async () => {
    mockSupabase({ user: { id: 'user-1' }, profile: { username: 'Aragorn' } })

    const jsx = await DashboardHeader()
    render(jsx)

    const brand = screen.getByRole('link', { name: /Realm/i })
    expect(brand).toHaveAttribute('href', '/dashboard')
  })

  it('passes the username initials to ProfileDropdown', async () => {
    mockSupabase({
      user: { id: 'user-1' },
      profile: { username: 'John Doe' },
    })

    const jsx = await DashboardHeader()
    render(jsx)

    expect(screen.getByTestId('profile-dropdown-mock')).toHaveTextContent('JD')
  })

  it('uses "??" initials when the profile row is missing', async () => {
    mockSupabase({ user: { id: 'user-1' }, profile: null })

    const jsx = await DashboardHeader()
    render(jsx)

    expect(screen.getByTestId('profile-dropdown-mock')).toHaveTextContent('??')
  })

  it('uses "??" initials when the user is not authenticated', async () => {
    mockSupabase({ user: null })

    const jsx = await DashboardHeader()
    render(jsx)

    expect(screen.getByTestId('profile-dropdown-mock')).toHaveTextContent('??')
  })

  it('uses "??" initials when the username is empty', async () => {
    mockSupabase({ user: { id: 'user-1' }, profile: { username: '' } })

    const jsx = await DashboardHeader()
    render(jsx)

    expect(screen.getByTestId('profile-dropdown-mock')).toHaveTextContent('??')
  })
})
