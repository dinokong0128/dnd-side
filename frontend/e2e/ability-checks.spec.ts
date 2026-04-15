import { test, expect, Page } from '@playwright/test'

// ─── DIN-25: Ability checks and saving throws with dice display ────────────────
//
// These tests verify the outcome badge and advantage/disadvantage display that
// appears in ChatMessage when a DM message carries a d20 dice roll with dc/success.
//
// They build on the DiceRoller infrastructure from DIN-24 and the `dice_rolls`
// field on game_messages.  We use `prefers-reduced-motion: reduce` throughout so
// the dice settle immediately and we don't have to wait for the 1.5s animation.
// ─────────────────────────────────────────────────────────────────────────────

const GAME_ID = 'test-game-checks'
const USER_ID = 'user-1'

async function setupGameMocks(page: Page, dmMessageContent: string, diceRolls: object[] | null) {
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
            name: 'The Ability Check Arena',
            dm_persona: 'A fair DM',
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
            id: 'player-1',
            game_id: GAME_ID,
            profile_id: USER_ID,
            character_name: 'Arya Swiftblade',
            character_class: 'Rogue',
            race: 'Elf',
            level: 5,
            hp_current: 32,
            hp_max: 38,
          },
        ]),
      })
    }
  })

  const dmMsg = {
    id: 'msg-check-1',
    game_id: GAME_ID,
    profile_id: null,
    role: 'dm',
    content: dmMessageContent,
    dice_rolls: diceRolls,
    created_at: '2026-01-01T00:00:01Z',
  }
  await page.route('**.supabase.co/rest/v1/game_messages**', (route) => {
    if (route.request().method() === 'GET') {
      const url = route.request().url()
      if (url.includes('select=role')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{ id: dmMsg.id, role: 'dm', created_at: dmMsg.created_at }]),
        })
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([dmMsg]),
        })
      }
    }
  })
}

// ─── Success / Failure outcome badges ─────────────────────────────────────────
test.describe('DIN-25 — Ability check outcome badge', () => {
  test('success badge appears with DC label (reduced motion)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await setupGameMocks(page, 'You slip past unnoticed.', [
      {
        type: 'dice_roll',
        die: 'd20',
        count: 1,
        result: 14,
        modifier: 3,
        total: 17,
        label: 'Stealth Check',
        dc: 15,
        success: true,
      },
    ])

    await page.goto(`/games/${GAME_ID}`)
    await expect(page.getByText('The Ability Check Arena')).toBeVisible({ timeout: 5000 })

    const badge = page.getByTestId('outcome-badge')
    await expect(badge).toBeVisible({ timeout: 3000 })
    await expect(badge).toContainText('Success')
    await expect(badge).toContainText('DC 15')
  })

  test('failure badge appears with DC label (reduced motion)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await setupGameMocks(page, 'You stumble and crash into a barrel.', [
      {
        type: 'dice_roll',
        die: 'd20',
        count: 1,
        result: 6,
        modifier: 1,
        total: 7,
        label: 'Athletics Check',
        dc: 12,
        success: false,
      },
    ])

    await page.goto(`/games/${GAME_ID}`)
    await expect(page.getByText('The Ability Check Arena')).toBeVisible({ timeout: 5000 })

    const badge = page.getByTestId('outcome-badge')
    await expect(badge).toBeVisible({ timeout: 3000 })
    await expect(badge).toContainText('Failure')
    await expect(badge).toContainText('DC 12')
  })

  test('natural 20 shows Critical Success label (reduced motion)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await setupGameMocks(page, 'Your senses sharpen beyond mortal limits.', [
      {
        type: 'dice_roll',
        die: 'd20',
        count: 1,
        result: 20,
        modifier: 2,
        total: 22,
        label: 'Perception Check',
        dc: 15,
        success: true,
      },
    ])

    await page.goto(`/games/${GAME_ID}`)
    await expect(page.getByText('The Ability Check Arena')).toBeVisible({ timeout: 5000 })

    const badge = page.getByTestId('outcome-badge')
    await expect(badge).toBeVisible({ timeout: 3000 })
    await expect(badge).toContainText('Critical Success')
  })

  test('natural 1 shows Critical Failure label (reduced motion)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await setupGameMocks(page, 'You completely botch the attempt.', [
      {
        type: 'dice_roll',
        die: 'd20',
        count: 1,
        result: 1,
        modifier: 2,
        total: 3,
        label: 'Acrobatics Check',
        dc: 12,
        success: false,
      },
    ])

    await page.goto(`/games/${GAME_ID}`)
    await expect(page.getByText('The Ability Check Arena')).toBeVisible({ timeout: 5000 })

    const badge = page.getByTestId('outcome-badge')
    await expect(badge).toBeVisible({ timeout: 3000 })
    await expect(badge).toContainText('Critical Failure')
  })

  test('no outcome badge for non-d20 damage roll without dc/success (reduced motion)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await setupGameMocks(page, 'The blade strikes deep.', [
      {
        type: 'dice_roll',
        die: 'd6',
        count: 1,
        result: 5,
        modifier: 3,
        total: 8,
        label: 'Sneak Attack',
      },
    ])

    await page.goto(`/games/${GAME_ID}`)
    await expect(page.getByText('The Ability Check Arena')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('The blade strikes deep.')).toBeVisible({ timeout: 3000 })

    // No outcome badge for plain damage roll
    await expect(page.getByTestId('outcome-badge')).not.toBeVisible()
  })

  test('outcome badge does not appear before animation completes (normal motion)', async ({ page }) => {
    // Normal motion — narration is hidden during the animation, so badge is also hidden
    await setupGameMocks(page, 'You dart through the shadows.', [
      {
        type: 'dice_roll',
        die: 'd20',
        count: 1,
        result: 16,
        modifier: 4,
        total: 20,
        label: 'Stealth Check',
        dc: 15,
        success: true,
      },
    ])

    await page.goto(`/games/${GAME_ID}`)
    await expect(page.getByText('The Ability Check Arena')).toBeVisible({ timeout: 5000 })

    // Badge not visible immediately after page load (dice still animating)
    await expect(page.getByTestId('outcome-badge')).not.toBeVisible()

    // After animation completes (~1.5s + buffer), badge appears
    await expect(page.getByTestId('outcome-badge')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('outcome-badge')).toContainText('Success')
  })

  test('outcome badge arrives via Realtime custom event (reduced motion)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    // No initial DM message with dice
    await setupGameMocks(page, 'The dungeon is quiet.', null)

    await page.goto(`/games/${GAME_ID}`)
    await expect(page.getByText('The Ability Check Arena')).toBeVisible({ timeout: 5000 })
    // Wait for the initial chat message — confirms the async useEffect fetch is done
    // and the E2E event listeners are registered
    await expect(page.getByText('The dungeon is quiet.')).toBeVisible({ timeout: 5000 })

    // Simulate DM check arriving via Realtime
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('dm-message', {
          detail: {
            game_id: 'test-game-checks',
            role: 'dm',
            content: 'You notice a hidden tripwire!',
            dice_rolls: [
              {
                type: 'dice_roll',
                die: 'd20',
                count: 1,
                result: 18,
                modifier: 3,
                total: 21,
                label: 'Investigation Check',
                dc: 15,
                success: true,
              },
            ],
            created_at: new Date().toISOString(),
          },
        })
      )
    })

    const badge = page.getByTestId('outcome-badge')
    await expect(badge).toBeVisible({ timeout: 3000 })
    await expect(badge).toContainText('Success')
    await expect(badge).toContainText('DC 15')
  })
})

