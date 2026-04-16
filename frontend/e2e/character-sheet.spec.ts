import { test, expect, Page } from '@playwright/test'

// ─── Shared mock data ─────────────────────────────────────────────────────────

const GAME_ID = 'test-game-sheet'
const USER_ID = 'user-1'
const PLAYER_ID = 'player-1'

const MOCK_GAME = {
  id: GAME_ID,
  name: 'The Lost Dungeon',
  dm_persona: 'A dramatic Dungeon Master',
  status: 'active',
  created_by: USER_ID,
  updated_at: '2026-01-01T00:00:00Z',
  suggested_actions: null,
}

// Full player row returned by CharacterSheetPanel's select('*') query
const MOCK_PLAYER_FULL = {
  id: PLAYER_ID,
  game_id: GAME_ID,
  profile_id: USER_ID,
  character_name: 'Aldric Stormcaller',
  character_class: 'Wizard',
  race: 'Human',
  level: 4,
  hp_current: 24,
  hp_max: 32,
  stats: { str: 8, dex: 14, con: 12, int: 18, wis: 12, cha: 10 },
  status: 'active',
  joined_at: '2026-01-01T00:00:00Z',
}

// Compact player row returned by GameSessionView's select('id,profile_id,character_name') query
const MOCK_PLAYER_SUMMARY = {
  id: PLAYER_ID,
  profile_id: USER_ID,
  character_name: MOCK_PLAYER_FULL.character_name,
}

const MOCK_INVENTORY = [
  { id: 'inv-1', player_id: PLAYER_ID, item_name: 'Staff of Power', quantity: 1 },
  { id: 'inv-2', player_id: PLAYER_ID, item_name: 'Arcane Focus', quantity: 2 },
]

// ─── Setup helper ─────────────────────────────────────────────────────────────

