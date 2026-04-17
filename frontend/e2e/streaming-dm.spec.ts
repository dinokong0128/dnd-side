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

test.describe('DIN-66 — SSE/Realtime race conditions', () => {
  test('SSE done with no Realtime — streamed text stays visible as best-effort', async ({
    page,
  }) => {
    await setupStreamMocks(page)
    const streamedText = 'The forest path winds deeper into shadow.'

    await mockStreamingFlow(page, [
      { type: 'chunk', text: streamedText },
      { type: 'done' },
    ])

    await gotoGame(page)

    await page.getByTestId('chat-textarea').fill('I follow the path.')
    await page.getByRole('button', { name: /Send/i }).click()

    // After SSE `done`: isWaitingForDm cleared → input re-enabled
    await expect(page.getByTestId('chat-textarea')).toBeEnabled({ timeout: 3000 })

    // streamingSegments NOT cleared by SSE done — content persists as best-effort
    await expect(page.getByText(streamedText)).toBeVisible()
  })

  test('Realtime INSERT before SSE done — streaming bubble clears on Realtime arrival', async ({
    page,
  }) => {
    await setupStreamMocks(page)
    const confirmedText = 'The drawbridge lowers with a thunderous crash.'

    // SSE is delayed — Realtime fires in the window before SSE resolves.
    // No chunks so no re-render after Realtime clears streamingSegments.
    await mockStreamingFlow(page, [{ type: 'done' }], { eventsDelayMs: 1500 })

    await gotoGame(page)
    // Ensure event listeners are attached before dispatching custom events
    await expect(page.locator('body[data-e2e-listeners-ready="true"]')).toBeAttached({
      timeout: 5000,
    })

    await page.getByTestId('chat-textarea').fill('I lower the drawbridge.')
    await page.getByRole('button', { name: /Send/i }).click()

    // Empty streaming bubble (cursor) appears after POST 202, before SSE resolves
    await expect(page.getByTestId('streaming-dm-message')).toBeVisible({ timeout: 2000 })

    // Realtime fires while SSE is still in-flight
    await page.evaluate(
      ({ gameId, content }) => {
        window.dispatchEvent(
          new CustomEvent('dm-message', {
            detail: {
              id: 'msg-dm-early-realtime',
              game_id: gameId,
              profile_id: null,
              role: 'dm',
              content,
              created_at: new Date().toISOString(),
            },
          })
        )
      },
      { gameId: GAME_ID, content: confirmedText }
    )

    // Streaming bubble clears immediately on Realtime arrival (setStreamingSegments(null))
    await expect(page.getByTestId('streaming-dm-message')).toHaveCount(0, { timeout: 2000 })

    // Confirmed persisted message is visible
    await expect(page.getByText(confirmedText)).toBeVisible()

    // Input re-enabled (Realtime handler sets isWaitingForDm(false))
    await expect(page.getByTestId('chat-textarea')).toBeEnabled()
  })

  test('SSE done before Realtime (consistent content) — single message, no duplicate', async ({
    page,
  }) => {
    await setupStreamMocks(page)
    const text = 'You find a locked chest hidden beneath the staircase.'

    await mockStreamingFlow(page, [{ type: 'chunk', text }, { type: 'done' }])

    await gotoGame(page)
    await expect(page.locator('body[data-e2e-listeners-ready="true"]')).toBeAttached({
      timeout: 5000,
    })

    await page.getByTestId('chat-textarea').fill('I search the room.')
    await page.getByRole('button', { name: /Send/i }).click()

    // After SSE done: input re-enabled, streamed text still visible in bubble
    await expect(page.getByTestId('chat-textarea')).toBeEnabled({ timeout: 3000 })
    const bubble = page.getByTestId('streaming-dm-message')
    await expect(bubble).toContainText(text)

    // Realtime fires with identical content (consistent — backend persisted same text)
    await page.evaluate(
      ({ gameId, content }) => {
        window.dispatchEvent(
          new CustomEvent('dm-message', {
            detail: {
              id: 'msg-dm-consistent-rt',
              game_id: gameId,
              profile_id: null,
              role: 'dm',
              content,
              created_at: new Date().toISOString(),
            },
          })
        )
      },
      { gameId: GAME_ID, content: text }
    )

    // Streaming bubble clears (setStreamingSegments(null))
    await expect(bubble).toHaveCount(0, { timeout: 2000 })

    // Confirmed message appears exactly once — no duplication
    await expect(page.getByText(text)).toHaveCount(1, { timeout: 2000 })
  })
})

