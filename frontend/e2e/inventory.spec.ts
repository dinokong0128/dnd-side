import { test, expect } from '@playwright/test'

const MOCK_GAME = {
  id: 'game-123',
  name: 'Dragon Quest',
  dm_persona: 'A classic high-fantasy D&D adventure.',
  status: 'lobby',
  created_by: 'user-1',
  created_at: '2026-04-05T00:00:00Z',
}

const MOCK_PLAYER = {
  id: 'player-1',
  game_id: 'game-123',
  profile_id: 'user-1',
  character_name: 'Thorin',
  character_class: 'Fighter',
  hp_current: 12,
  hp_max: 12,
  stats: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 8 },
  status: 'active',
  joined_at: '2026-04-05T00:00:00Z',
}

const MOCK_INVENTORY_FIGHTER = [
  { id: 'inv-1', item_name: 'Chain Mail', quantity: 1, properties: null, created_at: '2026-04-05T00:00:00Z' },
  { id: 'inv-2', item_name: "Explorer's Pack", quantity: 1, properties: null, created_at: '2026-04-05T00:00:00Z' },
  { id: 'inv-3', item_name: 'Handaxe', quantity: 5, properties: null, created_at: '2026-04-05T00:00:00Z' },
  { id: 'inv-4', item_name: 'Longsword', quantity: 1, properties: null, created_at: '2026-04-05T00:00:00Z' },
  { id: 'inv-5', item_name: 'Shield', quantity: 1, properties: null, created_at: '2026-04-05T00:00:00Z' },
]

function setupAuthMocks(page: import('@playwright/test').Page) {
  return Promise.all([
    page.route('**/auth/v1/user', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'user-1',
          email: 'player@example.com',
        }),
      })
    }),
    page.route('**/auth/v1/token?grant_type=refresh_token', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-token',
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: 'mock-refresh',
          user: { id: 'user-1', email: 'player@example.com' },
        }),
      })
    }),
  ])
}

test.describe('Inventory display', () => {
  test('no character — no inventory panel visible', async ({ page }) => {
    await setupAuthMocks(page)

    await page.route('**/rest/v1/games*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_GAME),
      })
    })

    await page.route('**/rest/v1/players*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(null),
      })
    })

    await page.route('**/rest/v1/player_inventory*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    await page.goto('/games/game-123')

    // Character panel should be visible but inventory should not
    await expect(page.getByText('Your Character')).toBeVisible()
    await expect(page.getByTestId('inventory-panel')).not.toBeVisible()
  })

  test('character exists with inventory — items displayed', async ({ page }) => {
    await setupAuthMocks(page)

    await page.route('**/rest/v1/games*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_GAME),
      })
    })

    await page.route('**/rest/v1/players*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_PLAYER),
      })
    })

    await page.route('**/rest/v1/player_inventory*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_INVENTORY_FIGHTER),
      })
    })

    await page.goto('/games/game-123')

    // Inventory panel should be visible
    await expect(page.getByTestId('inventory-panel')).toBeVisible()
    await expect(page.getByText(/Starting Equipment/)).toBeVisible()

    // All items should be rendered
    const items = page.getByTestId('inventory-item')
    await expect(items).toHaveCount(5)

    // Verify specific items
    await expect(page.getByText('Longsword')).toBeVisible()
    await expect(page.getByText('Chain Mail')).toBeVisible()
    await expect(page.getByText('×5')).toBeVisible()

    // Item count badge
    await expect(page.getByTestId('inventory-count')).toHaveText('5 items')
  })

  test('character exists but empty inventory — empty state', async ({ page }) => {
    await setupAuthMocks(page)

    await page.route('**/rest/v1/games*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_GAME),
      })
    })

    await page.route('**/rest/v1/players*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_PLAYER),
      })
    })

    await page.route('**/rest/v1/player_inventory*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    await page.goto('/games/game-123')

    // Inventory panel should be visible with empty state
    await expect(page.getByTestId('inventory-panel')).toBeVisible()
    await expect(page.getByTestId('inventory-empty')).toBeVisible()
    await expect(page.getByText(/No items yet/)).toBeVisible()
  })
})