// ─── Advantage / Disadvantage display ─────────────────────────────────────────
test.describe('DIN-25 — Advantage and disadvantage roll display', () => {
  test('advantage roll: kept die highlighted, discarded die struck through (reduced motion)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await setupGameMocks(page, 'Your keen senses catch every shadow.', [
      {
        type: 'dice_roll',
        die: 'd20',
        count: 1,
        result: 18,          // kept value
        modifier: 3,
        total: 21,
        label: 'Perception Check',
        dc: 15,
        success: true,
        advantage: true,
        all_rolls: [11, 18], // 11 discarded, 18 kept
      },
    ])

    await page.goto(`/games/${GAME_ID}`)
    await expect(page.getByText('The Ability Check Arena')).toBeVisible({ timeout: 5000 })

    // Both pip values should be visible after animation
    const kept = page.getByTestId('adv-kept')
    const discarded = page.getByTestId('adv-discarded')

    await expect(kept).toBeVisible({ timeout: 3000 })
    await expect(discarded).toBeVisible({ timeout: 3000 })

    await expect(kept).toHaveText('18')
    await expect(discarded).toHaveText('11')

    // Discarded die has line-through
    await expect(discarded).toHaveCSS('text-decoration-line', 'line-through')
  })

  test('disadvantage roll: lower die kept, higher die struck through (reduced motion)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await setupGameMocks(page, 'You fumble in the darkness.', [
      {
        type: 'dice_roll',
        die: 'd20',
        count: 1,
        result: 5,           // kept value (lower = disadvantage)
        modifier: 1,
        total: 6,
        label: 'Stealth Check',
        dc: 12,
        success: false,
        advantage: false,
        all_rolls: [5, 14],  // 14 discarded, 5 kept
      },
    ])

    await page.goto(`/games/${GAME_ID}`)
    await expect(page.getByText('The Ability Check Arena')).toBeVisible({ timeout: 5000 })

    const kept = page.getByTestId('adv-kept')
    const discarded = page.getByTestId('adv-discarded')

    await expect(kept).toBeVisible({ timeout: 3000 })
    await expect(discarded).toBeVisible({ timeout: 3000 })

    await expect(kept).toHaveText('5')
    await expect(discarded).toHaveText('14')

    await expect(discarded).toHaveCSS('text-decoration-line', 'line-through')
  })

  test('normal roll (no advantage field) does not show pip comparison (reduced motion)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await setupGameMocks(page, 'You make the attempt.', [
      {
        type: 'dice_roll',
        die: 'd20',
        count: 1,
        result: 13,
        modifier: 2,
        total: 15,
        label: 'Strength Check',
        dc: 15,
        success: true,
        // no advantage / all_rolls fields
      },
    ])

    await page.goto(`/games/${GAME_ID}`)
    await expect(page.getByText('The Ability Check Arena')).toBeVisible({ timeout: 5000 })

    // Outcome badge present
    await expect(page.getByTestId('outcome-badge')).toBeVisible({ timeout: 3000 })

    // No advantage pip display
    await expect(page.getByTestId('adv-kept')).not.toBeVisible()
    await expect(page.getByTestId('adv-discarded')).not.toBeVisible()
  })
})
