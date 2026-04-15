import { test, expect, Page } from '@playwright/test'

interface DiceRollEvent {
  type: 'dice_roll'
  die: 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100'
  count: number
  result: number
  modifier: number
  total: number
  label: string
  dc?: number
  success?: boolean
  advantage?: boolean
  all_rolls?: number[]
}

// ─── Shared mock data ─────────────────────────────────────────────────────────

const GAME_ID = 'test-game-dice'
const USER_ID = 'user-1'
const PLAYER_ID = 'player-1'

const MOCK_PLAYER = {
  id: PLAYER_ID,
  game_id: GAME_ID,
  profile_id: USER_ID,
  character_name: 'Arya Swiftblade',
  character_class: 'Rogue',
  race: 'Elf',
  level: 5,
  hp_current: 32,
  hp_max: 38,
}

const STEALTH_ROLL: DiceRollEvent = {
  type: 'dice_roll',
  die: 'd20',
  count: 1,
  result: 14,
  modifier: 3,
  total: 17,
  label: 'Stealth Check',
  dc: 15,
  success: true,
}

const DAMAGE_ROLL: DiceRollEvent = {
  type: 'dice_roll',
  die: 'd6',
  count: 1,
  result: 5,
  modifier: 4,
  total: 9,
  label: 'Sneak Attack',
}

const DM_NARRATION = 'You melt into the shadows with practiced ease, vanishing from the guard\'s sight.'

// ─── Setup helper ─────────────────────────────────────────────────────────────
//
// Registers auth, games, players, and game_messages mocks.
// game_messages: returns either the latestMessage (select=role) or the full list.
// Accepts an optional initialDmMessage with dice_rolls for the initial load tests.
//
async function setupGameMocks(
  page: Page,
  options: {
    initialDmMessage?: {
      content: string
      dice_rolls?: DiceRollEvent[] | null
    }
  } = {}
) {
  // Auth
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

  // Game
  await page.route('**.supabase.co/rest/v1/games**', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: GAME_ID,
            name: 'The Shadow Heist',
            dm_persona: 'A dramatic, tension-building DM',
            status: 'active',
            created_by: USER_ID,
            updated_at: '2026-01-01T00:00:00Z',
            suggested_actions: null,
          },
        ]),
      })
    }
  })

  // Players
  await page.route('**.supabase.co/rest/v1/players**', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([MOCK_PLAYER]),
      })
    }
  })

  // game_messages — differentiate latestMessage (select=role) from paginated fetch
  const dmMsg = options.initialDmMessage ?? { content: 'The adventure begins.', dice_rolls: null }
  const initialMessage = {
    id: 'msg-dm-1',
    game_id: GAME_ID,
    profile_id: null,
    role: 'dm',
    content: dmMsg.content,
    dice_rolls: dmMsg.dice_rolls ?? null,
    created_at: '2026-01-01T00:00:01Z',
  }

  await page.route('**.supabase.co/rest/v1/game_messages**', (route) => {
    if (route.request().method() === 'GET') {
      const url = route.request().url()
      if (url.includes('select=role')) {
        // latestMessagePromise — limit=1 → role='dm' means isWaitingForDm=false
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{ id: initialMessage.id, role: 'dm', created_at: initialMessage.created_at }]),
        })
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([initialMessage]),
        })
      }
    }
  })
}

