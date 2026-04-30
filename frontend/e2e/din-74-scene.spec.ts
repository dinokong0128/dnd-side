import { test, expect, Page } from '@playwright/test'

// ─── DIN-74 Part A: Scene continuity — <scene> block in SSE updates overlay ───
//
// DIN-74 Part A strengthens scene-continuity in the DM prompt (backend), but the
// corresponding frontend behaviour — parsing `{ type:'block', tag:'scene', ... }`
// SSE events and immediately updating `currentSceneType`/`currentSceneMood` — was
// already wired in DIN-66/DIN-73 and has no E2E coverage.
//
// These tests verify that the frontend correctly handles <scene> blocks from the
// SSE stream:
//
//   Event shape:
//     { type: 'block', tag: 'scene', attributes: { type: '...', mood?: '...' }, content: '' }
//
//   Expected outcomes:
//   A1 — scene-bg-active class appears on .dnd-page-bg when a <scene> block arrives
//   A2 — mood-overlay element renders with `dnd-mood-${mood}` class when mood set
//   A3 — mood-overlay is absent when no mood attribute is present
//   A4 — scene overlay updates (new mood class) when a second stream brings a
//        different scene/mood than the one loaded from DB messages
//   A5 — <scene> block tag text never leaks into the streaming DM bubble
// ─────────────────────────────────────────────────────────────────────────────

const GAME_ID = 'test-game-din74-scene'
const USER_ID = 'user-1'
const PLAYER_ID = 'player-1'

// ─── Shared setup ─────────────────────────────────────────────────────────────

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

// A no-scene DM message used to set isWaitingForDm=false when no history exists.
const INIT_DM_MSG: GameMessage = {
  id: 'msg-init-dm',
  game_id: GAME_ID,
  profile_id: null,
  role: 'dm',
  content: 'Your adventure begins.',
  scene_type: null,
  scene_mood: null,
  dice_rolls: null,
  created_at: '2026-01-01T00:00:00Z',
}

async function setupMocks(
  page: Page,
  options: {
    messages?: GameMessage[]
  } = {}
) {
  // Always include at least one DM message so isWaitingForDm=false on init.
  // (GameSessionView sets isWaitingForDm=true when latestData?.[0] is undefined.)
  const { messages = [INIT_DM_MSG] } = options

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
            name: 'The Continuity Spire',
            dm_persona: 'A vivid scene-setter',
            status: 'active',
            created_by: USER_ID,
            created_at: '2026-01-01T00:00:00Z',
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
            id: PLAYER_ID,
            game_id: GAME_ID,
            profile_id: USER_ID,
            character_name: 'Lyra',
            character_class: 'Ranger',
            race: 'Wood Elf',
            level: 3,
            hp_current: 24,
            hp_max: 24,
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

  await page.route('**.supabase.co/rest/v1/game_messages**', (route) => {
    if (route.request().method() === 'GET') {
      const url = route.request().url()
      const latestMsg = messages[0] ?? null
      if (url.includes('select=role')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(latestMsg ? [{ id: latestMsg.id, role: latestMsg.role, created_at: latestMsg.created_at }] : []),
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

async function mockStreamingAction(
  page: Page,
  sseEvents: object[],
  msgId = 'msg-1'
) {
  await page.route(`**/api/games/${GAME_ID}/actions`, async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ message_id: msgId, status: 'queued' }),
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
      body: sseEvents.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(''),
    })
  })
}

async function gotoGame(page: Page) {
  await page.goto(`/games/${GAME_ID}`)
  await expect(page.getByText('The Continuity Spire')).toBeVisible({ timeout: 8000 })
}

async function submitAction(page: Page, text: string) {
  const textarea = page.getByTestId('chat-textarea')
  await expect(textarea).toBeEnabled({ timeout: 5000 })
  await textarea.fill(text)
  await page.getByRole('button', { name: /Send/i }).click()
}

// ─── A1: <scene> block activates the scene overlay ────────────────────────────

test.describe('DIN-74 Part A — <scene> block in SSE activates scene overlay', () => {
  test('scene-bg-active class applied to page container after <scene> block in stream', async ({
    page,
  }) => {
    // Default: one no-scene DM message — textarea enabled, no initial scene
    await setupMocks(page)
    await mockStreamingAction(page, [
      { type: 'chunk', text: 'You enter the dungeon.' },
      {
        type: 'block',
        tag: 'scene',
        attributes: { type: 'dungeon', mood: 'tense' },
        content: '',
      },
      { type: 'done' },
    ])

    await gotoGame(page)

    // Before submitting, the page container does not have scene-bg-active
    // (game is active but sceneType is null → no scene)
    const container = page.locator('.dnd-page-bg')

    await submitAction(page, 'I step into the dungeon.')

    // After stream: scene block received → scene-bg-active must be applied
    await expect(container).toHaveClass(/scene-bg-active/, { timeout: 5000 })
  })

  test('scene-background-root element is in the DOM after <scene> block activates scene', async ({
    page,
  }) => {
    await setupMocks(page)
    await mockStreamingAction(page, [
      { type: 'chunk', text: 'The crypt door groans open.' },
      {
        type: 'block',
        tag: 'scene',
        attributes: { type: 'crypt', mood: 'somber' },
        content: '',
      },
      { type: 'done' },
    ])

    await gotoGame(page)
    await submitAction(page, 'I push the door.')

    // SceneBackground component renders once scene type is set
    await expect(page.getByTestId('scene-background-root')).toBeVisible({ timeout: 5000 })
  })
})

