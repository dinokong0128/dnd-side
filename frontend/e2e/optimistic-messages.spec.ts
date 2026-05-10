import { test, expect, Page } from '@playwright/test'

// ─── DIN-64: Optimistic player messages + reconciliation ──────────────────────
//
// Three coordinated latency improvements land in this issue:
//  1. Optimistic player message — the player's text appears in the chat
//     bubble immediately on Send, before the 202 response arrives.
//  2. Reconciliation — when the real Supabase Realtime INSERT fires
//     (simulated here with a custom DOM event), the optimistic entry is
//     replaced by the canonical DB row, leaving exactly one copy in the log.
//  3. Error roll-back — if the actions API returns a non-2xx status *or*
//     the request fails outright, the optimistic bubble is removed and the
//     input is re-enabled so the player can try again.
//
// The E2E custom-event layer (NEXT_PUBLIC_E2E_TESTING) has been updated in
// this PR to mirror the Realtime INSERT reconciliation logic, so tests that
// dispatch 'player-message' events can assert on deduplication behaviour.
// ─────────────────────────────────────────────────────────────────────────────

const GAME_ID = 'test-game-optimistic'
const USER_ID = 'user-1'
const ACTION_TEXT = 'I search the ancient library for clues about the prophecy.'

// ─── Setup helper ─────────────────────────────────────────────────────────────

async function setupGameMocks(
  page: Page,
  options: { actionsDelay?: number; actionsStatus?: number } = {}
) {
  const { actionsDelay = 0, actionsStatus = 202 } = options

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
            name: 'The Arcane Vault',
            dm_persona: 'A scholarly Dungeon Master',
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
        body: JSON.stringify([
          {
            id: 'player-1',
            game_id: GAME_ID,
            profile_id: USER_ID,
            character_name: 'Lyra Brightmantle',
            character_class: 'Wizard',
            race: 'Half-Elf',
            level: 3,
            hp_current: 18,
            hp_max: 20,
          },
        ]),
      })
    }
  })

  // game_messages — start with a DM message so isWaitingForDm=false
  const initMsg = {
    id: 'msg-dm-init',
    game_id: GAME_ID,
    profile_id: null,
    role: 'dm',
    content: 'The library doors creak open before you.',
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

  // Actions endpoint — configurable delay and status
  await page.route(`**/api/games/${GAME_ID}/actions`, async (route) => {
    if (route.request().method() === 'POST') {
      if (actionsDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, actionsDelay))
      }
      if (actionsStatus === 202) {
        route.fulfill({
          status: 202,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'queued', message_id: 'msg-player-1' }),
        })
      } else {
        route.fulfill({
          status: actionsStatus,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' }),
        })
      }
    }
  })
}

