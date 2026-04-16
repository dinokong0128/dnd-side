import { test, expect, Page } from '@playwright/test'

// ─── DIN-66: Streaming DM responses via Redis pub/sub (two endpoints) ─────────
//
// Verifies the end-to-end streaming behavior:
//  1. Empty streaming bubble (cursor) appears immediately after submit
//  2. Text chunks from SSE render progressively in the streaming bubble
//  3. dice_rolls blocks pop in as complete DiceRoller components, never as XML text
//  4. event / state_changes tags are consumed silently (never appear in chat)
//  5. Non-202 action response: bubble never opens, input re-enabled
// ─────────────────────────────────────────────────────────────────────────────

const GAME_ID = 'test-game-stream'
const USER_ID = 'user-1'

async function setupStreamMocks(page: Page) {
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
            name: 'The Streaming Keep',
            dm_persona: 'Grim Oracle',
            status: 'active',
            created_by: USER_ID,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
            suggested_actions: [],
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
            character_name: 'Mira',
            character_class: 'Rogue',
            race: 'Wood Elf',
            level: 2,
            hp_current: 18,
            hp_max: 20,
            stats: { str: 12, dex: 16, con: 12, int: 10, wis: 14, cha: 10 },
          },
        ]),
      })
    }
  })

  await page.route('**.supabase.co/rest/v1/player_inventory**', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    }
  })

  const initMsg = {
    id: 'msg-stream-init',
    game_id: GAME_ID,
    profile_id: null,
    role: 'dm',
    content: 'The keep looms before you.',
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
          body: JSON.stringify([
            { id: initMsg.id, role: 'dm', created_at: initMsg.created_at },
          ]),
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

function buildSseBody(events: object[]): string {
  return events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('')
}

/**
 * Mock the two-endpoint streaming flow:
 *   - POST /api/games/:id/actions → 202 JSON
 *   - GET  /api/games/:id/events  → SSE body with the given events
 * `eventsDelayMs` lets tests observe the empty cursor bubble before chunks arrive.
 */
async function mockStreamingFlow(
  page: Page,
  sseEvents: object[],
  options: { eventsDelayMs?: number } = {}
) {
  await page.route(`**/api/games/${GAME_ID}/actions`, async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({
          message_id: 'msg-1',
          game_id: GAME_ID,
          status: 'queued',
        }),
      })
    } else {
      await route.continue()
    }
  })

  await page.route(`**/api/games/${GAME_ID}/events`, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue()
      return
    }
    if (options.eventsDelayMs) {
      await new Promise((r) => setTimeout(r, options.eventsDelayMs))
    }
    await route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
      body: buildSseBody(sseEvents),
    })
  })
}

async function gotoGame(page: Page) {
  await page.goto(`/games/${GAME_ID}`)
  await expect(page.getByText('The Streaming Keep')).toBeVisible({ timeout: 5000 })
}

test.describe('DIN-66 — Streaming bubble appears immediately', () => {
  test('streaming bubble with cursor appears before SSE chunks arrive', async ({ page }) => {
    await setupStreamMocks(page)
    await mockStreamingFlow(
      page,
      [
        { type: 'chunk', text: 'The door creaks open.' },
        { type: 'done' },
      ],
      { eventsDelayMs: 400 }
    )

    await gotoGame(page)

    const textarea = page.getByTestId('chat-textarea')
    await textarea.fill('I push the door open.')
    await page.getByRole('button', { name: /Send/i }).click()

    await expect(page.getByTestId('streaming-dm-message')).toBeVisible({
      timeout: 2000,
    })
    await expect(page.getByTestId('streaming-cursor')).toBeVisible()
  })

  test('input is disabled while streaming is active', async ({ page }) => {
    await setupStreamMocks(page)
    await mockStreamingFlow(
      page,
      [
        { type: 'chunk', text: 'Shadows flicker.' },
        { type: 'done' },
      ],
      { eventsDelayMs: 400 }
    )

    await gotoGame(page)

    const textarea = page.getByTestId('chat-textarea')
    await textarea.fill('I look around cautiously.')
    await page.getByRole('button', { name: /Send/i }).click()

    await expect(textarea).toBeDisabled({ timeout: 1000 })
  })
})

