import { test, expect, Page } from '@playwright/test'

// ─── DIN-28: XP awards and character level-up flow ───────────────────────────
//
// Verifies:
//  1. CharacterSheetPanel level badge and XP bar display
//  2. XP bar progress percentage and label
//  3. Max-level XP display
//  4. Level-up toast appears when level-up-available E2E event fires
//  5. Toast contains correct level number and dismiss works
//  6. Level Up button opens LevelUpModal
//  7. LevelUpModal heading, HP options, spell-slot diff
//  8. Confirm Level Up via "Take Average" hits the proxy API
//  9. Modal cancel closes without API call
// 10. Modal error state
// ─────────────────────────────────────────────────────────────────────────────

const GAME_ID = 'test-game-levelup'
const USER_ID = 'user-1'
const PLAYER_ID = 'player-lv1'

const FIGHTER_PLAYER = {
  id: PLAYER_ID,
  game_id: GAME_ID,
  profile_id: USER_ID,
  character_name: 'Bran Ironwall',
  character_class: 'Fighter',
  race: 'Human',
  level: 1,
  hp_current: 12,
  hp_max: 12,
  stats: {
    str: 16,
    dex: 12,
    con: 14,
    int: 10,
    wis: 10,
    cha: 8,
    spell_slots: null,
    xp: 150,
  },
  status: 'active' as const,
  joined_at: '2026-01-01T00:00:00Z',
}

const WIZARD_PLAYER = {
  id: PLAYER_ID,
  game_id: GAME_ID,
  profile_id: USER_ID,
  character_name: 'Elara Moonwhisper',
  character_class: 'Wizard',
  race: 'Elf',
  level: 1,
  hp_current: 8,
  hp_max: 8,
  stats: {
    str: 8,
    dex: 14,
    con: 12,
    int: 18,
    wis: 14,
    cha: 10,
    spell_slots: { '1': { max: 2, used: 0 } },
    xp: 150,
  },
  status: 'active' as const,
  joined_at: '2026-01-01T00:00:00Z',
}

// ─── Setup helpers ────────────────────────────────────────────────────────────

