import { test, expect } from '@playwright/test'

test.describe('Session Lifecycle — Start, Pause, Resume, End', () => {
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
          user: { id: 'user-1', email: 'host@example.com' },
        }),
      })
    })
  })

  test('host starts a session and sees opening narration', async ({ page }) => {
    const gameId = 'test-game-start-123'
    const userId = 'user-1'

    // Mock game in lobby status
    await page.route('**/supabase.co/rest/v1/games**', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: gameId,
              name: 'The Beginning',
              dm_persona: 'A mysterious DM',
              status: 'lobby',
              created_at: '2026-01-01T00:00:00Z',
              created_by: userId,
              updated_at: '2026-01-01T00:00:00Z',
            },
          ]),
        })
      }
    })

    // Mock player with character
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
              character_name: 'Aragorn',
              character_class: 'Ranger',
              race: 'Human',
              level: 5,
              hp_current: 40,
              hp_max: 40,
            },
          ]),
        })
      }
    })

    // Mock start game endpoint
    let startCalled = false
    await page.route(`**/api/games/${gameId}/start`, (route) => {
      if (route.request().method() === 'POST') {
        startCalled = true
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'active' }),
        })
      }
    })

    await page.goto(`/games/${gameId}`)
    await expect(page.getByText('The Beginning')).toBeVisible()

    // Assert: "Begin the Adventure" button is visible
    const startButton = page.getByRole('button', { name: /Begin the Adventure/i })
    await expect(startButton).toBeVisible()

    // Click button
    await startButton.click()

    // Assert: button shows loading state
    await expect(startButton).toBeDisabled()

    // Verify API was called
    await page.waitForTimeout(500)
    expect(startCalled).toBe(true)

    // Simulate opening narration arriving
    await page.evaluate(() => {
      const event = new CustomEvent('opening-narration', {
        detail: {
          game_id: 'test-game-start-123',
          role: 'dm',
          content: 'The adventure begins in a small tavern...',
          created_at: new Date().toISOString(),
        },
      })
      window.dispatchEvent(event)
    })

    // Assert: typing indicator visible
    await expect(page.getByText(/Dungeon Master is writing/i)).toBeVisible({
      timeout: 5000,
    })

    // Simulate DM message arrives
    await page.evaluate(() => {
      const event = new CustomEvent('dm-message', {
        detail: {
          game_id: 'test-game-start-123',
          role: 'dm',
          content: 'The adventure begins in a small tavern...',
          created_at: new Date().toISOString(),
        },
      })
      window.dispatchEvent(event)
    })

    // Assert: page transitions to session view (chat log visible)
    await expect(page.getByText(/adventure begins/i)).toBeVisible({
      timeout: 5000,
    })
  })

  test('host pauses an active session', async ({ page }) => {
    const gameId = 'test-game-pause-123'
    const userId = 'user-1'

    // Mock game in active status
    await page.route('**/supabase.co/rest/v1/games**', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: gameId,
              name: 'Active Campaign',
              dm_persona: 'A wise DM',
              status: 'active',
              created_at: '2026-01-01T00:00:00Z',
              created_by: userId,
              updated_at: '2026-01-01T00:00:00Z',
            },
          ]),
        })
      }
    })

    // Mock player and messages
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
              character_name: 'Legolas',
              character_class: 'Ranger',
              race: 'Elf',
              level: 5,
              hp_current: 35,
              hp_max: 35,
            },
          ]),
        })
      }
    })

    // Mock pause endpoint
    let pauseCalled = false
    await page.route(`**/api/games/${gameId}/pause`, (route) => {
      if (route.request().method() === 'POST') {
        pauseCalled = true
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'paused' }),
        })
      }
    })

    await page.goto(`/games/${gameId}`)
    await expect(page.getByText('Active Campaign')).toBeVisible()

    // Assert: Pause button visible in header
    const pauseButton = page.getByRole('button', { name: /Pause/i })
    await expect(pauseButton).toBeVisible()

    // Click Pause
    await pauseButton.click()

    // Assert: confirmation modal appears
    await expect(page.getByText(/Pause the Adventure/i)).toBeVisible({
      timeout: 5000,
    })

    // Click "Pause Session" in modal
    const confirmPauseButton = page.locator('button').filter({ hasText: /Pause Session/i })
    if (await confirmPauseButton.isVisible()) {
      await confirmPauseButton.click()
    }

    // Wait for API call
    await page.waitForTimeout(500)
    expect(pauseCalled).toBe(true)

    // Simulate paused state
    await page.evaluate(() => {
      const event = new CustomEvent('session-paused', {
        detail: {
          game_id: 'test-game-pause-123',
          status: 'paused',
        },
      })
      window.dispatchEvent(event)
    })

    // Assert: "Session paused" banner appears
    await expect(page.getByText(/Session paused|paused/i)).toBeVisible({
      timeout: 5000,
    })

    // Assert: input is disabled
    const textarea = page.getByPlaceholder(/What does your character do/)
    await expect(textarea).toBeDisabled({ timeout: 5000 })
  })

  test('host ends a session permanently', async ({ page }) => {
    const gameId = 'test-game-end-123'
    const userId = 'user-1'

    // Mock game in active status
    await page.route('**/supabase.co/rest/v1/games**', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: gameId,
              name: 'Campaign to End',
              dm_persona: 'A closing DM',
              status: 'active',
              created_at: '2026-01-01T00:00:00Z',
              created_by: userId,
              updated_at: '2026-01-01T00:00:00Z',
            },
          ]),
        })
      }
    })

    // Mock player
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
              character_name: 'Gimli',
              character_class: 'Dwarf',
              race: 'Dwarf',
              level: 5,
              hp_current: 50,
              hp_max: 50,
            },
          ]),
        })
      }
    })

    // Mock end endpoint
    let endCalled = false
    await page.route(`**/api/games/${gameId}/end`, (route) => {
      if (route.request().method() === 'POST') {
        endCalled = true
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'ended' }),
        })
      }
    })

    await page.goto(`/games/${gameId}`)
    await expect(page.getByText('Campaign to End')).toBeVisible()

    // Click End
    const endButton = page.getByRole('button', { name: /End/i })
    await endButton.click()

    // Assert: destructive modal with "End This Adventure Forever?"
    await expect(page.getByText(/End This Adventure Forever/i)).toBeVisible({
      timeout: 5000,
    })

    // Click "End Session Forever"
    const confirmEndButton = page.locator('button').filter({ hasText: /End Session Forever/i })
    if (await confirmEndButton.isVisible()) {
      await confirmEndButton.click()
    }

    // Wait for API call
    await page.waitForTimeout(500)
    expect(endCalled).toBe(true)

    // Simulate ended state
    await page.evaluate(() => {
      const event = new CustomEvent('session-ended', {
        detail: {
          game_id: 'test-game-end-123',
          status: 'ended',
        },
      })
      window.dispatchEvent(event)
    })

    // Assert: "This adventure has concluded" banner
    await expect(page.getByText(/concluded|ended/i)).toBeVisible({
      timeout: 5000,
    })

    // Assert: input disabled permanently
    const textarea = page.getByPlaceholder(/What does your character do/)
    await expect(textarea).toBeDisabled({ timeout: 5000 })

    // Assert: no Resume button shown
    const resumeButton = page.getByRole('button', { name: /Resume/i })
    await expect(resumeButton).not.toBeVisible()
  })

  test('host resumes a paused session', async ({ page }) => {
    const gameId = 'test-game-resume-123'
    const userId = 'user-1'

    // Mock game in paused status
    await page.route('**/supabase.co/rest/v1/games**', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: gameId,
              name: 'Paused Campaign',
              dm_persona: 'A continuing DM',
              status: 'paused',
              created_at: '2026-01-01T00:00:00Z',
              created_by: userId,
              updated_at: '2026-01-01T00:00:00Z',
            },
          ]),
        })
      }
    })

    // Mock player
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
              character_name: 'Boromir',
              character_class: 'Fighter',
              race: 'Human',
              level: 5,
              hp_current: 45,
              hp_max: 45,
            },
          ]),
        })
      }
    })

    // Mock resume endpoint
    let resumeCalled = false
    await page.route(`**/api/games/${gameId}/resume`, (route) => {
      if (route.request().method() === 'POST') {
        resumeCalled = true
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'active' }),
        })
      }
    })

    await page.goto(`/games/${gameId}`)
    await expect(page.getByText('Paused Campaign')).toBeVisible()

    // Assert: "Session paused" banner with Resume button
    const resumeButton = page.getByRole('button', { name: /Resume/i })
    await expect(resumeButton).toBeVisible()

    // Click "Resume Session"
    await resumeButton.click()

    // Wait for API call
    await page.waitForTimeout(500)
    expect(resumeCalled).toBe(true)

    // Assert: typing indicator appears
    await expect(page.getByText(/Dungeon Master is writing/i)).toBeVisible({
      timeout: 5000,
    })

    // Simulate resume narration arrives
    await page.evaluate(() => {
      const event = new CustomEvent('dm-message', {
        detail: {
          game_id: 'test-game-resume-123',
          role: 'dm',
          content: 'The world resumes around you...',
          created_at: new Date().toISOString(),
        },
      })
      window.dispatchEvent(event)
    })

    // Assert: banner disappears and input re-enables
    await expect(
      page.getByText(/Session paused|paused/i)
    ).not.toBeVisible({ timeout: 5000 })

    const textarea = page.getByPlaceholder(/What does your character do/)
    await expect(textarea).toBeEnabled({ timeout: 5000 })
  })

  test('non-host cannot see Pause/End/Resume buttons', async ({ page }) => {
    const gameId = 'test-game-non-host-123'
    const hostUserId = 'user-1'
    const playerUserId = 'user-2'

    // Override auth for non-host user
    await page.route('**/auth/v1/user', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: playerUserId,
          email: 'player@example.com',
        }),
      })
    })

    // Mock game created by different user
    await page.route('**/supabase.co/rest/v1/games**', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: gameId,
              name: 'Host Game',
              dm_persona: 'Host DM',
              status: 'active',
              created_at: '2026-01-01T00:00:00Z',
              created_by: hostUserId,
              updated_at: '2026-01-01T00:00:00Z',
            },
          ]),
        })
      }
    })

    // Mock player as non-host
    await page.route('**/supabase.co/rest/v1/players**', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'player-2',
              game_id: gameId,
              profile_id: playerUserId,
              character_name: 'Guest Hero',
              character_class: 'Mage',
              race: 'Elf',
              level: 3,
              hp_current: 20,
              hp_max: 20,
            },
          ]),
        })
      }
    })

    await page.goto(`/games/${gameId}`)
    await expect(page.getByText('Host Game')).toBeVisible()

    // Assert: no Pause/End buttons in header
    const pauseButton = page.getByRole('button', { name: /Pause/i })
    const endButton = page.getByRole('button', { name: /End/i })

    if (await pauseButton.isVisible()) {
      expect(false).toBe(true) // Fail if button is visible
    }
    if (await endButton.isVisible()) {
      expect(false).toBe(true) // Fail if button is visible
    }
  })

  test('confirmation modal closes on Cancel', async ({ page }) => {
    const gameId = 'test-game-cancel-123'
    const userId = 'user-1'

    // Mock active game
    await page.route('**/supabase.co/rest/v1/games**', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: gameId,
              name: 'Cancel Test Game',
              dm_persona: 'Test DM',
              status: 'active',
              created_at: '2026-01-01T00:00:00Z',
              created_by: userId,
              updated_at: '2026-01-01T00:00:00Z',
            },
          ]),
        })
      }
    })

    // Mock player
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
              character_class: 'Warrior',
              race: 'Human',
              level: 1,
              hp_current: 10,
              hp_max: 10,
            },
          ]),
        })
      }
    })

    await page.goto(`/games/${gameId}`)
    await expect(page.getByText('Cancel Test Game')).toBeVisible()

    // Click Pause → modal opens
    const pauseButton = page.getByRole('button', { name: /Pause/i })
    await pauseButton.click()

    // Assert modal appears
    await expect(page.getByText(/Pause the Adventure/i)).toBeVisible({ timeout: 5000 })

    // Click Cancel
    const cancelButton = page.locator('button').filter({ hasText: /Cancel/i })
    if (await cancelButton.isVisible()) {
      await cancelButton.click()
    }

    // Assert: modal closes, game still active
    await expect(page.getByText(/Pause the Adventure/i)).not.toBeVisible({ timeout: 5000 })
  })

  test('confirmation modal closes on Escape key', async ({ page }) => {
    const gameId = 'test-game-escape-123'
    const userId = 'user-1'

    // Mock active game
    await page.route('**/supabase.co/rest/v1/games**', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: gameId,
              name: 'Escape Test Game',
              dm_persona: 'Test DM',
              status: 'active',
              created_at: '2026-01-01T00:00:00Z',
              created_by: userId,
              updated_at: '2026-01-01T00:00:00Z',
            },
          ]),
        })
      }
    })

    // Mock player
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

    await page.goto(`/games/${gameId}`)
    await expect(page.getByText('Escape Test Game')).toBeVisible()

    // Click End → modal opens
    const endButton = page.getByRole('button', { name: /End/i })
    await endButton.click()

    // Assert modal appears
    await expect(page.getByText(/End This Adventure Forever/i)).toBeVisible({
      timeout: 5000,
    })

    // Press Escape
    await page.keyboard.press('Escape')

    // Assert: modal closes
    await expect(page.getByText(/End This Adventure Forever/i)).not.toBeVisible({
      timeout: 5000,
    })
  })
})
