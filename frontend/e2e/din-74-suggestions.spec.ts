import { test, expect, Page } from '@playwright/test'

// ─── DIN-74: Tailored suggestions + textarea fix ──────────────────────────────
//
// E2E coverage for three sub-features shipped in DIN-74:
//
// Part B — Tailored vs. generic suggested actions
//   The `games.suggested_actions` column is now a jsonb
//   `SuggestedActionsBundle` shape:
//     { acting_player_id: string|null, tailored: string[], generic: string[] }
//   Acting player sees `tailored`; everyone else sees `generic`.
//
// Part C — Textarea UX fix
//   • ✨ cycle now triggers a `requestAnimationFrame` resize so long
//     suggestions actually expand the textarea (previously stuck at 40 px).
//   • maxHeight bumped from 96 px → 180 px.
//   • "Edit or send as-is" hint appended to the status line.
//   • Dual SSE blocks (`character_id` attr = tailored, `generic="true"` = generic).
//   • Realtime `game-update` event updates the bundle.
// ─────────────────────────────────────────────────────────────────────────────

const GAME_ID = 'test-game-din74'
const USER_ID = 'user-1'
const PLAYER_ID = 'player-1'

interface SuggestedActionsBundle {
  acting_player_id: string | null
  tailored: string[]
  generic: string[]
}

// Long 20-30 word first-person suggestion to exercise the resize path
const LONG_TAILORED_1 =
  '"I lower my sword slowly," I say, keeping my eyes fixed on the figure. "Tell me what you want, and I will listen."'
const LONG_TAILORED_2 =
  '"My magic senses something hidden here," I murmur, spreading my fingers wide and letting arcane light trace the walls for a concealed door.'
const GENERIC_1 = 'Wait and observe the others.'
const GENERIC_2 = 'Speak up with your own plan.'

// ─── Setup helper ─────────────────────────────────────────────────────────────
async function setupMocks(
  page: Page,
  options: {
    suggestedActions?: SuggestedActionsBundle | null
    playerProfileId?: string
    playerId?: string
  } = {}
) {
  const {
    suggestedActions = null,
    playerProfileId = USER_ID,
    playerId = PLAYER_ID,
  } = options

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
            name: 'The Continuity Keep',
            dm_persona: 'A theatrical DM',
            status: 'active',
            created_by: USER_ID,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
            suggested_actions: suggestedActions,
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
            id: playerId,
            game_id: GAME_ID,
            profile_id: playerProfileId,
            character_name: 'Aldric',
            character_class: 'Wizard',
            race: 'High Elf',
            level: 4,
            hp_current: 26,
            hp_max: 26,
            stats: { str: 10, dex: 14, con: 12, int: 18, wis: 14, cha: 12 },
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
    id: 'msg-init',
    game_id: GAME_ID,
    profile_id: null,
    role: 'dm',
    content: 'The keep looms before you, torchlight flickering.',
    scene_type: 'dungeon',
    scene_mood: 'tense',
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
  await expect(page.getByText('The Continuity Keep')).toBeVisible({ timeout: 8000 })
}

function buildSseBody(events: object[]): string {
  return events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('')
}

// ─── Part B: Tailored vs Generic suggestion routing ───────────────────────────

test.describe('DIN-74 — Acting player sees tailored suggestions', () => {
  test('✨ cycle shows tailored first-person suggestions when current player is the acting player', async ({
    page,
  }) => {
    const bundle: SuggestedActionsBundle = {
      acting_player_id: PLAYER_ID, // matches player-1 whose profile_id = USER_ID
      tailored: [LONG_TAILORED_1, LONG_TAILORED_2],
      generic: [GENERIC_1, GENERIC_2],
    }

    await setupMocks(page, { suggestedActions: bundle })
    await gotoGame(page)

    const cycleBtn = page.getByTestId('cycle-suggestion-btn')
    await expect(cycleBtn).toBeEnabled({ timeout: 5000 })

    const textarea = page.getByTestId('chat-textarea')

    // First click: should load the first tailored suggestion, not a generic one
    await cycleBtn.click()
    await expect(textarea).toHaveValue(LONG_TAILORED_1)

    // Second click: cycles to the second tailored suggestion
    await cycleBtn.click()
    await expect(textarea).toHaveValue(LONG_TAILORED_2)

    // Third click: wraps back to first tailored suggestion
    await cycleBtn.click()
    await expect(textarea).toHaveValue(LONG_TAILORED_1)

    // Generic suggestions must NOT appear
    await expect(textarea).not.toHaveValue(GENERIC_1)
  })
})

