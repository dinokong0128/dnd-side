import { test, expect, Page } from '@playwright/test'

// ─── Shared setup ─────────────────────────────────────────────────────────────

const GAME_ID = 'test-game-opt'
const USER_ID = 'user-1'
const PLAYER_ID = 'player-1'

async function setupGameMocks(page: Page) {
  await page.route('**/auth/v1/user', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: USER_ID, email: 'test@example.com' }),
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
        user: { id: USER_ID, email: 'test@example.com' },
      }),
    })
  )

  await page.route('**.supabase.co/rest/v1/games**', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: GAME_ID,
            name: 'Optimistic Test Campaign',
            dm_persona: 'A terse DM',
            status: 'active',
            created_by: USER_ID,
            updated_at: '2026-01-01T00:00:00Z',
            suggested_actions: null,
          },
        ]),
      })
    }
  })

  await page.route('**.supabase.co/rest/v1/players**', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: PLAYER_ID,
            game_id: GAME_ID,
            profile_id: USER_ID,
            character_name: 'Kira Flameheart',
            character_class: 'Ranger',
            race: 'Half-Elf',
            level: 2,
            hp_current: 20,
            hp_max: 22,
          },
        ]),
      })
    }
  })

  // Start with a DM message so isWaitingForDm=false (input enabled)
  const initMsg = {
    id: 'msg-dm-0',
    game_id: GAME_ID,
    profile_id: null,
    role: 'dm',
    content: 'You step into the dungeon.',
    dice_rolls: null,
    created_at: '2026-01-01T00:00:01Z',
  }
  await page.route('**.supabase.co/rest/v1/game_messages**', (route) => {
    if (route.request().method() === 'GET') {
      const url = route.request().url()
      if (url.includes('select=role')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{ id: initMsg.id, role: 'dm', created_at: initMsg.created_at }]),
        })
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([initMsg]),
        })
      }
    }
  })
}