// ─── A2: <scene> block with mood renders mood overlay ─────────────────────────

test.describe('DIN-74 Part A — <scene> block with mood renders mood overlay', () => {
  test('mood-overlay element appears with correct dnd-mood-{mood} class', async ({
    page,
  }) => {
    await setupMocks(page)
    await mockStreamingAction(page, [
      { type: 'chunk', text: 'Swords ring out in the chamber.' },
      {
        type: 'block',
        tag: 'scene',
        attributes: { type: 'throne_room', mood: 'combat' },
        content: '',
      },
      { type: 'done' },
    ])

    await gotoGame(page)
    await submitAction(page, 'I draw my blade.')

    const moodOverlay = page.getByTestId('mood-overlay')
    await expect(moodOverlay).toBeVisible({ timeout: 5000 })
    await expect(moodOverlay).toHaveClass(/dnd-mood-combat/)
  })

  test('mood-overlay has dnd-mood-tense class when scene mood is tense', async ({
    page,
  }) => {
    await setupMocks(page)
    await mockStreamingAction(page, [
      { type: 'chunk', text: 'A shadow shifts in the corner.' },
      {
        type: 'block',
        tag: 'scene',
        attributes: { type: 'cave', mood: 'tense' },
        content: '',
      },
      { type: 'done' },
    ])

    await gotoGame(page)
    await submitAction(page, 'I hold my breath.')

    const moodOverlay = page.getByTestId('mood-overlay')
    await expect(moodOverlay).toBeVisible({ timeout: 5000 })
    await expect(moodOverlay).toHaveClass(/dnd-mood-tense/)
  })
})

// ─── A3: <scene> block without mood hides the mood overlay ────────────────────

test.describe('DIN-74 Part A — <scene> block without mood omits mood overlay', () => {
  test('mood-overlay is not rendered when <scene> block has no mood attribute', async ({
    page,
  }) => {
    await setupMocks(page)
    await mockStreamingAction(page, [
      { type: 'chunk', text: 'The forest opens before you.' },
      {
        type: 'block',
        tag: 'scene',
        attributes: { type: 'forest' }, // no mood
        content: '',
      },
      { type: 'done' },
    ])

    await gotoGame(page)
    await submitAction(page, 'I walk into the trees.')

    // Scene overlay activates (scene type set)
    await expect(page.locator('.dnd-page-bg')).toHaveClass(/scene-bg-active/, { timeout: 5000 })

    // But mood overlay must NOT be present
    await expect(page.getByTestId('mood-overlay')).toHaveCount(0)
  })
})

// ─── A4: Scene overlay updates when a new <scene> block brings a different scene

test.describe('DIN-74 Part A — Scene overlay updates when SSE stream carries new scene', () => {
  test('mood overlay changes from initial tense to mystery when SSE delivers throne_room/mystery', async ({
    page,
  }) => {
    // Page loads with dungeon/tense from a prior DM message
    const priorDmMsg: GameMessage = {
      id: 'msg-prior',
      game_id: GAME_ID,
      profile_id: null,
      role: 'dm',
      content: 'You stand at the dungeon entrance.',
      scene_type: 'dungeon',
      scene_mood: 'tense',
      dice_rolls: null,
      created_at: '2026-01-01T00:00:01Z',
    }

    await setupMocks(page, { messages: [priorDmMsg] })
    await mockStreamingAction(page, [
      { type: 'chunk', text: 'The throne room is revealed.' },
      {
        type: 'block',
        tag: 'scene',
        attributes: { type: 'throne_room', mood: 'mystery' },
        content: '',
      },
      { type: 'done' },
    ])

    await gotoGame(page)

    // Initial scene: dungeon/tense from DB messages
    const moodOverlay = page.getByTestId('mood-overlay')
    await expect(moodOverlay).toBeVisible({ timeout: 5000 })
    await expect(moodOverlay).toHaveClass(/dnd-mood-tense/)

    // Action triggers stream with new scene
    await submitAction(page, 'I push open the heavy doors.')

    // Mood overlay updates to mystery
    await expect(moodOverlay).toHaveClass(/dnd-mood-mystery/, { timeout: 5000 })
    await expect(moodOverlay).not.toHaveClass(/dnd-mood-tense/)
  })

  test('scene-bg-active persists after stream completes without a Realtime scene message', async ({
    page,
  }) => {
    await setupMocks(page)
    await mockStreamingAction(page, [
      { type: 'chunk', text: 'The tavern is warm and inviting.' },
      {
        type: 'block',
        tag: 'scene',
        attributes: { type: 'tavern', mood: 'victory' },
        content: '',
      },
      { type: 'done' },
    ])

    await gotoGame(page)
    await submitAction(page, 'I enter the tavern.')

    // Scene activated by SSE
    const container = page.locator('.dnd-page-bg')
    await expect(container).toHaveClass(/scene-bg-active/, { timeout: 5000 })

    // Dispatch Realtime DM INSERT without scene_type — scene state must NOT reset
    await page.evaluate(({ gameId }) => {
      window.dispatchEvent(
        new CustomEvent('dm-message', {
          detail: {
            id: 'msg-dm-confirmed',
            game_id: gameId,
            profile_id: null,
            role: 'dm',
            content: 'The tavern is warm and inviting.',
            scene_type: null,
            scene_mood: null,
            created_at: new Date().toISOString(),
          },
        })
      )
    }, { gameId: GAME_ID })

    // Scene overlay must still be active (SSE-set scene type persists)
    await expect(container).toHaveClass(/scene-bg-active/, { timeout: 3000 })
    await expect(page.getByTestId('mood-overlay')).toHaveClass(/dnd-mood-victory/)
  })
})

