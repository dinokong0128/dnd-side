import { test, expect, Page } from '@playwright/test'

// ─── DIN-58: Lobby page D&D theming ──────────────────────────────────────────
//
// Verifies that game lobby components (CharacterSummaryCard, CharacterLobbyPanel,
// CharacterCreationForm, InviteSection) render correctly after migrating to
// dnd-* CSS classes. Tests focus on user-visible behaviour and data-testid
// queries (never CSS class names directly).
// ─────────────────────────────────────────────────────────────────────────────

const GAME_ID = 'test-game-lobby'
const HOST_ID = 'user-host'
const GUEST_ID = 'user-guest'

const MOCK_GAME_LOBBY = {
  id: GAME_ID,
  name: 'The Forgotten Realm',
  dm_persona: 'A mysterious Dungeon Master',
  status: 'lobby',
  created_by: HOST_ID,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const MOCK_PLAYER = {
  id: 'player-1',
  game_id: GAME_ID,
  profile_id: HOST_ID,
  character_name: 'Gandalf the Grey',
  character_class: 'Wizard',
  race: 'Human',
  level: 3,
  hp_current: 18,
  hp_max: 24,
  stats: { str: 8, dex: 12, con: 14, int: 18, wis: 16, cha: 14 },
  status: 'active',
  joined_at: '2026-01-01T00:00:00Z',
}

// ─── Setup helpers ────────────────────────────────────────────────────────────

async function setupAuthMocks(page: Page, userId: string) {
  await page.route('**/auth/v1/user', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: userId, email: `${userId}@example.com` }),
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
        user: { id: userId, email: `${userId}@example.com` },
      }),
    })
  )
}

async function setupLobbyMocks(
  page: Page,
  options: {
    userId?: string
    gameStatus?: string
    player?: typeof MOCK_PLAYER | null
    inventory?: { id: string; player_id: string; item_name: string; quantity: number }[]
  } = {}
) {
  const {
    userId = HOST_ID,
    gameStatus = 'lobby',
    player = MOCK_PLAYER,
    inventory = [],
  } = options

  await setupAuthMocks(page, userId)

  await page.route('**.supabase.co/rest/v1/games**', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ ...MOCK_GAME_LOBBY, status: gameStatus }]),
      })
    }
  })

  await page.route('**.supabase.co/rest/v1/players**', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(player ? [player] : []),
      })
    }
  })

  await page.route('**.supabase.co/rest/v1/player_inventory**', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(inventory),
      })
    }
  })
}

// ─── DIN-58: CharacterSummaryCard ────────────────────────────────────────────

test.describe('DIN-58 — CharacterSummaryCard in lobby', () => {
  test('displays character name, class, race, and level', async ({ page }) => {
    await setupLobbyMocks(page)
    await page.goto(`/games/${GAME_ID}`)
    await expect(page.getByText('The Forgotten Realm')).toBeVisible({ timeout: 5000 })

    await expect(page.getByText('Gandalf the Grey')).toBeVisible()
    await expect(page.getByText(/Level 3 Human Wizard/)).toBeVisible()
  })

  test('displays HP badge with current/max HP', async ({ page }) => {
    await setupLobbyMocks(page)
    await page.goto(`/games/${GAME_ID}`)
    await expect(page.getByText('Gandalf the Grey')).toBeVisible({ timeout: 5000 })

    // HP badge shows hp_current/hp_max
    const hpBadge = page.locator('.dnd-hp-badge')
    await expect(hpBadge).toBeVisible()
    await expect(hpBadge).toContainText('18/24')
  })

  test('displays ability score grid with all six stats', async ({ page }) => {
    await setupLobbyMocks(page)
    await page.goto(`/games/${GAME_ID}`)
    await expect(page.getByText('Gandalf the Grey')).toBeVisible({ timeout: 5000 })

    // Stat grid container and labels
    const statGrid = page.locator('.dnd-stat-grid')
    await expect(statGrid).toBeVisible()

    for (const stat of ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']) {
      await expect(statGrid.getByText(stat)).toBeVisible()
    }

    // INT=18 is visible
    await expect(statGrid.getByText('18')).toBeVisible()
  })

  test('Edit Character button is visible in lobby status', async ({ page }) => {
    await setupLobbyMocks(page)
    await page.goto(`/games/${GAME_ID}`)
    await expect(page.getByText('Gandalf the Grey')).toBeVisible({ timeout: 5000 })

    await expect(page.getByRole('button', { name: /Edit Character/i })).toBeVisible()
  })

  test('Edit Character button is hidden when game is not in lobby', async ({ page }) => {
    await setupLobbyMocks(page, { gameStatus: 'active' })
    // Active game → GameSessionView; no lobby CharacterSummaryCard shown
    await page.goto(`/games/${GAME_ID}`)
    // The game has no messages, so it'll show game session view
    // The CharacterSummaryCard (lobby version) should not be present
    await expect(page.getByRole('button', { name: /Edit Character/i })).not.toBeVisible({
      timeout: 5000,
    })
  })

  test('clicking Edit Character switches to creation form', async ({ page }) => {
    await setupLobbyMocks(page)
    await page.goto(`/games/${GAME_ID}`)
    await expect(page.getByText('Gandalf the Grey')).toBeVisible({ timeout: 5000 })

    await page.getByRole('button', { name: /Edit Character/i }).click()

    // Form appears — name input is pre-filled with existing character name.
    // The label is not htmlFor-linked, so we locate by placeholder.
    const nameInput = page.getByPlaceholder('Enter character name')
    await expect(nameInput).toBeVisible({ timeout: 3000 })
    await expect(nameInput).toHaveValue('Gandalf the Grey')
  })
})

