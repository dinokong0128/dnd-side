import { test, expect } from '@playwright/test'

const MOCK_GAME = {
  id: 'game-123',
  name: 'Dragon Quest',
  dm_persona: 'A classic high-fantasy D&D adventure.',
  status: 'lobby',
  created_by: 'user-1',
  created_at: '2026-04-05T00:00:00Z',
}

test.describe('Invite generation (host flow)', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authenticated user
    await page.route('**/auth/v1/user', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'user-1',
          email: 'host@example.com',
        }),
      })
    })

    // Mock auth token refresh
    await page.route('**/auth/v1/token?grant_type=refresh_token', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-token',
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: 'mock-refresh',
          user: { id: 'user-1', email: 'host@example.com' },
        }),
      })
    })

    // Mock Supabase REST API: game fetch
    await page.route('**/rest/v1/games*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_GAME),
      })
    })

    // Mock Supabase REST API: player fetch (no existing character)
    await page.route('**/rest/v1/players*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(null),
      })
    })
  })

  test('happy path: generate invite link and copy it', async ({ page }) => {
    // Mock the invite generation API route
    await page.route('**/api/games/game-123/invites', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 'abc123def456ghi7',
            invite_url:
              'http://localhost:3000/auth/signup?code=abc123def456ghi7',
          }),
        })
      }
    })

    await page.goto('/games/game-123')

    // InviteSection is shown for host in lobby
    await expect(page.getByTestId('generate-invite-button')).toBeVisible()

    // Click generate
    await page.getByTestId('generate-invite-button').click()

    // URL input should appear with the invite URL
    await expect(page.getByTestId('invite-url-input')).toBeVisible()
    await expect(page.getByTestId('invite-url-input')).toHaveValue(
      'http://localhost:3000/auth/signup?code=abc123def456ghi7'
    )

    // Copy button should be visible
    await expect(page.getByTestId('copy-button')).toBeVisible()

    // Click copy (clipboard API may not work in headless, but button should respond)
    await page.getByTestId('copy-button').click()
    await expect(page.getByTestId('copy-button')).toHaveText('Copied!')
  })

  test('generate another link: resets UI to initial state', async ({
    page,
  }) => {
    await page.route('**/api/games/game-123/invites', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 'abc123def456ghi7',
            invite_url:
              'http://localhost:3000/auth/signup?code=abc123def456ghi7',
          }),
        })
      }
    })

    await page.goto('/games/game-123')
    await page.getByTestId('generate-invite-button').click()
    await expect(page.getByTestId('invite-url-input')).toBeVisible()

    // Click "Generate another link"
    await page.getByTestId('generate-another-link').click()

    // Should show the generate button again
    await expect(page.getByTestId('generate-invite-button')).toBeVisible()
    await expect(page.getByTestId('invite-url-input')).not.toBeVisible()
    await expect(page.getByTestId('generate-another-link')).not.toBeVisible()
  })

  test('error state: shows error message on failure', async ({ page }) => {
    await page.route('**/api/games/game-123/invites', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Only the game creator can generate invites',
          }),
        })
      }
    })

    await page.goto('/games/game-123')
    await page.getByTestId('generate-invite-button').click()

    await expect(page.getByTestId('invite-error')).toBeVisible()
    await expect(page.getByTestId('invite-error')).toContainText(
      'Only the game creator can generate invites'
    )
  })
})