test.describe('DIN-74 — Non-acting player sees generic suggestions', () => {
  test('✨ cycle shows generic suggestions when current player is not the acting player', async ({
    page,
  }) => {
    const bundle: SuggestedActionsBundle = {
      acting_player_id: 'player-other', // different player is acting
      tailored: [LONG_TAILORED_1],
      generic: [GENERIC_1, GENERIC_2],
    }

    await setupMocks(page, { suggestedActions: bundle })
    await gotoGame(page)

    const cycleBtn = page.getByTestId('cycle-suggestion-btn')
    await expect(cycleBtn).toBeEnabled({ timeout: 5000 })

    const textarea = page.getByTestId('chat-textarea')

    // Should see generic, not tailored
    await cycleBtn.click()
    await expect(textarea).toHaveValue(GENERIC_1)

    await cycleBtn.click()
    await expect(textarea).toHaveValue(GENERIC_2)

    // Tailored suggestion must NOT appear
    await expect(textarea).not.toHaveValue(LONG_TAILORED_1)
  })
})

test.describe('DIN-74 — Empty bundle disables ✨ button', () => {
  test('✨ button is disabled when suggested_actions is null', async ({ page }) => {
    await setupMocks(page, { suggestedActions: null })
    await gotoGame(page)

    await expect(page.getByTestId('cycle-suggestion-btn')).toBeDisabled({ timeout: 5000 })
  })

  test('✨ button is disabled when bundle has no visible suggestions for current player', async ({
    page,
  }) => {
    // Non-acting player, empty generic list
    const bundle: SuggestedActionsBundle = {
      acting_player_id: 'player-other',
      tailored: [LONG_TAILORED_1],
      generic: [], // nothing for this player
    }

    await setupMocks(page, { suggestedActions: bundle })
    await gotoGame(page)

    await expect(page.getByTestId('cycle-suggestion-btn')).toBeDisabled({ timeout: 5000 })
  })
})

// ─── Part C: Textarea resize on cycle ────────────────────────────────────────

test.describe('DIN-74 — Textarea auto-grows when long suggestion is cycled in', () => {
  test('textarea style.height is set after ✨ cycles in a suggestion (resize ran)', async ({
    page,
  }) => {
    // Use a multi-line suggestion (~285 chars, guaranteed 3+ wrapped lines in any viewport)
    const multiLineTailored =
      '"I must approach this with caution," I say, my voice low as I study the runes etched into the stone doorframe. ' +
      'The arcane symbols pulse faintly in rhythm with my heartbeat. ' +
      '"Whatever was sealed behind this door was sealed for a reason — I intend to find out why before we proceed."'

    const bundle: SuggestedActionsBundle = {
      acting_player_id: PLAYER_ID,
      tailored: [multiLineTailored],
      generic: [],
    }

    await setupMocks(page, { suggestedActions: bundle })
    await gotoGame(page)

    const textarea = page.getByTestId('chat-textarea')
    await expect(textarea).toBeEnabled({ timeout: 5000 })

    // Baseline: no inline height style before cycling
    const styleBefore = await textarea.evaluate(
      (el: HTMLTextAreaElement) => el.style.height
    )
    expect(styleBefore).toBe('')

    const cycleBtn = page.getByTestId('cycle-suggestion-btn')
    await expect(cycleBtn).toBeEnabled({ timeout: 5000 })
    await cycleBtn.click()

    // Wait for requestAnimationFrame resize to settle
    await page.waitForTimeout(100)

    // After cycle, resizeTextarea() must have set style.height to a px value
    const styleAfter = await textarea.evaluate(
      (el: HTMLTextAreaElement) => el.style.height
    )
    expect(styleAfter).toMatch(/^\d+px$/)

    // And the rendered height must exceed the initial single-line minimum
    const offsetAfter = await textarea.evaluate(
      (el: HTMLTextAreaElement) => el.offsetHeight
    )
    expect(offsetAfter).toBeGreaterThan(45)
  })

  test('textarea height never exceeds 180 px even for very long content', async ({
    page,
  }) => {
    const veryLongSuggestion = Array(20).fill('A very long action description.').join(' ')
    const bundle: SuggestedActionsBundle = {
      acting_player_id: PLAYER_ID,
      tailored: [veryLongSuggestion],
      generic: [],
    }

    await setupMocks(page, { suggestedActions: bundle })
    await gotoGame(page)

    const textarea = page.getByTestId('chat-textarea')
    await expect(textarea).toBeEnabled({ timeout: 5000 })

    const cycleBtn = page.getByTestId('cycle-suggestion-btn')
    await expect(cycleBtn).toBeEnabled({ timeout: 5000 })
    await cycleBtn.click()

    await page.waitForTimeout(100)

    const afterHeight = await textarea.evaluate(
      (el: HTMLTextAreaElement) => el.offsetHeight
    )

    // Must be capped at 180 px
    expect(afterHeight).toBeLessThanOrEqual(180)
  })
})