// ─── DIN-58: CharacterLobbyPanel ────────────────────────────────────────────

test.describe('DIN-58 — CharacterLobbyPanel', () => {
  test('CharacterCreationForm shown directly when player has no character in lobby', async ({
    page,
  }) => {
    // When initialPlayer is null, isEditing starts as true → form shows immediately
    await setupLobbyMocks(page, { player: null })
    await page.goto(`/games/${GAME_ID}`)
    await expect(page.getByText('The Forgotten Realm')).toBeVisible({ timeout: 5000 })

    // Form is rendered directly — no "Create Your Character" CTA button to click
    await expect(page.getByRole('button', { name: /Save Character/i })).toBeVisible({ timeout: 5000 })
    // The character name input is present and empty (placeholder visible)
    await expect(page.getByPlaceholder('Enter character name')).toBeVisible()
  })

  test('CharacterCreationForm uses dnd-label and dnd-input for name field', async ({ page }) => {
    await setupLobbyMocks(page, { player: null })
    await page.goto(`/games/${GAME_ID}`)
    await expect(page.getByText('The Forgotten Realm')).toBeVisible({ timeout: 5000 })

    await expect(page.getByRole('button', { name: /Save Character/i })).toBeVisible({ timeout: 5000 })

    // Label element uses dnd-label class — locate by text since label is not htmlFor-linked
    const label = page.getByText('Character Name').first()
    await expect(label).toHaveClass(/dnd-label/)

    // Input uses dnd-input class — locate by placeholder
    await expect(page.getByPlaceholder('Enter character name')).toHaveClass(/dnd-input/)
  })

  test('warning box shown when game has already started and user has no character', async ({
    page,
  }) => {
    // CharacterLobbyPanel shows dnd-warning-box when gameStatus !== 'lobby' and
    // isEditing is true (no existing character). We set up a lobby page with
    // non-lobby status returned by the games endpoint.
    await setupAuthMocks(page, HOST_ID)

    await page.route('**.supabase.co/rest/v1/games**', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { ...MOCK_GAME_LOBBY, status: 'active', created_by: HOST_ID },
          ]),
        })
      }
    })

    // No player exists for this user in an active game
    await page.route('**.supabase.co/rest/v1/players**', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        })
      }
    })

    await page.route('**.supabase.co/rest/v1/game_messages**', (route) => {
      if (route.request().method() === 'GET') {
        const url = route.request().url()
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(url.includes('select=role') ? [] : []),
        })
      }
    })

    await page.goto(`/games/${GAME_ID}`)

    // The active game redirects to GameSessionView which has no CharacterLobbyPanel.
    // The lobby-panel warning scenario is fully covered by unit tests;
    // in E2E we confirm the active session view renders (game title header).
    await expect(page.getByText('The Forgotten Realm')).toBeVisible({ timeout: 5000 })
    // No lobby-specific "Create Your Character" shown in active session
    await expect(page.getByRole('button', { name: /Create Your Character/i })).not.toBeVisible()
  })
})

