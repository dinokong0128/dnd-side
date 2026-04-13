import { test, expect } from '@playwright/test'

test.describe('Core Game Loop — Submit Action + Receive DM Response', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authenticated user
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

    // Mock auth session
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

  test('happy path: submit action, see typing indicator, receive DM response', async ({
    page,
  }) => {
    const gameId = 'test-game-123'
    const userId = 'user-1'

    // Mock Supabase server-side fetch for game data (fetchGameById)
    await page.route('**/supabase.co/rest/v1/games**', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: gameId,
              name: 'The Shadowveil Campaign',
              dm_persona: 'A wise and dramatic Dungeon Master',
              status: 'active',
              created_at: '2026-01-01T00:00:00Z',
              created_by: userId,
              updated_at: '2026-01-01T00:00:00Z',
              suggested_actions: null,
            },
          ]),
        })
      }
    })

    // Mock Supabase server-side fetch for players
    await page.route('**/supabase.co/rest/v1/players**', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'player-1',
              game_id: gameId,
              profile_id: userId,
              character_name: 'Theron the Brave',
              character_class: 'Paladin',
              race: 'Human',
              level: 3,
              hp_current: 25,
              hp_max: 28,
              created_at: '2026-01-01T00:00:00Z',
            },
          ]),
        })
      }
    })

    // Mock POST /api/games/:id/actions - submit action
    let actionSubmitted = false
    await page.route(`**/api/games/${gameId}/actions`, (route) => {
      if (route.request().method() === 'POST') {
        actionSubmitted = true
        route.fulfill({
          status: 202,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'queued',
            message_id: 'msg-123',
          }),
        })
      }
    })

    // Navigate to game
    await page.goto(`/games/${gameId}`)

    // Wait for game to load
    await expect(page.getByText('The Shadowveil Campaign')).toBeVisible({
      timeout: 5000,
    })

    // Check that input is initially enabled (game is active, not waiting for DM)
    const textarea = page.getByPlaceholder(/What does your character do/)
    await expect(textarea).toBeEnabled()

    // Type an action
    await textarea.fill('I approach the merchant and ask about the mysterious amulet.')

    // Click Send (or press Enter)
    const sendButton = page.getByRole('button', { name: /Send/i })
    await expect(sendButton).toBeEnabled()
    await sendButton.click()

    // Verify the action was submitted
    expect(actionSubmitted).toBe(true)

    // After submit, input should be disabled (waiting for DM)
    await expect(textarea).toBeDisabled()

    // Typing indicator should appear
    await expect(
      page.getByText(/The Dungeon Master is writing/i)
    ).toBeVisible()

    // Simulate Realtime: player message arrives
    await page.evaluate(() => {
      const event = new CustomEvent('player-message', {
        detail: {
          game_id: 'test-game-123',
          profile_id: 'user-1',
          role: 'player',
          content:
            'I approach the merchant and ask about the mysterious amulet.',
          created_at: new Date().toISOString(),
        },
      })
      window.dispatchEvent(event)
    })

    // Player message should appear in chat
    await expect(
      page.getByText(/I approach the merchant and ask about the mysterious amulet/)
    ).toBeVisible({ timeout: 5000 })

    // Simulate Realtime: DM response arrives
    await page.evaluate(() => {
      const event = new CustomEvent('dm-message', {
        detail: {
          game_id: 'test-game-123',
          role: 'dm',
          content:
            "The merchant's eyes gleam with ancient knowledge. 'This amulet,' he says, holding it to the light, 'has been in my family for generations. Many seek its power, but few understand its true purpose.' He pauses meaningfully, waiting for your response.",
          created_at: new Date().toISOString(),
        },
      })
      window.dispatchEvent(event)
    })

    // DM response should appear in chat
    await expect(
      page.getByText(
        /The merchant's eyes gleam with ancient knowledge/
      )
    ).toBeVisible({ timeout: 5000 })

    // Input should be re-enabled
    await expect(textarea).toBeEnabled({ timeout: 5000 })

    // Typing indicator should disappear
    await expect(
      page.getByText(/The Dungeon Master is writing/i)
    ).not.toBeVisible({ timeout: 5000 })
  })

  test('validation: empty action is rejected', async ({ page }) => {
    const gameId = 'test-game-123'
    const userId = 'user-1'

    // Mock Supabase server-side fetch for game data
    await page.route('**/supabase.co/rest/v1/games**', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: gameId,
              name: 'Test Campaign',
              dm_persona: 'A test DM',
              status: 'active',
              created_by: userId,
              updated_at: '2026-01-01T00:00:00Z',
              suggested_actions: null,
            },
          ]),
        })
      }
    })

    // Mock Supabase server-side fetch for players
    await page.route('**/supabase.co/rest/v1/players**', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'player-1',
              game_id: gameId,
              profile_id: userId,
              character_name: 'Test Char',
              character_class: 'Wizard',
              race: 'Elf',
              level: 1,
              hp_current: 10,
              hp_max: 10,
            },
          ]),
        })
      }
    })

    await page.goto(`/games/${gameId}`)
    await expect(page.getByText('Test Campaign')).toBeVisible()

    const textarea = page.getByPlaceholder(/What does your character do/)
    const sendButton = page.getByRole('button', { name: /Send/i })

    // Send button should be disabled when textarea is empty
    await expect(sendButton).toBeDisabled()

    // Type whitespace only
    await textarea.fill('   ')

    // Send button should still be disabled
    await expect(sendButton).toBeDisabled()

    // Type valid text
    await textarea.fill('I cast fireball!')

    // Send button should now be enabled
    await expect(sendButton).toBeEnabled()
  })

  test('error handling: DM task failure shows error message and re-enables input', async ({
    page,
  }) => {
    const gameId = 'test-game-123'
    const userId = 'user-1'

    // Mock Supabase server-side fetch for game data
    await page.route('**/supabase.co/rest/v1/games**', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: gameId,
              name: 'Error Test Campaign',
              dm_persona: 'Test DM',
              status: 'active',
              created_by: userId,
              updated_at: '2026-01-01T00:00:00Z',
              suggested_actions: null,
            },
          ]),
        })
      }
    })

    // Mock Supabase server-side fetch for players
    await page.route('**/supabase.co/rest/v1/players**', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'player-1',
              game_id: gameId,
              profile_id: userId,
              character_name: 'Test Char',
              character_class: 'Rogue',
              race: 'Halfling',
              level: 1,
              hp_current: 8,
              hp_max: 8,
            },
          ]),
        })
      }
    })

    await page.route(`**/api/games/${gameId}/actions`, (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 202,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'queued' }),
        })
      }
    })

    await page.goto(`/games/${gameId}`)
    await expect(page.getByText('Error Test Campaign')).toBeVisible()

    const textarea = page.getByPlaceholder(/What does your character do/)
    const sendButton = page.getByRole('button', { name: /Send/i })

    // Submit action
    await textarea.fill('I try to pick the lock.')
    await sendButton.click()

    // Input should be disabled
    await expect(textarea).toBeDisabled()

    // Simulate system error message from backend
    await page.evaluate(() => {
      const event = new CustomEvent('system-message', {
        detail: {
          game_id: 'test-game-123',
          role: 'system',
          content: 'The Dungeon Master encountered an error. Please try your action again.',
          created_at: new Date().toISOString(),
        },
      })
      window.dispatchEvent(event)
    })

    // Error message should appear in chat
    await expect(
      page.getByText(/The Dungeon Master encountered an error/)
    ).toBeVisible({ timeout: 5000 })

    // Input should be re-enabled after error
    await expect(textarea).toBeEnabled({ timeout: 5000 })
  })

  test('input is disabled when user has no character', async ({ page }) => {
    const gameId = 'test-game-123'
    const userId = 'user-2' // Different user, no character

    // Mock Supabase server-side fetch for game data
    await page.route('**/supabase.co/rest/v1/games**', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: gameId,
              name: 'Campaign',
              dm_persona: 'DM',
              status: 'active',
              created_by: 'user-1',
              updated_at: '2026-01-01T00:00:00Z',
              suggested_actions: null,
            },
          ]),
        })
      }
    })

    // Mock Supabase server-side fetch for players - no players for user-2
    await page.route('**/supabase.co/rest/v1/players**', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'player-1',
              game_id: gameId,
              profile_id: 'user-1', // Different user
              character_name: 'Another Player',
              character_class: 'Barbarian',
              race: 'Orc',
              level: 2,
              hp_current: 30,
              hp_max: 30,
            },
          ]),
        })
      }
    })

    // Override the auth mock for this test
    await page.route('**/auth/v1/user', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: userId,
          email: 'other@example.com',
        }),
      })
    })

    await page.goto(`/games/${gameId}`)
    await expect(page.getByText('Campaign')).toBeVisible()

    const textarea = page.getByPlaceholder(/What does your character do/)
    const sendButton = page.getByRole('button', { name: /Send/i })

    // Input should be disabled
    await expect(textarea).toBeDisabled()
    await expect(sendButton).toBeDisabled()
  })
})