// ─── Part C: "Edit or send as-is" hint ───────────────────────────────────────

test.describe('DIN-74 — "Edit or send as-is" hint in suggestion status line', () => {
  test('hint text includes "edit or send as-is" when suggestions are available', async ({
    page,
  }) => {
    const bundle: SuggestedActionsBundle = {
      acting_player_id: PLAYER_ID,
      tailored: [LONG_TAILORED_1, LONG_TAILORED_2],
      generic: [],
    }

    await setupMocks(page, { suggestedActions: bundle })
    await gotoGame(page)

    // The status line is visible when suggestions are available (before first click
    // it shows the total count; after clicking it shows the current index).
    await expect(
      page.getByText(/click ✨ to cycle · edit or send as-is/i)
    ).toBeVisible({ timeout: 5000 })
  })

  test('status line updates index after cycling', async ({ page }) => {
    const bundle: SuggestedActionsBundle = {
      acting_player_id: PLAYER_ID,
      tailored: [LONG_TAILORED_1, LONG_TAILORED_2],
      generic: [],
    }

    await setupMocks(page, { suggestedActions: bundle })
    await gotoGame(page)

    const cycleBtn = page.getByTestId('cycle-suggestion-btn')
    await expect(cycleBtn).toBeEnabled({ timeout: 5000 })

    // Before first click the label shows the total count as "current"
    await expect(
      page.getByText(/2 · click ✨ to cycle/i)
    ).toBeVisible({ timeout: 5000 })

    // After first click: "Suggestion 1 of 2 · …"
    await cycleBtn.click()
    await expect(page.getByText(/Suggestion 1 of 2/i)).toBeVisible({ timeout: 3000 })
  })
})

// ─── Part B+C: SSE dual-block streaming ──────────────────────────────────────

