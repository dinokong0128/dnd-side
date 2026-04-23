import { test, expect, Page } from '@playwright/test'

// ─── DIN-73: Scene overlay must not block game UI ─────────────────────────────
//
// Regression suite for the production bug where SceneBackground's fixed overlay
// painted on top of the header and chat, making them unclickable and causing the
// IntersectionObserver top sentinel to fire onLoadMore in an infinite loop.
//
// Fix: SceneBackground root uses z-index:-1 + pointer-events:none, and
// .scene-bg-active isolates its stacking context via position:relative +
// isolation:isolate, keeping the overlay strictly behind in-flow UI siblings.
// ─────────────────────────────────────────────────────────────────────────────

const GAME_ID = 'test-game-din73'
const USER_ID = 'user-1'

interface GameMessage {
  id: string
  game_id: string
  profile_id: string | null
  role: 'player' | 'dm' | 'system'
  content: string
  scene_type?: string | null
  scene_mood?: string | null
  dice_rolls?: null
  created_at: string
}

// ─── Setup helper ─────────────────────────────────────────────────────────────
//
// Registers auth, game, player, inventory, and message mocks.
// `messages` must be in DESC created_at order (newest first) — matching
// the Supabase `.order('created_at', { ascending: false })` response.
// The game is always set to status='active' so the scene overlay renders.
async function setupSceneMocks(page: Page, messages: GameMessage[]) {
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
            name: 'The Shadow Vault',
            dm_persona: 'A grim, theatrical Dungeon Master',
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
            character_name: 'Aldric',
            character_class: 'Paladin',
            race: 'Half-Elf',
            level: 4,
            hp_current: 36,
            hp_max: 36,
            stats: { str: 16, dex: 10, con: 14, int: 10, wis: 12, cha: 14 },
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

  await page.route('**.supabase.co/rest/v1/game_messages**', (route) => {
    if (route.request().method() === 'GET') {
      const url = route.request().url()
      if (url.includes('select=role')) {
        // latestMessagePromise (limit=1): newest message
        const latest = messages[0]
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(latest ? [latest] : []),
        })
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(messages),
        })
      }
    }
  })
}

