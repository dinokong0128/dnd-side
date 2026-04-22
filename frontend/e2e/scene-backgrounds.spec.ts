import { test, expect, Page } from '@playwright/test'

// ─── DIN-73: Dynamic Scene Backgrounds & Shared Scene Protocol ────────────────
//
// Verifies the SceneBackground component lifecycle in E2E:
//  1. SceneBackground renders (dim overlay visible) when the game is active
//  2. Scene image src reflects the DM message's scene_type
//  3. Scene image rotates to a new src when scene_type changes between turns
//  4. Mood overlay carries the correct CSS class for the given scene_mood
//  5. SceneBackground is absent when the localStorage preference is disabled
//  6. `realm-prefs-changed` event disables/re-enables the background live
//  7. Scene block in an SSE stream updates the background before `done` arrives
//  8. Resume: scene derived from the most recent DM message with scene_type
// ─────────────────────────────────────────────────────────────────────────────

const GAME_ID = 'test-game-scene'
const USER_ID = 'user-1'
const PLAYER_ID = 'player-1'

const MOCK_GAME = {
  id: GAME_ID,
  name: 'The Realm of Shadows',
  dm_persona: 'A dramatic storyteller',
  status: 'active',
  created_by: USER_ID,
  updated_at: '2026-01-01T00:00:00Z',
  suggested_actions: null,
}

const INIT_MSG_BASE = {
  id: 'msg-init',
  game_id: GAME_ID,
  profile_id: null,
  role: 'dm',
  dice_rolls: null,
  created_at: '2026-01-01T00:00:01Z',
}

const INIT_MSG_CONTENT = 'Shadows stretch across the ancient stones.'

// ─── Setup helper ─────────────────────────────────────────────────────────────

async function setupGameMocks(
  page: Page,
  options: {
    initialSceneType?: string | null
    initialSceneMood?: string | null
  } = {}
) {
  const { initialSceneType = null, initialSceneMood = null } = options

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
        body: JSON.stringify([MOCK_GAME]),
      })
    }
  })

  await page.route('**.supabase.co/rest/v1/players**', (route) => {
    if (route.request().method() !== 'GET') return
    const url = route.request().url()
    if (url.includes(`id=eq.${PLAYER_ID}`)) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: PLAYER_ID,
          game_id: GAME_ID,
          profile_id: USER_ID,
          character_name: 'Elaryn',
          character_class: 'Ranger',
          race: 'Wood Elf',
          level: 4,
          hp_current: 30,
          hp_max: 36,
          stats: {},
        }),
      })
    } else {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: PLAYER_ID, profile_id: USER_ID, character_name: 'Elaryn' },
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
    ...INIT_MSG_BASE,
    content: INIT_MSG_CONTENT,
    scene_type: initialSceneType,
    scene_mood: initialSceneMood,
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

// ─── Navigation helper ────────────────────────────────────────────────────────

async function gotoGame(page: Page) {
  await page.goto(`/games/${GAME_ID}`)
  await expect(page.getByText('The Realm of Shadows')).toBeVisible({ timeout: 5000 })
  await expect(
    page.locator('body[data-e2e-listeners-ready="true"]')
  ).toBeAttached({ timeout: 5000 })
  await expect(page.getByText(INIT_MSG_CONTENT)).toBeVisible({ timeout: 5000 })
}

// ─── Event helper ─────────────────────────────────────────────────────────────