test.describe('DIN-74 — SSE dual suggested_actions blocks populate bundle', () => {
  test('tailored block (character_id attr) flows to acting player after stream', async ({
    page,
  }) => {
    // The current player IS the acting player
    const tailoredLine = '"I take a cautious step forward," I whisper, hand on hilt.'
    const genericLine = 'Wait and observe.'

    await setupMocks(page, { suggestedActions: null }) // start with no suggestions

    // Action POST
    await page.route(`**/api/games/${GAME_ID}/actions`, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 202,
          contentType: 'application/json',
          body: JSON.stringify({ message_id: 'msg-1', status: 'queued' }),
        })
      } else {
        await route.continue()
      }
    })

    // SSE stream: narrative + tailored block + generic block
    await page.route(`**/api/games/${GAME_ID}/events`, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue()
        return
      }
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
        body: buildSseBody([
          { type: 'chunk', text: 'The corridor is silent. ' },
          {
            type: 'block',
            tag: 'suggested_actions',
            attributes: { character_id: PLAYER_ID },
            content: tailoredLine,
          },
          {
            type: 'block',
            tag: 'suggested_actions',
            attributes: { generic: 'true' },
            content: genericLine,
          },
          { type: 'done' },
        ]),
      })
    })

    await gotoGame(page)

    // Submit action to trigger the stream
    const textarea = page.getByTestId('chat-textarea')
    await textarea.fill('I move forward.')
    await page.getByRole('button', { name: /Send/i }).click()

    // Simulate the Realtime DM INSERT so isWaitingForDm clears
    await page.evaluate(({ gameId }) => {
      window.dispatchEvent(
        new CustomEvent('dm-message', {
          detail: {
            id: 'msg-dm-1',
            game_id: gameId,
            profile_id: null,
            role: 'dm',
            content: 'The corridor is silent.',
            created_at: new Date().toISOString(),
          },
        })
      )
    }, { gameId: GAME_ID })

    const cycleBtn = page.getByTestId('cycle-suggestion-btn')
    await expect(cycleBtn).toBeEnabled({ timeout: 5000 })

    // Acting player (player-1 = USER_ID) should see the tailored suggestion
    await cycleBtn.click()
    await expect(textarea).toHaveValue(tailoredLine)
  })

  test('generic block (generic="true" attr) flows to non-acting player after stream', async ({
    page,
  }) => {
    // The current player is NOT the acting player (acting = 'player-other')
    const tailoredLine = '"I raise my sword," the rogue says, stepping up boldly.'
    const genericLine1 = 'Wait and observe the others.'
    const genericLine2 = 'Speak up with your own plan.'

    // Player-1 is NOT the acting player (acting_player_id will be 'player-other')
    await setupMocks(page, { suggestedActions: null })

    await page.route(`**/api/games/${GAME_ID}/actions`, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 202,
          contentType: 'application/json',
          body: JSON.stringify({ message_id: 'msg-2', status: 'queued' }),
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
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
        body: buildSseBody([
          { type: 'chunk', text: 'The rogue dashes ahead. ' },
          {
            type: 'block',
            tag: 'suggested_actions',
            attributes: { character_id: 'player-other' }, // different player
            content: tailoredLine,
          },
          {
            type: 'block',
            tag: 'suggested_actions',
            attributes: { generic: 'true' },
            content: [genericLine1, genericLine2].join('\n'),
          },
          { type: 'done' },
        ]),
      })
    })

    await gotoGame(page)

    const textarea = page.getByTestId('chat-textarea')
    await textarea.fill('I watch the rogue.')
    await page.getByRole('button', { name: /Send/i }).click()

    // Realtime DM INSERT
    await page.evaluate(({ gameId }) => {
      window.dispatchEvent(
        new CustomEvent('dm-message', {
          detail: {
            id: 'msg-dm-2',
            game_id: gameId,
            profile_id: null,
            role: 'dm',
            content: 'The rogue dashes ahead.',
            created_at: new Date().toISOString(),
          },
        })
      )
    }, { gameId: GAME_ID })

    const cycleBtn = page.getByTestId('cycle-suggestion-btn')
    await expect(cycleBtn).toBeEnabled({ timeout: 5000 })

    // Non-acting player should see generic suggestions
    await cycleBtn.click()
    await expect(textarea).toHaveValue(genericLine1)

    await cycleBtn.click()
    await expect(textarea).toHaveValue(genericLine2)

    // Tailored suggestion for the other player must NOT appear
    await expect(textarea).not.toHaveValue(tailoredLine)
  })
})

// ─── Part C: Realtime game-update bundle ─────────────────────────────────────