// ─── A3b: DB-loaded scene with type but no mood ────────────────────────────────
//
// When the most-recent DM message in the DB has scene_type but scene_mood=null,
// the frontend should activate the scene background (scene-bg-active) but NOT
// render a mood overlay. Complements A3 (which tests the same via SSE stream).

test.describe('DIN-74 Part A — DB-loaded scene with type but no mood activates background without mood overlay', () => {
  test('scene-bg-active set and mood-overlay absent when message has scene_type but null scene_mood', async ({
    page,
  }) => {
    const priorDmMsg: GameMessage = {
      id: 'msg-scene-no-mood',
      game_id: GAME_ID,
      profile_id: null,
      role: 'dm',
      content: 'You emerge into a vast coastal expanse.',
      scene_type: 'coast',
      scene_mood: null,
      dice_rolls: null,
      created_at: '2026-01-01T00:00:01Z',
    }

    await setupMocks(page, { messages: [priorDmMsg] })
    await gotoGame(page)

    // Scene overlay must activate (scene_type = 'coast')
    await expect(page.locator('.dnd-page-bg')).toHaveClass(/scene-bg-active/, {
      timeout: 5000,
    })

    // Mood overlay must NOT render (scene_mood is null)
    await expect(page.getByTestId('mood-overlay')).toHaveCount(0)
  })
})

// ─── A5: <scene> block does not leak tag text into the streaming bubble ────────

test.describe('DIN-74 Part A — <scene> block tag does not appear in streaming bubble', () => {
  test('scene type/mood values do not appear as text in the streaming bubble', async ({
    page,
  }) => {
    await setupMocks(page)
    await mockStreamingAction(page, [
      { type: 'chunk', text: 'The swamp stretches endlessly.' },
      {
        type: 'block',
        tag: 'scene',
        attributes: { type: 'swamp', mood: 'mystery' },
        content: '',
      },
      { type: 'chunk', text: ' You hear croaking in the distance.' },
      { type: 'done' },
    ])

    await gotoGame(page)
    await submitAction(page, 'I wade into the swamp.')

    const bubble = page.getByTestId('streaming-dm-message')
    await expect(bubble).toContainText('The swamp stretches endlessly.', { timeout: 3000 })
    await expect(bubble).toContainText('You hear croaking in the distance.')

    // Scene block must not leak into the bubble — no raw tag text or attribute values
    await expect(bubble).not.toContainText('<scene')
    await expect(bubble).not.toContainText('type="swamp"')
    await expect(bubble).not.toContainText('mood="mystery"')
  })

  test('scene block with all-caps type value does not bleed into chat (invalid type rejected gracefully)', async ({
    page,
  }) => {
    // Backend always emits valid types, but guard against invalid SSE data corrupting the UI
    await setupMocks(page)
    await mockStreamingAction(page, [
      { type: 'chunk', text: 'The air grows cold.' },
      {
        type: 'block',
        tag: 'scene',
        // Invalid type (not in SCENE_TYPES enum) — parseSceneTag returns null → state unchanged
        attributes: { type: 'INVALID_SCENE', mood: 'tense' },
        content: '',
      },
      { type: 'chunk', text: ' You shiver.' },
      { type: 'done' },
    ])

    await gotoGame(page)
    await submitAction(page, 'I look around nervously.')

    const bubble = page.getByTestId('streaming-dm-message')
    await expect(bubble).toContainText('The air grows cold.', { timeout: 3000 })
    await expect(bubble).toContainText('You shiver.')
    await expect(bubble).not.toContainText('<scene')
    await expect(bubble).not.toContainText('INVALID_SCENE')
  })
})