// A single DM message with scene_type set — activates the scene overlay.
const dmSceneMsg: GameMessage = {
  id: 'msg-scene',
  game_id: GAME_ID,
  profile_id: null,
  role: 'dm',
  content: 'The dungeon yawns before you, torchlight catching the carved stone walls.',
  scene_type: 'dungeon',
  scene_mood: 'tense',
  dice_rolls: null,
  created_at: '2026-01-01T00:00:01Z',
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('DIN-73 — Scene overlay does not block game UI', () => {
  // ── 1. CSS guard: root element must pass through all pointer events ──────────
  test('scene-background-root has pointer-events:none', async ({ page }) => {
    await setupSceneMocks(page, [dmSceneMsg])
    await page.goto(`/games/${GAME_ID}`)

    // Wait for the game page to settle — game name in header signals mount
    await expect(page.getByText('The Shadow Vault')).toBeVisible({ timeout: 8000 })

    const root = page.locator('[data-testid="scene-background-root"]')
    await expect(root).toBeVisible({ timeout: 5000 })

    const pointerEvents = await root.evaluate(
      (el) => window.getComputedStyle(el).pointerEvents
    )
    expect(pointerEvents).toBe('none')
  })

  // ── 2. Header button clickable with scene overlay in the DOM ─────────────────
  //
  // Regression: the fixed SceneBackground at z-index:0 intercepted all clicks
  // in the header area. Verify the character sheet opens normally.
  test('header sheet button is clickable when scene overlay is active', async ({
    page,
  }) => {
    await setupSceneMocks(page, [dmSceneMsg])
    await page.goto(`/games/${GAME_ID}`)

    await expect(page.getByText('The Shadow Vault')).toBeVisible({ timeout: 8000 })

    // Confirm the scene-bg-active class is present — overlay IS in the DOM
    const container = page.locator('.dnd-page-bg')
    await expect(container).toHaveClass(/scene-bg-active/, { timeout: 5000 })

    // Click the character sheet toggle
    const sheetButton = page.getByTestId('sheet-button')
    await expect(sheetButton).toBeVisible({ timeout: 5000 })
    await sheetButton.click()

    // The character sheet panel must open — its close button is the clearest signal
    await expect(page.getByTestId('character-sheet-close')).toBeVisible({
      timeout: 5000,
    })
  })

  // ── 3. Chat textarea is interactive with scene overlay active ────────────────
  //
  // Regression: the root overlay container swallowed clicks in the chat area.
  // Verify the textarea is focusable, accepts text, and the form submits.
  test('chat textarea accepts input and submits when scene overlay is active', async ({
    page,
  }) => {
    let actionCallCount = 0
    await page.route(`**/api/games/${GAME_ID}/actions`, (route) => {
      if (route.request().method() === 'POST') {
        actionCallCount++
        route.fulfill({
          status: 202,
          contentType: 'application/json',
          body: JSON.stringify({ message_id: 'msg-new', status: 'queued' }),
        })
      }
    })

    await setupSceneMocks(page, [dmSceneMsg])
    await page.goto(`/games/${GAME_ID}`)

    await expect(page.getByText('The Shadow Vault')).toBeVisible({ timeout: 8000 })

    const textarea = page.getByTestId('chat-textarea')
    await expect(textarea).toBeEnabled({ timeout: 8000 })
    await textarea.click()
    await textarea.fill('I examine the carved runes on the wall.')

    // Submit via Enter
    await textarea.press('Enter')

    // The actions proxy route must have been hit
    await expect
      .poll(() => actionCallCount, { timeout: 5000 })
      .toBeGreaterThan(0)
  })

  // ── 4. Scroll-to-bottom button appears when scrolled away from bottom ─────────
  //
  // Regression: the infinite load-more loop kept the scroll container at the top,
  // which meant the scroll-to-bottom button was always visible.  After the fix the
  // page auto-scrolls to the latest message and the button is hidden until the user
  // manually scrolls up.
  test('scroll-to-bottom button is hidden on load, appears after scrolling up', async ({
    page,
  }) => {
    // Small viewport guarantees the chat log overflows with few messages
    await page.setViewportSize({ width: 1280, height: 400 })

    // 8 DM messages (< page size 10 → hasMoreMessages=false, no load-more) in DESC.
    // All DM so latestMessagePromise returns role='dm' → isWaitingForDm=false.
    const msgs: GameMessage[] = Array.from({ length: 8 }, (_, i) => {
      const n = 8 - i // 8 down to 1 (DESC newest-first)
      return {
        id: `msg-scroll-${n}`,
        game_id: GAME_ID,
        profile_id: null,
        role: 'dm',
        content: `The DM narrates scroll scene ${n} with vivid detail.`,
        scene_type: n === 8 ? 'dungeon' : null,
        dice_rolls: null,
        created_at: `2026-01-01T00:${String(n).padStart(2, '0')}:00Z`,
      }
    })

    await setupSceneMocks(page, msgs)
    await page.goto(`/games/${GAME_ID}`)

    // Wait for the newest message to render (the page auto-scrolls here)
    await expect(
      page.getByText('The DM narrates scroll scene 8 with vivid detail.')
    ).toBeVisible({ timeout: 8000 })

    // Scroll-to-bottom button must NOT be shown when already at the bottom
    const scrollBtn = page.getByRole('button', { name: /latest message/i })
    await expect(scrollBtn).not.toBeVisible()

    // Scroll the chat log back to the top — simulates user reading history
    await page.evaluate(() => {
      const el = document.querySelector('.dnd-chat-log')
      if (el) {
        el.scrollTop = 0
        el.dispatchEvent(new Event('scroll'))
      }
    })

    // Button must now appear
    await expect(scrollBtn).toBeVisible({ timeout: 5000 })

    // Click it — user returns to bottom
    await scrollBtn.click()

    // Button disappears once back at the bottom
    await expect(scrollBtn).not.toBeVisible({ timeout: 5000 })
  })

  // ── 5. Pagination does not loop infinitely when scene overlay is active ───────
  //
  // Regression: the fixed overlay at z-index:0 obscured the scroll container,
  // causing the IntersectionObserver on the top sentinel to fire onLoadMore
  // continuously.  The load-more query URL contains `created_at=lt.` (cursor).
  // After the fix, that path should be called at most once per genuine scroll-to-top.
  test('game_messages pagination is not triggered in an infinite loop', async ({
    page,
  }) => {
    let loadMoreCallCount = 0

    // Override the messages route BEFORE setupSceneMocks so ours wins (routes
    // registered first match first in Playwright).
    await page.route('**.supabase.co/rest/v1/game_messages**', (route) => {
      if (route.request().method() === 'GET') {
        const url = route.request().url()
        if (url.includes('select=role')) {
          // latestMessagePromise — return the newest dm message
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([dmSceneMsg]),
          })
        } else if (url.includes('created_at=lt.')) {
          // load-more cursor query
          loadMoreCallCount++
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([]),
          })
        } else {
          // Initial paginated query — return exactly CHAT_PAGE_SIZE (10) messages
          // so hasMoreMessages=true and the sentinel is relevant
          const tenMsgs: GameMessage[] = Array.from({ length: 10 }, (_, i) => ({
            id: `msg-loop-${10 - i}`,
            game_id: GAME_ID,
            profile_id: null,
            role: 'dm',
            content: `Message ${10 - i}.`,
            scene_type: i === 0 ? 'dungeon' : null,
            dice_rolls: null,
            created_at: `2026-01-01T00:${String(10 - i).padStart(2, '0')}:00Z`,
          }))
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(tenMsgs),
          })
        }
      }
    })

    // Auth, game, player, inventory mocks (messages already mocked above)
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
              name: 'The Shadow Vault',
              dm_persona: 'Grim narrator',
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
              character_name: 'Aldric',
              character_class: 'Paladin',
              race: 'Half-Elf',
              level: 4,
              hp_current: 36,
              hp_max: 36,
              stats: { str: 16, dex: 10, con: 14, int: 10, wis: 12, cha: 14 },
            },
          ]),
        })
      }
    })
    await page.route('**.supabase.co/rest/v1/player_inventory**', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
      }
    })

    await page.goto(`/games/${GAME_ID}`)

    // Wait for the page to settle — newest message renders
    await expect(page.getByText('Message 10.')).toBeVisible({ timeout: 8000 })

    // Hold for 3 seconds — an infinite loop would rack up hundreds of calls
    await page.waitForTimeout(3000)

    // With the fix the top sentinel fires at most once (scroll-to-top on initial
    // load) and then only when the user manually scrolls up.
    expect(loadMoreCallCount).toBeLessThanOrEqual(2)
  })
})