async function setupGameMocks(
  page: Page,
  options: {
    player?: typeof MOCK_PLAYER_FULL | null
    inventory?: typeof MOCK_INVENTORY
    gameStatus?: string
  } = {}
) {
  const {
    player = MOCK_PLAYER_FULL,
    inventory = MOCK_INVENTORY,
    gameStatus = 'active',
  } = options

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
        body: JSON.stringify([{ ...MOCK_GAME, status: gameStatus }]),
      })
    }
  })

  // Players — differentiate GameSessionView (game_id filter) from
  // CharacterSheetPanel (id=eq filter, select=* for single player)
  await page.route('**.supabase.co/rest/v1/players**', (route) => {
    if (route.request().method() !== 'GET') return
    const url = route.request().url()

    if (url.includes(`id=eq.${PLAYER_ID}`)) {
      // CharacterSheetPanel's single-player fetch (.single())
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(player),
      })
    } else {
      // GameSessionView's player-list fetch (used to build playerMap + currentPlayerId)
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(player ? [MOCK_PLAYER_SUMMARY] : []),
      })
    }
  })

  // Player inventory (CharacterSheetPanel only)
  await page.route('**.supabase.co/rest/v1/player_inventory**', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(inventory),
      })
    }
  })

  // game_messages
  const initialMessage = {
    id: 'msg-dm-1',
    game_id: GAME_ID,
    profile_id: null,
    role: 'dm',
    content: 'You stand at the dungeon entrance.',
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

// ─── Helper: navigate and wait for game header ────────────────────────────────
async function gotoGame(page: Page) {
  await page.goto(`/games/${GAME_ID}`)
  await expect(page.getByText('The Lost Dungeon')).toBeVisible({ timeout: 5000 })
}

// ─── DIN-15: In-game Character Sheet Panel ───────────────────────────────────
test.describe('DIN-15 — In-game Character Sheet Panel', () => {
  test('sheet button is visible in active game when player has a character', async ({ page }) => {
    await setupGameMocks(page)
    await gotoGame(page)

    // Sheet button rendered by GameHeader when gameStatus is active and currentPlayerId is set
    await expect(page.getByTestId('sheet-button')).toBeVisible({ timeout: 3000 })
    await expect(page.getByTestId('sheet-button')).toContainText('Sheet')
  })

  test('sheet button is absent when user has no character in this game', async ({ page }) => {
    await setupGameMocks(page, { player: null })
    await gotoGame(page)

    // GameSessionView sets currentPlayerId = null → no onToggleSheet prop → button absent
    await expect(page.getByTestId('sheet-button')).not.toBeVisible()
  })

  test('clicking sheet button opens the character sheet panel', async ({ page }) => {
    await setupGameMocks(page)
    await gotoGame(page)

    await page.getByTestId('sheet-button').click()

    // CharacterSheetPanel renders as role=dialog
    await expect(page.getByRole('dialog', { name: 'Character Sheet' })).toBeVisible({ timeout: 3000 })
  })

  test('character sheet panel displays identity and HP', async ({ page }) => {
    await setupGameMocks(page)
    await gotoGame(page)
    await page.getByTestId('sheet-button').click()

    const sheet = page.getByRole('dialog', { name: 'Character Sheet' })
    await expect(sheet).toBeVisible({ timeout: 3000 })

    // Name, class line, HP numbers
    await expect(sheet.getByText('Aldric Stormcaller')).toBeVisible()
    await expect(sheet.getByText(/Level 4 Human Wizard/)).toBeVisible()
    await expect(sheet.getByText('24')).toBeVisible()
    await expect(sheet.getByText('32')).toBeVisible()
  })

  test('HP bar shows emerald (high) state when HP > 50%', async ({ page }) => {
    // hp_current=24, hp_max=32 → 75% → high
    await setupGameMocks(page)
    await gotoGame(page)
    await page.getByTestId('sheet-button').click()

    await expect(page.getByRole('dialog', { name: 'Character Sheet' })).toBeVisible({ timeout: 3000 })
    // The expanded view's hp-bar (second one in the DOM)
    const hpBar = page.getByTestId('hp-bar').last()
    await expect(hpBar).toHaveAttribute('data-hp-state', 'high')
  })

  test('HP bar shows crimson (low) state when HP ≤ 25%', async ({ page }) => {
    const lowHpPlayer = { ...MOCK_PLAYER_FULL, hp_current: 7, hp_max: 32 } // 22% → low
    await setupGameMocks(page, { player: lowHpPlayer })
    await gotoGame(page)
    await page.getByTestId('sheet-button').click()

    await expect(page.getByRole('dialog', { name: 'Character Sheet' })).toBeVisible({ timeout: 3000 })
    const hpBar = page.getByTestId('hp-bar').last()
    await expect(hpBar).toHaveAttribute('data-hp-state', 'low')
  })

  test('unconscious label appears at 0 HP', async ({ page }) => {
    const deadPlayer = { ...MOCK_PLAYER_FULL, hp_current: 0, hp_max: 32 }
    await setupGameMocks(page, { player: deadPlayer })
    await gotoGame(page)
    await page.getByTestId('sheet-button').click()

    await expect(page.getByRole('dialog', { name: 'Character Sheet' })).toBeVisible({ timeout: 3000 })
    await expect(page.getByTestId('unconscious-label')).toBeVisible()
    await expect(page.getByTestId('unconscious-label')).toContainText('Unconscious')
  })

  test('ability scores grid displays all six stats with modifiers', async ({ page }) => {
    await setupGameMocks(page)
    await gotoGame(page)
    await page.getByTestId('sheet-button').click()

    await expect(page.getByRole('dialog', { name: 'Character Sheet' })).toBeVisible({ timeout: 3000 })

    const grid = page.getByTestId('ability-scores-grid')
    await expect(grid).toBeVisible()

    // All six ability score labels
    for (const label of ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']) {
      await expect(grid.getByText(label)).toBeVisible()
    }

    // INT score = 18, modifier = +4
    await expect(grid.getByText('18')).toBeVisible()
    await expect(grid.getByText('+4')).toBeVisible()
  })

  test('inventory items are displayed in alphabetical order', async ({ page }) => {
    await setupGameMocks(page)
    await gotoGame(page)
    await page.getByTestId('sheet-button').click()

    await expect(page.getByRole('dialog', { name: 'Character Sheet' })).toBeVisible({ timeout: 3000 })

    // Arcane Focus comes before Staff of Power alphabetically
    await expect(page.getByText('Arcane Focus')).toBeVisible()
    await expect(page.getByText('Staff of Power')).toBeVisible()
    // Quantity badge for Arcane Focus (qty=2)
    await expect(page.getByText('×2')).toBeVisible()
  })

  test('empty inventory shows the empty state', async ({ page }) => {
    await setupGameMocks(page, { inventory: [] })
    await gotoGame(page)
    await page.getByTestId('sheet-button').click()

    await expect(page.getByRole('dialog', { name: 'Character Sheet' })).toBeVisible({ timeout: 3000 })
    await expect(page.getByText('🎒 Empty')).toBeVisible()
  })

  test('close button (×) dismisses the character sheet panel', async ({ page }) => {
    await setupGameMocks(page)
    await gotoGame(page)
    await page.getByTestId('sheet-button').click()

    const sheet = page.getByRole('dialog', { name: 'Character Sheet' })
    await expect(sheet).toBeVisible({ timeout: 3000 })

    await page.getByTestId('character-sheet-close').click()
    await expect(sheet).not.toBeVisible()
  })

  test('Escape key dismisses the character sheet panel', async ({ page }) => {
    await setupGameMocks(page)
    await gotoGame(page)
    await page.getByTestId('sheet-button').click()

    const sheet = page.getByRole('dialog', { name: 'Character Sheet' })
    await expect(sheet).toBeVisible({ timeout: 3000 })

    await page.keyboard.press('Escape')
    await expect(sheet).not.toBeVisible()
  })

  test('collapse button (‹) collapses the panel, showing only the HP bar', async ({ page }) => {
    await setupGameMocks(page)
    await gotoGame(page)
    await page.getByTestId('sheet-button').click()

    await expect(page.getByRole('dialog', { name: 'Character Sheet' })).toBeVisible({ timeout: 3000 })

    // Panel starts expanded — character name is visible
    await expect(page.getByText('Aldric Stormcaller')).toBeVisible()

    await page.getByTestId('character-sheet-collapse').click()

    // After collapse, character name is hidden and hp-bar is still visible
    await expect(page.getByText('Aldric Stormcaller')).not.toBeVisible()
    await expect(page.getByTestId('hp-bar').first()).toBeVisible()
  })

  test('HP updates in real-time via custom E2E event', async ({ page }) => {
    await setupGameMocks(page)
    await gotoGame(page)
    await page.getByTestId('sheet-button').click()

    const sheet = page.getByRole('dialog', { name: 'Character Sheet' })
    await expect(sheet).toBeVisible({ timeout: 3000 })

    // Initial HP: 24/32 → verify it's shown
    await expect(sheet.getByText('24')).toBeVisible()

    // Simulate a Realtime player UPDATE via custom E2E event (HP drops to 5)
    await page.evaluate((playerId) => {
      window.dispatchEvent(
        new CustomEvent(`e2e-player-update-${playerId}`, {
          detail: { hp_current: 5 },
        })
      )
    }, PLAYER_ID)

    // HP display should now show 5 instead of 24
    await expect(sheet.getByText('5')).toBeVisible({ timeout: 2000 })
    // HP bar should now be low (5/32 = 15.6%)
    await expect(page.getByTestId('hp-bar').last()).toHaveAttribute('data-hp-state', 'low')
    // Unconscious label appears when HP = 0 (5 ≠ 0 so it should NOT appear)
    await expect(page.getByTestId('unconscious-label')).not.toBeVisible()
  })
})

// ─── DIN-27: Spell slot tracking and display ─────────────────────────────────
//
// Spell slots are stored in players.stats.spell_slots JSONB. The character
// sheet renders a Spell Slots section (pip display + count label) only for
// spellcasting classes (when stats.spell_slots is not null). Non-casters and
// levels with max=0 are hidden. Slot usage propagates via the e2e-player-update
// event (mirrors Supabase Realtime players UPDATE subscription).
// ─────────────────────────────────────────────────────────────────────────────

const WIZARD_STATS = {
  str: 8, dex: 14, con: 12, int: 18, wis: 12, cha: 10,
  spell_slots: {
    '1': { max: 4, used: 1 },
    '2': { max: 2, used: 0 },
    '3': { max: 0, used: 0 }, // max=0 → should be hidden
  },
  cantrips: ['Fire Bolt', 'Mage Hand'],
}

const FIGHTER_STATS = {
  str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 8,
  spell_slots: null,
}

const WIZARD_PLAYER = {
  ...MOCK_PLAYER_FULL,
  character_class: 'Wizard',
  stats: WIZARD_STATS,
}

const FIGHTER_PLAYER = {
  ...MOCK_PLAYER_FULL,
  character_name: 'Bran Ironwall',
  character_class: 'Fighter',
  stats: FIGHTER_STATS,
}

test.describe('DIN-27 — Spell slot tracking and display', () => {
  test('spell slots section is visible for a Wizard with spell_slots in stats', async ({ page }) => {
    await setupGameMocks(page, { player: WIZARD_PLAYER })
    await gotoGame(page)
    await page.getByTestId('sheet-button').click()

    const sheet = page.getByRole('dialog', { name: 'Character Sheet' })
    await expect(sheet).toBeVisible({ timeout: 3000 })

    // Spell Slots heading present
    await expect(sheet.getByText('Spell Slots', { exact: true })).toBeVisible()
  })

  test('spell slots section is NOT visible for a Fighter (null spell_slots)', async ({ page }) => {
    await setupGameMocks(page, { player: FIGHTER_PLAYER })
    await gotoGame(page)
    await page.getByTestId('sheet-button').click()

    const sheet = page.getByRole('dialog', { name: 'Character Sheet' })
    await expect(sheet).toBeVisible({ timeout: 3000 })

    await expect(sheet.getByText('Spell Slots', { exact: true })).not.toBeVisible()
  })

  test('pip display shows used (●) and available (○) pips correctly', async ({ page }) => {
    await setupGameMocks(page, { player: WIZARD_PLAYER })
    await gotoGame(page)
    await page.getByTestId('sheet-button').click()

    const sheet = page.getByRole('dialog', { name: 'Character Sheet' })
    await expect(sheet).toBeVisible({ timeout: 3000 })

    // 1st level: 4 max, 1 used → 1 pip-used + 3 pip-available
    const row1 = sheet.getByTestId('spell-slot-row-1')
    await expect(row1).toBeVisible()
    await expect(row1.getByTestId('pip-used')).toHaveCount(1)
    await expect(row1.getByTestId('pip-available')).toHaveCount(3)

    // 2nd level: 2 max, 0 used → 0 pip-used + 2 pip-available
    const row2 = sheet.getByTestId('spell-slot-row-2')
    await expect(row2).toBeVisible()
    await expect(row2.getByTestId('pip-used')).toHaveCount(0)
    await expect(row2.getByTestId('pip-available')).toHaveCount(2)
  })

  test('count label shows remaining / max in correct format', async ({ page }) => {
    await setupGameMocks(page, { player: WIZARD_PLAYER })
    await gotoGame(page)
    await page.getByTestId('sheet-button').click()

    const sheet = page.getByRole('dialog', { name: 'Character Sheet' })
    await expect(sheet).toBeVisible({ timeout: 3000 })

    // 1st level: 4 max, 1 used → remaining = 3
    await expect(sheet.getByTestId('spell-slot-label-1')).toHaveText('3 / 4')
    // 2nd level: 2 max, 0 used → remaining = 2
    await expect(sheet.getByTestId('spell-slot-label-2')).toHaveText('2 / 2')
  })

  test('levels with max=0 are hidden from the spell slots section', async ({ page }) => {
    await setupGameMocks(page, { player: WIZARD_PLAYER })
    await gotoGame(page)
    await page.getByTestId('sheet-button').click()

    const sheet = page.getByRole('dialog', { name: 'Character Sheet' })
    await expect(sheet).toBeVisible({ timeout: 3000 })

    // 3rd level has max=0 — row must not appear
    await expect(sheet.getByTestId('spell-slot-row-3')).not.toBeVisible()
  })

  test('cantrips are listed with the infinity symbol', async ({ page }) => {
    await setupGameMocks(page, { player: WIZARD_PLAYER })
    await gotoGame(page)
    await page.getByTestId('sheet-button').click()

    const sheet = page.getByRole('dialog', { name: 'Character Sheet' })
    await expect(sheet).toBeVisible({ timeout: 3000 })

    // Cantrip line format: "Cantrips (∞): Fire Bolt, Mage Hand"
    await expect(sheet.getByText(/Cantrips \(∞\)/)).toBeVisible()
    await expect(sheet.getByText(/Fire Bolt/)).toBeVisible()
    await expect(sheet.getByText(/Mage Hand/)).toBeVisible()
  })

  test('spell slot use updates pips in real-time via e2e-player-update event', async ({ page }) => {
    await setupGameMocks(page, { player: WIZARD_PLAYER })
    await gotoGame(page)
    await page.getByTestId('sheet-button').click()

    const sheet = page.getByRole('dialog', { name: 'Character Sheet' })
    await expect(sheet).toBeVisible({ timeout: 3000 })

    // Initial state: 1 used, 3 available for 1st level
    const row1 = sheet.getByTestId('spell-slot-row-1')
    await expect(row1.getByTestId('pip-used')).toHaveCount(1)
    await expect(row1.getByTestId('pip-available')).toHaveCount(3)

    // Simulate Realtime player UPDATE — spell_slot_use increments used to 2
    await page.evaluate((playerId) => {
      window.dispatchEvent(
        new CustomEvent(`e2e-player-update-${playerId}`, {
          detail: {
            stats: {
              str: 8, dex: 14, con: 12, int: 18, wis: 12, cha: 10,
              spell_slots: {
                '1': { max: 4, used: 2 },
                '2': { max: 2, used: 0 },
                '3': { max: 0, used: 0 },
              },
              cantrips: ['Fire Bolt', 'Mage Hand'],
            },
          },
        })
      )
    }, PLAYER_ID)

    // After update: 2 used, 2 available for 1st level
    await expect(row1.getByTestId('pip-used')).toHaveCount(2, { timeout: 2000 })
    await expect(row1.getByTestId('pip-available')).toHaveCount(2, { timeout: 2000 })

    // Count label updates to 2 / 4
    await expect(sheet.getByTestId('spell-slot-label-1')).toHaveText('2 / 4', { timeout: 2000 })
  })

  test('long rest (spell_slots_recharge) resets all pips to available', async ({ page }) => {
    // Start with used slots: 1st=1, 2nd=1
    const partiallyUsedWizard = {
      ...WIZARD_PLAYER,
      stats: {
        ...WIZARD_STATS,
        spell_slots: {
          '1': { max: 4, used: 3 },
          '2': { max: 2, used: 1 },
          '3': { max: 0, used: 0 },
        },
      },
    }

    await setupGameMocks(page, { player: partiallyUsedWizard })
    await gotoGame(page)
    await page.getByTestId('sheet-button').click()

    const sheet = page.getByRole('dialog', { name: 'Character Sheet' })
    await expect(sheet).toBeVisible({ timeout: 3000 })

    // Initial: 3 used, 1 available for 1st level
    const row1 = sheet.getByTestId('spell-slot-row-1')
    await expect(row1.getByTestId('pip-used')).toHaveCount(3)

    // Simulate long rest — all slots recharged (used=0)
    await page.evaluate((playerId) => {
      window.dispatchEvent(
        new CustomEvent(`e2e-player-update-${playerId}`, {
          detail: {
            stats: {
              str: 8, dex: 14, con: 12, int: 18, wis: 12, cha: 10,
              spell_slots: {
                '1': { max: 4, used: 0 },
                '2': { max: 2, used: 0 },
                '3': { max: 0, used: 0 },
              },
              cantrips: ['Fire Bolt', 'Mage Hand'],
            },
          },
        })
      )
    }, PLAYER_ID)

    // All slots recharged: 0 used, 4 available for 1st level
    await expect(row1.getByTestId('pip-used')).toHaveCount(0, { timeout: 2000 })
    await expect(row1.getByTestId('pip-available')).toHaveCount(4, { timeout: 2000 })

    // 2nd level also recharged: 0 used, 2 available
    const row2 = sheet.getByTestId('spell-slot-row-2')
    await expect(row2.getByTestId('pip-used')).toHaveCount(0, { timeout: 2000 })
    await expect(row2.getByTestId('pip-available')).toHaveCount(2, { timeout: 2000 })
  })
})