test.describe('DIN-74 — Realtime game-update replaces bundle', () => {
  test('game-update Realtime event with new bundle enables ✨ and shows correct suggestions', async ({
    page,
  }) => {
    // Start with no suggestions
    await setupMocks(page, { suggestedActions: null })
    await gotoGame(page)

    const cycleBtn = page.getByTestId('cycle-suggestion-btn')
    await expect(cycleBtn).toBeDisabled({ timeout: 5000 })

    // Simulate Supabase Realtime `game-update` event with new bundle
    const newBundle: SuggestedActionsBundle = {
      acting_player_id: PLAYER_ID,
      tailored: [LONG_TAILORED_1, LONG_TAILORED_2],
      generic: [GENERIC_1],
    }

    await page.evaluate(
      ({ gameId, bundle }) => {
        window.dispatchEvent(
          new CustomEvent('game-update', {
            detail: {
              id: gameId,
              name: 'The Continuity Keep',
              dm_persona: 'A theatrical DM',
              status: 'active',
              created_by: 'user-1',
              created_at: '2026-01-01T00:00:00Z',
              updated_at: new Date().toISOString(),
              suggested_actions: bundle,
            },
          })
        )
      },
      { gameId: GAME_ID, bundle: newBundle }
    )

    // ✨ should now be enabled for the acting player
    await expect(cycleBtn).toBeEnabled({ timeout: 5000 })

    const textarea = page.getByTestId('chat-textarea')
    await cycleBtn.click()
    await expect(textarea).toHaveValue(LONG_TAILORED_1)
  })

  test('game-update with null bundle disables ✨', async ({ page }) => {
    const initialBundle: SuggestedActionsBundle = {
      acting_player_id: PLAYER_ID,
      tailored: [LONG_TAILORED_1],
      generic: [],
    }

    await setupMocks(page, { suggestedActions: initialBundle })
    await gotoGame(page)

    const cycleBtn = page.getByTestId('cycle-suggestion-btn')
    await expect(cycleBtn).toBeEnabled({ timeout: 5000 })

    // Realtime update clears suggestions (game paused / new round starting)
    await page.evaluate(({ gameId }) => {
      window.dispatchEvent(
        new CustomEvent('game-update', {
          detail: {
            id: gameId,
            name: 'The Continuity Keep',
            dm_persona: 'A theatrical DM',
            status: 'active',
            created_by: 'user-1',
            created_at: '2026-01-01T00:00:00Z',
            updated_at: new Date().toISOString(),
            suggested_actions: null,
          },
        })
      )
    }, { gameId: GAME_ID })

    await expect(cycleBtn).toBeDisabled({ timeout: 5000 })
  })
})

// ─── Part B+C: Streaming bubble — no content leakage ─────────────────────────
//
// DIN-74 introduces two new `<suggested_actions>` attribute formats:
//   character_id="<id>"  → tailored bucket for the acting player
//   generic="true"       → generic bucket for all other players
//
// Both must be silently consumed by the SSE parser — their text content
// must never surface inside the streaming DM bubble.

test.describe('DIN-74 — Attributed suggested_actions blocks do not leak into chat bubble', () => {
  test('tailored block (character_id attr) content does not appear in the streaming bubble', async ({
    page,
  }) => {
    const tailoredContent =
      '"I draw my blade slowly," I say, eyes fixed on the shadow lurking behind the altar.'
    const genericContent = 'Wait and observe the others.'

    await setupMocks(page, { suggestedActions: null })

    await page.route(`**/api/games/${GAME_ID}/actions`, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 202,
          contentType: 'application/json',
          body: JSON.stringify({ message_id: 'msg-1', status: 'queued' }),
        })
      } else {
        await route.continue()
      }
    })

    await page.route(`**/api/games/${GAME_ID}/events`, async (route) => {
      if (route.request().method() !== 'GET') { await route.continue(); return }
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
        body: buildSseBody([
          { type: 'chunk', text: 'The altar pulses with dark energy. ' },
          {
            type: 'block',
            tag: 'suggested_actions',
            attributes: { character_id: PLAYER_ID },
            content: tailoredContent,
          },
          {
            type: 'block',
            tag: 'suggested_actions',
            attributes: { generic: 'true' },
            content: genericContent,
          },
          { type: 'chunk', text: 'You must decide quickly.' },
          { type: 'done' },
        ]),
      })
    })

    await gotoGame(page)

    await page.getByTestId('chat-textarea').fill('I approach the altar.')
    await page.getByRole('button', { name: /Send/i }).click()

    const bubble = page.getByTestId('streaming-dm-message')
    await expect(bubble).toContainText('The altar pulses with dark energy.', { timeout: 3000 })
    await expect(bubble).toContainText('You must decide quickly.')
    await expect(bubble).not.toContainText('I draw my blade')
    await expect(bubble).not.toContainText('Wait and observe')
    await expect(bubble).not.toContainText('<suggested_actions')
  })

  test('generic block (generic="true" attr) content does not appear in the streaming bubble', async ({
    page,
  }) => {
    const tailoredContent = '"Forward!" I shout, charging ahead with reckless abandon.'
    const genericLine1 = 'Speak up with your own plan.'
    const genericLine2 = 'Help the acting player.'

    await setupMocks(page, { suggestedActions: null })

    await page.route(`**/api/games/${GAME_ID}/actions`, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 202,
          contentType: 'application/json',
          body: JSON.stringify({ message_id: 'msg-2', status: 'queued' }),
        })
      } else {
        await route.continue()
      }
    })

    await page.route(`**/api/games/${GAME_ID}/events`, async (route) => {
      if (route.request().method() !== 'GET') { await route.continue(); return }
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
        body: buildSseBody([
          { type: 'chunk', text: 'The fighter dashes forward. ' },
          {
            type: 'block',
            tag: 'suggested_actions',
            attributes: { character_id: PLAYER_ID },
            content: tailoredContent,
          },
          {
            type: 'block',
            tag: 'suggested_actions',
            attributes: { generic: 'true' },
            content: [genericLine1, genericLine2].join('\n'),
          },
          { type: 'chunk', text: 'The corridor shakes.' },
          { type: 'done' },
        ]),
      })
    })

    await gotoGame(page)

    await page.getByTestId('chat-textarea').fill('I charge ahead.')
    await page.getByRole('button', { name: /Send/i }).click()

    const bubble = page.getByTestId('streaming-dm-message')
    await expect(bubble).toContainText('The fighter dashes forward.', { timeout: 3000 })
    await expect(bubble).toContainText('The corridor shakes.')
    await expect(bubble).not.toContainText('Forward!')
    await expect(bubble).not.toContainText('Speak up with your own plan')
    await expect(bubble).not.toContainText('Help the acting player')
    await expect(bubble).not.toContainText('<suggested_actions')
  })
})