async function dispatchSceneDmMessage(
  page: Page,
  opts: { sceneType: string; sceneMood?: string; id?: string }
) {
  await page.evaluate(
    ({ gameId, sceneType, sceneMood, id }) => {
      window.dispatchEvent(
        new CustomEvent('dm-message', {
          detail: {
            id: id ?? `msg-scene-${Date.now()}`,
            game_id: gameId,
            profile_id: null,
            role: 'dm',
            content: 'The scene shifts.',
            created_at: new Date().toISOString(),
            scene_type: sceneType,
            scene_mood: sceneMood ?? null,
          },
        })
      )
    },
    {
      gameId: GAME_ID,
      sceneType: opts.sceneType,
      sceneMood: opts.sceneMood,
      id: opts.id,
    }
  )
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('DIN-73 — SceneBackground renders in active game', () => {
  test('dim overlay is visible for an active game with default preferences', async ({
    page,
  }) => {
    await setupGameMocks(page)
    await gotoGame(page)

    // SceneBackground always renders the dim overlay when enabled, even before
    // any scene_type arrives.
    await expect(page.locator('[data-testid="scene-background"]')).toBeAttached({
      timeout: 3000,
    })
    await expect(page.locator('[data-testid="dim-overlay"]')).toBeVisible({ timeout: 3000 })
  })
})

test.describe('DIN-73 — Scene image src reflects scene_type', () => {
  test('scene image loads with correct path when DM message carries scene_type=tavern', async ({
    page,
  }) => {
    await setupGameMocks(page)
    await gotoGame(page)

    await dispatchSceneDmMessage(page, { sceneType: 'tavern' })

    // No mood → variant 1 (serene) → /scenes/tavern/1.webp
    await expect(page.locator('img.scene-img-active')).toHaveAttribute(
      'src',
      /scenes\/tavern\/1\.webp/,
      { timeout: 3000 }
    )
  })

  test('scene image src updates when scene_type changes between DM turns', async ({
    page,
  }) => {
    await setupGameMocks(page)
    await gotoGame(page)

    await dispatchSceneDmMessage(page, { sceneType: 'tavern', id: 'msg-scene-1' })
    await expect(page.locator('img.scene-img-active')).toHaveAttribute(
      'src',
      /scenes\/tavern\//,
      { timeout: 3000 }
    )

    await dispatchSceneDmMessage(page, { sceneType: 'dungeon', id: 'msg-scene-2' })
    await expect(page.locator('img.scene-img-active')).toHaveAttribute(
      'src',
      /scenes\/dungeon\//,
      { timeout: 3000 }
    )
  })
})

test.describe('DIN-73 — Mood overlay CSS class', () => {
  test('mood overlay carries dnd-mood-combat class when scene_mood=combat', async ({
    page,
  }) => {
    await setupGameMocks(page)
    await gotoGame(page)

    await dispatchSceneDmMessage(page, { sceneType: 'dungeon', sceneMood: 'combat' })

    await expect(page.locator('[data-testid="mood-overlay"]')).toBeVisible({
      timeout: 3000,
    })
    await expect(page.locator('[data-testid="mood-overlay"]')).toHaveClass(
      /dnd-mood-combat/,
      { timeout: 3000 }
    )
    // Combat → variant 2 (dramatic)
    await expect(page.locator('img.scene-img-active')).toHaveAttribute(
      'src',
      /scenes\/dungeon\/2\.webp/,
      { timeout: 3000 }
    )
  })

  test('no mood overlay when DM message has no scene_mood', async ({ page }) => {
    await setupGameMocks(page)
    await gotoGame(page)

    await dispatchSceneDmMessage(page, { sceneType: 'forest' })

    // Image loads but no mood overlay
    await expect(page.locator('img.scene-img-active')).toHaveAttribute(
      'src',
      /scenes\/forest\//,
      { timeout: 3000 }
    )
    await expect(page.locator('[data-testid="mood-overlay"]')).toHaveCount(0)
  })
})

test.describe('DIN-73 — User preference: disable dynamic backgrounds', () => {
  test('SceneBackground not rendered when localStorage disables it', async ({ page }) => {
    await setupGameMocks(page)
    await page.addInitScript(() => {
      localStorage.setItem('realmAndRuin.dynamicBackgrounds', 'false')
    })
    await gotoGame(page)

    // SceneBackground returns null when enabled=false → no testid, no dim overlay
    await expect(page.locator('[data-testid="scene-background"]')).toHaveCount(0, {
      timeout: 3000,
    })
    await expect(page.locator('[data-testid="dim-overlay"]')).toHaveCount(0)
  })

  test('realm-prefs-changed event disables background in the active session', async ({
    page,
  }) => {
    await setupGameMocks(page)
    await gotoGame(page)

    // Background is present initially
    await expect(page.locator('[data-testid="scene-background"]')).toBeAttached({
      timeout: 3000,
    })

    // Simulate AccountView dispatching preference change
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('realm-prefs-changed', {
          detail: { enabled: false, reduceMotion: false },
        })
      )
    })

    await expect(page.locator('[data-testid="scene-background"]')).toHaveCount(0, {
      timeout: 3000,
    })
  })

  test('realm-prefs-changed event re-enables background after disable', async ({ page }) => {
    await setupGameMocks(page)
    await page.addInitScript(() => {
      localStorage.setItem('realmAndRuin.dynamicBackgrounds', 'false')
    })
    await gotoGame(page)

    // Starts disabled
    await expect(page.locator('[data-testid="scene-background"]')).toHaveCount(0, {
      timeout: 3000,
    })

    // Re-enable via event
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('realm-prefs-changed', {
          detail: { enabled: true, reduceMotion: false },
        })
      )
    })

    await expect(page.locator('[data-testid="scene-background"]')).toBeAttached({
      timeout: 3000,
    })
    await expect(page.locator('[data-testid="dim-overlay"]')).toBeVisible()
  })
})