// ─── DIN-64: Optimistic player messages ───────────────────────────────────────
test.describe('DIN-64 — Optimistic player messages', () => {
  test('player message appears immediately after Send before the API responds', async ({ page }) => {
    await setupGameMocks(page)

    // Route that never resolves — keeps the fetch pending indefinitely
    await page.route(`**/api/games/${GAME_ID}/actions`, () => {
      // intentionally never call route.fulfill() so the fetch hangs
    })

    await page.goto(`/games/${GAME_ID}`)
    await expect(page.getByText('Optimistic Test Campaign')).toBeVisible({ timeout: 5000 })

    // Input is enabled
    const textarea = page.getByPlaceholder(/What does your character do/)
    await expect(textarea).toBeEnabled({ timeout: 5000 })

    // Type and submit an action
    const actionText = 'I search the shadows for hidden traps.'
    await textarea.fill(actionText)
    await page.getByRole('button', { name: /Send/i }).click()

    // The optimistic message should appear immediately (before the API responds)
    await expect(page.getByText(actionText)).toBeVisible({ timeout: 3000 })
  })

  test('typing indicator appears alongside the optimistic message', async ({ page }) => {
    await setupGameMocks(page)

    // Route that never resolves
    await page.route(`**/api/games/${GAME_ID}/actions`, () => {})

    await page.goto(`/games/${GAME_ID}`)
    await expect(page.getByText('Optimistic Test Campaign')).toBeVisible({ timeout: 5000 })

    await page.getByPlaceholder(/What does your character do/).fill('I examine the runes.')
    await page.getByRole('button', { name: /Send/i }).click()

    // Both optimistic message and typing indicator should be visible
    await expect(page.getByText('I examine the runes.')).toBeVisible({ timeout: 3000 })
    await expect(page.getByText(/The Dungeon Master is writing/i)).toBeVisible({ timeout: 3000 })
  })

  test('input is disabled while optimistic message is pending (isWaitingForDm=true)', async ({ page }) => {
    await setupGameMocks(page)

    // Route that never resolves
    await page.route(`**/api/games/${GAME_ID}/actions`, () => {})

    await page.goto(`/games/${GAME_ID}`)
    await expect(page.getByText('Optimistic Test Campaign')).toBeVisible({ timeout: 5000 })

    const textarea = page.getByPlaceholder(/What does your character do/)
    await expect(textarea).toBeEnabled({ timeout: 5000 })

    await textarea.fill('I attack the orc.')
    await page.getByRole('button', { name: /Send/i }).click()

    // Optimistic message visible, input now disabled (placeholder changes to "The Dungeon Master is writing…")
    await expect(page.getByText('I attack the orc.')).toBeVisible({ timeout: 3000 })
    await expect(page.locator('textarea')).toBeDisabled()
  })

  test('optimistic message is removed and input re-enabled when API returns error', async ({ page }) => {
    await setupGameMocks(page)

    // Route that returns a server error
    await page.route(`**/api/games/${GAME_ID}/actions`, (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal Server Error' }),
        })
      }
    })

    await page.goto(`/games/${GAME_ID}`)
    await expect(page.getByText('Optimistic Test Campaign')).toBeVisible({ timeout: 5000 })

    const textarea = page.getByPlaceholder(/What does your character do/)
    await expect(textarea).toBeEnabled({ timeout: 5000 })

    const actionText = 'I pick the lock carefully.'
    await textarea.fill(actionText)
    await page.getByRole('button', { name: /Send/i }).click()

    // After the 500 error, the optimistic message should be gone and input re-enabled
    await expect(page.getByText(actionText)).not.toBeVisible({ timeout: 5000 })
    await expect(textarea).toBeEnabled({ timeout: 5000 })
  })

  test('optimistic message is removed and input re-enabled on network failure', async ({ page }) => {
    await setupGameMocks(page)

    // Route that aborts (network failure)
    await page.route(`**/api/games/${GAME_ID}/actions`, (route) => {
      if (route.request().method() === 'POST') {
        route.abort('failed')
      }
    })

    await page.goto(`/games/${GAME_ID}`)
    await expect(page.getByText('Optimistic Test Campaign')).toBeVisible({ timeout: 5000 })

    const textarea = page.getByPlaceholder(/What does your character do/)
    await expect(textarea).toBeEnabled({ timeout: 5000 })

    const actionText = 'I cast a spell at the beast.'
    await textarea.fill(actionText)
    await page.getByRole('button', { name: /Send/i }).click()

    // After network failure, optimistic gone, input re-enabled
    await expect(page.getByText(actionText)).not.toBeVisible({ timeout: 5000 })
    await expect(textarea).toBeEnabled({ timeout: 5000 })
  })

  test('successful submit: real message replaces optimistic via Realtime, no duplicate', async ({ page }) => {
    await setupGameMocks(page)

    // Route returns 202 immediately
    await page.route(`**/api/games/${GAME_ID}/actions`, (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 202,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'queued', message_id: 'msg-new' }),
        })
      }
    })

    await page.goto(`/games/${GAME_ID}`)
    await expect(page.getByText('Optimistic Test Campaign')).toBeVisible({ timeout: 5000 })

    const actionText = 'I scale the wall with my grappling hook.'
    await page.getByPlaceholder(/What does your character do/).fill(actionText)
    await page.getByRole('button', { name: /Send/i }).click()

    // Optimistic message appears
    await expect(page.getByText(actionText)).toBeVisible({ timeout: 3000 })

    // Simulate Realtime INSERT with the real message (matching player+content)
    await page.evaluate(
      ({ gameId, userId, text }) => {
        window.dispatchEvent(
          new CustomEvent('player-message', {
            detail: {
              id: 'real-msg-1',
              game_id: gameId,
              profile_id: userId,
              role: 'player',
              content: text,
              created_at: new Date().toISOString(),
            },
          })
        )
      },
      { gameId: GAME_ID, userId: USER_ID, text: actionText }
    )

    // Message still visible (real replaced optimistic), only one instance in chat
    await expect(page.getByText(actionText)).toBeVisible({ timeout: 3000 })
    const messageInstances = await page.getByText(actionText).count()
    expect(messageInstances).toBe(1)
  })

  test('DM response after optimistic clears typing indicator and re-enables input', async ({ page }) => {
    await setupGameMocks(page)

    await page.route(`**/api/games/${GAME_ID}/actions`, (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 202,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'queued', message_id: 'msg-dm-resp' }),
        })
      }
    })

    await page.goto(`/games/${GAME_ID}`)
    await expect(page.getByText('Optimistic Test Campaign')).toBeVisible({ timeout: 5000 })

    await page.getByPlaceholder(/What does your character do/).fill('I negotiate with the merchant.')
    await page.getByRole('button', { name: /Send/i }).click()

    // Optimistic visible, typing indicator up
    await expect(page.getByText('I negotiate with the merchant.')).toBeVisible({ timeout: 3000 })
    await expect(page.getByText(/The Dungeon Master is writing/i)).toBeVisible({ timeout: 3000 })

    // DM responds via Realtime
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('dm-message', {
          detail: {
            game_id: 'test-game-opt',
            role: 'dm',
            content: 'The merchant eyes you suspiciously before nodding slowly.',
            created_at: new Date().toISOString(),
          },
        })
      )
    })

    await expect(
      page.getByText('The merchant eyes you suspiciously before nodding slowly.')
    ).toBeVisible({ timeout: 3000 })
    await expect(page.getByText(/The Dungeon Master is writing/i)).not.toBeVisible()
    await expect(page.getByPlaceholder(/What does your character do/)).toBeEnabled({ timeout: 3000 })
  })
})
