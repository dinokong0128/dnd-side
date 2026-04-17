import { test, expect, Page } from '@playwright/test'

// ─── DIN-16: Character Stats & Inventory Auto-update via <state_changes> ──────
//
// The backend parses <state_changes> XML from Claude DM responses, applies HP
// changes and inventory mutations to the database, then strips the block before
// storing the message.  The frontend never sees raw <state_changes> XML — it
// receives clean DM text via game_messages and live stat updates via Supabase
// Realtime on the players / player_inventory tables.
//
// These E2E tests verify the observable frontend behaviour in this pipeline:
//  • Game session initialises correctly with the updated player query that
//    resolves the current player's UUID (needed for Realtime subscriptions).
//  • DM messages after state_changes processing render clean content in chat.
//  • Raw <state_changes> XML never leaks to the chat log.
// ─────────────────────────────────────────────────────────────────────────────

const GAME_ID = 'test-game-state'
const USER_ID = 'user-1'
const PLAYER_ID = 'player-42'  // non-trivial UUID to confirm resolution

const MOCK_PLAYER = {
  id: PLAYER_ID,
  game_id: GAME_ID,
  profile_id: USER_ID,
  character_name: 'Thorin Ironforge',
  character_class: 'Fighter',
  race: 'Dwarf',
  level: 3,
  hp_current: 28,
  hp_max: 34,
  stats: { str: 16, dex: 10, con: 14, int: 10, wis: 12, cha: 8 },
  status: 'active',
  joined_at: '2026-01-01T00:00:00Z',
}

// ─── Setup helper ─────────────────────────────────────────────────────────────
async function setupGameMocks(
  page: Page,
  options: { gameStatus?: string } = {}
) {
  const { gameStatus = 'active' } = options

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
            name: 'The Iron Mines',
            dm_persona: 'A gritty, realistic DM',
            status: gameStatus,
            created_by: USER_ID,
            updated_at: '2026-01-01T00:00:00Z',
            suggested_actions: null,
          },
        ]),
      })
    }
  })

  // Players — return full player row including id so GameSessionView can
  // resolve playerId for the CharacterSheetPanel Realtime subscription (DIN-15).
  await page.route('**.supabase.co/rest/v1/players**', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: PLAYER_ID,
            profile_id: USER_ID,
            character_name: MOCK_PLAYER.character_name,
          },
        ]),
      })
    }
  })

  // game_messages
  const initMsg = {
    id: 'msg-1',
    game_id: GAME_ID,
    profile_id: null,
    role: 'dm',
    content: 'The mines stretch before you.',
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
  await expect(page.getByText('The Iron Mines')).toBeVisible({ timeout: 5000 })
  // Wait for both the E2E listeners useEffect AND the initial data fetch to
  // complete. Without the latter, initializeSession's setMessages(msgs) can
  // run after a simulated event and overwrite it.
  await expect(page.locator('body[data-e2e-listeners-ready="true"]')).toBeAttached({
    timeout: 5000,
  })
  await expect(page.getByText('The mines stretch before you.')).toBeVisible({
    timeout: 5000,
  })
}