test.describe('DIN-73 — Live scene update during SSE streaming', () => {
  test('scene block in SSE stream updates background before done event', async ({ page }) => {
    await setupGameMocks(page)

    await page.route(`**/api/games/${GAME_ID}/actions`, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 202,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'queued', message_id: 'msg-sse-1' }),
        })
      } else {
        await route.continue()
      }
    })

    const sseEvents = [
      { type: 'chunk', text: 'You enter the forest clearing.' },
      { type: 'block', tag: 'scene', attributes: { type: 'forest' }, content: '' },
      { type: 'chunk', text: ' Tall oaks tower around you.' },
      { type: 'done' },
    ]

    await page.route(`**/api/games/${GAME_ID}/events`, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue()
        return
      }
      await route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        body: sseEvents.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(''),
      })
    })

    await gotoGame(page)

    await page.getByTestId('chat-textarea').fill('I walk into the clearing.')
    await page.getByRole('button', { name: /Send/i }).click()

    // Scene background should update to forest after the scene block event
    await expect(page.locator('img.scene-img-active')).toHaveAttribute(
      'src',
      /scenes\/forest\//,
      { timeout: 5000 }
    )
  })

  test('scene block with mood in SSE stream applies mood overlay', async ({ page }) => {
    await setupGameMocks(page)

    await page.route(`**/api/games/${GAME_ID}/actions`, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 202,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'queued', message_id: 'msg-sse-2' }),
        })
      } else {
        await route.continue()
      }
    })

    const sseEvents = [
      { type: 'chunk', text: 'The cave grows dark.' },
      {
        type: 'block',
        tag: 'scene',
        attributes: { type: 'cave', mood: 'tense' },
        content: '',
      },
      { type: 'done' },
    ]

    await page.route(`**/api/games/${GAME_ID}/events`, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue()
        return
      }
      await route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        body: sseEvents.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(''),
      })
    })

    await gotoGame(page)

    await page.getByTestId('chat-textarea').fill('I peer into the darkness.')
    await page.getByRole('button', { name: /Send/i }).click()

    // tense mood → variant 4 (ominous) → /scenes/cave/4.webp
    await expect(page.locator('img.scene-img-active')).toHaveAttribute(
      'src',
      /scenes\/cave\/4\.webp/,
      { timeout: 5000 }
    )
    await expect(page.locator('[data-testid="mood-overlay"]')).toHaveClass(
      /dnd-mood-tense/,
      { timeout: 3000 }
    )
  })
})

test.describe('DIN-73 — Resume: scene derived from initial messages', () => {
  test('scene loads on mount when initial messages carry scene_type', async ({ page }) => {
    // Mock a game session where the last DM message already has scene_type set
    // (simulates returning to an in-progress game).
    await setupGameMocks(page, {
      initialSceneType: 'tavern',
      initialSceneMood: null,
    })
    await gotoGame(page)

    // Scene should be active immediately from the resumed state
    await expect(page.locator('img.scene-img-active')).toHaveAttribute(
      'src',
      /scenes\/tavern\//,
      { timeout: 3000 }
    )
  })

  test('resume with mood sets correct mood overlay', async ({ page }) => {
    await setupGameMocks(page, {
      initialSceneType: 'crypt',
      initialSceneMood: 'somber',
    })
    await gotoGame(page)

    await expect(page.locator('[data-testid="mood-overlay"]')).toHaveClass(
      /dnd-mood-somber/,
      { timeout: 3000 }
    )
    // somber → variant 3 (melancholic)
    await expect(page.locator('img.scene-img-active')).toHaveAttribute(
      'src',
      /scenes\/crypt\/3\.webp/,
      { timeout: 3000 }
    )
  })
})