// ─── DIN-24: Dice Roller in DM Messages ───────────────────────────────────────
test.describe('DIN-24 — Dice Roller in DM chat messages', () => {
  test('DM message with dice_rolls renders die type badge and label (reduced motion)', async ({ page }) => {
    // Dice settle immediately with prefers-reduced-motion — avoids 1500ms wait
    await page.emulateMedia({ reducedMotion: 'reduce' })

    await setupGameMocks(page, {
      initialDmMessage: { content: DM_NARRATION, dice_rolls: [STEALTH_ROLL] },
    })

    await page.goto(`/games/${GAME_ID}`)
    await expect(page.getByText('The Shadow Heist')).toBeVisible({ timeout: 5000 })

    // Die type badge for d20
    await expect(page.getByTestId('die-type-badge')).toBeVisible({ timeout: 3000 })
    await expect(page.getByTestId('die-type-badge')).toHaveText('d20')

    // Label is shown above the die
    await expect(page.getByText('Stealth Check')).toBeVisible()
  })

  test('dice total with modifier shows correct breakdown (reduced motion)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })

    await setupGameMocks(page, {
      initialDmMessage: { content: DM_NARRATION, dice_rolls: [STEALTH_ROLL] },
    })

    await page.goto(`/games/${GAME_ID}`)
    await expect(page.getByText('The Shadow Heist')).toBeVisible({ timeout: 5000 })

    // With reduced motion dice settle immediately → dice-total is shown
    // result=14, modifier=+3, total=17  → "14 + 3 = 17"
    const total = page.getByTestId('dice-total')
    await expect(total).toBeVisible({ timeout: 3000 })
    await expect(total).toContainText('14')
    await expect(total).toContainText('3')
    await expect(total).toContainText('17')
  })

  test('dice with no modifier shows just the result total (reduced motion)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })

    const noModRoll: DiceRollEvent = {
      type: 'dice_roll',
      die: 'd8',
      count: 1,
      result: 7,
      modifier: 0,
      total: 7,
      label: 'Hit Points',
    }

    await setupGameMocks(page, {
      initialDmMessage: { content: 'You recover some stamina.', dice_rolls: [noModRoll] },
    })

    await page.goto(`/games/${GAME_ID}`)
    await expect(page.getByText('The Shadow Heist')).toBeVisible({ timeout: 5000 })

    const total = page.getByTestId('dice-total')
    await expect(total).toBeVisible({ timeout: 3000 })
    await expect(total).toHaveText('7')
  })

  test('narration text is visible immediately with reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })

    await setupGameMocks(page, {
      initialDmMessage: { content: DM_NARRATION, dice_rolls: [STEALTH_ROLL] },
    })

    await page.goto(`/games/${GAME_ID}`)
    await expect(page.getByText('The Shadow Heist')).toBeVisible({ timeout: 5000 })

    // With reduced motion, dice complete instantly so narration is visible
    await expect(page.getByText(DM_NARRATION)).toBeVisible({ timeout: 3000 })
  })

  test('narration text is hidden while dice animate, then appears after settling', async ({ page }) => {
    // Normal motion: narration starts hidden; becomes visible after ~1.5s animation
    await setupGameMocks(page, {
      initialDmMessage: { content: DM_NARRATION, dice_rolls: [STEALTH_ROLL] },
    })

    await page.goto(`/games/${GAME_ID}`)
    await expect(page.getByText('The Shadow Heist')).toBeVisible({ timeout: 5000 })

    // Right after page load, narration should still be hidden (visibility: hidden)
    // because the dice animation hasn't completed yet
    const narration = page.getByText(DM_NARRATION)
    await expect(narration).not.toBeVisible()

    // After animation completes (~1.5s + render buffer), narration becomes visible
    await expect(narration).toBeVisible({ timeout: 5000 })
  })

  test('DM message without dice_rolls shows narration immediately (no animation)', async ({ page }) => {
    await setupGameMocks(page, {
      initialDmMessage: { content: 'The tavern is quiet tonight.', dice_rolls: null },
    })

    await page.goto(`/games/${GAME_ID}`)
    await expect(page.getByText('The Shadow Heist')).toBeVisible({ timeout: 5000 })

    // No dice_rolls → narrationVisible starts as true → immediately visible
    await expect(page.getByText('The tavern is quiet tonight.')).toBeVisible({ timeout: 3000 })
  })

  test('multiple dice in one DM message render with correct die types (reduced motion)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })

    await setupGameMocks(page, {
      initialDmMessage: {
        content: 'Your attack connects with devastating force!',
        dice_rolls: [STEALTH_ROLL, DAMAGE_ROLL],
      },
    })

    await page.goto(`/games/${GAME_ID}`)
    await expect(page.getByText('The Shadow Heist')).toBeVisible({ timeout: 5000 })

    // Both dice badges should be visible
    const badges = page.getByTestId('die-type-badge')
    await expect(badges).toHaveCount(2, { timeout: 3000 })

    // First die: d20, second die: d6
    await expect(badges.nth(0)).toHaveText('d20')
    await expect(badges.nth(1)).toHaveText('d6')

    // Both labels visible
    await expect(page.getByText('Stealth Check')).toBeVisible()
    await expect(page.getByText('Sneak Attack')).toBeVisible()

    // Narration visible after all dice settle
    await expect(page.getByText('Your attack connects with devastating force!')).toBeVisible()
  })

  test('dice arrive via Realtime (custom event) with dice_rolls', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })

    // Start with no initial messages
    await setupGameMocks(page)

    await page.goto(`/games/${GAME_ID}`)
    await expect(page.getByText('The Shadow Heist')).toBeVisible({ timeout: 5000 })
    // Wait for initializeSession to complete before dispatching the Realtime event —
    // otherwise setMessages(fetchedMessages) will overwrite the event-dispatched message
    await expect(page.getByText('The adventure begins.')).toBeVisible({ timeout: 3000 })

    // Simulate DM message arriving via Realtime with dice_rolls
    await page.evaluate(
      ({ narration, roll }) => {
        const event = new CustomEvent('dm-message', {
          detail: {
            game_id: 'test-game-dice',
            role: 'dm',
            content: narration,
            dice_rolls: [roll],
            created_at: new Date().toISOString(),
          },
        })
        window.dispatchEvent(event)
      },
      { narration: DM_NARRATION, roll: STEALTH_ROLL }
    )

    // Die renders in chat
    await expect(page.getByTestId('die-type-badge')).toBeVisible({ timeout: 3000 })
    await expect(page.getByTestId('die-type-badge')).toHaveText('d20')
    await expect(page.getByText('Stealth Check')).toBeVisible()
    await expect(page.getByTestId('dice-total')).toBeVisible()
  })

  test('player message does not render a dice roller', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })

    await setupGameMocks(page)

    await page.goto(`/games/${GAME_ID}`)
    await expect(page.getByText('The Shadow Heist')).toBeVisible({ timeout: 5000 })
    // Wait for initializeSession to complete before dispatching the Realtime event
    await expect(page.getByText('The adventure begins.')).toBeVisible({ timeout: 3000 })

    // Simulate a player action arriving
    await page.evaluate(() => {
      const event = new CustomEvent('player-message', {
        detail: {
          game_id: 'test-game-dice',
          profile_id: 'user-1',
          role: 'player',
          content: 'I attempt to sneak past the guard.',
          created_at: new Date().toISOString(),
        },
      })
      window.dispatchEvent(event)
    })

    await expect(page.getByText('I attempt to sneak past the guard.')).toBeVisible({ timeout: 3000 })

    // No dice roller for player messages
    await expect(page.getByTestId('die-type-badge')).not.toBeVisible()
  })
})
