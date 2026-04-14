import { test, expect, Page } from '@playwright/test'

// ─── Test constants ────────────────────────────────────────────────────────────
const GAME_ID = 'test-game-editing-123'
const USER_ID = 'user-1'
const DM_MSG_ID = 'dm-msg-1'
const PLAYER_MSG_ID = 'player-msg-1'

// ─── Mock helper ──────────────────────────────────────────────────────────────
//
// Correct game_messages mock ordering (the DIN-61 mock-ordering fix):
//
// GameSessionView fetches messages with order=desc then reverses the array.
// The paginated query must return messages in DESCENDING created_at order so
// that after the frontend reversal the player message ends up last in the array
// (i.e., isLastMessage=true and controls are renderable).
//
// Two separate calls hit game_messages:
//   1. latestMessagePromise – select('role'), limit=1 — identified by 'select=role' in URL
//   2. messagesPromise      – select('*'), limit=10   — all other GET requests
//
// The limit=1 mock returns only the DM message so that isWaitingForDm=false
// (latestMsg.role !== 'player'), which re-enables the input.
async function mockGameData(page: Page) {
  // ── Auth ─────────────────────────────────────────────────────────────────
  await page.route('**/auth/v1/user', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: USER_ID, email: 'test@example.com' }),
    })
  })

  await page.route('**/auth/v1/token?grant_type=refresh_token', (route) => {
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
  })

  // ── Game ─────────────────────────────────────────────────────────────────
  await page.route('**.supabase.co/rest/v1/games**', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: GAME_ID,
            name: 'The Editing Test Campaign',
            dm_persona: 'A wise DM',
            status: 'active',
            created_by: USER_ID,
            updated_at: '2026-01-01T00:00:00Z',
          },
        ]),
      })
    }
  })

  // ── Players ───────────────────────────────────────────────────────────────
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
            character_name: 'Kael Dawnstrider',
            character_class: 'Rogue',
            race: 'Half-Elf',
            level: 3,
            hp_current: 20,
            hp_max: 24,
          },
        ]),
      })
    }
  })

  // ── Messages ──────────────────────────────────────────────────────────────
  // The game_messages route intercepts BOTH the paginated (limit=10) and
  // latest-message (limit=1, select=role) queries.  We distinguish them by
  // checking whether the URL contains 'select=role' — that parameter is only
  // present on the latestMessagePromise (`.select('role')`).
  //
  // Paginated response is in DESCENDING created_at order (player-msg newest,
  // dm-msg older).  After the frontend reverses the array the order becomes:
  //   [dm-msg (index 0), player-msg (index 1 = last)]
  // This makes the player message the last in the list, which is required for
  // any isLastMessage-gated controls to render correctly.
  await page.route('**.supabase.co/rest/v1/game_messages**', (route) => {
    if (route.request().method() === 'GET') {
      const url = route.request().url()

      if (url.includes('select=role')) {
        // latest-message query — return only the DM message so isWaitingForDm=false
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: DM_MSG_ID,
              game_id: GAME_ID,
              profile_id: null,
              role: 'dm',
              content: 'The dungeon stretches before you, cold and foreboding.',
              created_at: '2026-01-01T00:00:01Z',
            },
          ]),
        })
      } else {
        // paginated query — DESC order (newest first); frontend reverses to ascending
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: PLAYER_MSG_ID,
              game_id: GAME_ID,
              profile_id: USER_ID,
              role: 'player',
              content: 'I search the room for traps.',
              created_at: '2026-01-01T00:00:02Z',
            },
            {
              id: DM_MSG_ID,
              game_id: GAME_ID,
              profile_id: null,
              role: 'dm',
              content: 'The dungeon stretches before you, cold and foreboding.',
              created_at: '2026-01-01T00:00:01Z',
            },
          ]),
        })
      }
    }
  })
}

// ─── Tests ────────────────────────────────────────────────────────────────────
test.describe('DIN-61 — Message display with correct mock ordering', () => {
  test('both messages render after DESC fetch and frontend reversal', async ({
    page,
  }) => {
    await mockGameData(page)
    await page.goto(`/games/${GAME_ID}`)

    await expect(page.getByText('The Editing Test Campaign')).toBeVisible()

    // Both messages should be visible after the frontend reverses the DESC array
    await expect(
      page.getByText('The dungeon stretches before you, cold and foreboding.')
    ).toBeVisible({ timeout: 5000 })
    await expect(
      page.getByText('I search the room for traps.')
    ).toBeVisible({ timeout: 5000 })
  })

  test('input is enabled when latest message is DM (isWaitingForDm=false)', async ({
    page,
  }) => {
    await mockGameData(page)
    await page.goto(`/games/${GAME_ID}`)

    await expect(page.getByText('The Editing Test Campaign')).toBeVisible()

    // The limit=1 mock returns role='dm' → isWaitingForDm=false → textarea enabled
    const textarea = page.getByPlaceholder(/What does your character do/)
    await expect(textarea).toBeEnabled({ timeout: 5000 })

    // Typing indicator must not appear
    await expect(
      page.getByText(/The Dungeon Master is writing/i)
    ).not.toBeVisible()
  })

  test('player message shows character name and DM message shows Dungeon Master label', async ({
    page,
  }) => {
    await mockGameData(page)
    await page.goto(`/games/${GAME_ID}`)

    await expect(page.getByText('The Editing Test Campaign')).toBeVisible()

    // Player message should show the character name from the playerMap
    await expect(page.getByText('Kael Dawnstrider')).toBeVisible({
      timeout: 5000,
    })
    // DM message should show the "Dungeon Master" label
    await expect(page.getByText('Dungeon Master')).toBeVisible({
      timeout: 5000,
    })
  })
})