// ─── Part C: Status line visibility ──────────────────────────────────────────

test.describe('DIN-74 — Suggestion status line is hidden when no suggestions exist', () => {
  test('status line is not rendered when suggested_actions is null', async ({ page }) => {
    await setupMocks(page, { suggestedActions: null })
    await gotoGame(page)

    // The "click ✨ to cycle" hint must not be present when there are no suggestions
    await expect(
      page.getByText(/click ✨ to cycle/i)
    ).toHaveCount(0, { timeout: 5000 })
  })

  test('status line is not rendered when the visible list is empty for current player', async ({
    page,
  }) => {
    // Non-acting player with empty generic list → nothing to show
    const bundle: SuggestedActionsBundle = {
      acting_player_id: 'player-other',
      tailored: [LONG_TAILORED_1],
      generic: [],
    }

    await setupMocks(page, { suggestedActions: bundle })
    await gotoGame(page)

    await expect(
      page.getByText(/click ✨ to cycle/i)
    ).toHaveCount(0, { timeout: 5000 })
  })
})

// ─── Part C: Textarea resets after submit ─────────────────────────────────────

test.describe('DIN-74 — Textarea height resets to auto after submitting a cycled suggestion', () => {
  test('textarea style.height is cleared after sending a long cycled suggestion', async ({
    page,
  }) => {
    const multiLineTailored =
      '"Let us proceed with caution," I whisper, scanning the shadows for any sign of movement before taking a careful step through the threshold.'

    const bundle: SuggestedActionsBundle = {
      acting_player_id: PLAYER_ID,
      tailored: [multiLineTailored],
      generic: [],
    }

    await setupMocks(page, { suggestedActions: bundle })

    // Action POST mock — needed to submit the form
    await page.route(`**/api/games/${GAME_ID}/actions`, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 202,
          contentType: 'application/json',
          body: JSON.stringify({ message_id: 'msg-reset', status: 'queued' }),
        })
      } else {
        await route.continue()
      }
    })

    await gotoGame(page)

    const textarea = page.getByTestId('chat-textarea')
    const cycleBtn = page.getByTestId('cycle-suggestion-btn')

    await expect(cycleBtn).toBeEnabled({ timeout: 5000 })
    await cycleBtn.click()

    // Allow rAF resize to settle
    await page.waitForTimeout(100)

    // Textarea must have grown
    const heightAfterCycle = await textarea.evaluate(
      (el: HTMLTextAreaElement) => el.style.height
    )
    expect(heightAfterCycle).toMatch(/^\d+px$/)

    // Submit the cycled suggestion
    await page.getByRole('button', { name: /Send/i }).click()

    // After submit, style.height must be cleared back to 'auto' or empty
    const heightAfterSubmit = await textarea.evaluate(
      (el: HTMLTextAreaElement) => el.style.height
    )
    expect(['auto', '']).toContain(heightAfterSubmit)
  })
})