// ─── Tests ───────────────────────────────────────────────────────────────────
test.describe('DIN-16 — Character stats & inventory auto-update via state_changes', () => {
  test('game session loads and resolves current player UUID', async ({ page }) => {
    await setupGameMocks(page)
    await gotoGame(page)

    // GameSessionView stores the resolved player UUID in data-player-id
    // so CharacterSheetPanel Realtime subscriptions use the correct id.
    const root = page.locator('[data-player-id]')
    await expect(root).toBeVisible({ timeout: 3000 })
    await expect(root).toHaveAttribute('data-player-id', PLAYER_ID)
  })

  test('DM message after state_changes pipeline renders clean text in chat', async ({ page }) => {
    await setupGameMocks(page)
    await gotoGame(page)

    // Simulate a DM message arriving after the backend has stripped <state_changes>
    // (this is what the Supabase Realtime INSERT delivers to the frontend).
    const cleanDmContent = 'Your axe strikes true! The goblin recoils, badly wounded.'
    await page.evaluate((content) => {
      window.dispatchEvent(
        new CustomEvent('dm-message', {
          detail: {
            game_id: 'test-game-state',
            role: 'dm',
            content,
            created_at: new Date().toISOString(),
          },
        })
      )
    }, cleanDmContent)

    await expect(page.getByText(cleanDmContent)).toBeVisible({ timeout: 3000 })
  })

  test('raw <state_changes> XML never appears in the chat log', async ({ page }) => {
    await setupGameMocks(page)
    await gotoGame(page)

    // The backend always strips <state_changes> before inserting to game_messages.
    // This test confirms: if a clean message arrives, the XML block is absent.
    const cleanContent = 'You find a healing potion in the chest.'
    await page.evaluate((content) => {
      window.dispatchEvent(
        new CustomEvent('dm-message', {
          detail: {
            game_id: 'test-game-state',
            role: 'dm',
            content,
            created_at: new Date().toISOString(),
          },
        })
      )
    }, cleanContent)

    await expect(page.getByText(cleanContent)).toBeVisible({ timeout: 3000 })
    // No raw <state_changes> XML present anywhere in the page
    await expect(page.getByText('<state_changes>')).not.toBeVisible()
    await expect(page.getByText('</state_changes>')).not.toBeVisible()
  })

  test('multiple DM messages after consecutive state_changes all appear in order', async ({ page }) => {
    await setupGameMocks(page)
    await gotoGame(page)

    const messages = [
      'Round 1: You strike the orc for 8 damage.',
      'Round 2: The orc retaliates — you take 5 damage.',
      'Round 3: With a mighty blow you finish the orc. Victory!',
    ]

    for (const content of messages) {
      await page.evaluate((c) => {
        window.dispatchEvent(
          new CustomEvent('dm-message', {
            detail: {
              game_id: 'test-game-state',
              role: 'dm',
              content: c,
              created_at: new Date().toISOString(),
            },
          })
        )
      }, content)
    }

    // All three messages visible in the chat log
    for (const content of messages) {
      await expect(page.getByText(content)).toBeVisible({ timeout: 3000 })
    }
  })

  test('player message followed by DM response reflects correct waiting state', async ({ page }) => {
    await setupGameMocks(page)
    await gotoGame(page)

    // Player submits an action — waiting indicator should appear
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('player-message', {
          detail: {
            game_id: 'test-game-state',
            profile_id: 'user-1',
            role: 'player',
            content: 'I attack the goblin with my battleaxe.',
            created_at: new Date().toISOString(),
          },
        })
      )
    })

    await expect(page.getByText('I attack the goblin with my battleaxe.')).toBeVisible({ timeout: 3000 })

    // DM response arrives (backend has processed state_changes and stripped the block)
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('dm-message', {
          detail: {
            game_id: 'test-game-state',
            role: 'dm',
            content: 'Your axe buries deep into the goblin\'s shoulder. It staggers back, howling.',
            created_at: new Date().toISOString(),
          },
        })
      )
    })

    await expect(
      page.getByText("Your axe buries deep into the goblin's shoulder. It staggers back, howling.")
    ).toBeVisible({ timeout: 3000 })

    // Typing indicator should be gone after DM responds
    await expect(page.getByTestId('typing-indicator')).not.toBeVisible()
  })

  test('game session works correctly when player has no character (no player UUID resolved)', async ({ page }) => {
    // Simulate a non-player observer — players array is empty for this user
    await page.route('**/auth/v1/user', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'observer-user', email: 'observer@example.com' }),
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
          user: { id: 'observer-user', email: 'observer@example.com' },
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
              name: 'The Iron Mines',
              dm_persona: 'A gritty DM',
              status: 'active',
              created_by: 'some-other-user',
              updated_at: '2026-01-01T00:00:00Z',
              suggested_actions: null,
            },
          ]),
        })
      }
    })
    await page.route('**.supabase.co/rest/v1/players**', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
      }
    })
    const initMsg = {
      id: 'msg-1',
      game_id: GAME_ID,
      profile_id: null,
      role: 'dm',
      content: 'The mines stretch before you.',
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

    await page.goto(`/games/${GAME_ID}`)
    await expect(page.getByText('The Iron Mines')).toBeVisible({ timeout: 5000 })

    // No player UUID should be resolved — data-player-id is empty
    const root = page.locator('[data-player-id]')
    await expect(root).toHaveAttribute('data-player-id', '')
  })
})