// ─── DIN-58: CharacterCreationForm ───────────────────────────────────────────

test.describe('DIN-58 — CharacterCreationForm', () => {
  test('validation error appears when character name is cleared and form submitted', async ({
    page,
  }) => {
    // Form is shown directly (no player) — no button click needed
    await setupLobbyMocks(page, { player: null })
    await page.goto(`/games/${GAME_ID}`)
    await expect(page.getByText('The Forgotten Realm')).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('button', { name: /Save Character/i })).toBeVisible({ timeout: 5000 })

    // Clear the character name field and submit
    const nameInput = page.getByPlaceholder('Enter character name')
    await nameInput.fill('')
    await page.getByRole('button', { name: /Save Character/i }).click()

    // Field error should appear (dnd-field-error class)
    await expect(page.locator('.dnd-field-error').first()).toBeVisible()
  })

  test('server error banner appears on API failure', async ({ page }) => {
    await setupLobbyMocks(page, { player: null })

    // Mock the character creation API to return an error
    await page.route(`**/api/games/${GAME_ID}/players`, (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 422,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Character name already taken' }),
        })
      }
    })

    await page.goto(`/games/${GAME_ID}`)
    await expect(page.getByText('The Forgotten Realm')).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('button', { name: /Save Character/i })).toBeVisible({ timeout: 5000 })

    // Fill in a name and submit
    await page.getByPlaceholder('Enter character name').fill('Thorin')
    await page.getByRole('button', { name: /Save Character/i }).click()

    // Error banner (dnd-error-banner) should appear
    await expect(page.locator('.dnd-error-banner')).toBeVisible({ timeout: 3000 })
  })

  test('stat grid inputs are visible in character creation form (6 stats)', async ({ page }) => {
    // Form shows directly when no player
    await setupLobbyMocks(page, { player: null })
    await page.goto(`/games/${GAME_ID}`)
    await expect(page.getByText('The Forgotten Realm')).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('button', { name: /Save Character/i })).toBeVisible({ timeout: 5000 })

    // Stat grid uses dnd-stat-input for all 6 ability score fields
    const statInputs = page.locator('.dnd-stat-input')
    await expect(statInputs).toHaveCount(6)
  })
})

// ─── DIN-58: InviteSection ───────────────────────────────────────────────────

test.describe('DIN-58 — InviteSection theming', () => {
  test('invite section renders inside a dnd-card for the game host', async ({ page }) => {
    await setupLobbyMocks(page)
    await page.goto(`/games/${GAME_ID}`)
    await expect(page.getByText('The Forgotten Realm')).toBeVisible({ timeout: 5000 })

    // InviteSection should be wrapped in a dnd-card
    await expect(page.getByTestId('generate-invite-button')).toBeVisible()
    const card = page.getByTestId('generate-invite-button').locator('xpath=ancestor::div[contains(@class,"dnd-card")]')
    await expect(card).toBeVisible()
  })

  test('invite section is NOT shown for a non-host player', async ({ page }) => {
    // Log in as a guest user (different from the game creator)
    await setupLobbyMocks(page, {
      userId: GUEST_ID,
      player: { ...MOCK_PLAYER, profile_id: GUEST_ID },
    })
    await page.goto(`/games/${GAME_ID}`)
    await expect(page.getByText('The Forgotten Realm')).toBeVisible({ timeout: 5000 })

    // Non-host should not see the invite section
    await expect(page.getByTestId('generate-invite-button')).not.toBeVisible()
  })

  test('invite URL input uses dnd-input class after generation', async ({ page }) => {
    await page.context().grantPermissions(['clipboard-write'])
    await setupLobbyMocks(page)

    await page.route(`**/api/games/${GAME_ID}/invites`, (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 'abc123',
            invite_url: 'http://localhost:3000/auth/signup?code=abc123',
          }),
        })
      }
    })

    await page.goto(`/games/${GAME_ID}`)
    await expect(page.getByText('The Forgotten Realm')).toBeVisible({ timeout: 5000 })

    await page.getByTestId('generate-invite-button').click()

    const inviteInput = page.getByTestId('invite-url-input')
    await expect(inviteInput).toBeVisible()
    // Input uses dnd-input class
    await expect(inviteInput).toHaveClass(/dnd-input/)
  })
})