test.describe('DIN-66 × DIN-25 — outcome badge in streaming bubble', () => {
  test('d20 dice block with dc + success renders streaming-outcome-badge', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await setupStreamMocks(page)

    const diceContent = JSON.stringify([
      {
        type: 'dice_roll',
        die: 'd20',
        count: 1,
        result: 16,
        modifier: 3,
        total: 19,
        label: 'Arcana Check',
        dc: 14,
        success: true,
      },
    ])

    await mockStreamingFlow(page, [
      { type: 'chunk', text: 'You sense the wards on the vault. ' },
      { type: 'block', tag: 'dice_rolls', attributes: {}, content: diceContent },
      { type: 'chunk', text: ' The magic yields its secrets.' },
      { type: 'done' },
    ])

    await gotoGame(page)

    await page.getByTestId('chat-textarea').fill('I examine the vault runes.')
    await page.getByRole('button', { name: /Send/i }).click()

    const bubble = page.getByTestId('streaming-dm-message')
    await expect(bubble).toBeVisible({ timeout: 3000 })

    // Dice component renders in the bubble
    await expect(page.getByTestId('streaming-dice')).toBeVisible()

    // Outcome badge appears (success, dc=14)
    const badge = page.getByTestId('streaming-outcome-badge')
    await expect(badge).toBeVisible({ timeout: 3000 })
    await expect(badge).toContainText('Success')
    await expect(badge).toContainText('14')
  })

  test('natural 20 in streaming bubble shows Critical Success badge', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await setupStreamMocks(page)

    const diceContent = JSON.stringify([
      {
        type: 'dice_roll',
        die: 'd20',
        count: 1,
        result: 20,
        modifier: 2,
        total: 22,
        label: 'Persuasion Check',
        dc: 10,
        success: true,
      },
    ])

    await mockStreamingFlow(page, [
      { type: 'block', tag: 'dice_rolls', attributes: {}, content: diceContent },
      { type: 'chunk', text: 'The guard steps aside.' },
      { type: 'done' },
    ])

    await gotoGame(page)

    await page.getByTestId('chat-textarea').fill('I persuade the guard.')
    await page.getByRole('button', { name: /Send/i }).click()

    await expect(page.getByTestId('streaming-dice')).toBeVisible({ timeout: 3000 })
    await expect(page.getByTestId('streaming-outcome-badge')).toContainText(
      '💥 Critical Success',
      { timeout: 3000 }
    )
  })

  test('no streaming-outcome-badge for a d20 roll without dc', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await setupStreamMocks(page)

    const diceContent = JSON.stringify([
      {
        type: 'dice_roll',
        die: 'd20',
        count: 1,
        result: 11,
        modifier: 2,
        total: 13,
        label: 'Initiative',
      },
    ])

    await mockStreamingFlow(page, [
      { type: 'block', tag: 'dice_rolls', attributes: {}, content: diceContent },
      { type: 'chunk', text: 'Combat begins.' },
      { type: 'done' },
    ])

    await gotoGame(page)

    await page.getByTestId('chat-textarea').fill('I ready my weapon.')
    await page.getByRole('button', { name: /Send/i }).click()

    await expect(page.getByTestId('streaming-dice')).toBeVisible({ timeout: 3000 })
    // No dc field → no outcome badge
    await expect(page.getByTestId('streaming-outcome-badge')).toHaveCount(0)
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

test.describe('DIN-66 — suggested_actions tag not visible in streaming bubble', () => {
  test('suggested_actions block content never appears in the chat bubble', async ({ page }) => {
    await setupStreamMocks(page)
    const suggestionContent =
      'Charge the goblin with your sword.\nShout for backup.\nSneak past and run.'

    await mockStreamingFlow(page, [
      { type: 'chunk', text: 'The goblin blocks the path. ' },
      {
        type: 'block',
        tag: 'suggested_actions',
        attributes: {},
        content: suggestionContent,
      },
      { type: 'chunk', text: 'Decide quickly.' },
      { type: 'done' },
    ])

    await gotoGame(page)

    await page.getByTestId('chat-textarea').fill('I face the goblin.')
    await page.getByRole('button', { name: /Send/i }).click()

    const bubble = page.getByTestId('streaming-dm-message')
    await expect(bubble).toContainText('The goblin blocks the path.', { timeout: 3000 })
    await expect(bubble).toContainText('Decide quickly.')
    await expect(bubble).not.toContainText('Charge the goblin')
    await expect(bubble).not.toContainText('Shout for backup')
    await expect(bubble).not.toContainText('<suggested_actions>')
  })
})

test.describe('DIN-66 — suggested_actions block enables cycle UI after reconciliation', () => {
  test('cycle button activates with new suggestions once Realtime DM INSERT fires', async ({
    page,
  }) => {
    await setupStreamMocks(page)
    const suggestions = [
      'Draw your sword and charge.',
      'Call out to the figure in the shadows.',
      'Duck behind the crates for cover.',
    ]

    await mockStreamingFlow(page, [
      { type: 'chunk', text: 'A cloaked figure emerges. ' },
      {
        type: 'block',
        tag: 'suggested_actions',
        attributes: {},
        content: suggestions.join('\n'),
      },
      { type: 'done' },
    ])

    await gotoGame(page)

    const cycleBtn = page.getByTestId('cycle-suggestion-btn')
    // Starts disabled — game has no suggested_actions initially
    await expect(cycleBtn).toBeDisabled()

    await page.getByTestId('chat-textarea').fill('I peer into the shadows.')
    await page.getByRole('button', { name: /Send/i }).click()

    // Simulate Realtime DM INSERT — triggers reconciliation. (Note: after
    // DIN-66 fix 525eee7, the SSE `done` event already clears isWaitingForDm
    // before Realtime arrives, so the cycle button may already be enabled
    // at this point. The meaningful assertion is that it remains enabled and
    // the streamed suggestions are usable after reconciliation.)
    await page.evaluate(
      ({ gameId }) => {
        window.dispatchEvent(
          new CustomEvent('dm-message', {
            detail: {
              id: 'msg-dm-suggest',
              game_id: gameId,
              profile_id: null,
              role: 'dm',
              content: 'A cloaked figure emerges.',
              created_at: new Date().toISOString(),
            },
          })
        )
      },
      { gameId: GAME_ID }
    )

    // After reconciliation isWaitingForDm=false → cycle button enabled with streamed suggestions
    await expect(cycleBtn).toBeEnabled({ timeout: 3000 })

    // Clicking populates the textarea with the first suggestion
    await cycleBtn.click()
    await expect(page.getByTestId('chat-textarea')).toHaveValue(suggestions[0])
  })
})

test.describe('DIN-66 — Realtime reconciliation: no duplicate, no flash', () => {
  test('confirmed DM INSERT clears streaming bubble and renders single message', async ({
    page,
  }) => {
    await setupStreamMocks(page)
    const streamedText = 'The orc raises his axe.'
    const confirmedText = 'The orc raises his axe and bellows a war cry.'

    await mockStreamingFlow(page, [
      { type: 'chunk', text: streamedText },
      { type: 'done' },
    ])

    await gotoGame(page)

    await page.getByTestId('chat-textarea').fill('I stand my ground.')
    await page.getByRole('button', { name: /Send/i }).click()

    // Streaming bubble visible with the streamed text while waiting for Realtime
    const streamBubble = page.getByTestId('streaming-dm-message')
    await expect(streamBubble).toBeVisible({ timeout: 3000 })
    await expect(streamBubble).toContainText(streamedText)

    // Simulate Realtime DM INSERT — backend persisted the clean version
    await page.evaluate(
      ({ gameId, content }) => {
        window.dispatchEvent(
          new CustomEvent('dm-message', {
            detail: {
              id: 'msg-dm-confirmed',
              game_id: gameId,
              profile_id: null,
              role: 'dm',
              content,
              created_at: new Date().toISOString(),
            },
          })
        )
      },
      { gameId: GAME_ID, content: confirmedText }
    )

    // Streaming bubble disappears — swapped for confirmed DB message
    await expect(streamBubble).toHaveCount(0, { timeout: 3000 })

    // Confirmed message appears exactly once (no duplicate)
    await expect(page.getByText(confirmedText)).toBeVisible({ timeout: 3000 })
    await expect(page.getByText(confirmedText)).toHaveCount(1)

    // Input re-enabled after reconciliation
    await expect(page.getByTestId('chat-textarea')).toBeEnabled()
  })
})

test.describe('DIN-66 — GET /events non-200 clears streaming state', () => {
  test('events endpoint error clears bubble; system message re-enables input', async ({
    page,
  }) => {
    await setupStreamMocks(page)

    await page.route(`**/api/games/${GAME_ID}/actions`, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 202,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'queued', message_id: 'msg-1' }),
        })
      } else {
        await route.continue()
      }
    })

    await page.route(`**/api/games/${GAME_ID}/events`, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Stream unavailable' }),
        })
      } else {
        await route.continue()
      }
    })

    await gotoGame(page)

    const textarea = page.getByTestId('chat-textarea')
    await textarea.fill('I cast fireball.')
    await page.getByRole('button', { name: /Send/i }).click()

    // Bubble must clear after the events endpoint error
    await expect(page.getByTestId('streaming-dm-message')).toHaveCount(0, {
      timeout: 3000,
    })

    // isWaitingForDm stays true — input remains disabled until backend signal
    await expect(textarea).toBeDisabled()

    // Simulate backend inserting a system error message via Supabase Realtime
    await page.evaluate(
      ({ gameId }) => {
        window.dispatchEvent(
          new CustomEvent('system-message', {
            detail: {
              id: 'msg-system-err',
              game_id: gameId,
              profile_id: null,
              role: 'system',
              content:
                'The Dungeon Master encountered an error. Please try your action again.',
              created_at: new Date().toISOString(),
            },
          })
        )
      },
      { gameId: GAME_ID }
    )

    // Error message visible in chat log
    await expect(
      page.getByText(/The Dungeon Master encountered an error/i)
    ).toBeVisible({ timeout: 3000 })

    // Input re-enabled after system message arrives
    await expect(textarea).toBeEnabled({ timeout: 3000 })
  })
})