async function setupSessionMocks(
  page: Page,
  player: typeof FIGHTER_PLAYER | typeof WIZARD_PLAYER
) {
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
            name: 'The Ascent',
            dm_persona: 'A legendary DM',
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
      const url = route.request().url()
      if (url.includes(`id=eq.${PLAYER_ID}`)) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(player),
        })
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([player]),
        })
      }
    }
  })

  await page.route('**.supabase.co/rest/v1/player_inventory**', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    }
  })

  const initMsg = {
    id: 'msg-1',
    game_id: GAME_ID,
    profile_id: null,
    role: 'dm',
    content: 'A new adventure awaits.',
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

async function gotoGame(page: Page) {
  await page.goto(`/games/${GAME_ID}`)
  await expect(page.getByText('The Ascent')).toBeVisible({ timeout: 5000 })
}

async function openSheet(page: Page) {
  await page.getByTestId('sheet-button').click()
  await expect(page.getByRole('dialog', { name: 'Character Sheet' })).toBeVisible({ timeout: 3000 })
  // Wait for the CharacterSheetPanel's E2E listener useEffect to attach before
  // dispatching any simulated Realtime events.
  await expect(
    page.locator(`body[data-e2e-player-listener-ready="${PLAYER_ID}"]`)
  ).toBeAttached({ timeout: 5000 })
}

// ─── DIN-28: CharacterSheetPanel — level badge ───────────────────────────────

test.describe('DIN-28 — Level badge in CharacterSheetPanel', () => {
  test('level badge is visible in expanded sheet with correct level number', async ({ page }) => {
    await setupSessionMocks(page, FIGHTER_PLAYER)
    await gotoGame(page)
    await openSheet(page)

    const badge = page.getByTestId('level-badge')
    await expect(badge).toBeVisible()
    await expect(badge).toContainText('1')
  })

  test('level badge updates when HP update also changes level via e2e-player-update', async ({
    page,
  }) => {
    await setupSessionMocks(page, FIGHTER_PLAYER)
    await gotoGame(page)
    await openSheet(page)

    // Wait for player data to load before dispatching — level-badge visible means
    // the async fetch completed and setPlayer(playerData) was called.  Without this,
    // prev is null and the E2E update is silently dropped.
    const badge = page.getByTestId('level-badge')
    await expect(badge).toBeVisible({ timeout: 3000 })

    // Simulate level-up side effect — player row updates to level 2
    await page.evaluate((playerId) => {
      window.dispatchEvent(
        new CustomEvent(`e2e-player-update-${playerId}`, {
          detail: { level: 2, hp_max: 22, hp_current: 22 },
        })
      )
    }, PLAYER_ID)

    await expect(badge).toContainText('2', { timeout: 2000 })
  })
})

// ─── DIN-28: XP bar ───────────────────────────────────────────────────────────

test.describe('DIN-28 — XP bar in CharacterSheetPanel', () => {
  test('XP bar is visible with correct xp-pct attribute (level 1, 150 XP / 300)', async ({
    page,
  }) => {
    await setupSessionMocks(page, FIGHTER_PLAYER)
    await gotoGame(page)
    await openSheet(page)

    // 150 XP towards Level 2 (threshold 300), starting from Level 1 (threshold 0)
    // pct = round((150 - 0) / (300 - 0) * 100) = 50
    const xpBar = page.getByTestId('xp-bar')
    await expect(xpBar).toBeVisible()
    await expect(xpBar).toHaveAttribute('data-xp-pct', '50')
  })

  test('XP label shows "XP: 150 / 300 to Lv 2"', async ({ page }) => {
    await setupSessionMocks(page, FIGHTER_PLAYER)
    await gotoGame(page)
    await openSheet(page)

    const sheet = page.getByRole('dialog', { name: 'Character Sheet' })
    await expect(sheet.getByText(/150.*300.*Lv 2/)).toBeVisible()
  })

  test('max-level XP shows "Max level" text for level 5 character', async ({ page }) => {
    const maxLevelPlayer = {
      ...FIGHTER_PLAYER,
      level: 5,
      stats: { ...FIGHTER_PLAYER.stats, xp: 6500 },
    }
    await setupSessionMocks(page, maxLevelPlayer)
    await gotoGame(page)
    await openSheet(page)

    await expect(page.getByText('Max level')).toBeVisible()

    // XP bar should be at 100%
    const xpBar = page.getByTestId('xp-bar')
    await expect(xpBar).toHaveAttribute('data-xp-pct', '100')
  })

  test('XP bar updates in real-time after XP award via e2e-player-update', async ({ page }) => {
    await setupSessionMocks(page, FIGHTER_PLAYER)
    await gotoGame(page)
    await openSheet(page)

    // Initial: 50% (150/300)
    await expect(page.getByTestId('xp-bar')).toHaveAttribute('data-xp-pct', '50')

    // XP award: 150 → 225 (75% of 300)
    await page.evaluate((playerId) => {
      window.dispatchEvent(
        new CustomEvent(`e2e-player-update-${playerId}`, {
          detail: {
            stats: {
              str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 8,
              spell_slots: null,
              xp: 225,
            },
          },
        })
      )
    }, PLAYER_ID)

    await expect(page.getByTestId('xp-bar')).toHaveAttribute('data-xp-pct', '75', {
      timeout: 2000,
    })
  })

  test('XP bar has data-xp-pct="0" when stats.xp is undefined (defaults to 0)', async ({
    page,
  }) => {
    const noXpPlayer = {
      ...FIGHTER_PLAYER,
      stats: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 8, spell_slots: null },
    }
    await setupSessionMocks(page, noXpPlayer)
    await gotoGame(page)
    await openSheet(page)

    // xp defaults to 0, threshold 0→300, pct = 0%
    // width: 0% means the bar has no visible area — check attribute directly
    const xpBar = page.getByTestId('xp-bar')
    await expect(xpBar).toHaveAttribute('data-xp-pct', '0')
    // The "Experience" label and xp text are visible even at 0%
    await expect(page.getByText('Experience')).toBeVisible()
  })
})

// ─── DIN-28: Level-up toast ───────────────────────────────────────────────────

test.describe('DIN-28 — Level-up toast banner', () => {
  test('toast appears when level-up-available event is dispatched', async ({ page }) => {
    await setupSessionMocks(page, FIGHTER_PLAYER)
    await gotoGame(page)

    // No toast initially
    await expect(page.getByTestId('level-up-toast')).not.toBeVisible()

    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('level-up-available', {
          detail: { character_id: 'player-lv1', new_level: 2 },
        })
      )
    })

    await expect(page.getByTestId('level-up-toast')).toBeVisible({ timeout: 3000 })
  })

  test('toast shows the new level number', async ({ page }) => {
    await setupSessionMocks(page, FIGHTER_PLAYER)
    await gotoGame(page)

    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('level-up-available', {
          detail: { character_id: 'player-lv1', new_level: 3 },
        })
      )
    })

    const toast = page.getByTestId('level-up-toast')
    await expect(toast).toBeVisible({ timeout: 3000 })
    await expect(toast).toContainText('Level 3')
  })

  test('dismiss (✕) button closes the toast without opening modal', async ({ page }) => {
    await setupSessionMocks(page, FIGHTER_PLAYER)
    await gotoGame(page)

    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('level-up-available', {
          detail: { character_id: 'player-lv1', new_level: 2 },
        })
      )
    })

    const toast = page.getByTestId('level-up-toast')
    await expect(toast).toBeVisible({ timeout: 3000 })

    await page.getByRole('button', { name: /Dismiss level up/i }).click()

    await expect(toast).not.toBeVisible()
    await expect(page.getByRole('dialog', { name: 'Level Up' })).not.toBeVisible()
  })

  test('"Level Up" button in toast opens the modal', async ({ page }) => {
    await setupSessionMocks(page, FIGHTER_PLAYER)
    await gotoGame(page)

    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('level-up-available', {
          detail: { character_id: 'player-lv1', new_level: 2 },
        })
      )
    })

    await expect(page.getByTestId('level-up-toast')).toBeVisible({ timeout: 3000 })

    await page.getByRole('button', { name: /^Level Up$/i }).click()

    await expect(page.getByRole('dialog', { name: 'Level Up' })).toBeVisible({ timeout: 3000 })
    // Toast hidden while modal is open
    await expect(page.getByTestId('level-up-toast')).not.toBeVisible()
  })
})