test.describe('DIN-66 — Chunk events render progressively', () => {
  test('text chunks accumulate in the streaming bubble', async ({ page }) => {
    await setupStreamMocks(page)
    await mockStreamingFlow(page, [
      { type: 'chunk', text: 'The goblin ' },
      { type: 'chunk', text: 'lunges with a snarl.' },
      { type: 'done' },
    ])

    await gotoGame(page)

    await page.getByTestId('chat-textarea').fill('I prepare to parry.')
    await page.getByRole('button', { name: /Send/i }).click()

    const bubble = page.getByTestId('streaming-dm-message')
    await expect(bubble).toContainText('The goblin lunges with a snarl.', {
      timeout: 3000,
    })
  })
})

test.describe('DIN-66 — dice_rolls block renders as a complete component', () => {
  test('dice_rolls block pops in as DiceRoller, never as raw XML text', async ({ page }) => {
    await setupStreamMocks(page)
    const diceContent = JSON.stringify([
      {
        type: 'dice_roll',
        die: 'd20',
        count: 1,
        result: 15,
        modifier: 2,
        total: 17,
        label: 'Stealth',
      },
    ])

    await mockStreamingFlow(page, [
      { type: 'chunk', text: 'Rolling... ' },
      { type: 'block', tag: 'dice_rolls', attributes: {}, content: diceContent },
      { type: 'chunk', text: ' You sneak past.' },
      { type: 'done' },
    ])

    await gotoGame(page)

    await page.getByTestId('chat-textarea').fill('I sneak past.')
    await page.getByRole('button', { name: /Send/i }).click()

    const bubble = page.getByTestId('streaming-dm-message')
    await expect(bubble).toBeVisible({ timeout: 3000 })
    await expect(bubble).not.toContainText('<dice_rolls>')
    await expect(bubble).not.toContainText('</dice_rolls>')
    await expect(page.getByTestId('streaming-dice')).toBeVisible()
  })
})

test.describe('DIN-66 — event / state_changes tags consumed silently', () => {
  test('event tag text does not leak into the chat', async ({ page }) => {
    await setupStreamMocks(page)
    await mockStreamingFlow(page, [
      { type: 'chunk', text: 'Combat begins. ' },
      {
        type: 'block',
        tag: 'event',
        attributes: { type: 'combat' },
        content: 'Goblin slain',
      },
      { type: 'chunk', text: 'The party rests.' },
      { type: 'done' },
    ])

    await gotoGame(page)

    await page.getByTestId('chat-textarea').fill('I attack the goblin.')
    await page.getByRole('button', { name: /Send/i }).click()

    const bubble = page.getByTestId('streaming-dm-message')
    await expect(bubble).toContainText('Combat begins.', { timeout: 3000 })
    await expect(bubble).toContainText('The party rests.')
    await expect(bubble).not.toContainText('Goblin slain')
    await expect(bubble).not.toContainText('<event')
  })

  test('state_changes tag does not leak into the chat', async ({ page }) => {
    await setupStreamMocks(page)
    await mockStreamingFlow(page, [
      { type: 'chunk', text: 'The dragon bites. ' },
      {
        type: 'block',
        tag: 'state_changes',
        attributes: {},
        content: '{"hp_changes":[{"character_id":"p","delta":-8}]}',
      },
      { type: 'chunk', text: 'You gasp.' },
      { type: 'done' },
    ])

    await gotoGame(page)

    await page.getByTestId('chat-textarea').fill('I block.')
    await page.getByRole('button', { name: /Send/i }).click()

    const bubble = page.getByTestId('streaming-dm-message')
    await expect(bubble).toContainText('You gasp.', { timeout: 3000 })
    await expect(bubble).not.toContainText('hp_changes')
    await expect(bubble).not.toContainText('<state_changes>')
  })
})

test.describe('DIN-66 — non-ok response clears streaming state', () => {
  test('POST /actions failing keeps input enabled and no bubble opens', async ({
    page,
  }) => {
    await setupStreamMocks(page)
    await page.route(`**/api/games/${GAME_ID}/actions`, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Backend error' }),
        })
      } else {
        await route.continue()
      }
    })

    await gotoGame(page)

    const textarea = page.getByTestId('chat-textarea')
    await textarea.fill('I do the thing.')
    await page.getByRole('button', { name: /Send/i }).click()

    // Streaming bubble must not appear.
    await expect(page.getByTestId('streaming-dm-message')).toHaveCount(0, {
      timeout: 2000,
    })
    // Input re-enabled so the player can retry.
    await expect(textarea).toBeEnabled()
  })
})