test.describe('DIN-42 — DM action suggestions (✨ cycling)', () => {
  const gameId = 'test-game-suggestions'
  const userId = 'user-1'

  const SUGGESTIONS = [
    'Pick the lock using your thieves\' tools.',
    'Search the walls nearby for a hidden mechanism.',
    'Press your ear to the door and listen carefully.',
  ]

  test.beforeEach(async ({ page }) => {
    await page.route('**/auth/v1/user', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: userId, email: 'test@example.com' }),
      })
    )

    await page.route('**/auth/v1/token?grant_type=refresh_token', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-token',
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: 'mock-refresh',
          user: { id: userId, email: 'test@example.com' },
        }),
      })
    )

    await page.route('**/supabase.co/rest/v1/players**', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'player-1',
              game_id: gameId,
              profile_id: userId,
              character_name: 'Kael Dawnstrider',
              character_class: 'Ranger',
              race: 'Half-Elf',
              level: 5,
              hp_current: 42,
              hp_max: 46,
            },
          ]),
        })
      }
    })
  })

  test('✨ button is disabled when game has no suggested_actions', async ({
    page,
  }) => {
    await page.route('**/supabase.co/rest/v1/games**', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: gameId,
              name: 'No Suggestions Game',
              dm_persona: 'A DM',
              status: 'active',
              created_by: userId,
              updated_at: '2026-01-01T00:00:00Z',
              suggested_actions: null,
            },
          ]),
        })
      }
    })

    await page.goto(`/games/${gameId}`)
    await expect(page.getByText('No Suggestions Game')).toBeVisible({
      timeout: 5000,
    })

    const cycleBtn = page.getByTestId('cycle-suggestion-btn')
    await expect(cycleBtn).toBeDisabled()
  })

  test('✨ button is enabled and cycles through suggestions when game has suggested_actions', async ({
    page,
  }) => {
    await page.route('**/supabase.co/rest/v1/games**', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: gameId,
              name: 'Suggestions Game',
              dm_persona: 'A DM',
              status: 'active',
              created_by: userId,
              updated_at: '2026-01-01T00:00:00Z',
              suggested_actions: SUGGESTIONS,
            },
          ]),
        })
      }
    })

    await page.goto(`/games/${gameId}`)
    await expect(page.getByText('Suggestions Game')).toBeVisible({
      timeout: 5000,
    })

    const cycleBtn = page.getByTestId('cycle-suggestion-btn')
    await expect(cycleBtn).toBeEnabled({ timeout: 3000 })

    const textarea = page.getByPlaceholder(/What does your character do/)

    // First click: populates textarea with first suggestion
    await cycleBtn.click()
    await expect(textarea).toHaveValue(SUGGESTIONS[0])

    // Second click: cycles to second suggestion
    await cycleBtn.click()
    await expect(textarea).toHaveValue(SUGGESTIONS[1])

    // Third click: cycles to third suggestion
    await cycleBtn.click()
    await expect(textarea).toHaveValue(SUGGESTIONS[2])

    // Fourth click: wraps back to first
    await cycleBtn.click()
    await expect(textarea).toHaveValue(SUGGESTIONS[0])
  })

  test('suggestion counter label appears when suggestions are available', async ({
    page,
  }) => {
    await page.route('**/supabase.co/rest/v1/games**', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: gameId,
              name: 'Counter Label Game',
              dm_persona: 'A DM',
              status: 'active',
              created_by: userId,
              updated_at: '2026-01-01T00:00:00Z',
              suggested_actions: SUGGESTIONS,
            },
          ]),
        })
      }
    })

    await page.goto(`/games/${gameId}`)
    await expect(page.getByText('Counter Label Game')).toBeVisible({
      timeout: 5000,
    })

    // Counter label should show total count before first click
    await expect(
      page.getByText(new RegExp(`${SUGGESTIONS.length}.*click.*to cycle`, 'i'))
    ).toBeVisible({ timeout: 3000 })

    // After clicking, counter updates
    await page.getByTestId('cycle-suggestion-btn').click()
    await expect(
      page.getByText(/Suggestion 1 of/i)
    ).toBeVisible({ timeout: 3000 })
  })
})
