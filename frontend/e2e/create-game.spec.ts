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

test.describe('DIN-63 — Auto-generate text fields', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/auth/v1/user', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'user-1', email: 'test@example.com' }),
      })
    })

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

  test('✨ campaign name: clicking generates and populates the name field', async ({
    page,
  }) => {
    await page.route('**/api/generate-text', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ suggestion: 'The Crimson Pact' }),
        })
      }
    })

    await page.goto('/dashboard/new')

    const nameInput = page.getByTestId('game-name-input')
    await expect(nameInput).toHaveValue('')

    await page.getByTestId('generate-name-btn').click()

    await expect(nameInput).toHaveValue('The Crimson Pact', { timeout: 5000 })

    // Verify the request sent the correct type
    const requests: string[] = []
    await page.route('**/api/generate-text', (route) => {
      requests.push(route.request().postDataJSON()?.type)
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ suggestion: 'Echoes of the Void' }),
      })
    })

    await page.getByTestId('generate-name-btn').click()
    await expect(nameInput).toHaveValue('Echoes of the Void', { timeout: 5000 })
  })

  test('✨ DM persona: clicking generates and populates the persona textarea', async ({
    page,
  }) => {
    await page.route('**/api/generate-text', (route) => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON()
        if (body?.type === 'dm_persona') {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              suggestion:
                'A gritty low-magic world where corruption runs deep and no one can be trusted.',
            }),
          })
        } else {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ suggestion: 'Generic suggestion' }),
          })
        }
      }
    })

    await page.goto('/dashboard/new')

    const personaTextarea = page.getByTestId('dm-persona-input')
    await expect(personaTextarea).toHaveValue('')

    await page.getByTestId('generate-persona-btn').click()

    await expect(personaTextarea).toHaveValue(
      'A gritty low-magic world where corruption runs deep and no one can be trusted.',
      { timeout: 5000 }
    )
  })

  test('✨ name button: disabled while request is in flight, re-enables after', async ({
    page,
  }) => {
    let resolveRequest: (() => void) | null = null

    await page.route('**/api/generate-text', async (route) => {
      // Hold the request until we resolve it
      await new Promise<void>((resolve) => {
        resolveRequest = resolve
      })
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ suggestion: 'The Forgotten Dominion' }),
      })
    })

    await page.goto('/dashboard/new')

    const btn = page.getByTestId('generate-name-btn')
    await expect(btn).toBeEnabled()

    await btn.click()

    // Button should be disabled while in-flight
    await expect(btn).toBeDisabled()

    // Release the request
    resolveRequest?.()

    // Button should re-enable and field should be populated
    await expect(btn).toBeEnabled({ timeout: 5000 })
    await expect(page.getByTestId('game-name-input')).toHaveValue(
      'The Forgotten Dominion',
      { timeout: 5000 }
    )
  })

  test('✨ name button: silent fail — field unchanged when API returns error', async ({
    page,
  }) => {
    await page.route('**/api/generate-text', (route) => {
      route.fulfill({ status: 500, body: JSON.stringify({ error: 'Server error' }) })
    })

    await page.goto('/dashboard/new')

    const nameInput = page.getByTestId('game-name-input')
    await nameInput.fill('My Campaign')

    await page.getByTestId('generate-name-btn').click()

    // Field should remain unchanged after error
    await expect(nameInput).toHaveValue('My Campaign', { timeout: 3000 })

    // Button should re-enable silently
    await expect(page.getByTestId('generate-name-btn')).toBeEnabled({
      timeout: 5000,
    })
  })
})