// ─── DIN-28: LevelUpModal ─────────────────────────────────────────────────────

test.describe('DIN-28 — LevelUpModal content', () => {
  async function openModal(page: Page, player = FIGHTER_PLAYER) {
    await setupSessionMocks(page, player)
    await gotoGame(page)
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('level-up-available', {
          detail: { character_id: 'player-lv1', new_level: 2 },
        })
      )
    })
    await expect(page.getByTestId('level-up-toast')).toBeVisible({ timeout: 3000 })
    await page.getByRole('button', { name: /^Level Up$/i }).click()
    await expect(page.getByRole('dialog', { name: 'Level Up' })).toBeVisible({ timeout: 3000 })
  }

  test('modal heading shows "You\'ve reached Level 2!"', async ({ page }) => {
    await openModal(page)
    const modal = page.getByRole('dialog', { name: 'Level Up' })
    await expect(modal.getByText(/You.ve reached Level 2!/)).toBeVisible()
  })

  test('modal shows character name and class subtitle', async ({ page }) => {
    await openModal(page)
    const modal = page.getByRole('dialog', { name: 'Level Up' })
    await expect(modal.getByText(/Bran Ironwall.*Fighter/)).toBeVisible()
  })

  test('modal shows level transition: 1 → 2', async ({ page }) => {
    await openModal(page)
    const modal = page.getByRole('dialog', { name: 'Level Up' })
    await expect(modal.getByText(/1 → 2/)).toBeVisible()
  })

  test('"Take Average" card shows average HP value for Fighter (d10 + CON mod)', async ({
    page,
  }) => {
    // Fighter: d10, CON=14 → mod=+2; avg = ceil(10/2)+2 = 7; min 1
    await openModal(page)

    const avgCard = page.getByTestId('hp-choice-average')
    await expect(avgCard).toBeVisible()
    await expect(avgCard).toContainText('+7')
  })

  test('selecting "Take Average" marks it as selected', async ({ page }) => {
    await openModal(page)

    const avgCard = page.getByTestId('hp-choice-average')
    await avgCard.click()

    // "Confirm Level Up" button should become enabled (was disabled without selection)
    await expect(
      page.getByRole('button', { name: /Confirm Level Up/i })
    ).toBeEnabled()
  })

  test('"Roll" card appears and shows dice roller after clicking', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openModal(page)

    const rollCard = page.getByTestId('hp-choice-roll')
    await expect(rollCard).toBeVisible()
    await rollCard.click()

    // DiceRoller is rendered inside the roll card
    await expect(rollCard.getByTestId('die-type-badge')).toBeVisible({ timeout: 3000 })
  })

  test('cancel button closes modal and shows toast again', async ({ page }) => {
    await openModal(page)

    await page.getByRole('button', { name: /Cancel/i }).click()

    await expect(page.getByRole('dialog', { name: 'Level Up' })).not.toBeVisible({ timeout: 2000 })
    // Toast should reappear
    await expect(page.getByTestId('level-up-toast')).toBeVisible()
  })

  test('spell slot diff section shown for Wizard levelling up', async ({ page }) => {
    // Wizard levels from 1→2: gains spell slots
    await openModal(page, WIZARD_PLAYER)

    const modal = page.getByRole('dialog', { name: 'Level Up' })
    await expect(modal.getByTestId('spell-slot-diff')).toBeVisible()
    // Wizard L1→L2: 1st level slots go from 2→3
    await expect(modal.getByText(/1st level/)).toBeVisible()
  })

  test('spell slot diff section NOT shown for Fighter (non-spellcaster)', async ({ page }) => {
    await openModal(page, FIGHTER_PLAYER)

    const modal = page.getByRole('dialog', { name: 'Level Up' })
    await expect(modal.getByTestId('spell-slot-diff')).not.toBeVisible()
  })
})

