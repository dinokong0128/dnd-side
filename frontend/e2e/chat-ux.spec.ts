import { test, expect, Page } from '@playwright/test'

// ─── Types ────────────────────────────────────────────────────────────────────
interface GameMessage {
  id: string
  game_id: string
  profile_id: string | null
  role: 'player' | 'dm' | 'system'
  content: string
  created_at: string
}

// ─── Shared setup helper ──────────────────────────────────────────────────────
//
// Registers auth, games, players, and game_messages mocks.  Messages are
// expected in DESCENDING created_at order (newest first) — matching what
// Supabase returns for `.order('created_at', { ascending: false })`.
// The frontend reverses the array before rendering, so the caller should build
// `initialMessages` with the newest message at index 0.
//
// game_messages URL routing:
//   - URL contains 'select=role'   → latestMessagePromise (limit=1)
//                                    → returns [initialMessages[0]] so that
//                                      isWaitingForDm = (role === 'player')
//   - Everything else              → paginated fetch
//                                    → returns initialMessages as-is
async function setupGameMocks(
  page: Page,
  options: {
    gameId?: string
    userId?: string
    gameStatus?: string
    initialMessages?: GameMessage[]
    playerName?: string
  } = {}
) {
  const {
    gameId = 'test-game-123',
    userId = 'user-1',
    gameStatus = 'active',
    initialMessages = [],
    playerName = 'Kael Dawnstrider',
  } = options

  // ── Auth ────────────────────────────────────────────────────────────────
  await page.route('**/auth/v1/user', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: userId, email: 'test@example.com' }),
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
        user: { id: userId, email: 'test@example.com' },
      }),
    })
  })

  // ── Game ────────────────────────────────────────────────────────────────
  await page.route('**.supabase.co/rest/v1/games**', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: gameId,
            name: 'Test Game',
            dm_persona: 'A dramatic Dungeon Master',
            status: gameStatus,
            created_by: userId,
            updated_at: '2026-01-01T00:00:00Z',
          },
        ]),
      })
    }
  })

  // ── Players ─────────────────────────────────────────────────────────────
  await page.route('**.supabase.co/rest/v1/players**', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'player-1',
            game_id: gameId,
            profile_id: userId,
            character_name: playerName,
            character_class: 'Fighter',
            race: 'Human',
            level: 3,
            hp_current: 28,
            hp_max: 28,
          },
        ]),
      })
    }
  })

  // ── Messages ────────────────────────────────────────────────────────────
  // Distinguishes the two GET requests to game_messages:
  //   1. latestMessagePromise uses .select('role') → URL has 'select=role'
  //   2. messagesPromise uses .select('*')         → URL has 'select=*' (encoded)
  await page.route('**.supabase.co/rest/v1/game_messages**', (route) => {
    if (route.request().method() === 'GET') {
      const url = route.request().url()

      if (url.includes('select=role')) {
        // latest-message query (limit=1) — first element of DESC array is newest
        const latest = initialMessages[0]
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(latest ? [latest] : []),
        })
      } else {
        // paginated query — return messages in DESC order as provided
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(initialMessages),
        })
      }
    }
  })
}

// ─── DIN-60: DM error recovery ────────────────────────────────────────────────
test.describe('DIN-60 — DM error recovery', () => {
  test('retry button appears on system error message and re-submits last action', async ({
    page,
  }) => {
    const gameId = 'test-game-din60'
    const userId = 'user-1'

    // Initial state: a player action followed by a system error message.
    // DESC order (newest first): sys-msg at [0], player-msg at [1].
    // After frontend reversal (ascending): [player-msg, sys-msg].
    // limit=1 returns sys-msg (role='system') → isWaitingForDm = false.
    const initialMessages: GameMessage[] = [
      {
        id: 'sys-1',
        game_id: gameId,
        profile_id: null,
        role: 'system',
        content:
          'The Dungeon Master encountered an error. Please try your action again.',
        created_at: '2026-01-01T00:00:02Z',
      },
      {
        id: 'pl-1',
        game_id: gameId,
        profile_id: userId,
        role: 'player',
        content: 'I search the room for clues.',
        created_at: '2026-01-01T00:00:01Z',
      },
    ]

    await setupGameMocks(page, { gameId, userId, initialMessages })

    // Track retry action POST
    let retryCallCount = 0
    await page.route(`**/api/games/${gameId}/actions`, (route) => {
      if (route.request().method() === 'POST') {
        retryCallCount++
        route.fulfill({
          status: 202,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'queued', message_id: 'msg-retry' }),
        })
      }
    })

    await page.goto(`/games/${gameId}`)
    await expect(page.getByText('Test Game')).toBeVisible()

    // System error message must be visible
    await expect(
      page.getByText('The Dungeon Master encountered an error')
    ).toBeVisible({ timeout: 5000 })

    // Retry button must be visible inside the system message
    const retryButton = page.getByRole('button', { name: /Retry last action/i })
    await expect(retryButton).toBeVisible({ timeout: 5000 })

    // Input is enabled while not waiting for DM
    const textarea = page.getByPlaceholder(/What does your character do/)
    await expect(textarea).toBeEnabled({ timeout: 5000 })

    // Click the retry button
    await retryButton.click()

    // The actions API must have been called
    expect(retryCallCount).toBeGreaterThan(0)

    // After submit, isWaitingForDm=true → typing indicator appears
    await expect(
      page.getByText(/The Dungeon Master is writing/i)
    ).toBeVisible({ timeout: 5000 })
  })
})