async function gotoGame(page: Page) {
  await page.goto(`/games/${GAME_ID}`)
  await expect(page.getByText('The Arcane Vault')).toBeVisible({ timeout: 5000 })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('DIN-64 — Optimistic player messages', () => {
  test('optimistic message appears in chat immediately, before 202 response arrives', async ({
    page,
  }) => {
    // Delay the actions endpoint by 600ms — the optimistic message must be
    // visible while the request is still in-flight.
    await setupGameMocks(page, { actionsDelay: 600 })
    await gotoGame(page)

    const textarea = page.getByTestId('chat-textarea')
    await expect(textarea).toBeEnabled()

    await textarea.fill(ACTION_TEXT)
    await page.getByRole('button', { name: /Send/i }).click()

    // The optimistic message should be rendered synchronously (before the
    // delayed 202 comes back).  Use a tight timeout to confirm it was
    // immediate and not waiting for the round-trip.
    await expect(page.getByText(ACTION_TEXT)).toBeVisible({ timeout: 300 })

    // Input disabled while waiting
    await expect(textarea).toBeDisabled()

    // Wait for the delayed fetch to complete (give it a generous buffer)
    await expect(textarea).toBeDisabled({ timeout: 800 })
  })

  test('no duplicate message when Realtime player-message event fires after submit', async ({
    page,
  }) => {
    await setupGameMocks(page)
    await gotoGame(page)

    const textarea = page.getByTestId('chat-textarea')
    await textarea.fill(ACTION_TEXT)
    await page.getByRole('button', { name: /Send/i }).click()

    // Optimistic message appears
    await expect(page.getByText(ACTION_TEXT)).toBeVisible({ timeout: 3000 })

    // Read the id the client minted so Realtime can dedupe by the same id.
    // Use .last() — messages are sorted ascending by created_at, so the
    // optimistic player message (just added, newest timestamp) is always the
    // last [data-message-id] element in the DOM.  .first() would grab the
    // initial DM message's id, causing addMessage to replace the DM entry
    // instead of the optimistic one and leaving two copies in the log.
    const optimisticId = await page
      .locator('[data-message-id]')
      .last()
      .getAttribute('data-message-id')

    // Simulate Supabase Realtime INSERT for the same player message (real DB row)
    await page.evaluate(
      ({ gameId, userId, content, id }) => {
        window.dispatchEvent(
          new CustomEvent('player-message', {
            detail: {
              id,
              game_id: gameId,
              profile_id: userId,
              role: 'player',
              content,
              created_at: new Date().toISOString(),
            },
          })
        )
      },
      { gameId: GAME_ID, userId: USER_ID, content: ACTION_TEXT, id: optimisticId }
    )

    // Wait a tick for reconciliation to complete
    await page.waitForTimeout(150)

    // The optimistic entry is replaced by the real one — exactly ONE copy of
    // the action text must be visible in the chat log.
    const matches = page.getByText(ACTION_TEXT, { exact: true })
    await expect(matches).toHaveCount(1)
  })

  test('optimistic message is removed and input re-enabled on API error (non-2xx)', async ({
    page,
  }) => {
    // Small delay ensures the optimistic message is painted before the 500 arrives
    await setupGameMocks(page, { actionsStatus: 500, actionsDelay: 50 })
    await gotoGame(page)

    const textarea = page.getByTestId('chat-textarea')
    await textarea.fill(ACTION_TEXT)
    await page.getByRole('button', { name: /Send/i }).click()

    // Optimistic message briefly appears
    await expect(page.getByText(ACTION_TEXT)).toBeVisible({ timeout: 3000 })

    // After the 500 response, the optimistic bubble must disappear
    await expect(page.getByText(ACTION_TEXT)).not.toBeVisible({ timeout: 3000 })

    // Input must be re-enabled so the player can try again
    await expect(textarea).toBeEnabled({ timeout: 3000 })
  })

  test('optimistic message is removed and input re-enabled on network failure', async ({
    page,
  }) => {
    // Simulate a hard network failure (connection refused) with a delay so the
    // optimistic message is painted before the abort arrives.  50ms was too tight
    // under full-suite parallel load — 200ms gives React a full render cycle.
    await page.route(`**/api/games/${GAME_ID}/actions`, async (route) => {
      if (route.request().method() === 'POST') {
        await new Promise((resolve) => setTimeout(resolve, 200))
        route.abort('connectionrefused')
      }
    })

    // Still need the other mocks
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
              name: 'The Arcane Vault',
              dm_persona: 'DM',
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
              character_name: 'Lyra Brightmantle',
              character_class: 'Wizard',
              race: 'Half-Elf',
              level: 3,
              hp_current: 18,
              hp_max: 20,
            },
          ]),
        })
      }
    })
    await page.route('**.supabase.co/rest/v1/game_messages**', (route) => {
      if (route.request().method() === 'GET') {
        const url = route.request().url()
        if (url.includes('select=role')) {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([{ id: 'msg-1', role: 'dm', created_at: '2026-01-01T00:00:01Z' }]),
          })
        } else {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
              {
                id: 'msg-1',
                game_id: GAME_ID,
                profile_id: null,
                role: 'dm',
                content: 'The library doors creak open.',
                dice_rolls: null,
                created_at: '2026-01-01T00:00:01Z',
              },
            ]),
          })
        }
      }
    })

    await gotoGame(page)

    const textarea = page.getByTestId('chat-textarea')
    await textarea.fill(ACTION_TEXT)
    await page.getByRole('button', { name: /Send/i }).click()

    // Optimistic message briefly appears then is removed after the fetch throws
    await expect(page.getByText(ACTION_TEXT)).toBeVisible({ timeout: 3000 })
    await expect(page.getByText(ACTION_TEXT)).not.toBeVisible({ timeout: 5000 })

    // Input re-enabled
    await expect(textarea).toBeEnabled({ timeout: 3000 })
  })

  test('typing indicator appears while waiting for DM after optimistic submit', async ({
    page,
  }) => {
    await setupGameMocks(page)
    await gotoGame(page)

    const textarea = page.getByTestId('chat-textarea')
    await textarea.fill(ACTION_TEXT)
    await page.getByRole('button', { name: /Send/i }).click()

    // Optimistic message visible AND typing indicator active simultaneously
    await expect(page.getByText(ACTION_TEXT)).toBeVisible({ timeout: 3000 })
    await expect(page.getByText(/The Dungeon Master is writing/i)).toBeVisible({ timeout: 3000 })

    // When DM response arrives, typing indicator disappears and input re-enables
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('dm-message', {
          detail: {
            game_id: 'test-game-optimistic',
            role: 'dm',
            content: 'Shelves of ancient tomes line the walls, their spines gleaming with arcane sigils.',
            created_at: new Date().toISOString(),
          },
        })
      )
    })

    await expect(
      page.getByText(/Shelves of ancient tomes line the walls/)
    ).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(/The Dungeon Master is writing/i)).not.toBeVisible()
    await expect(textarea).toBeEnabled()
  })
})