// ─── DIN-28: LevelUpModal — confirm API call ──────────────────────────────────

test.describe('DIN-28 — LevelUpModal confirm and API', () => {
  async function openModal(page: Page, player = FIGHTER_PLAYER) {
    await setupSessionMocks(page, player)
    await gotoGame(page)
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('level-up-available', {
          detail: { character_id: 'player-lv1', new_level: 2 },
        })
      )
    })
    await expect(page.getByTestId('level-up-toast')).toBeVisible({ timeout: 3000 })
    await page.getByRole('button', { name: /^Level Up$/i }).click()
    await expect(page.getByRole('dialog', { name: 'Level Up' })).toBeVisible({ timeout: 3000 })
  }

  test('confirming "Take Average" calls POST /api/games/{gameId}/level-up', async ({ page }) => {
    let levelUpCalled = false
    let requestBody: unknown = null

    await page.route(`**/api/games/${GAME_ID}/level-up`, (route) => {
      if (route.request().method() === 'POST') {
        levelUpCalled = true
        const body = route.request().postData()
        if (body) requestBody = JSON.parse(body)
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ level: 2, hp_max: 19, hp_gained: 7 }),
        })
      }
    })

    await openModal(page)

    await page.getByTestId('hp-choice-average').click()
    await page.getByRole('button', { name: /Confirm Level Up/i }).click()

    await expect(page.getByRole('dialog', { name: 'Level Up' })).not.toBeVisible({
      timeout: 3000,
    })
    expect(levelUpCalled).toBe(true)
  })

  test('success: modal closes and toast is dismissed after confirm', async ({ page }) => {
    await page.route(`**/api/games/${GAME_ID}/level-up`, (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ level: 2, hp_max: 19, hp_gained: 7 }),
        })
      }
    })

    await openModal(page)

    await page.getByTestId('hp-choice-average').click()
    await page.getByRole('button', { name: /Confirm Level Up/i }).click()

    // Both modal and toast are gone
    await expect(page.getByRole('dialog', { name: 'Level Up' })).not.toBeVisible({ timeout: 3000 })
    await expect(page.getByTestId('level-up-toast')).not.toBeVisible()
  })

  test('error state shown when API returns error', async ({ page }) => {
    await page.route(`**/api/games/${GAME_ID}/level-up`, (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Internal server error' }),
        })
      }
    })

    await openModal(page)

    await page.getByTestId('hp-choice-average').click()
    await page.getByRole('button', { name: /Confirm Level Up/i }).click()

    // Error banner should appear in the modal
    await expect(page.getByTestId('level-up-error')).toBeVisible({ timeout: 3000 })
    await expect(page.getByTestId('level-up-error')).toContainText('Internal server error')

    // Modal stays open so the user can retry
    await expect(page.getByRole('dialog', { name: 'Level Up' })).toBeVisible()
  })

  test('confirm button is disabled until an HP choice is made', async ({ page }) => {
    await page.route(`**/api/games/${GAME_ID}/level-up`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ level: 2, hp_max: 19, hp_gained: 7 }),
      })
    })

    await openModal(page)

    // Initially disabled (no choice selected)
    await expect(page.getByRole('button', { name: /Confirm Level Up/i })).toBeDisabled()

    // Select an option
    await page.getByTestId('hp-choice-average').click()

    await expect(page.getByRole('button', { name: /Confirm Level Up/i })).toBeEnabled()
  })

  test('confirming "Roll" sends hp_choice: "roll" to POST /api/games/{gameId}/level-up', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })

    let capturedBody: Record<string, unknown> | null = null
    await page.route(`**/api/games/${GAME_ID}/level-up`, (route) => {
      if (route.request().method() === 'POST') {
        const raw = route.request().postData()
        if (raw) capturedBody = JSON.parse(raw) as Record<string, unknown>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ level: 2, hp_max: 22, hp_gained: 10 }),
        })
      }
    })

    await openModal(page)

    // Select Roll option
    const rollCard = page.getByTestId('hp-choice-roll')
    await rollCard.click()

    // Confirm button should become enabled
    await expect(page.getByRole('button', { name: /Confirm Level Up/i })).toBeEnabled()

    await page.getByRole('button', { name: /Confirm Level Up/i }).click()

    // Modal should close
    await expect(page.getByRole('dialog', { name: 'Level Up' })).not.toBeVisible({
      timeout: 3000,
    })

    // Verify the API received hp_choice: 'roll'
    expect(capturedBody).not.toBeNull()
    expect((capturedBody as Record<string, unknown>).hp_choice).toBe('roll')
  })
})