// ─── DIN-62: Paginated chat history ───────────────────────────────────────────
test.describe('DIN-62 — Paginated chat history', () => {
  test('shows adventure begins here banner when fewer than 10 messages exist', async ({
    page,
  }) => {
    const gameId = 'test-game-din62a'
    const userId = 'user-1'

    // 3 messages < CHAT_PAGE_SIZE (10) → hasMoreMessages=false → banner renders
    // DESC order: msg-3 (newest) … msg-1 (oldest)
    const initialMessages: GameMessage[] = [
      {
        id: 'msg-3',
        game_id: gameId,
        profile_id: null,
        role: 'dm',
        content: 'The third message from the DM.',
        created_at: '2026-01-01T00:03:00Z',
      },
      {
        id: 'msg-2',
        game_id: gameId,
        profile_id: userId,
        role: 'player',
        content: 'Player second action.',
        created_at: '2026-01-01T00:02:00Z',
      },
      {
        id: 'msg-1',
        game_id: gameId,
        profile_id: null,
        role: 'dm',
        content: 'The opening narration.',
        created_at: '2026-01-01T00:01:00Z',
      },
    ]

    await setupGameMocks(page, { gameId, userId, initialMessages })

    await page.goto(`/games/${gameId}`)

    await expect(
      page.getByText('The third message from the DM.')
    ).toBeVisible({ timeout: 5000 })

    // Banner visible because hasMoreMessages=false (3 < 10)
    await expect(page.getByText('The adventure begins here')).toBeVisible({
      timeout: 5000,
    })
  })

  test('initial load shows only last 10 messages and load-more works', async ({
    page,
  }) => {
    const gameId = 'test-game-din62b'
    const userId = 'user-1'

    // Generate 13 messages: odd indices = dm, even = player
    // msg-13 is the newest (dm), msg-1 is the oldest (dm)
    const allMessages: GameMessage[] = Array.from(
      { length: 13 },
      (_, i) => {
        const n = 13 - i // 13 down to 1 (DESC order)
        const isDm = n % 2 === 1
        return {
          id: `msg-${n}`,
          game_id: gameId,
          profile_id: isDm ? null : userId,
          role: (isDm ? 'dm' : 'player') as 'dm' | 'player',
          content: isDm
            ? `The DM narrates turn ${n}.`
            : `Player action ${n}.`,
          created_at: `2026-01-01T00:${String(n).padStart(2, '0')}:00Z`,
        }
      }
    )
    // allMessages[0]  = msg-13 (newest, dm)
    // allMessages[12] = msg-1  (oldest, dm)

    const initial10 = allMessages.slice(0, 10) // msg-13 … msg-4 (DESC)
    const older3 = allMessages.slice(10)       // msg-3, msg-2, msg-1 (DESC)

    // Auth, games, players mocks via helper (without game_messages)
    await page.route('**/auth/v1/user', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: userId, email: 'test@example.com' }),
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
          user: { id: userId, email: 'test@example.com' },
        }),
      })
    })
    await page.route('**.supabase.co/rest/v1/games**', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: gameId,
              name: 'Test Game',
              dm_persona: 'DM',
              status: 'active',
              created_by: userId,
              updated_at: '2026-01-01T00:00:00Z',
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
              game_id: gameId,
              profile_id: userId,
              character_name: 'Kael Dawnstrider',
              character_class: 'Fighter',
              race: 'Human',
              level: 3,
              hp_current: 28,
              hp_max: 28,
            },
          ]),
        })
      }
    })

    // Custom game_messages mock: handles all three URL patterns
    await page.route('**.supabase.co/rest/v1/game_messages**', (route) => {
      if (route.request().method() === 'GET') {
        const url = route.request().url()

        if (url.includes('select=role')) {
          // latest-message query (limit=1) — msg-13 is dm → isWaitingForDm=false
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([initial10[0]]),
          })
        } else if (url.includes('created_at=lt.')) {
          // load-more query (cursor-based pagination)
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(older3),
          })
        } else {
          // initial paginated query — newest 10 in DESC order
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(initial10),
          })
        }
      }
    })

    await page.goto(`/games/${gameId}`)

    // Newest message (msg-13) must be visible after initial load
    await expect(page.getByText('The DM narrates turn 13.')).toBeVisible({
      timeout: 5000,
    })

    // Ensure the sentinel is scrolled into view to trigger load-more.
    // (In headless Chromium the IntersectionObserver may fire immediately on the
    // initial render if the sentinel is in the scroll container's viewport; this
    // evaluate call guarantees load-more is triggered regardless of scroll state.)
    await page.evaluate(() => {
      const sentinel = document.querySelector(
        '[data-testid="top-sentinel"]'
      )
      if (sentinel) {
        sentinel.scrollIntoView()
      }
    })

    // Wait for msg-1 to appear (load-more completed)
    await expect(page.getByText('The DM narrates turn 1.')).toBeVisible({
      timeout: 8000,
    })

    // Banner now visible (hasMoreMessages=false after older3.length < 10)
    await expect(page.getByText('The adventure begins here')).toBeVisible({
      timeout: 5000,
    })
  })
})
