import { test, expect } from '@playwright/test'

test.describe('Create a new game', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authenticated user for all requests
    await page.route('**/auth/v1/user', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'user-1',
          email: 'test@example.com',
        }),
      })
    })

    // Mock auth session/token refresh
    await page.route('**/auth/v1/token?grant_type=refresh_token', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-token',
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: 'mock-refresh',
          user: { id: 'user-1', email: 'test@example.com' },
        }),
      })
    })
  })

  test('happy path: fill game name, submit, redirect to game', async ({
    page,
  }) => {
    await page.route('**/api/games', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'new-game-id',
            name: 'My Campaign',
            dm_persona: 'A classic high-fantasy D&D adventure.',
            status: 'lobby',
            created_at: '2026-01-01T00:00:00Z',
          }),
        })
      }
    })

    await page.goto('/dashboard/new')

    await page.getByTestId('game-name-input').fill('My Campaign')
    await page.getByTestId('submit-button').click()

    await page.waitForURL('**/games/new-game-id**')
  })

  test('validation: empty name shows error', async ({ page }) => {
    await page.goto('/dashboard/new')

    await page.getByTestId('submit-button').click()

    await expect(page.getByText(/Game name is required/)).toBeVisible()
  })

  test('default persona: submitting without dm_persona uses default', async ({
    page,
  }) => {
    let requestBody: Record<string, unknown> | null = null

    await page.route('**/api/games', (route) => {
      if (route.request().method() === 'POST') {
        requestBody = route.request().postDataJSON()
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'new-game-id',
            name: 'Test Game',
            dm_persona: 'A classic high-fantasy D&D adventure.',
            status: 'lobby',
            created_at: '2026-01-01T00:00:00Z',
          }),
        })
      }
    })

    await page.goto('/dashboard/new')

    await page.getByTestId('game-name-input').fill('Test Game')
    await page.getByTestId('submit-button').click()

    await page.waitForURL('**/games/new-game-id**')

    expect(requestBody).toEqual({
      name: 'Test Game',
      dm_persona: 'A classic high-fantasy D&D adventure.',
    })
  })
})
